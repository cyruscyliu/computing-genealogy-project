const DATASET_URL = "./data/generated/lineage-dataset.json";
const SEARCH_RESULT_LIMIT = 10;

const graphContainers = {
  force: document.getElementById("lineageGraphForce"),
  tree: document.getElementById("lineageGraphTree"),
  "rank-hire": document.getElementById("lineageGraphRankHire"),
  "rank-lineage": document.getElementById("lineageGraphRankLineage"),
  "school-detail": document.getElementById("lineageGraphSchoolDetail"),
};
const totalCount = document.getElementById("totalCount");
const inbreedingCount = document.getElementById("inbreedingCount");
const internalLineageCount = document.getElementById("internalLineageCount");
const unresolvedCount = document.getElementById("unresolvedCount");
const treeCount = document.getElementById("treeCount");
const schoolCount = document.getElementById("schoolCount");
const relationCount = document.getElementById("relationCount");
const fitButton = document.getElementById("fitButton");
const layoutButton = document.getElementById("layoutButton");
const sharedSchoolToggle = document.getElementById("sharedSchoolToggle");
const filterPolicy = document.getElementById("filterPolicy");
const forceLegend = document.getElementById("forceLegend");
const graphTabs = [
  document.getElementById("graphTabForce"),
  document.getElementById("graphTabTree"),
  document.getElementById("graphTabRankHire"),
  document.getElementById("graphTabRankLineage"),
  document.getElementById("graphTabSchoolDetail"),
].filter(Boolean);
const errorToast = document.getElementById("errorToast");
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const relationshipInputA = document.getElementById("relationshipInputA");
const relationshipInputB = document.getElementById("relationshipInputB");
const relationshipButton = document.getElementById("relationshipButton");
const relationshipResult = document.getElementById("relationshipResult");
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
let hoveredPersonId = null;
let selectedFamilyNodeId = null;
let selectedSchoolDetail = null;
let showSharedSchoolLinks = false;
let forceFamilyNodeIdByPersonId = new Map();
let forceRepresentativePersonIdByNodeId = new Map();
let forceFamilyPersonIdsByNodeId = new Map();
let forceFamilyComponentNodeIdsByNodeId = new Map();
const networkByMode = {
  force: null,
  tree: null,
};
const lastGraphIdsByMode = {
  force: new Set(),
  tree: new Set(),
};
const graphSignatureByMode = {
  force: null,
  tree: null,
};

const WHEEL_ZOOM_FACTOR = 0.0015;
const MIN_VISIBLE_FAMILY_SIZE = 4;
const institutionAliases = new Map(globalThis.__INSTITUTION_ALIASES__ || []);
const FORCE_3D_BASE_NODE_SIZE = 6;
const FORCE_3D_SELECTED_NODE_SIZE = 9;
const FORCE_3D_HOVERED_NODE_SIZE = 7.5;
const FORCE_3D_FOCUS_DISTANCE = 160;
const FORCE_3D_COLORS = {
  "person-active": "#bf5a36",
  "person-seed": "#19526d",
  "person-stub": "#8d8076",
  mentor: "#8f3b76",
};
const FORCE_3D_HIGHLIGHT = "#f3b45e";
const FORCE_3D_HOVER = "#d88d45";

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

