const DATASET_URL = "./data/generated/lineage-dataset.json";
const SEARCH_RESULT_LIMIT = 10;

const graphContainer = document.getElementById("lineageGraph");
const peopleCount = document.getElementById("peopleCount");
const totalCount = document.getElementById("totalCount");
const unresolvedCount = document.getElementById("unresolvedCount");
const schoolCount = document.getElementById("schoolCount");
const relationCount = document.getElementById("relationCount");
const fitButton = document.getElementById("fitButton");
const layoutButton = document.getElementById("layoutButton");
const filterPolicy = document.getElementById("filterPolicy");
const graphTabs = [
  document.getElementById("graphTabForce"),
  document.getElementById("graphTabTree"),
].filter(Boolean);
const errorToast = document.getElementById("errorToast");
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const suggestions = document.getElementById("peopleSuggestions");
const schoolFilterToggle = document.getElementById("schoolFilterToggle");
const schoolFilterList = document.getElementById("schoolFilterList");
const resetFiltersButton = document.getElementById("resetFiltersButton");
const filtersPanel = document.getElementById("filtersPanel");
const personPanel = document.getElementById("personPanel");
const filtersToggle = document.getElementById("filtersToggle");
const filtersClose = document.getElementById("filtersClose");
const personToggle = document.getElementById("personToggle");
const personClose = document.getElementById("personClose");
const personName = document.getElementById("personName");
const personInstitution = document.getElementById("personInstitution");
const personLineageCount = document.getElementById("personLineageCount");
const educationList = document.getElementById("educationList");
const lineageList = document.getElementById("lineageList");
const sourceList = document.getElementById("sourceList");

let network;
let dataset;
let personById = new Map();
let personIdsByNameKey = new Map();
let inboundAdvisorIds = new Set();
let adviseesById = new Map();
let selectedPersonId = null;
let lastGraphIds = new Set();
let schoolFacet = [];
let graphMode = "force";

const WHEEL_ZOOM_FACTOR = 0.0015;
const institutionAliases = new Map([
  ["CISPA Helmholtz Center", "CISPA Helmholtz Center for Information Security"],
  ["德国CISPA亥姆霍兹信息安全中心", "CISPA Helmholtz Center for Information Security"],
  ["德国马克斯普朗克数学研究所（MPIM）; 德国汉诺威莱布尼兹大学", "Max Planck Institute for Mathematics; Leibniz University Hannover"],
  ["Delft University of Technology", "TU Delft"],
  ["电子科技大学", "UESTC"],
  ["法国巴黎萨克雷大学", "Paris-Saclay University"],
  ["复旦大学", "Fudan University"],
  ["海南大学", "Hainan University"],
  ["荷兰Radboud大学", "Radboud University"],
  ["华中科技大学", "Huazhong University of Science and Technology"],
  ["Indian Institute of Technology (IIT), Bombay", "Indian Institute of Technology Bombay"],
  ["暨南大学", "Jinan University"],
  ["Massachusetts Inst. of Technology", "Massachusetts Institute of Technology"],
  ["美国纽约大学石溪分校; 美国东北大学", "Stony Brook University; Northeastern University"],
  ["美国普渡大学", "Purdue University"],
  ["美国佐治亚理工学院", "Georgia Institute of Technology"],
  ["美国佐治亚理工学院，电子与计算机工程学院", "Georgia Institute of Technology"],
  ["南京邮电大学", "Nanjing University of Posts and Telecommunications"],
  ["山东大学", "Shandong University"],
  ["上海交通大学", "Shanghai Jiao Tong University"],
  ["天津大学", "Tianjin University"],
  ["Univ. of California - Berkeley", "University of California, Berkeley"],
  ["Univ. of Illinois at Urbana-Champaign", "University of Illinois Urbana-Champaign"],
  ["武汉大学", "Wuhan University"],
  ["香港理工大学", "Hong Kong Polytechnic University"],
  ["Zhejiang University, China", "Zhejiang University"],
  ["中国人民大学", "Renmin University of China"],
  ["浙江大学", "Zhejiang University"],
]);

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeInstitutionName(value) {
  if (!value) {
    return value;
  }

  return institutionAliases.get(value) ?? value;
}

function debounce(callback, delay) {
  let timer = null;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => callback(...args), delay);
  };
}

