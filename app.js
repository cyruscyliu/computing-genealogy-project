const DATASET_URL = "./data/generated/lineage-dataset.json";

const graphContainer = document.getElementById("lineageGraph");
const peopleCount = document.getElementById("peopleCount");
const schoolCount = document.getElementById("schoolCount");
const relationCount = document.getElementById("relationCount");
const fitButton = document.getElementById("fitButton");
const layoutButton = document.getElementById("layoutButton");
const filterPolicy = document.getElementById("filterPolicy");
const errorToast = document.getElementById("errorToast");

let network;

const WHEEL_ZOOM_FACTOR = 0.0015;

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createNodeOnce(nodes, nodeIds, node) {
  if (nodeIds.has(node.id)) {
    return;
  }

  nodes.push(node);
  nodeIds.add(node.id);
}

function addSchoolNode(nodes, nodeIds, schoolName) {
  if (!schoolName) {
    return null;
  }

  const id = `school:${slugify(schoolName)}`;
  createNodeOnce(nodes, nodeIds, {
    id,
    label: schoolName,
    group: "school",
    title: schoolName,
  });
  return id;
}

function addMentorFallbackNode(nodes, nodeIds, mentorName) {
  if (!mentorName) {
    return null;
  }

  const id = `mentor:${slugify(mentorName)}`;
  createNodeOnce(nodes, nodeIds, {
    id,
    label: mentorName,
    group: "mentor",
    title: mentorName,
  });
  return id;
}

function pushEdge(edges, from, to, label, color, dashes = false) {
  if (!from || !to) {
    return;
  }

  edges.push({
    from,
    to,
    label,
    arrows: "to",
    color: { color },
    dashes,
  });
}

function hasLineageSignal(person, inboundAdvisorIds) {
  return Boolean(
      person.stages.phd.advisorPersonId ||
      person.stages.phd.advisorLabel ||
      person.stages.postdoc.advisorPersonId ||
      person.stages.postdoc.advisorLabel ||
      inboundAdvisorIds.has(person.id)
  );
}

function buildGraphData(people) {
  const inboundAdvisorIds = new Set();
  people.forEach((person) => {
    if (person.stages.phd.advisorPersonId) {
      inboundAdvisorIds.add(person.stages.phd.advisorPersonId);
    }
    if (person.stages.postdoc.advisorPersonId) {
      inboundAdvisorIds.add(person.stages.postdoc.advisorPersonId);
    }
  });

  const visiblePeople = people.filter((person) => hasLineageSignal(person, inboundAdvisorIds));
  const nodes = [];
  const edges = [];
  const nodeIds = new Set();

  visiblePeople.forEach((person) => {
    createNodeOnce(nodes, nodeIds, {
      id: person.id,
      label: person.name,
      group: "person",
      title: person.summary || person.name,
    });

    const phdAdvisorId = person.stages.phd.advisorPersonId
      ? person.stages.phd.advisorPersonId
      : addMentorFallbackNode(nodes, nodeIds, person.stages.phd.advisorLabel);
    const postdocAdvisorId = person.stages.postdoc.advisorPersonId
      ? person.stages.postdoc.advisorPersonId
      : addMentorFallbackNode(nodes, nodeIds, person.stages.postdoc.advisorLabel);

    pushEdge(edges, phdAdvisorId, person.id, "PhD advisor", "#8f3b76", true);
    pushEdge(edges, postdocAdvisorId, person.id, "Postdoc advisor", "#8f3b76", true);
  });

  return {
    nodes,
    edges,
    visiblePeopleCount: visiblePeople.length,
  };
}

function renderStats(meta, graphData) {
  peopleCount.textContent = `${graphData.visiblePeopleCount} Visible / ${meta.stats.peopleCount} Total`;
  schoolCount.textContent = `${meta.stats.stageCoverage.work} Work Institutions`;
  relationCount.textContent = `${graphData.edges.length} Edges`;
  filterPolicy.textContent =
    `Default view: show lineage-bearing profiles and advisor links only. Institution nodes are hidden by default, but work and degree metadata are still collected in the dataset.`;
}