function stripAdvisorHonorifics(value) {
  if (!value) {
    return value;
  }

  return value
    .replace(/\b(?:Prof(?:essor)?|Dr)\.?\s*/gi, "")
    .replace(/\s*(?:教授|院士)\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitAdvisorLabels(advisorLabel) {
  if (!advisorLabel) {
    return [];
  }

  return advisorLabel
    .split(/\s*(?:;|,|、|，|\band\b|和)\s*/i)
    .map((label) => stripAdvisorHonorifics(label))
    .filter(Boolean);
}

function resolveAdvisorEntries(stage) {
  if (!stage) {
    return [];
  }

  const entries = [];
  const seen = new Set();

  if (stage.advisorPersonId && personById.has(stage.advisorPersonId)) {
    const linkedAdvisor = personById.get(stage.advisorPersonId);
    entries.push({
      personId: stage.advisorPersonId,
      label: linkedAdvisor.name,
    });
    seen.add(`person:${stage.advisorPersonId}`);
    seen.add(`label:${buildPersonNameKey(linkedAdvisor.name)}`);
  }

  splitAdvisorLabels(stage.advisorLabel).forEach((label) => {
    const personId = findUniquePersonIdByName(label);
    const labelKey = `label:${buildPersonNameKey(label)}`;
    const personKey = personId ? `person:${personId}` : null;
    if ((personKey && seen.has(personKey)) || seen.has(labelKey)) {
      return;
    }
    if (personKey) {
      seen.add(personKey);
    }
    seen.add(labelKey);
    entries.push({ personId, label });
  });

  return entries;
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
        const person = personById.get(entry.personId);
        if (!person) {
          return null;
        }

        createNodeOnce(nodes, nodeIds, {
          id: person.id,
          label: person.name,
          group: `person-${person.tracking.status}`,
          title: person.summary || person.name,
        });
        return person.id;
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

function pushUndirectedEdge(edges, from, to, label, color, dashes = false) {
  if (!from || !to) {
    return;
  }

  edges.push({
    from,
    to,
    label,
    color: { color },
    dashes,
  });
}

function graphNodeBaseColor(group) {
  return FORCE_3D_COLORS[group] || FORCE_3D_COLORS["person-stub"];
}

function setSelectedFamily(nodeId) {
  selectedFamilyNodeId = nodeId || null;
  updateForceLegend();
}

function syncSelectedFamilyForPerson(personId) {
  setSelectedFamily(forceFamilyNodeIdByPersonId.get(personId) || null);
}

function activeForceSelectionNodeId() {
  return selectedFamilyNodeId;
}

function graphNodeColor(node) {
  if (node.id === activeForceSelectionNodeId()) {
    return FORCE_3D_HIGHLIGHT;
  }

  if (node.id === hoveredPersonId) {
    return FORCE_3D_HOVER;
  }

  return node.color || graphNodeBaseColor(node.group);
}

function graphNodeSize(node) {
  if (node.id === activeForceSelectionNodeId()) {
    return FORCE_3D_SELECTED_NODE_SIZE;
  }

  if (node.id === hoveredPersonId) {
    return FORCE_3D_HOVERED_NODE_SIZE;
  }

  return node.size || FORCE_3D_BASE_NODE_SIZE;
}

function graphLinkEndpointId(endpoint) {
  if (!endpoint) {
    return null;
  }

  return typeof endpoint === "object" ? endpoint.id : endpoint;
}

function graphLinkColor(link) {
  const activeSelectionNodeId = activeForceSelectionNodeId();
  if (!activeSelectionNodeId) {
    return link.color;
  }

  const sourceId = graphLinkEndpointId(link.source);
  const targetId = graphLinkEndpointId(link.target);
  return sourceId === activeSelectionNodeId || targetId === activeSelectionNodeId
    ? "rgba(191, 90, 54, 0.9)"
    : link.color;
}

function isForce3DGraph(value) {
  return value?.__graphKind === "force-3d";
}

function getActiveGraph() {
  return networkByMode[graphMode];
}

function syncGlobalNetworkReference() {
  network = getActiveGraph();
  window.__lineageNetwork = network;
}

function currentForceGraphContainerSize() {
  const container = graphContainers.force;
  return {
    width: Math.max(container?.clientWidth || 0, 320),
    height: Math.max(container?.clientHeight || 0, 320),
  };
}

function selectedGraphNodeIdForMode(mode) {
  if (mode === "force") {
    return activeForceSelectionNodeId();
  }

  return selectedPersonId;
}

function updateForceLegend() {
  if (!forceLegend) {
    return;
  }

  if (graphMode !== "force") {
    forceLegend.classList.remove("is-active");
    return;
  }

  forceLegend.classList.add("is-active");
  const selectedFamilyId = activeForceSelectionNodeId();
  const forceGraph = networkByMode.force;
  const graphData = forceGraph?.__graphData;

  if (!selectedFamilyId || !graphData) {
    forceLegend.innerHTML = `
      <strong>Edge meaning</strong>
      <span><em>Postdoc bridge</em>: a postdoc advisor connects two lineage families.</span>
      ${showSharedSchoolLinks ? "<span><em>Shared school</em>: two families share at least one school.</span>" : ""}
    `;
    return;
  }

  const selectedNode = graphData.nodes.find((node) => node.id === selectedFamilyId);
  const relatedEdges = graphData.links.filter((link) => {
    const sourceId = graphLinkEndpointId(link.source);
    const targetId = graphLinkEndpointId(link.target);
    return sourceId === selectedFamilyId || targetId === selectedFamilyId;
  });

  if (!selectedNode) {
    forceLegend.innerHTML = `
      <strong>Edge meaning</strong>
      <span><em>Postdoc bridge</em>: a postdoc advisor connects two lineage families.</span>
      ${showSharedSchoolLinks ? "<span><em>Shared school</em>: two families share at least one school.</span>" : ""}
    `;
    return;
  }

  const meaningLines = [];
  const incomingPostdocBridgeCount = relatedEdges.filter((edge) => {
    const sourceId = graphLinkEndpointId(edge.source);
    const targetId = graphLinkEndpointId(edge.target);
    return edge.label === "Postdoc bridge" && targetId === selectedFamilyId && sourceId !== selectedFamilyId;
  }).length;
  const outgoingPostdocBridgeCount = relatedEdges.filter((edge) => {
    const sourceId = graphLinkEndpointId(edge.source);
    const targetId = graphLinkEndpointId(edge.target);
    return edge.label === "Postdoc bridge" && sourceId === selectedFamilyId && targetId !== selectedFamilyId;
  }).length;
  const sharedSchoolCount = relatedEdges.filter((edge) => edge.label === "Shared school").length;

  if (incomingPostdocBridgeCount > 0 || outgoingPostdocBridgeCount > 0) {
    meaningLines.push(
      `<span><em>Postdoc bridge</em>: ${incomingPostdocBridgeCount} incoming, ${outgoingPostdocBridgeCount} outgoing.</span>`
    );
  }
  if (sharedSchoolCount > 0) {
    meaningLines.push(
      `<span><em>Shared school</em>: ${sharedSchoolCount} shared-school links.</span>`
    );
  }

  forceLegend.innerHTML = `
    <strong>${escapeHtml(selectedNode.label)}</strong>
    <span>${escapeHtml(`${selectedNode.familySize || 0} people • ${relatedEdges.length} cross-family links`)}</span>
    ${meaningLines.join("") || "<span>This family currently has no visible cross-family links.</span>"}
  `;
}

function updateForce3DGraphAppearance(graph) {
  if (!isForce3DGraph(graph)) {
    return;
  }

  graph.nodeColor(graphNodeColor);
  graph.nodeVal(graphNodeSize);
  graph.linkColor(graphLinkColor);
  graph.linkWidth((link) => (graphLinkColor(link) === link.color ? 1.2 : 2.2));
  graph.linkDirectionalArrowColor((link) => graphLinkColor(link));
  graph.refresh();
}

function focusForce3DNode(graph, nodeId, scale = 1, duration = 260) {
  if (!isForce3DGraph(graph) || !nodeId) {
    return;
  }

  const node = graph.__nodeLookup.get(nodeId);
  if (!node) {
    return;
  }

  const distance = FORCE_3D_FOCUS_DISTANCE / Math.max(scale, 0.35);
  const magnitude = Math.hypot(node.x || 0, node.y || 0, node.z || 0) || 1;
  const ratio = 1 + distance / magnitude;

  graph.cameraPosition(
    {
      x: (node.x || 0) * ratio,
      y: (node.y || 0) * ratio,
      z: (node.z || 0) * ratio,
    },
    { x: node.x || 0, y: node.y || 0, z: node.z || 0 },
    duration
  );
}

function resizeForce3DGraph(graph) {
  if (!isForce3DGraph(graph)) {
    return;
  }

  const { width, height } = currentForceGraphContainerSize();
  graph.width(width).height(height);
}

function setSelectedNode(nodeId) {
  selectedPersonId = nodeId;

  Object.values(networkByMode).forEach((graph) => {
    if (isForce3DGraph(graph)) {
      updateForce3DGraphAppearance(graph);
    }
  });
}

function createForce3DGraphData(graphData) {
  return {
    nodes: graphData.nodes.map((node) => ({
      ...node,
      color: graphNodeBaseColor(node.group),
      size:
        node.group === "person-active"
          ? FORCE_3D_BASE_NODE_SIZE + 1.4
          : node.group === "mentor"
            ? FORCE_3D_BASE_NODE_SIZE + 0.8
            : FORCE_3D_BASE_NODE_SIZE,
    })),
    links: graphData.edges.map((edge) => ({
      source: edge.from,
      target: edge.to,
      label: edge.label,
      color: edge.color?.color || "rgba(143, 59, 118, 0.36)",
    })),
  };
}

function buildForce3DLabel(node) {
  const person = personById.get(node.representativePersonId || node.id);
  const institution = person
    ? normalizeInstitutionName(person.work.institution) || "Not recorded"
    : "Family aggregate";
  const familySummary = node.familySize
    ? `${node.familySize} people • ${node.schoolCount || 0} schools`
    : institution;

  return `
    <strong>${escapeHtml(node.label)}</strong>
    <br />
    <span>${escapeHtml(familySummary)}</span>
    <br />
    <span>${escapeHtml(institution)}</span>
  `;
}

function createForce3DGraph(container, graphData, largeGraph) {
  if (typeof ForceGraph3D !== "function") {
    throw new Error("3D graph library failed to load.");
  }

  const graph = new ForceGraph3D(container, {
    controlType: "trackball",
    rendererConfig: {
      alpha: true,
      antialias: !largeGraph,
    },
  });
  const graphPayload = createForce3DGraphData(graphData);

  graph.__graphKind = "force-3d";
  graph.__nodeLookup = new Map(graphPayload.nodes.map((node) => [node.id, node]));
  graph.__graphData = graphPayload;

  resizeForce3DGraph(graph);
  graph
    .backgroundColor("rgba(0,0,0,0)")
    .showNavInfo(false)
    .numDimensions(3)
    .warmupTicks(largeGraph ? 80 : 40)
    .cooldownTicks(largeGraph ? 220 : 160)
    .d3VelocityDecay(0.28)
    .nodeLabel(buildForce3DLabel)
    .nodeColor(graphNodeColor)
    .nodeVal(graphNodeSize)
    .nodeOpacity(0.96)
    .linkColor(graphLinkColor)
    .linkWidth((link) => (graphLinkColor(link) === link.color ? 1.2 : 2.2))
    .linkOpacity(0.34)
    .linkDirectionalArrowLength((link) => (link.label === "Postdoc bridge" ? 4 : 0))
    .linkDirectionalArrowRelPos(1)
    .linkDirectionalArrowColor((link) => graphLinkColor(link))
    .linkCurvature(0.06)
    .onNodeHover((node) => {
      hoveredPersonId = node?.id || null;
      updateForce3DGraphAppearance(graph);
    })
    .onNodeClick((node) => {
      const targetPersonId = node?.representativePersonId || node?.id;
      if (targetPersonId && personById.has(targetPersonId)) {
        setSelectedFamily(node.id);
        selectPerson(targetPersonId, { focus: false });
      }
    })
    .onNodeDragEnd((node) => {
      node.fx = node.x;
      node.fy = node.y;
      node.fz = node.z;
    })
    .graphData(graphPayload);

  const chargeForce = graph.d3Force("charge");
  if (chargeForce?.strength) {
    chargeForce.strength(largeGraph ? -160 : -220);
  }

  const linkForce = graph.d3Force("link");
  if (linkForce?.distance) {
    linkForce.distance(largeGraph ? 70 : 95);
  }

  return graph;
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

function isMissingCorePhdLineage(person) {
  return Boolean(
    !person?.stages?.phd?.school ||
      !(person?.stages?.phd?.advisorPersonId || person?.stages?.phd?.advisorLabel)
  );
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

function getSearchRank(person, query) {
  const normalizedQuery = buildPersonNameKey(query);
  const normalizedName = buildPersonNameKey(person.name);
  const normalizedAliases = person.aliases.map((alias) => buildPersonNameKey(alias)).filter(Boolean);
  const searchText = getSearchText(person);

  if (normalizedName === normalizedQuery) {
    return 0;
  }

  if (normalizedAliases.includes(normalizedQuery)) {
    return 1;
  }

  if (normalizedName.startsWith(normalizedQuery)) {
    return 2;
  }

  if (normalizedAliases.some((alias) => alias.startsWith(normalizedQuery))) {
    return 3;
  }

  if (normalizedName.includes(normalizedQuery)) {
    return 4;
  }

  if (normalizedAliases.some((alias) => alias.includes(normalizedQuery))) {
    return 5;
  }

  if (searchText.includes(query)) {
    return 6;
  }

  return Number.POSITIVE_INFINITY;
}

function findMatchingPeople(query) {
  if (!dataset) {
    return [];
  }

  return dataset.people
    .map((person) => ({
      person,
      rank: getSearchRank(person, query),
    }))
    .filter((entry) => Number.isFinite(entry.rank))
    .sort((left, right) => {
      if (left.rank !== right.rank) {
        return left.rank - right.rank;
      }

      return left.person.name.localeCompare(right.person.name);
    })
    .map((entry) => entry.person);
}

function findBestMatchingPerson(query) {
  return findMatchingPeople(query.trim().toLowerCase())[0] || null;
}

function buildPhdLineageMaps() {
  const parentsByPerson = new Map();
  const childrenByPerson = new Map();

  for (const person of dataset?.people || []) {
    parentsByPerson.set(person.id, []);
    childrenByPerson.set(person.id, []);
  }

  for (const person of dataset?.people || []) {
    const advisorIds = resolveAdvisorEntries(person.stages.phd)
      .map((entry) => entry.personId)
      .filter((personId) => personId && parentsByPerson.has(personId));

    parentsByPerson.set(person.id, advisorIds);

    for (const advisorId of advisorIds) {
      childrenByPerson.get(advisorId).push(person.id);
    }
  }

  return { parentsByPerson, childrenByPerson };
}

function computeDirectionalDistances(startId, neighborMap) {
  const distances = new Map([[startId, 0]]);
  const queue = [startId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    const currentDistance = distances.get(currentId);

    for (const neighborId of neighborMap.get(currentId) || []) {
      if (distances.has(neighborId)) {
        continue;
      }

      distances.set(neighborId, currentDistance + 1);
      queue.push(neighborId);
    }
  }

  return distances;
}

function describeAncestorRelationship(ancestorName, descendantName, generations) {
  if (generations === 1) {
    return `${ancestorName} is ${descendantName}'s PhD advisor.`;
  }

  if (generations === 2) {
    return `${ancestorName} is ${descendantName}'s academic grand-advisor.`;
  }

  return `${ancestorName} is ${descendantName}'s academic ancestor ${generations} generations up.`;
}

function describeDescendantRelationship(descendantName, ancestorName, generations) {
  if (generations === 1) {
    return `${descendantName} is ${ancestorName}'s PhD student.`;
  }

  if (generations === 2) {
    return `${descendantName} is ${ancestorName}'s academic grandstudent.`;
  }

  return `${descendantName} is ${ancestorName}'s academic descendant ${generations} generations down.`;
}

function describeCollateralRelationship(personA, personB, commonAncestor, distanceA, distanceB) {
  if (distanceA === 1 && distanceB === 1) {
    return `${personA.name} and ${personB.name} are academic siblings with the same PhD advisor: ${commonAncestor.name}.`;
  }

  if (distanceA === 1 && distanceB === 2) {
    return `${personA.name} is ${personB.name}'s academic aunt/uncle through the PhD lineage of ${commonAncestor.name}.`;
  }

  if (distanceA === 2 && distanceB === 1) {
    return `${personA.name} is ${personB.name}'s academic niece/nephew through the PhD lineage of ${commonAncestor.name}.`;
  }

  if (distanceA === distanceB) {
    return `${personA.name} and ${personB.name} are academic cousins under the common PhD ancestor ${commonAncestor.name}.`;
  }

  if (distanceA < distanceB) {
    return `${personA.name} is in a senior collateral branch to ${personB.name} under the common PhD ancestor ${commonAncestor.name}.`;
  }

  return `${personB.name} is in a senior collateral branch to ${personA.name} under the common PhD ancestor ${commonAncestor.name}.`;
}

function computeRelationshipDescription(personA, personB) {
  if (!dataset) {
    return null;
  }

  if (personA.id === personB.id) {
    return `${personA.name} and ${personB.name} are the same person.`;
  }

  const { parentsByPerson, childrenByPerson } = buildPhdLineageMaps();
  const ancestorsFromA = computeDirectionalDistances(personA.id, parentsByPerson);
  const ancestorsFromB = computeDirectionalDistances(personB.id, parentsByPerson);

  if (ancestorsFromA.has(personB.id)) {
    return describeAncestorRelationship(personB.name, personA.name, ancestorsFromA.get(personB.id));
  }

  if (ancestorsFromB.has(personA.id)) {
    return describeDescendantRelationship(personB.name, personA.name, ancestorsFromB.get(personA.id));
  }

  const commonAncestorIds = [...ancestorsFromA.keys()].filter((personId) => ancestorsFromB.has(personId));
  if (!commonAncestorIds.length) {
    return `${personA.name} and ${personB.name} are not connected in the current PhD genealogy data.`;
  }

  commonAncestorIds.sort((leftId, rightId) => {
    const leftScore = ancestorsFromA.get(leftId) + ancestorsFromB.get(leftId);
    const rightScore = ancestorsFromA.get(rightId) + ancestorsFromB.get(rightId);
    if (leftScore !== rightScore) {
      return leftScore - rightScore;
    }

    return leftId.localeCompare(rightId);
  });

  const commonAncestor = personById.get(commonAncestorIds[0]);
  return describeCollateralRelationship(
    personA,
    personB,
    commonAncestor,
    ancestorsFromA.get(commonAncestor.id),
    ancestorsFromB.get(commonAncestor.id)
  );
}

function showRelationshipResult(message) {
  relationshipResult.hidden = false;
  relationshipResult.textContent = message;
}

function findRelationshipBetweenPeople() {
  const queryA = relationshipInputA.value.trim();
  const queryB = relationshipInputB.value.trim();

  if (!queryA || !queryB) {
    showRelationshipResult("Enter two people to compute their PhD-lineage relationship.");
    return;
  }

  const personA = findBestMatchingPerson(queryA);
  const personB = findBestMatchingPerson(queryB);

  if (!personA || !personB) {
    showRelationshipResult("Could not resolve one or both people in the current dataset.");
    return;
  }

  showRelationshipResult(computeRelationshipDescription(personA, personB));
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
  return buildForceFamilyGraphData(people);
}

function buildDescendantCountMap(edges) {
  const childIdsByNode = new Map();

  edges.forEach((edge) => {
    if (edge.label !== "PhD advisor") {
      return;
    }

    if (!childIdsByNode.has(edge.from)) {
      childIdsByNode.set(edge.from, []);
    }
    childIdsByNode.get(edge.from).push(edge.to);
    if (!childIdsByNode.has(edge.to)) {
      childIdsByNode.set(edge.to, []);
    }
  });

  const memo = new Map();

  function resolve(nodeId, stack = new Set()) {
    if (memo.has(nodeId)) {
      return memo.get(nodeId);
    }

    if (stack.has(nodeId)) {
      return new Set();
    }

    stack.add(nodeId);
    const descendants = new Set();

    for (const childId of childIdsByNode.get(nodeId) || []) {
      descendants.add(childId);
      resolve(childId, stack).forEach((descendantId) => descendants.add(descendantId));
    }

    stack.delete(nodeId);
    memo.set(nodeId, descendants);
    return descendants;
  }

  return new Map([...childIdsByNode.keys()].map((nodeId) => [nodeId, resolve(nodeId).size]));
}

function chooseFamilyRepresentative(personIds, edges, descendantCountByPersonId) {
  const parentIdsByNode = new Map(personIds.map((personId) => [personId, []]));

  edges.forEach((edge) => {
    if (edge.label !== "PhD advisor") {
      return;
    }
    if (parentIdsByNode.has(edge.to) && parentIdsByNode.has(edge.from)) {
      parentIdsByNode.get(edge.to).push(edge.from);
    }
  });

  return [...personIds].sort((leftId, rightId) => {
    const leftParents = parentIdsByNode.get(leftId)?.length || 0;
    const rightParents = parentIdsByNode.get(rightId)?.length || 0;
    if (leftParents !== rightParents) {
      return leftParents - rightParents;
    }

    const descendantDelta =
      (descendantCountByPersonId.get(rightId) || 0) - (descendantCountByPersonId.get(leftId) || 0);
    if (descendantDelta !== 0) {
      return descendantDelta;
    }

    return (personById.get(leftId)?.name || leftId).localeCompare(personById.get(rightId)?.name || rightId);
  })[0];
}

function buildFamilyStructures(treeGraphData) {
  const familyComponents = getConnectedComponents(treeGraphData.nodes, treeGraphData.edges);
  const descendantCountByPersonId = buildDescendantCountMap(treeGraphData.edges);
  const familyNodeIdByPersonId = new Map();
  const representativePersonIdByFamilyNodeId = new Map();
  const familyPersonIdsByNodeId = new Map();
  const familyComponentNodeIdsByNodeId = new Map();
  const familyDescriptors = [];

  familyComponents.forEach((componentNodeIds, index) => {
    const personIds = componentNodeIds.filter((nodeId) => personById.has(nodeId));
    if (!personIds.length) {
      return;
    }

    const familyNodeId = `family:${index + 1}`;
    const representativePersonId = chooseFamilyRepresentative(
      personIds,
      treeGraphData.edges,
      descendantCountByPersonId
    );
    const representative = personById.get(representativePersonId);
    const schoolCount = new Set(
      personIds.flatMap((personId) => collectSchools(personById.get(personId))).filter(Boolean)
    ).size;

    familyDescriptors.push({
      id: familyNodeId,
      label: representative?.name || `Family ${index + 1}`,
      group: representative ? `person-${representative.tracking.status}` : "person-seed",
      title:
        `${representative?.name || `Family ${index + 1}`}\n` +
        `${personIds.length} people\n` +
        `${schoolCount} schools`,
      size: 10 + Math.sqrt(personIds.length) * 4,
      color: representative
        ? graphNodeBaseColor(`person-${representative.tracking.status}`)
        : graphNodeBaseColor("person-seed"),
      familySize: personIds.length,
      representativePersonId,
      schoolCount,
    });

    personIds.forEach((personId) => familyNodeIdByPersonId.set(personId, familyNodeId));
    representativePersonIdByFamilyNodeId.set(familyNodeId, representativePersonId);
    familyPersonIdsByNodeId.set(familyNodeId, personIds);
    familyComponentNodeIdsByNodeId.set(familyNodeId, componentNodeIds);
  });

  return {
    familyDescriptors,
    familyNodeIdByPersonId,
    representativePersonIdByFamilyNodeId,
    familyPersonIdsByNodeId,
    familyComponentNodeIdsByNodeId,
    descendantCountByPersonId,
  };
}

function syncFamilyStructures(familyStructures) {
  forceFamilyNodeIdByPersonId = familyStructures.familyNodeIdByPersonId;
  forceRepresentativePersonIdByNodeId = familyStructures.representativePersonIdByFamilyNodeId;
  forceFamilyPersonIdsByNodeId = familyStructures.familyPersonIdsByNodeId;
  forceFamilyComponentNodeIdsByNodeId = familyStructures.familyComponentNodeIdsByNodeId;

  if (selectedPersonId) {
    syncSelectedFamilyForPerson(selectedPersonId);
  }
}

function buildForceFamilyGraphDataFromStructures(people, treeGraphData, familyStructures) {
  const nodes = [...familyStructures.familyDescriptors];
  const edges = [];
  const familyEdgeByKey = new Map();
  const registerFamilyEdge = (sourceFamilyId, targetFamilyId, label, weight, directed = false) => {
    if (!sourceFamilyId || !targetFamilyId || sourceFamilyId === targetFamilyId) {
      return;
    }

    const from = directed ? sourceFamilyId : [sourceFamilyId, targetFamilyId].sort()[0];
    const to = directed ? targetFamilyId : [sourceFamilyId, targetFamilyId].sort()[1];
    const key = directed ? `${label}|${from}|${to}` : `${label}|${from}|${to}`;
    const existing = familyEdgeByKey.get(key);
    if (!existing || existing.weight < weight) {
      familyEdgeByKey.set(key, { from, to, label, weight, directed });
    }
  };

  people.forEach((person) => {
    const personFamilyId = familyStructures.familyNodeIdByPersonId.get(person.id);
    if (!personFamilyId) {
      return;
    }

    resolveAdvisorEntries(person.stages.postdoc).forEach((entry) => {
      registerFamilyEdge(
        personFamilyId,
        familyStructures.familyNodeIdByPersonId.get(entry.personId),
        "Postdoc bridge",
        2,
        true
      );
    });
  });

  const familyIdsBySchool = new Map();
  people.forEach((person) => {
    const familyId = familyStructures.familyNodeIdByPersonId.get(person.id);
    if (!familyId) {
      return;
    }

    collectSchools(person).forEach((school) => {
      if (!school) {
        return;
      }
      if (!familyIdsBySchool.has(school)) {
        familyIdsBySchool.set(school, new Set());
      }
      familyIdsBySchool.get(school).add(familyId);
    });
  });

  familyIdsBySchool.forEach((familyIds) => {
    if (!showSharedSchoolLinks) {
      return;
    }

    const ids = [...familyIds];
    if (ids.length < 2) {
      return;
    }
    for (let index = 0; index < ids.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < ids.length; otherIndex += 1) {
        registerFamilyEdge(ids[index], ids[otherIndex], "Shared school", 1);
      }
    }
  });

  familyEdgeByKey.forEach((entry) => {
    if (entry.label === "Shared school") {
      pushUndirectedEdge(
        edges,
        entry.from,
        entry.to,
        entry.label,
        "#24627b",
        false
      );
      return;
    }

    pushEdge(
      edges,
      entry.from,
      entry.to,
      entry.label,
      "#d88d45",
      false
    );
  });

  return {
    nodes,
    edges,
    visiblePeopleCount: treeGraphData.visiblePeopleCount,
    nodeIds: new Set(nodes.map((node) => node.id)),
    hierarchicalLevels: new Map(),
    treeCount: treeGraphData.treeCount,
  };
}

function buildTreeGraphData(people) {
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

    phdAdvisorIds.forEach((advisorId) => {
      pushEdge(edges, advisorId, person.id, "PhD advisor", "#9e4f7f", true);
    });
  });

  return pruneSmallFamilyComponents({
    nodes,
    edges,
    visiblePeopleCount: people.length,
    nodeIds,
    hierarchicalLevels: buildHierarchicalLevels(nodes, edges),
    treeHeights: buildTreeHeights(nodes, edges),
    treeCount: countConnectedComponents(nodes, edges),
  });
}

function buildSelectedFamilyTreeGraphData(treeGraphData) {
  if (!selectedFamilyNodeId || !forceFamilyComponentNodeIdsByNodeId.has(selectedFamilyNodeId)) {
    return {
      ...treeGraphData,
      nodes: [],
      edges: [],
      nodeIds: new Set(),
      visiblePeopleCount: 0,
      hierarchicalLevels: new Map(),
      treeHeights: new Map(),
    };
  }

  const visibleNodeIds = new Set(forceFamilyComponentNodeIdsByNodeId.get(selectedFamilyNodeId));
  const nodes = treeGraphData.nodes.filter((node) => visibleNodeIds.has(node.id));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = treeGraphData.edges.filter(
    (edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to)
  );

  return {
    ...treeGraphData,
    nodes,
    edges,
    nodeIds,
    visiblePeopleCount: nodes.filter((node) => personById.has(node.id)).length,
    hierarchicalLevels: buildHierarchicalLevels(nodes, edges),
    treeHeights: buildTreeHeights(nodes, edges),
    treeCount: treeGraphData.treeCount,
  };
}

function getConnectedComponents(nodes, edges) {
  const neighborIdsByNode = new Map(nodes.map((node) => [node.id, new Set()]));

  for (const edge of edges) {
    if (!neighborIdsByNode.has(edge.from) || !neighborIdsByNode.has(edge.to)) {
      continue;
    }

    neighborIdsByNode.get(edge.from).add(edge.to);
    neighborIdsByNode.get(edge.to).add(edge.from);
  }

  const seen = new Set();
  const components = [];

  for (const node of nodes) {
    if (seen.has(node.id)) {
      continue;
    }

    const queue = [node.id];
    const componentNodeIds = [];
    seen.add(node.id);

    while (queue.length > 0) {
      const nodeId = queue.shift();
      componentNodeIds.push(nodeId);
      for (const neighborId of neighborIdsByNode.get(nodeId) || []) {
        if (seen.has(neighborId)) {
          continue;
        }

        seen.add(neighborId);
        queue.push(neighborId);
      }
    }

    components.push(componentNodeIds);
  }

  return components;
}

function countConnectedComponents(nodes, edges) {
  return getConnectedComponents(nodes, edges).length;
}

function pruneSmallFamilyComponents(graphData) {
  const components = getConnectedComponents(graphData.nodes, graphData.edges);
  const visibleNodeIds = new Set();

  components.forEach((componentNodeIds) => {
    const visiblePeopleInComponent = componentNodeIds.filter((nodeId) => personById.has(nodeId)).length;
    if (visiblePeopleInComponent >= MIN_VISIBLE_FAMILY_SIZE) {
      componentNodeIds.forEach((nodeId) => visibleNodeIds.add(nodeId));
    }
  });

  const nodes = graphData.nodes.filter((node) => visibleNodeIds.has(node.id));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = graphData.edges.filter(
    (edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to)
  );

  return {
    ...graphData,
    nodes,
    edges,
    nodeIds,
    visiblePeopleCount: nodes.filter((node) => personById.has(node.id)).length,
    hierarchicalLevels: buildHierarchicalLevels(nodes, edges),
    treeHeights: graphData.treeHeights ? buildTreeHeights(nodes, edges) : undefined,
    treeCount: graphData.treeCount !== undefined ? countConnectedComponents(nodes, edges) : undefined,
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

function buildTreeHeights(nodes, edges) {
  const childIdsByNode = new Map(nodes.map((node) => [node.id, []]));
  const memo = new Map();

  for (const edge of edges) {
    if (!childIdsByNode.has(edge.from) || !childIdsByNode.has(edge.to)) {
      continue;
    }

    childIdsByNode.get(edge.from).push(edge.to);
  }

  function resolveHeight(nodeId, stack = new Set()) {
    if (memo.has(nodeId)) {
      return memo.get(nodeId);
    }

    if (stack.has(nodeId)) {
      return 0;
    }

    stack.add(nodeId);
    const childIds = childIdsByNode.get(nodeId) || [];
    const height = childIds.length
      ? Math.max(...childIds.map((childId) => resolveHeight(childId, stack))) + 1
      : 0;
    stack.delete(nodeId);
    memo.set(nodeId, height);
    return height;
  }

  return new Map(nodes.map((node) => [node.id, resolveHeight(node.id)]));
}

function computePersonCoverage(person) {
  const checks = [
    Boolean(person?.work?.institution),
    Boolean(person?.stages?.undergraduate?.school),
    Boolean(person?.stages?.masters?.school),
    Boolean(person?.stages?.phd?.school),
    Boolean(person?.stages?.phd?.advisorPersonId || person?.stages?.phd?.advisorLabel),
    Boolean(person?.stages?.postdoc?.school),
    Boolean(person?.stages?.postdoc?.advisorPersonId || person?.stages?.postdoc?.advisorLabel),
  ];
  const filled = checks.filter(Boolean).length;
  return {
    filled,
    total: checks.length,
    ratio: checks.length === 0 ? 0 : filled / checks.length,
  };
}

function collectVisiblePeopleFromGraphData(graphData, filteredPeople) {
  const filteredPeopleById = new Map(
    (filteredPeople || []).map((person) => [person.id, person])
  );
  const visiblePersonIds = new Set();

  for (const node of graphData.nodes || []) {
    if (filteredPeopleById.has(node.id) || personById.has(node.id)) {
      visiblePersonIds.add(node.id);
      continue;
    }

    const familyPersonIds = forceFamilyPersonIdsByNodeId.get(node.id) || [];
    for (const personId of familyPersonIds) {
      if (personById.has(personId)) {
        visiblePersonIds.add(personId);
      }
    }
  }

  return [...visiblePersonIds]
    .map((personId) => filteredPeopleById.get(personId) || personById.get(personId))
    .filter(Boolean);
}

function isCurrentPhdStudent(person) {
  const phdStatus = String(person.stages?.phd?.status || "").toLowerCase();
  const phdNote = String(person.stages?.phd?.note || "").toLowerCase();
  const studentPattern =
    /\b(ph\.?d\.?\s*student|doctoral student|student listing|student|candidate)\b|博士研究生|博士生/;

  return studentPattern.test(phdStatus) || studentPattern.test(phdNote);
}

function isEligibleSameSchoolHireCase(person) {
  return Boolean(
    !isCurrentPhdStudent(person) &&
      normalizeInstitutionName(person.work?.institution) &&
      normalizeInstitutionName(person.stages?.phd?.school) &&
      person.stages?.phd?.graduationYear != null
  );
}

function isEligibleInternalLineageCase(person) {
  return Boolean(
    !isCurrentPhdStudent(person) &&
      normalizeInstitutionName(person.work?.institution) &&
      person.stages?.phd?.graduationYear != null
  );
}

function buildSameSchoolHireRanking(people) {
  const statsBySchool = new Map();

  people.forEach((person) => {
    if (!isEligibleSameSchoolHireCase(person)) {
      return;
    }

    const workSchool = normalizeInstitutionName(person.work?.institution);
    const phdSchool = normalizeInstitutionName(person.stages?.phd?.school);
    if (!workSchool || !phdSchool) {
      return;
    }

    if (!statsBySchool.has(workSchool)) {
      statsBySchool.set(workSchool, {
        school: workSchool,
        known: 0,
        sameSchool: 0,
      });
    }

    const stats = statsBySchool.get(workSchool);
    stats.known += 1;
    if (workSchool === phdSchool) {
      stats.sameSchool += 1;
    }
  });

  const rows = [...statsBySchool.values()]
    .map((entry) => ({
      ...entry,
      rate: entry.known === 0 ? 0 : entry.sameSchool / entry.known,
    }))
    .filter((entry) => entry.known > 0)
    .sort((left, right) => {
      if (right.rate !== left.rate) {
        return right.rate - left.rate;
      }
      if (right.sameSchool !== left.sameSchool) {
        return right.sameSchool - left.sameSchool;
      }
      if (right.known !== left.known) {
        return right.known - left.known;
      }
      return left.school.localeCompare(right.school);
    });

  return rows;
}

function buildInternalLineageRanking(people) {
  const peopleWithWork = people.filter(isEligibleInternalLineageCase);
  const ids = new Set(peopleWithWork.map((person) => person.id));
  const parentIdsByPerson = new Map(peopleWithWork.map((person) => [person.id, []]));
  const childIdsByPerson = new Map(peopleWithWork.map((person) => [person.id, []]));
  const schoolByPersonId = new Map(
    peopleWithWork.map((person) => [person.id, normalizeInstitutionName(person.work?.institution)])
  );
  const lineageKnownIds = new Set();
  const internalLineageFacultyIds = new Set();
  const directAdvisorTiesBySchool = new Map();

  peopleWithWork.forEach((person) => {
    resolveAdvisorEntries(person.stages.phd)
      .map((entry) => entry.personId)
      .filter((personId) => personId && ids.has(personId))
      .forEach((advisorId) => {
        parentIdsByPerson.get(person.id).push(advisorId);
        childIdsByPerson.get(advisorId).push(person.id);
      });
  });

  ids.forEach((personId) => {
    if ((parentIdsByPerson.get(personId) || []).length > 0 || (childIdsByPerson.get(personId) || []).length > 0) {
      lineageKnownIds.add(personId);
    }
  });

  peopleWithWork.forEach((person) => {
    const school = schoolByPersonId.get(person.id);
    const directAdvisorIds = parentIdsByPerson.get(person.id) || [];
    const directAdviseeIds = childIdsByPerson.get(person.id) || [];

    directAdvisorIds.forEach((advisorId) => {
      if (schoolByPersonId.get(advisorId) === school) {
        internalLineageFacultyIds.add(person.id);
        internalLineageFacultyIds.add(advisorId);
        directAdvisorTiesBySchool.set(school, (directAdvisorTiesBySchool.get(school) || 0) + 1);
      }
    });

    if (directAdviseeIds.some((adviseeId) => schoolByPersonId.get(adviseeId) === school)) {
      internalLineageFacultyIds.add(person.id);
    }
  });

  const statsBySchool = new Map();
  peopleWithWork.forEach((person) => {
    const school = schoolByPersonId.get(person.id);
    if (!statsBySchool.has(school)) {
      statsBySchool.set(school, {
        school,
        facultyWithLineageData: 0,
        internalLineageFaculty: 0,
        directAdvisorTies: 0,
      });
    }

    const stats = statsBySchool.get(school);
    if (lineageKnownIds.has(person.id)) {
      stats.facultyWithLineageData += 1;
    }
    if (internalLineageFacultyIds.has(person.id)) {
      stats.internalLineageFaculty += 1;
    }
  });

  statsBySchool.forEach((stats, school) => {
    stats.directAdvisorTies = directAdvisorTiesBySchool.get(school) || 0;
    stats.rate =
      stats.facultyWithLineageData === 0
        ? 0
        : stats.internalLineageFaculty / stats.facultyWithLineageData;
  });

  return [...statsBySchool.values()]
    .filter((entry) => entry.facultyWithLineageData > 0)
    .sort((left, right) => {
      if (right.rate !== left.rate) {
        return right.rate - left.rate;
      }
      if (right.internalLineageFaculty !== left.internalLineageFaculty) {
        return right.internalLineageFaculty - left.internalLineageFaculty;
      }
      if (right.directAdvisorTies !== left.directAdvisorTies) {
        return right.directAdvisorTies - left.directAdvisorTies;
      }
      return left.school.localeCompare(right.school);
    });
}

function buildSchoolDetailData(people, schoolName) {
  const normalizedSchool = normalizeInstitutionName(schoolName);
  const schoolPeople = people.filter(
    (person) =>
      isEligibleInternalLineageCase(person) &&
      normalizeInstitutionName(person.work?.institution) === normalizedSchool
  );
  const peopleById = new Map(schoolPeople.map((person) => [person.id, person]));
  const directAdvisorTies = [];
  const internalLineagePersonIds = new Set();

  schoolPeople.forEach((person) => {
    resolveAdvisorEntries(person.stages.phd).forEach((entry) => {
      if (!entry.personId || !peopleById.has(entry.personId)) {
        return;
      }

      const advisor = peopleById.get(entry.personId);
      directAdvisorTies.push({
        advisorId: advisor.id,
        advisorName: advisor.name,
        studentId: person.id,
        studentName: person.name,
      });
      internalLineagePersonIds.add(advisor.id);
      internalLineagePersonIds.add(person.id);
    });
  });

  const schoolPeopleWithLineageData = schoolPeople.filter(
    (person) =>
      resolveAdvisorEntries(person.stages.phd).some((entry) => entry.personId && peopleById.has(entry.personId)) ||
      schoolPeople.some((otherPerson) =>
        resolveAdvisorEntries(otherPerson.stages.phd).some((entry) => entry.personId === person.id)
      )
  );

  return {
    school: normalizedSchool,
    totalCurrentPeople: schoolPeople.length,
    facultyWithLineageData: schoolPeopleWithLineageData.length,
    internalLineageFaculty: internalLineagePersonIds.size,
    directAdvisorTies,
    internalLineagePeople: schoolPeople
      .filter((person) => internalLineagePersonIds.has(person.id))
      .sort((left, right) => left.name.localeCompare(right.name)),
  };
}

function renderRankTable(title, columns, rows, emptyMessage) {
  if (!rows.length) {
    return `
      <div class="rank-empty">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(emptyMessage)}</span>
      </div>
    `;
  }

  return `
    <section class="rank-section">
      <h3>${escapeHtml(title)}</h3>
      <div class="rank-table-wrap">
        <table class="rank-table">
          <thead>
            <tr>
              ${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (row, index) => `
                  <tr ${row.__clickSchool ? `class="rank-row-link" data-school="${escapeAttribute(row.__clickSchool)}"` : ""}>
                    ${columns
                      .map((column) => `<td>${escapeHtml(String(column.render(row, index)))}</td>`)
                      .join("")}
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderSameSchoolRankView(rows) {
  const container = graphContainers["rank-hire"];
  if (!container) {
    return;
  }

  container.innerHTML = `
    ${renderRankTable(
      "Same-school hire ranking",
      [
        { label: "Rank", render: (_, index) => index + 1 },
        { label: "School", render: (row) => row.school },
        { label: "Rate", render: (row) => `${(row.rate * 100).toFixed(1)}%` },
        { label: "Same-school hires", render: (row) => row.sameSchool },
        { label: "Known cases", render: (row) => row.known },
      ],
      rows,
      "No visible people currently satisfy the same-school hire rule."
    )}
  `;
}

function renderInternalLineageRankView(rows) {
  const container = graphContainers["rank-lineage"];
  if (!container) {
    return;
  }

  container.innerHTML = `
    ${renderRankTable(
      "Internal lineage ranking",
      [
        { label: "Rank", render: (_, index) => index + 1 },
        { label: "School", render: (row) => row.school },
        { label: "Rate", render: (row) => `${(row.rate * 100).toFixed(1)}%` },
        { label: "Internal-lineage faculty", render: (row) => row.internalLineageFaculty },
        { label: "Faculty with lineage data", render: (row) => row.facultyWithLineageData },
        { label: "Direct advisor ties", render: (row) => row.directAdvisorTies },
      ],
      rows.map((row) => ({ ...row, __clickSchool: row.school })),
      "No visible schools currently have internal lineage matches."
    )}
  `;
}

function renderSchoolDetailView(detail) {
  const container = graphContainers["school-detail"];
  if (!container) {
    return;
  }

  if (!detail || !detail.school) {
    container.innerHTML = `
      <div class="rank-empty">
        <strong>No school selected</strong>
        <span>Select a school from Internal lineage ranking to inspect its internal lineage details.</span>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <section class="rank-section">
      <h3>${escapeHtml(detail.school)}</h3>
      <div class="school-detail-cards">
        <article class="meta-card">
          <span class="meta-label">Current people</span>
          <span class="meta-value">${detail.totalCurrentPeople}</span>
        </article>
        <article class="meta-card">
          <span class="meta-label">Faculty with lineage data</span>
          <span class="meta-value">${detail.facultyWithLineageData}</span>
        </article>
        <article class="meta-card">
          <span class="meta-label">Internal-lineage faculty</span>
          <span class="meta-value">${detail.internalLineageFaculty}</span>
        </article>
        <article class="meta-card">
          <span class="meta-label">Direct advisor ties</span>
          <span class="meta-value">${detail.directAdvisorTies.length}</span>
        </article>
      </div>
    </section>
    ${renderRankTable(
      "Direct internal advisor ties",
      [
        { label: "Rank", render: (_, index) => index + 1 },
        { label: "Advisor", render: (row) => row.advisorName },
        { label: "Student", render: (row) => row.studentName },
      ],
      detail.directAdvisorTies,
      "No direct advisor-student ties are currently visible inside this school."
    )}
    ${renderRankTable(
      "Internal-lineage people",
      [
        { label: "Rank", render: (_, index) => index + 1 },
        { label: "Name", render: (row) => row.name },
      ],
      detail.internalLineagePeople,
      "No visible internal-lineage people for this school."
    )}
  `;
}

function renderStats(filteredPeople, graphData) {
  const graphVisiblePeople = collectVisiblePeopleFromGraphData(graphData, filteredPeople);
  const allowedIds = new Set(filteredPeople.map((person) => person.id));
  const visiblePeople = graphVisiblePeople.filter((person) => allowedIds.has(person.id));
  const schools = new Set(visiblePeople.flatMap((person) => collectSchools(person)));
  const unresolvedProfiles =
    dataset?.people?.filter(
      (person) => isTopSecurityImport(person) && isMissingCorePhdLineage(person)
    ).length || 0;
  const coveragePopulation = dataset?.people || visiblePeople;
  const averageCoverage =
    coveragePopulation.length === 0
      ? 0
      : coveragePopulation.reduce((sum, person) => {
          const ratio =
            typeof person.coverage?.ratio === "number"
              ? person.coverage.ratio
              : computePersonCoverage(person).ratio;
          return sum + ratio;
        }, 0) / coveragePopulation.length;
  const inbreedingPopulation = dataset?.people || visiblePeople;
  const inbreedingKnownPeople = inbreedingPopulation.filter(isEligibleSameSchoolHireCase);
  const inbreedingMatches = inbreedingKnownPeople.filter(
    (person) => normalizeInstitutionName(person.work?.institution) === normalizeInstitutionName(person.stages?.phd?.school)
  );
  const inbreedingRate =
    inbreedingKnownPeople.length === 0 ? 0 : inbreedingMatches.length / inbreedingKnownPeople.length;
  const globalInternalLineageRows = buildInternalLineageRanking(dataset?.people || visiblePeople);
  const globalInternalLineageFaculty = globalInternalLineageRows.reduce(
    (sum, row) => sum + row.internalLineageFaculty,
    0
  );
  const globalFacultyWithLineageData = globalInternalLineageRows.reduce(
    (sum, row) => sum + row.facultyWithLineageData,
    0
  );
  const internalLineageRate =
    globalFacultyWithLineageData === 0
      ? 0
      : globalInternalLineageFaculty / globalFacultyWithLineageData;

  totalCount.textContent = `${(averageCoverage * 100).toFixed(1)}% avg coverage`;
  inbreedingCount.textContent = `${(inbreedingRate * 100).toFixed(1)}% same-school hires`;
  internalLineageCount.textContent = `${(internalLineageRate * 100).toFixed(1)}% internal-lineage faculty`;
  unresolvedCount.textContent = `${unresolvedProfiles} unresolved profiles`;
  treeCount.hidden = false;
  treeCount.textContent = `${graphData.treeCount ?? countConnectedComponents(graphData.nodes, graphData.edges)} trees shown`;
  schoolCount.textContent = `${schools.size} schools`;
  relationCount.textContent = `${graphData.edges.length} lineage edges`;
}

function renderPolicy(filters, graphData) {
  if (graphMode === "rank-hire") {
    filterPolicy.textContent =
      "Ranking schools by the share of visible people whose current institution matches their PhD school.";
    return;
  }

  if (graphMode === "rank-lineage") {
    filterPolicy.textContent =
      "Ranking schools by how many current people are embedded in internal advisor lineages at the same institution.";
    return;
  }

  if (graphMode === "school-detail") {
    filterPolicy.textContent = selectedSchoolDetail
      ? `Inspecting internal lineage details for ${selectedSchoolDetail}.`
      : "Select a school from Internal lineage ranking to inspect its internal lineage details.";
    return;
  }

  if (graphMode === "tree" && !selectedFamilyNodeId) {
    filterPolicy.textContent = "Select a family in Network graph to inspect its genealogy tree.";
    return;
  }

  if (filters.selectedSchools.size === 0) {
    filterPolicy.textContent = `Showing ${graphData.visiblePeopleCount} lineage-connected profiles across all schools, hiding family trees with 3 or fewer people.`;
    return;
  }

  const selectedSchools = [...filters.selectedSchools];
  const label =
    selectedSchools.length <= 3
      ? selectedSchools.join(", ")
      : `${selectedSchools.length} selected schools`;
  filterPolicy.textContent = `Showing ${graphData.visiblePeopleCount} lineage-connected profiles for ${label}, hiding family trees with 3 or fewer people.`;
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

function graphDataSignature(graphData) {
  const nodeIds = graphData.nodes.map((node) => node.id).sort().join("|");
  const edgeIds = graphData.edges
    .map((edge) => `${edge.from}->${edge.to}:${edge.label}`)
    .sort()
    .join("|");
  return `${nodeIds}__${edgeIds}`;
}

function renderGraphTabs() {
  const schoolDetailTab = document.getElementById("graphTabSchoolDetail");
  if (schoolDetailTab) {
    schoolDetailTab.hidden = !selectedSchoolDetail;
    schoolDetailTab.textContent = selectedSchoolDetail || "School detail";
  }

  graphTabs.forEach((tab) => {
    if (tab.hidden) {
      return;
    }
    const active = tab.dataset.graphMode === graphMode;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });

  Object.entries(graphContainers).forEach(([mode, container]) => {
    container?.classList.toggle("is-active", mode === graphMode);
  });

  forceLegend?.classList.toggle("is-active", graphMode === "force");
  updateForceLegend();
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
  const treeHeights = graphData.treeHeights || new Map();

  const sortedComponents = components.sort((left, right) => {
    const leftMax = Math.max(...left.map((nodeId) => treeHeights.get(nodeId) || 0));
    const rightMax = Math.max(...right.map((nodeId) => treeHeights.get(nodeId) || 0));
    if (leftMax !== rightMax) {
      return rightMax - leftMax;
    }

    const leftLabel = nodeById.get(left[0])?.label || "";
    const rightLabel = nodeById.get(right[0])?.label || "";
    return leftLabel.localeCompare(rightLabel);
  });

  for (const component of sortedComponents) {
    const nodesByHeight = new Map();

    for (const nodeId of component) {
      const height = treeHeights.get(nodeId) || 0;
      if (!nodesByHeight.has(height)) {
        nodesByHeight.set(height, []);
      }
      nodesByHeight.get(height).push(nodeId);
    }

    const orderedHeights = [...nodesByHeight.keys()].sort((left, right) => right - left);
    const orderByNodeId = new Map();
    let componentWidth = 0;

    for (const height of orderedHeights) {
      const sortedNodeIds = nodesByHeight.get(height).sort((leftId, rightId) => {
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

    for (const height of orderedHeights) {
      const sortedNodeIds = [...nodesByHeight.get(height)].sort(
        (leftId, rightId) => (orderByNodeId.get(leftId) || 0) - (orderByNodeId.get(rightId) || 0)
      );
      const rowWidth = Math.max(sortedNodeIds.length - 1, 0) * nodeGap;
      const rowStartX = componentCenterX - rowWidth / 2;

      sortedNodeIds.forEach((nodeId, index) => {
        positioned.set(nodeId, {
          x: rowStartX + index * nodeGap,
          y: -height * levelGap,
        });
      });
    }

    currentX += componentWidth + componentGap;
  }

  return positioned;
}

function renderGraph(graphData) {
  const mode = graphMode;
  const container = graphContainers[mode];
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
  const signature = graphDataSignature(graphData);
  const cachedNetwork = networkByMode[mode];
  const selectedGraphNodeId = selectedGraphNodeIdForMode(mode);

  if (cachedNetwork && graphSignatureByMode[mode] === signature) {
    if (isForce3DGraph(cachedNetwork)) {
      resizeForce3DGraph(cachedNetwork);
      updateForce3DGraphAppearance(cachedNetwork);
    }
    lastGraphIds = lastGraphIdsByMode[mode];
    syncGlobalNetworkReference();
    if (selectedGraphNodeId && graphData.nodeIds.has(selectedGraphNodeId)) {
      if (isForce3DGraph(cachedNetwork)) {
        updateForce3DGraphAppearance(cachedNetwork);
      } else {
        cachedNetwork.selectNodes([selectedGraphNodeId]);
      }
    }
    return;
  }

  if (cachedNetwork) {
    if (isForce3DGraph(cachedNetwork)) {
      cachedNetwork._destructor();
      container.innerHTML = "";
    } else {
      cachedNetwork.destroy();
    }
  }

  if (mode === "force") {
    network = createForce3DGraph(container, graphData, largeGraph);
  } else {
    const data = {
      nodes: new vis.DataSet(nodes),
      edges: new vis.DataSet(graphData.edges),
    };
    const options = buildGraphOptions(largeGraph);
    network = new vis.Network(container, data, options);
    network.__graphKind = "tree-vis";
    network.on("selectNode", ({ nodes: selectedNodeIds }) => {
      const nodeId = selectedNodeIds[0];
      if (nodeId && personById.has(nodeId)) {
        selectPerson(nodeId, { focus: false });
      }
    });
  }

  networkByMode[mode] = network;
  graphSignatureByMode[mode] = signature;
  syncGlobalNetworkReference();

  if (mode === "tree") {
    fitGraph(true);
    if (selectedGraphNodeId && graphData.nodeIds.has(selectedGraphNodeId)) {
      network.selectNodes([selectedGraphNodeId]);
    }
  } else {
    window.setTimeout(() => {
      fitGraph(true);
      if (selectedGraphNodeId && graphData.nodeIds.has(selectedGraphNodeId)) {
        updateForce3DGraphAppearance(network);
        focusForce3DNode(network, selectedGraphNodeId, 1, 260);
      }
    }, 180);
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      fitGraph(false);
    });
  });

  lastGraphIds = graphData.nodeIds;
  lastGraphIdsByMode[mode] = graphData.nodeIds;
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

  setSelectedNode(personId);
  syncSelectedFamilyForPerson(personId);
  renderPersonPanel(personId);
  personPanel.classList.add("is-open");

  if (window.matchMedia("(max-width: 1279px)").matches) {
    document.body.classList.add("person-open");
  }

  if (network && lastGraphIds.has(personId)) {
    if (isForce3DGraph(network)) {
      updateForce3DGraphAppearance(network);
      if (focus) {
        focusForce3DNode(network, activeForceSelectionNodeId(), 1, 260);
      }
    } else {
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
}

function focusFirstSearchMatch() {
  const query = searchInput.value.trim().toLowerCase();
  if (!query || !dataset) {
    return;
  }

  const matchingPeople = findMatchingPeople(query);
  const match = matchingPeople.find((person) => lastGraphIds.has(person.id)) || matchingPeople[0];
  if (!match) {
    showError(`No people matched "${searchInput.value.trim()}".`);
    return;
  }

  clearError();

  if (graphMode === "tree") {
    selectPerson(match.id, { focus: false });
    renderApp();

    if (!lastGraphIds.has(match.id)) {
      showError("Match found outside the current tree filters. Relax filters to visualize this person.");
      return;
    }
    if (network) {
      network.selectNodes([match.id]);
      network.focus(match.id, {
        scale: Math.max(1.25, network.getScale()),
        animation: {
          duration: 260,
          easingFunction: "easeInOutQuad",
        },
      });
    }
    return;
  }

  selectPerson(match.id);
  if (!lastGraphIds.has(activeForceSelectionNodeId())) {
    showError("Match found outside the current graph filters. Relax filters to visualize this person.");
  }
}

function updateSuggestions() {
  if (!dataset) {
    return;
  }

  const activeValue =
    document.activeElement === relationshipInputA
      ? relationshipInputA.value
      : document.activeElement === relationshipInputB
        ? relationshipInputB.value
        : searchInput.value;
  const query = activeValue.trim().toLowerCase();
  if (!query) {
    suggestions.innerHTML = "";
    return;
  }

  const matches = findMatchingPeople(query).slice(0, SEARCH_RESULT_LIMIT);

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
  const treeGraphData = buildTreeGraphData(filteredPeople);
  const familyStructures = buildFamilyStructures(treeGraphData);
  syncFamilyStructures(familyStructures);
  const forceGraphData = buildForceFamilyGraphDataFromStructures(filteredPeople, treeGraphData, familyStructures);
  const treeViewGraphData = buildSelectedFamilyTreeGraphData(treeGraphData);
  const graphData =
    graphMode === "tree"
      ? treeViewGraphData
      : graphMode === "rank-hire" || graphMode === "rank-lineage" || graphMode === "school-detail"
        ? treeGraphData
        : forceGraphData;
  const sameSchoolRankingRows = graphMode === "rank-hire" ? buildSameSchoolHireRanking(filteredPeople) : null;
  const internalLineageRankingRows = graphMode === "rank-lineage" ? buildInternalLineageRanking(filteredPeople) : null;
  const schoolDetailData =
    graphMode === "school-detail" ? buildSchoolDetailData(filteredPeople, selectedSchoolDetail) : null;

  renderStats(filteredPeople, graphData);
  renderPolicy(filters, graphData);
  if (graphMode === "rank-hire") {
    renderSameSchoolRankView(sameSchoolRankingRows);
  } else if (graphMode === "rank-lineage") {
    renderInternalLineageRankView(internalLineageRankingRows);
  } else if (graphMode === "school-detail") {
    renderSchoolDetailView(schoolDetailData);
  } else {
    renderGraph(graphData);
  }

  if (!filteredPeople.length) {
    selectedPersonId = null;
    renderEmptyPersonPanel("No records match the current filter combination.");
    return;
  }

  if (graphMode === "tree" && !selectedFamilyNodeId) {
    selectedPersonId = null;
    renderEmptyPersonPanel("Select a family in Network graph to inspect its genealogy tree.");
    return;
  }

  if (selectedPersonId && personById.has(selectedPersonId)) {
    renderPersonPanel(selectedPersonId);
    if (!graphData.nodeIds.has(selectedPersonId)) {
      if (isForce3DGraph(network)) {
        updateForce3DGraphAppearance(network);
      } else {
        network.unselectAll();
      }
    }
  } else if (filteredPeople[0]) {
    renderPersonPanel(filteredPeople[0].id);
    setSelectedNode(filteredPeople[0].id);
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
  const activeNetwork = getActiveGraph();
  if (!activeNetwork) {
    return;
  }

  syncGlobalNetworkReference();

  if (isForce3DGraph(activeNetwork)) {
    resizeForce3DGraph(activeNetwork);
    activeNetwork.zoomToFit(animated ? 220 : 0, 50);
    return;
  }

  activeNetwork.redraw();
  activeNetwork.fit({
    animation: animated
      ? {
          duration: 220,
          easingFunction: "easeInOutQuad",
        }
      : false,
  });
}

function zoomGraphTo(scale) {
  const activeNetwork = getActiveGraph();
  if (!activeNetwork) {
    return;
  }

  syncGlobalNetworkReference();
  if (isForce3DGraph(activeNetwork)) {
    if (selectedPersonId && lastGraphIds.has(selectedPersonId)) {
      focusForce3DNode(activeNetwork, selectedPersonId, scale, 220);
    } else {
      fitGraph(true);
    }
    return;
  }

  const position = activeNetwork.getViewPosition();
  activeNetwork.moveTo({
    position,
    scale,
    animation: {
      duration: 160,
      easingFunction: "easeInOutQuad",
    },
  });
}

function zoomGraphOut() {
  const activeNetwork = getActiveGraph();
  if (!activeNetwork) {
    return;
  }

  if (isForce3DGraph(activeNetwork)) {
    fitGraph(true);
    return;
  }

  zoomGraphTo(activeNetwork.getScale() * 0.88);
}

function attachWheelZoom() {
  Object.values(graphContainers).forEach((container) => {
    container.addEventListener(
      "wheel",
      (event) => {
        const activeNetwork = networkByMode[graphMode];
        if (!activeNetwork || !container.classList.contains("is-active")) {
          return;
        }

        if (isForce3DGraph(activeNetwork)) {
          return;
        }

        event.preventDefault();
        const currentScale = activeNetwork.getScale();
        const nextScale = Math.min(
          3,
          Math.max(0.08, currentScale * Math.exp(-event.deltaY * WHEEL_ZOOM_FACTOR))
        );
        zoomGraphTo(nextScale);
      },
      { passive: false }
    );
  });
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
  relationshipInputA.addEventListener("input", debounce(updateSuggestions, 80));
  relationshipInputB.addEventListener("input", debounce(updateSuggestions, 80));
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      focusFirstSearchMatch();
    }
  });
  [relationshipInputA, relationshipInputB].forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        findRelationshipBetweenPeople();
      }
    });
  });
  searchButton.addEventListener("click", focusFirstSearchMatch);
  relationshipButton.addEventListener("click", findRelationshipBetweenPeople);
  graphContainers["rank-lineage"]?.addEventListener("click", (event) => {
    const row = event.target.closest("[data-school]");
    if (!row) {
      return;
    }

    selectedSchoolDetail = row.dataset.school || null;
    if (!selectedSchoolDetail) {
      return;
    }

    graphMode = "school-detail";
    renderGraphTabs();
    renderApp();
  });
  sharedSchoolToggle?.addEventListener("change", () => {
    showSharedSchoolLinks = sharedSchoolToggle.checked;
    renderApp();
  });

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

    if (isForce3DGraph(network)) {
      network.cooldownTicks(180);
      network.d3ReheatSimulation();
      window.setTimeout(() => {
        fitGraph(true);
      }, 260);
      return;
    }
  });

  resetFiltersButton.addEventListener("click", resetFilters);
  window.addEventListener("resize", () => {
    Object.values(networkByMode).forEach((graph) => {
      if (isForce3DGraph(graph)) {
        resizeForce3DGraph(graph);
      }
    });
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
    if (graphMode === "force" && typeof ForceGraph3D !== "function") {
      graphMode = "tree";
      showError("3D network graph failed to load. Falling back to Genealogy tree.");
    }
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