function createNodeOnce(nodes, nodeIds, node) {
  if (nodeIds.has(node.id)) {
    return;
  }

  nodes.push(node);
  nodeIds.add(node.id);
}

function buildPersonNameKey(value) {
  return value ? slugify(value) : "";
}

function findUniquePersonIdByName(name) {
  const key = buildPersonNameKey(name);
  if (!key) {
    return null;
  }

  const matches = personIdsByNameKey.get(key) || [];
  return matches.length === 1 ? matches[0] : null;
}

function splitAdvisorLabels(advisorLabel) {
  if (!advisorLabel) {
    return [];
  }

  return advisorLabel
    .split(/\s*(?:;|,|\band\b)\s*/i)
    .map((label) => label.trim())
    .filter(Boolean);
}

function resolveAdvisorEntries(stage) {
  if (!stage) {
    return [];
  }

  if (stage.advisorPersonId && personById.has(stage.advisorPersonId)) {
    return [
      {
        personId: stage.advisorPersonId,
        label: personById.get(stage.advisorPersonId).name,
      },
    ];
  }

  return splitAdvisorLabels(stage.advisorLabel).map((label) => ({
    personId: findUniquePersonIdByName(label),
    label,
  }));
}

function resolveAdvisorPersonId(stage) {
  return resolveAdvisorEntries(stage).find((entry) => entry.personId)?.personId || null;
}