function renderGraph(graphData) {
  const largeGraph = graphData.nodes.length > 180;
  const data = {
    nodes: new vis.DataSet(graphData.nodes),
    edges: new vis.DataSet(graphData.edges),
  };

  const options = {
    autoResize: true,
    layout: {
      improvedLayout: true,
    },
    physics: {
      enabled: true,
      stabilization: {
        enabled: true,
        iterations: largeGraph ? 250 : 180,
        fit: true,
      },
      barnesHut: {
        gravitationalConstant: largeGraph ? -5800 : -7200,
        centralGravity: 0.12,
        springLength: largeGraph ? 120 : 150,
        springConstant: 0.04,
        damping: 0.3,
      },
    },
    interaction: {
      hover: true,
      navigationButtons: true,
      keyboard: true,
    },
    nodes: {
      shape: "dot",
      size: 22,
      borderWidth: 0,
      font: {
        face: "IBM Plex Sans, Noto Sans SC, sans-serif",
        size: 17,
        color: "#241813",
      },
      shadow: {
        enabled: true,
        color: "rgba(36, 24, 19, 0.16)",
        size: 16,
        x: 0,
        y: 8,
      },
    },
    groups: {
      person: {
        color: {
          background: "#bf5a36",
          border: "#bf5a36",
        },
        size: 28,
      },
      school: {
        color: {
          background: "#19526d",
          border: "#19526d",
        },
        size: 20,
      },
      mentor: {
        color: {
          background: "#8f3b76",
          border: "#8f3b76",
        },
        size: 24,
      },
    },
    edges: {
      width: largeGraph ? 1.3 : 2.1,
      smooth: {
        enabled: true,
        type: largeGraph ? "continuous" : "dynamic",
      },
      font: {
        face: "IBM Plex Sans, Noto Sans SC, sans-serif",
        size: largeGraph ? 0 : 13,
        color: "#6f5a4d",
        strokeWidth: 0,
      },
    },
  };

  if (network) {
    network.destroy();
  }

  network = new vis.Network(graphContainer, data, options);
  network.once("stabilizationIterationsDone", () => {
    network.setOptions({ physics: false });
    fitGraph(true);
  });
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      fitGraph(false);
    });
  });
}

async function loadDataset() {
  const response = await fetch(DATASET_URL);
  if (!response.ok) {
    throw new Error(`Failed to load dataset: ${response.status}`);
  }

  return response.json();
}

function showError(message) {
  errorToast.hidden = false;
  errorToast.textContent = message;
}

function fitGraph(animated = true) {
  if (!network) {
    return;
  }

  network.redraw();
  network.fit({
    animation: animated
      ? {
          duration: 220,
          easingFunction: "easeInOutQuad",
        }
      : false,
  });
}

function zoomGraphTo(scale) {
  if (!network) {
    return;
  }

  const position = network.getViewPosition();
  network.moveTo({
    position,
    scale,
    animation: {
      duration: 160,
      easingFunction: "easeInOutQuad",
    },
  });
}

function attachWheelZoom() {
  graphContainer.addEventListener(
    "wheel",
    (event) => {
      if (!network) {
        return;
      }

      event.preventDefault();
      const currentScale = network.getScale();
      const nextScale = Math.min(
        3,
        Math.max(0.08, currentScale * Math.exp(-event.deltaY * WHEEL_ZOOM_FACTOR))
      );
      zoomGraphTo(nextScale);
    },
    { passive: false }
  );
}

async function init() {
  try {
    const dataset = await loadDataset();
    const graphData = buildGraphData(dataset.people);
    renderStats(dataset, graphData);
    renderGraph(graphData);
    attachWheelZoom();

    window.addEventListener("resize", () => {
      fitGraph(false);
    });

    fitButton.addEventListener("click", () => {
      fitGraph(true);
    });

    layoutButton.addEventListener("click", () => {
      if (!network) {
        return;
      }

      network.setOptions({ physics: { enabled: true } });
      network.stabilize(180);
      window.setTimeout(() => {
        network?.setOptions({ physics: false });
        fitGraph(true);
      }, 260);
    });
  } catch (error) {
    showError(error.message);
  }
}

window.addEventListener("load", init);