function resolveGraphAdvisorNodeIds(stage, nodes, nodeIds, includedIds) {
  return resolveAdvisorEntries(stage)
    .map((entry) => {
      if (entry.personId && includedIds.has(entry.personId)) {
        return entry.personId;
      }

      if (entry.personId) {
        return null;
      }

      return addMentorFallbackNode(nodes, nodeIds, entry.label);
    })
    .filter(Boolean);
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

function hasAdvisorData(person) {
  return Boolean(
    person.stages.phd.advisorPersonId ||
      person.stages.phd.advisorLabel ||
      person.stages.postdoc.advisorPersonId ||
      person.stages.postdoc.advisorLabel
  );
}

function hasStudents(person) {
  return adviseesById.has(person.id);
}

function hasLineageSignal(person) {
  return hasAdvisorData(person) || inboundAdvisorIds.has(person.id);
}

function isTopSecurityImport(person) {
  if (person?.source?.url?.includes("top-authors-sys_sec")) {
    return true;
  }

  if (
    person?.sources?.some(
      (source) => source.kind === "ranking" && source.url?.includes("top-authors-sys_sec")
    )
  ) {
    return true;
  }

  return /top-authors system security ranking page/i.test(person?.tracking?.note || "");
}

function buildIndexes(people) {
  personById = new Map(people.map((person) => [person.id, person]));
  personIdsByNameKey = new Map();
  inboundAdvisorIds = new Set();
  adviseesById = new Map();

  for (const person of people) {
    const nameKey = buildPersonNameKey(person.name);
    if (!nameKey) {
      continue;
    }

    if (!personIdsByNameKey.has(nameKey)) {
      personIdsByNameKey.set(nameKey, []);
    }

    personIdsByNameKey.get(nameKey).push(person.id);
  }

  for (const person of people) {
    for (const stageName of ["phd", "postdoc"]) {
      resolveAdvisorEntries(person.stages[stageName]).forEach((entry) => {
        if (!entry.personId) {
          return;
        }

        inboundAdvisorIds.add(entry.personId);

        if (!adviseesById.has(entry.personId)) {
          adviseesById.set(entry.personId, []);
        }

        adviseesById.get(entry.personId).push({
          personId: person.id,
          name: person.name,
          relation: stageName === "phd" ? "PhD student" : "Postdoc",
        });
      });
    }
  }
}

function stageSchoolText(stage) {
  return normalizeInstitutionName(stage.school) || "Not recorded";
}

function stageAdvisorText(stage) {
  return resolveAdvisorEntries(stage)
    .map((entry) => (entry.personId && personById.has(entry.personId) ? personById.get(entry.personId).name : entry.label))
    .join("; ");
}

function collectSchools(person) {
  return [...new Set([
    normalizeInstitutionName(person.work.institution),
    normalizeInstitutionName(person.stages.undergraduate.school),
    normalizeInstitutionName(person.stages.masters.school),
    normalizeInstitutionName(person.stages.phd.school),
    normalizeInstitutionName(person.stages.postdoc.school),
  ].filter(Boolean))];
}

function buildSchoolFacet(people) {
  const counts = new Map();

  people.filter(hasLineageSignal).forEach((person) => {
    collectSchools(person).forEach((school) => {
      counts.set(school, (counts.get(school) || 0) + 1);
    });
  });

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function renderSchoolFilters() {
  schoolFilterList.innerHTML = schoolFacet
    .map(
      (school) => `
        <label class="checkbox-row school-row">
          <input type="checkbox" value="${escapeAttribute(school.name)}" />
          <span>${escapeHtml(school.name)}</span>
          <strong>${school.count}</strong>
        </label>
      `
    )
    .join("");
}

function getSelectedSchools() {
  return new Set(
    [...schoolFilterList.querySelectorAll('input[type="checkbox"]:checked')].map(
      (input) => input.value
    )
  );
}

function getSearchText(person) {
  return [
    person.name,
    normalizeInstitutionName(person.work.institution),
    person.summary,
    ...person.aliases,
    normalizeInstitutionName(person.stages.undergraduate.school),
    normalizeInstitutionName(person.stages.masters.school),
    normalizeInstitutionName(person.stages.phd.school),
    normalizeInstitutionName(person.stages.postdoc.school),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesInstitution(person, query) {
  if (!query) {
    return true;
  }

  return [
    normalizeInstitutionName(person.work.institution),
    normalizeInstitutionName(person.stages.undergraduate.school),
    normalizeInstitutionName(person.stages.masters.school),
    normalizeInstitutionName(person.stages.phd.school),
    normalizeInstitutionName(person.stages.postdoc.school),
  ]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(query));
}

function getFilters() {
  return {
    selectedSchools: getSelectedSchools(),
  };
}

function filterPeople(people, filters) {
  return people.filter((person) => {
    if (!hasLineageSignal(person)) {
      return false;
    }
    if (
      filters.selectedSchools.size > 0 &&
      !collectSchools(person).some((school) => filters.selectedSchools.has(school))
    ) {
      return false;
    }

    return true;
  });
}

function buildGraphData(people) {
  const nodes = [];
  const edges = [];
  const nodeIds = new Set();
  const includedIds = new Set(people.map((person) => person.id));

  people.forEach((person) => {
    createNodeOnce(nodes, nodeIds, {
      id: person.id,
      label: person.name,
      group: `person-${person.tracking.status}`,
      title: person.summary || person.name,
    });

    const phdAdvisorIds = resolveGraphAdvisorNodeIds(
      person.stages.phd,
      nodes,
      nodeIds,
      includedIds
    );
    const postdocAdvisorIds = resolveGraphAdvisorNodeIds(
      person.stages.postdoc,
      nodes,
      nodeIds,
      includedIds
    );

    phdAdvisorIds.forEach((advisorId) => {
      pushEdge(edges, advisorId, person.id, "PhD advisor", "#9e4f7f", true);
    });
    postdocAdvisorIds.forEach((advisorId) => {
      pushEdge(edges, advisorId, person.id, "Postdoc advisor", "#9e4f7f", true);
    });
  });

  return {
    nodes,
    edges,
    visiblePeopleCount: people.length,
    nodeIds,
    hierarchicalLevels: buildHierarchicalLevels(nodes, edges),
  };
}

function buildHierarchicalLevels(nodes, edges) {
  const parentIdsByNode = new Map(nodes.map((node) => [node.id, []]));
  const memo = new Map();

  for (const edge of edges) {
    if (!parentIdsByNode.has(edge.to) || !parentIdsByNode.has(edge.from)) {
      continue;
    }

    parentIdsByNode.get(edge.to).push(edge.from);
  }

  function resolveLevel(nodeId, stack = new Set()) {
    if (memo.has(nodeId)) {
      return memo.get(nodeId);
    }

    if (stack.has(nodeId)) {
      return 0;
    }

    stack.add(nodeId);
    const parentIds = parentIdsByNode.get(nodeId) || [];
    const level = parentIds.length
      ? Math.max(...parentIds.map((parentId) => resolveLevel(parentId, stack))) + 1
      : 0;
    stack.delete(nodeId);
    memo.set(nodeId, level);
    return level;
  }

  return new Map(nodes.map((node) => [node.id, resolveLevel(node.id)]));
}

function renderStats(filteredPeople, graphData) {
  const schools = new Set(filteredPeople.flatMap((person) => collectSchools(person)));
  const totalProfiles = dataset?.people?.length || filteredPeople.length;
  const unresolvedProfiles =
    dataset?.people?.filter(
      (person) => person.tracking?.status === "seed" && isTopSecurityImport(person)
    ).length || 0;

  peopleCount.textContent = `${filteredPeople.length} profiles`;
  totalCount.textContent = `${totalProfiles} total profiles`;
  unresolvedCount.textContent = `${unresolvedProfiles} unresolved profiles`;
  schoolCount.textContent = `${schools.size} schools`;
  relationCount.textContent = `${graphData.edges.length} lineage edges`;
}

function renderPolicy(filters, filteredPeople) {
  if (filters.selectedSchools.size === 0) {
    filterPolicy.textContent = `Showing ${filteredPeople.length} lineage-connected profiles across all schools.`;
    return;
  }

  const selectedSchools = [...filters.selectedSchools];
  const label =
    selectedSchools.length <= 3
      ? selectedSchools.join(", ")
      : `${selectedSchools.length} selected schools`;
  filterPolicy.textContent = `Showing ${filteredPeople.length} lineage-connected profiles for ${label}.`;
}

function buildForceGraphOptions(largeGraph) {
  return {
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
      dragNodes: true,
      dragView: true,
      hover: true,
      navigationButtons: false,
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
        strokeWidth: 0,
      },
      shadow: {
        enabled: true,
        color: "rgba(36, 24, 19, 0.14)",
        size: 16,
        x: 0,
        y: 8,
      },
    },
    groups: {
      "person-active": {
        color: { background: "#bf5a36", border: "#bf5a36", highlight: "#d87753" },
        size: 28,
      },
      "person-seed": {
        color: { background: "#19526d", border: "#19526d", highlight: "#2b6d8a" },
        size: 22,
      },
      "person-stub": {
        color: { background: "#8d8076", border: "#8d8076", highlight: "#a2968d" },
        size: 20,
      },
      mentor: {
        color: { background: "#8f3b76", border: "#8f3b76", highlight: "#a35089" },
        size: 22,
      },
    },
    edges: {
      width: largeGraph ? 1.3 : 2.1,
      color: {
        color: "rgba(143, 59, 118, 0.36)",
        highlight: "rgba(143, 59, 118, 0.7)",
        hover: "rgba(143, 59, 118, 0.82)",
        inherit: false,
        opacity: 1,
      },
      smooth: {
        enabled: true,
        type: largeGraph ? "continuous" : "dynamic",
      },
      font: {
        face: "IBM Plex Sans, Noto Sans SC, sans-serif",
        size: 0,
        color: "#6f5a4d",
        strokeWidth: 0,
      },
    },
  };
}

function buildTreeGraphOptions(largeGraph) {
  return {
    autoResize: true,
    layout: {
      improvedLayout: false,
    },
    physics: {
      enabled: false,
      stabilization: {
        enabled: false,
      },
    },
    interaction: {
      dragNodes: false,
      dragView: true,
      hover: true,
      navigationButtons: false,
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
        strokeWidth: 0,
      },
      shadow: {
        enabled: true,
        color: "rgba(36, 24, 19, 0.14)",
        size: 16,
        x: 0,
        y: 8,
      },
    },
    groups: {
      "person-active": {
        color: { background: "#bf5a36", border: "#bf5a36", highlight: "#d87753" },
        size: 28,
      },
      "person-seed": {
        color: { background: "#19526d", border: "#19526d", highlight: "#2b6d8a" },
        size: 22,
      },
      "person-stub": {
        color: { background: "#8d8076", border: "#8d8076", highlight: "#a2968d" },
        size: 20,
      },
      mentor: {
        color: { background: "#8f3b76", border: "#8f3b76", highlight: "#a35089" },
        size: 22,
      },
    },
    edges: {
      width: largeGraph ? 1.3 : 2.1,
      color: {
        color: "rgba(143, 59, 118, 0.36)",
        highlight: "rgba(143, 59, 118, 0.7)",
        hover: "rgba(143, 59, 118, 0.82)",
        inherit: false,
        opacity: 1,
      },
      smooth: {
        enabled: false,
      },
      font: {
        face: "IBM Plex Sans, Noto Sans SC, sans-serif",
        size: 0,
        color: "#6f5a4d",
        strokeWidth: 0,
      },
    },
  };
}

function buildGraphOptions(largeGraph) {
  return graphMode === "tree"
    ? buildTreeGraphOptions(largeGraph)
    : buildForceGraphOptions(largeGraph);
}

function renderGraphTabs() {
  graphTabs.forEach((tab) => {
    const active = tab.dataset.graphMode === graphMode;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });
}

function buildTreeNodePositions(graphData) {
  const parentIdsByNode = new Map(graphData.nodes.map((node) => [node.id, []]));
  const childIdsByNode = new Map(graphData.nodes.map((node) => [node.id, []]));
  const neighborIdsByNode = new Map(graphData.nodes.map((node) => [node.id, new Set()]));
  const nodeById = new Map(graphData.nodes.map((node) => [node.id, node]));

  for (const edge of graphData.edges) {
    if (!parentIdsByNode.has(edge.to) || !childIdsByNode.has(edge.from)) {
      continue;
    }

    parentIdsByNode.get(edge.to).push(edge.from);
    childIdsByNode.get(edge.from).push(edge.to);
    neighborIdsByNode.get(edge.from).add(edge.to);
    neighborIdsByNode.get(edge.to).add(edge.from);
  }

  const components = [];
  const seen = new Set();

  for (const node of graphData.nodes) {
    if (seen.has(node.id)) {
      continue;
    }

    const queue = [node.id];
    const component = [];
    seen.add(node.id);

    while (queue.length > 0) {
      const nodeId = queue.shift();
      component.push(nodeId);

      for (const neighborId of neighborIdsByNode.get(nodeId) || []) {
        if (seen.has(neighborId)) {
          continue;
        }

        seen.add(neighborId);
        queue.push(neighborId);
      }
    }

    components.push(component);
  }

  const levelGap = 220;
  const nodeGap = 170;
  const componentGap = 260;
  const positioned = new Map();
  let currentX = 0;

  const sortedComponents = components.sort((left, right) => {
    const leftMin = Math.min(...left.map((nodeId) => graphData.hierarchicalLevels.get(nodeId) || 0));
    const rightMin = Math.min(...right.map((nodeId) => graphData.hierarchicalLevels.get(nodeId) || 0));
    if (leftMin !== rightMin) {
      return leftMin - rightMin;
    }

    const leftLabel = nodeById.get(left[0])?.label || "";
    const rightLabel = nodeById.get(right[0])?.label || "";
    return leftLabel.localeCompare(rightLabel);
  });

  for (const component of sortedComponents) {
    const nodesByLevel = new Map();

    for (const nodeId of component) {
      const level = graphData.hierarchicalLevels.get(nodeId) || 0;
      if (!nodesByLevel.has(level)) {
        nodesByLevel.set(level, []);
      }
      nodesByLevel.get(level).push(nodeId);
    }

    const orderedLevels = [...nodesByLevel.keys()].sort((left, right) => left - right);
    const orderByNodeId = new Map();
    let componentWidth = 0;

    for (const level of orderedLevels) {
      const sortedNodeIds = nodesByLevel.get(level).sort((leftId, rightId) => {
        const leftParents = parentIdsByNode.get(leftId) || [];
        const rightParents = parentIdsByNode.get(rightId) || [];
        const leftScore = leftParents.length
          ? leftParents.reduce((sum, parentId) => sum + (orderByNodeId.get(parentId) || 0), 0) /
            leftParents.length
          : Number.POSITIVE_INFINITY;
        const rightScore = rightParents.length
          ? rightParents.reduce((sum, parentId) => sum + (orderByNodeId.get(parentId) || 0), 0) /
            rightParents.length
          : Number.POSITIVE_INFINITY;

        if (leftScore !== rightScore) {
          return leftScore - rightScore;
        }

        return (nodeById.get(leftId)?.label || "").localeCompare(nodeById.get(rightId)?.label || "");
      });

      sortedNodeIds.forEach((nodeId, index) => {
        orderByNodeId.set(nodeId, index);
      });

      componentWidth = Math.max(componentWidth, Math.max(sortedNodeIds.length - 1, 0) * nodeGap);
    }

    const componentCenterX = currentX + componentWidth / 2;

    for (const level of orderedLevels) {
      const sortedNodeIds = [...nodesByLevel.get(level)].sort(
        (leftId, rightId) => (orderByNodeId.get(leftId) || 0) - (orderByNodeId.get(rightId) || 0)
      );
      const rowWidth = Math.max(sortedNodeIds.length - 1, 0) * nodeGap;
      const rowStartX = componentCenterX - rowWidth / 2;

      sortedNodeIds.forEach((nodeId, index) => {
        positioned.set(nodeId, {
          x: rowStartX + index * nodeGap,
          y: level * levelGap,
        });
      });
    }

    currentX += componentWidth + componentGap;
  }

  return positioned;
}

function renderGraph(graphData) {
  const largeGraph = graphData.nodes.length > 180;
  const treePositions = graphMode === "tree" ? buildTreeNodePositions(graphData) : null;
  const nodes =
    graphMode === "tree"
      ? graphData.nodes.map((node) => ({
          ...node,
          ...(treePositions.get(node.id) || {}),
          fixed: {
            x: true,
            y: true,
          },
        }))
      : graphData.nodes;
  const data = {
    nodes: new vis.DataSet(nodes),
    edges: new vis.DataSet(graphData.edges),
  };
  const options = buildGraphOptions(largeGraph);

  if (network) {
    network.destroy();
  }

  network = new vis.Network(graphContainer, data, options);
  window.__lineageNetwork = network;
  network.on("selectNode", ({ nodes }) => {
    const nodeId = nodes[0];
    if (nodeId && personById.has(nodeId)) {
      selectPerson(nodeId, { focus: false });
    }
  });

  if (graphMode === "tree") {
    fitGraph(true);
    if (selectedPersonId && graphData.nodeIds.has(selectedPersonId)) {
      network.selectNodes([selectedPersonId]);
    }
  } else {
    network.once("stabilizationIterationsDone", () => {
      network.setOptions({ physics: false });
      fitGraph(true);
      if (selectedPersonId && graphData.nodeIds.has(selectedPersonId)) {
        network.selectNodes([selectedPersonId]);
      }
    });
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      fitGraph(false);
    });
  });

  lastGraphIds = graphData.nodeIds;
}

function renderEducation(person) {
  const stageEntries = [
    {
      label: "Bachelor",
      school: stageSchoolText(person.stages.undergraduate),
      detail: null,
    },
    {
      label: "Masters",
      school: stageSchoolText(person.stages.masters),
      detail: null,
    },
    {
      label: "PhD",
      school: stageSchoolText(person.stages.phd),
      detail: null,
    },
    {
      label: "Postdoc",
      school: stageSchoolText(person.stages.postdoc),
      detail: null,
    },
  ];

  educationList.innerHTML = stageEntries
    .map(
      (stage) => `
        <div class="timeline-row">
          <dt>${escapeHtml(stage.label)}</dt>
          <dd>
            <strong>${escapeHtml(stage.school)}</strong>
            ${stage.detail ? `<span>${escapeHtml(stage.detail)}</span>` : ""}
          </dd>
        </div>
      `
    )
    .join("");
}

function renderLineage(person) {
  const items = [];
  const pushPersonTag = (label, targetId, fallbackLabel) => {
    const text = targetId && personById.has(targetId) ? personById.get(targetId).name : fallbackLabel;
    if (!text) {
      return;
    }

    items.push(
      `<button class="tag-button" type="button" data-person-id="${targetId || ""}">${escapeHtml(
        `${label}: ${text}`
      )}</button>`
    );
  };

  resolveAdvisorEntries(person.stages.phd).forEach((entry) => {
    pushPersonTag("PhD advisor", entry.personId, entry.label);
  });
  resolveAdvisorEntries(person.stages.postdoc).forEach((entry) => {
    pushPersonTag("Postdoc advisor", entry.personId, entry.label);
  });

  const advisees = adviseesById.get(person.id) || [];
  advisees.forEach((advisee) => {
    items.push(
      `<button class="tag-button" type="button" data-person-id="${advisee.personId}">${escapeHtml(
        `${advisee.relation}: ${advisee.name}`
      )}</button>`
    );
  });

  lineageList.innerHTML = items.length
    ? items.join("")
    : `<p class="empty-copy">No linked advisors or descendants in the current dataset.</p>`;
}

function renderSources(person) {
  const sourceItems = [
    {
      kind: person.source.label,
      url: person.source.url,
      confidence: "primary",
    },
    ...person.sources.map((source) => ({
      kind: source.kind,
      url: source.url,
      confidence: source.confidence,
    })),
  ];

  sourceList.innerHTML = sourceItems
    .map(
      (source) => `
        <article class="source-card">
          <div class="source-head">
            <span>${escapeHtml(source.kind)}</span>
            <span class="confidence-pill">${escapeHtml(source.confidence)}</span>
          </div>
          <a href="${escapeAttribute(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(
            readableUrl(source.url)
          )}</a>
        </article>
      `
    )
    .join("");
}

function buildLineageCountSummary(person) {
  const advisorCount =
    resolveAdvisorEntries(person.stages.phd).length +
    resolveAdvisorEntries(person.stages.postdoc).length;
  const descendantCount = (adviseesById.get(person.id) || []).length;

  const parts = [];
  parts.push(`${advisorCount} advisor${advisorCount === 1 ? "" : "s"}`);
  parts.push(`${descendantCount} descendant${descendantCount === 1 ? "" : "s"}`);
  return parts.join(" • ");
}

function renderEmptyPersonPanel(message) {
  personName.textContent = "No selection";
  personInstitution.textContent = "Unavailable";
  personLineageCount.textContent = "Unavailable";
  educationList.innerHTML = "";
  lineageList.innerHTML = `<p class="empty-copy">${escapeHtml(message)}</p>`;
  sourceList.innerHTML = "";
}

function renderPersonPanel(personId) {
  const person = personById.get(personId);
  if (!person) {
    return;
  }

  personName.textContent = person.name;
  personInstitution.textContent = normalizeInstitutionName(person.work.institution) || "Not recorded";
  personLineageCount.textContent = buildLineageCountSummary(person);
  renderEducation(person);
  renderLineage(person);
  renderSources(person);
}

function selectPerson(personId, { focus = true } = {}) {
  if (!personById.has(personId)) {
    return;
  }

  selectedPersonId = personId;
  renderPersonPanel(personId);
  personPanel.classList.add("is-open");

  if (window.matchMedia("(max-width: 1279px)").matches) {
    document.body.classList.add("person-open");
  }

  if (network && lastGraphIds.has(personId)) {
    network.selectNodes([personId]);
    if (focus) {
      network.focus(personId, {
        scale: Math.max(0.8, network.getScale()),
        animation: {
          duration: 260,
          easingFunction: "easeInOutQuad",
        },
      });
    }
  }
}

function focusFirstSearchMatch() {
  const query = searchInput.value.trim().toLowerCase();
  if (!query || !dataset) {
    return;
  }

  const matchingPeople = dataset.people.filter((person) => getSearchText(person).includes(query));
  const match = matchingPeople.find((person) => lastGraphIds.has(person.id)) || matchingPeople[0];
  if (!match) {
    showError(`No people matched "${searchInput.value.trim()}".`);
    return;
  }

  clearError();
  selectPerson(match.id);
  if (!lastGraphIds.has(match.id)) {
    showError("Match found outside the current graph filters. Relax filters to visualize this person.");
  }
}

function updateSuggestions() {
  if (!dataset) {
    return;
  }

  const query = searchInput.value.trim().toLowerCase();
  if (!query) {
    suggestions.innerHTML = "";
    return;
  }

  const matches = dataset.people
    .filter((person) => getSearchText(person).includes(query))
    .slice(0, SEARCH_RESULT_LIMIT);

  suggestions.innerHTML = matches
    .map(
      (person) =>
        `<option value="${escapeAttribute(person.name)}">${escapeHtml(
          person.work.institution || ""
        )}</option>`
    )
    .join("");
}

function renderApp() {
  if (!dataset) {
    return;
  }

  const filters = getFilters();
  const filteredPeople = filterPeople(dataset.people, filters);
  const graphData = buildGraphData(filteredPeople);

  renderStats(filteredPeople, graphData);
  renderPolicy(filters, filteredPeople);
  renderGraph(graphData);

  if (!filteredPeople.length) {
    selectedPersonId = null;
    renderEmptyPersonPanel("No records match the current filter combination.");
    return;
  }

  if (selectedPersonId && personById.has(selectedPersonId)) {
    renderPersonPanel(selectedPersonId);
    if (!graphData.nodeIds.has(selectedPersonId)) {
      network.unselectAll();
    }
  } else if (filteredPeople[0]) {
    renderPersonPanel(filteredPeople[0].id);
    selectedPersonId = filteredPeople[0].id;
  }
}

function showError(message) {
  errorToast.hidden = false;
  errorToast.textContent = message;
}

function clearError() {
  errorToast.hidden = true;
  errorToast.textContent = "";
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

function zoomGraphOut() {
  if (!network) {
    return;
  }

  zoomGraphTo(network.getScale() * 0.88);
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

function resetFilters() {
  schoolFilterList.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.checked = false;
  });
  renderApp();
}

function attachInspectorActions() {
  lineageList.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-person-id]");
    if (!trigger) {
      return;
    }

    const personId = trigger.dataset.personId;
    if (!personId) {
      return;
    }

    selectPerson(personId);
  });
}

function attachPanelToggles() {
  filtersToggle?.addEventListener("click", () => {
    document.body.classList.add("filters-open");
    filtersPanel.classList.add("is-open");
  });
  filtersClose?.addEventListener("click", () => {
    document.body.classList.remove("filters-open");
    filtersPanel.classList.remove("is-open");
  });
  personToggle?.addEventListener("click", () => {
    document.body.classList.add("person-open");
    personPanel.classList.add("is-open");
  });
  personClose?.addEventListener("click", () => {
    document.body.classList.remove("person-open");
    personPanel.classList.remove("is-open");
  });
}

function attachEvents() {
  const rerender = debounce(() => {
    clearError();
    renderApp();
  }, 120);

  graphTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const nextMode = tab.dataset.graphMode;
      if (!nextMode || nextMode === graphMode) {
        return;
      }

      graphMode = nextMode;
      renderGraphTabs();
      renderApp();
    });
  });

  schoolFilterToggle.addEventListener("click", () => {
    const expanded = schoolFilterToggle.getAttribute("aria-expanded") === "true";
    schoolFilterToggle.setAttribute("aria-expanded", String(!expanded));
    schoolFilterList.classList.toggle("is-collapsed", expanded);
    schoolFilterToggle.querySelector(".facet-toggle-icon").textContent = expanded ? "+" : "−";
  });
  schoolFilterList.addEventListener("change", rerender);

  searchInput.addEventListener("input", debounce(updateSuggestions, 80));
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      focusFirstSearchMatch();
    }
  });
  searchButton.addEventListener("click", focusFirstSearchMatch);

  fitButton.addEventListener("click", () => {
    fitGraph(true);
  });

  layoutButton.addEventListener("click", () => {
    if (!network) {
      return;
    }

    if (graphMode === "tree") {
      fitGraph(true);
      return;
    }

    network.setOptions({ physics: { enabled: true } });
    network.stabilize(180);
    window.setTimeout(() => {
      network?.setOptions({ physics: false });
      fitGraph(true);
    }, 260);
  });

  resetFiltersButton.addEventListener("click", resetFilters);
  window.addEventListener("resize", () => {
    fitGraph(false);
    if (window.innerWidth >= 1280) {
      document.body.classList.remove("filters-open", "person-open");
      filtersPanel.classList.remove("is-open");
      personPanel.classList.add("is-open");
    }
  });

  attachInspectorActions();
  attachPanelToggles();
}

async function loadDataset() {
  if (window.location?.protocol === "file:") {
    return loadDatasetFromScript();
  }

  let response;
  try {
    response = await fetch(DATASET_URL, { cache: "no-store" });
  } catch (error) {
    throw error;
  }

  if (!response.ok) {
    if (window.location?.protocol === "file:") {
      return loadDatasetFromScript();
    }
    throw new Error(`Failed to load dataset: ${response.status}`);
  }

  return response.json();
}

async function loadDatasetFromScript() {
  if (window.__LINEAGE_DATASET__) {
    return window.__LINEAGE_DATASET__;
  }

  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "./data/generated/lineage-dataset.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Failed to load fallback dataset script"));
    document.head.append(script);
  });

  if (!window.__LINEAGE_DATASET__) {
    throw new Error("Fallback dataset script loaded without dataset payload");
  }

  return window.__LINEAGE_DATASET__;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

function readableUrl(value) {
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./, "") + url.pathname;
  } catch {
    return value;
  }
}

async function init() {
  try {
    dataset = await loadDataset();
    buildIndexes(dataset.people);
    schoolFacet = buildSchoolFacet(dataset.people);
    renderSchoolFilters();
    renderGraphTabs();
    attachEvents();
    attachWheelZoom();
    updateSuggestions();
    renderApp();
  } catch (error) {
    showError(error.message);
  }
}

window.addEventListener("load", init);
