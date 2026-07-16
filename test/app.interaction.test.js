const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createElementStub() {
  const classes = new Set();
  const attributes = new Map();
  const listeners = new Map();
  return {
    hidden: false,
    innerHTML: "",
    textContent: "",
    value: "",
    dataset: {},
    clientWidth: 960,
    clientHeight: 640,
    classList: {
      add(...tokens) {
        tokens.forEach((token) => classes.add(token));
      },
      remove(...tokens) {
        tokens.forEach((token) => classes.delete(token));
      },
      toggle(token, force) {
        if (force === true) {
          classes.add(token);
          return true;
        }
        if (force === false) {
          classes.delete(token);
          return false;
        }
        if (classes.has(token)) {
          classes.delete(token);
          return false;
        }
        classes.add(token);
        return true;
      },
      contains() {
        return classes.has(arguments[0]);
      },
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
    addEventListener(eventName, handler) {
      listeners.set(eventName, handler);
    },
    removeEventListener(eventName) {
      listeners.delete(eventName);
    },
    dispatchEvent(eventName, event) {
      const handler = listeners.get(eventName);
      if (handler) {
        handler(event);
      }
    },
    querySelectorAll() {
      return [];
    },
    querySelector() {
      return { textContent: "" };
    },
  };
}

function loadAppWithGraphMocks() {
  const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const elements = new Map();
  const networkInstances = [];
  const forceGraphInstances = [];
  const windowListeners = new Map();

  class MockDataSet {
    constructor(items) {
      this.items = items;
    }
  }

  class MockNetwork {
    constructor(container, data, options) {
      this.container = container;
      this.data = data;
      this.options = options;
      this.handlers = new Map();
      this.onceHandlers = new Map();
      networkInstances.push(this);
    }

    destroy() {}

    on(eventName, handler) {
      this.handlers.set(eventName, handler);
    }

    once(eventName, handler) {
      this.onceHandlers.set(eventName, handler);
    }

    setOptions(options) {
      this.lastSetOptions = options;
    }

    redraw() {}

    fit(options) {
      this.lastFitOptions = options;
    }

    getScale() {
      return 1;
    }

    getViewPosition() {
      return { x: 0, y: 0 };
    }

    moveTo(options) {
      this.lastMoveToOptions = options;
    }

    selectNodes(nodeIds) {
      this.lastSelectedNodeIds = nodeIds;
    }

    focus(nodeId, options) {
      this.lastFocus = { nodeId, options };
    }

    unselectAll() {}

    stabilize() {}
  }

  class MockForceGraph3D {
    constructor(container, config) {
      this.container = container;
      this.config = config;
      this.forceSettings = new Map();
      forceGraphInstances.push(this);
    }

    _destructor() {}

    width(value) {
      this.lastWidth = value;
      return this;
    }

    height(value) {
      this.lastHeight = value;
      return this;
    }

    backgroundColor(value) {
      this.lastBackgroundColor = value;
      return this;
    }

    showNavInfo(value) {
      this.lastShowNavInfo = value;
      return this;
    }

    numDimensions(value) {
      this.lastNumDimensions = value;
      return this;
    }

    warmupTicks(value) {
      this.lastWarmupTicks = value;
      return this;
    }

    cooldownTicks(value) {
      this.lastCooldownTicks = value;
      return this;
    }

    d3VelocityDecay(value) {
      this.lastVelocityDecay = value;
      return this;
    }

    nodeLabel(value) {
      this.lastNodeLabel = value;
      return this;
    }

    nodeColor(value) {
      this.lastNodeColor = value;
      return this;
    }

    nodeVal(value) {
      this.lastNodeVal = value;
      return this;
    }

    nodeOpacity(value) {
      this.lastNodeOpacity = value;
      return this;
    }

    linkColor(value) {
      this.lastLinkColor = value;
      return this;
    }

    linkWidth(value) {
      this.lastLinkWidth = value;
      return this;
    }

    linkOpacity(value) {
      this.lastLinkOpacity = value;
      return this;
    }

    linkDirectionalArrowLength(value) {
      this.lastArrowLength = value;
      return this;
    }

    linkDirectionalArrowRelPos(value) {
      this.lastArrowRelPos = value;
      return this;
    }

    linkDirectionalArrowColor(value) {
      this.lastArrowColor = value;
      return this;
    }

    linkCurvature(value) {
      this.lastLinkCurvature = value;
      return this;
    }

    onNodeHover(handler) {
      this.onHover = handler;
      return this;
    }

    onNodeClick(handler) {
      this.onClick = handler;
      return this;
    }

    onNodeDragEnd(handler) {
      this.onDragEnd = handler;
      return this;
    }

    graphData(value) {
      this.lastGraphData = value;
      return this;
    }

    d3Force(name) {
      if (!this.forceSettings.has(name)) {
        this.forceSettings.set(name, {
          strength: (value) => {
            this[`${name}Strength`] = value;
            return this;
          },
          distance: (value) => {
            this[`${name}Distance`] = value;
            return this;
          },
        });
      }

      return this.forceSettings.get(name);
    }

    refresh() {
      this.didRefresh = true;
      return this;
    }

    cameraPosition(position, lookAt, duration) {
      this.lastCameraPosition = { position, lookAt, duration };
      return this;
    }

    zoomToFit(duration, padding) {
      this.lastZoomToFit = { duration, padding };
      return this;
    }

    d3ReheatSimulation() {
      this.didReheat = true;
      return this;
    }
  }

  const windowStub = {
    __lineageNetwork: null,
    addEventListener(eventName, handler) {
      windowListeners.set(eventName, handler);
    },
    removeEventListener(eventName) {
      windowListeners.delete(eventName);
    },
    dispatchEvent(eventName) {
      const handler = windowListeners.get(eventName);
      if (handler) {
        return handler();
      }

      return undefined;
    },
    clearTimeout,
    setTimeout,
    location: {
      protocol: "http:",
    },
    matchMedia() {
      return { matches: false };
    },
  };

  const context = {
    console,
    Math,
    Map,
    Set,
    URL,
    clearTimeout,
    setTimeout,
    requestAnimationFrame(callback) {
      callback();
    },
    document: {
      head: {
        append(node) {
          if (typeof node.onload === "function") {
            node.onload();
          }
        },
      },
      createElement() {
        return {};
      },
      body: createElementStub(),
      getElementById(id) {
        if (!elements.has(id)) {
          elements.set(id, createElementStub());
        }

        return elements.get(id);
      },
    },
    vis: {
      DataSet: MockDataSet,
      Network: MockNetwork,
    },
    ForceGraph3D: MockForceGraph3D,
    window: windowStub,
    fetch: async () => ({
      ok: true,
      async json() {
        return { people: [] };
      },
    }),
  };

  vm.createContext(context);
  vm.runInContext(appSource, context, { filename: "app.js" });

  return { context, networkInstances, forceGraphInstances, windowStub };
}

test("renderGraph uses the 3D renderer in force mode", () => {
  const { context, forceGraphInstances, networkInstances, windowStub } = loadAppWithGraphMocks();
  vm.runInContext('graphMode = "force";', context);

  context.renderGraph({
    nodes: [{ id: "ada-lovelace", label: "Ada Lovelace", group: "person-active", title: "Ada" }],
    edges: [],
    nodeIds: new Set(["ada-lovelace"]),
  });

  assert.equal(networkInstances.length, 0);
  assert.equal(forceGraphInstances.length, 1);
  assert.equal(forceGraphInstances[0].lastNumDimensions, 3);
  assert.equal(forceGraphInstances[0].lastArrowLength({ label: "Shared school" }), 0);
  assert.equal(forceGraphInstances[0].lastArrowLength({ label: "Postdoc bridge" }), 4);
  assert.equal(forceGraphInstances[0].lastGraphData.nodes[0].id, "ada-lovelace");
  assert.equal(windowStub.__lineageNetwork, forceGraphInstances[0]);
});

test("renderGraph preserves explicit family node sizes in 3D mode", () => {
  const { context, forceGraphInstances } = loadAppWithGraphMocks();
  vm.runInContext('graphMode = "force";', context);

  context.renderGraph({
    nodes: [
      { id: "family:1", label: "Small family", group: "person-active", title: "Small", size: 18 },
      { id: "family:2", label: "Large family", group: "person-active", title: "Large", size: 42 },
    ],
    edges: [],
    nodeIds: new Set(["family:1", "family:2"]),
  });

  assert.deepEqual(
    forceGraphInstances[0].lastGraphData.nodes.map((node) => node.size),
    [18, 42]
  );
});

test("renderGraph keeps genealogy tree on vis-network", () => {
  const { context, networkInstances, forceGraphInstances, windowStub } = loadAppWithGraphMocks();
  vm.runInContext('graphMode = "tree";', context);

  context.renderGraph({
    nodes: [{ id: "ada-lovelace", label: "Ada Lovelace", group: "person-active", title: "Ada" }],
    edges: [],
    nodeIds: new Set(["ada-lovelace"]),
    treeHeights: new Map([["ada-lovelace", 0]]),
  });

  assert.equal(forceGraphInstances.length, 0);
  assert.equal(networkInstances.length, 1);
  assert.equal(networkInstances[0].options.physics.enabled, false);
  assert.equal(windowStub.__lineageNetwork, networkInstances[0]);
});

test("renderGraphTabs can activate the ranking tab", () => {
  const { context } = loadAppWithGraphMocks();
  context.document.getElementById("graphTabForce").dataset.graphMode = "force";
  context.document.getElementById("graphTabTree").dataset.graphMode = "tree";
  context.document.getElementById("graphTabRankHire").dataset.graphMode = "rank-hire";
  context.document.getElementById("graphTabRankLineage").dataset.graphMode = "rank-lineage";
  vm.runInContext('graphMode = "rank-hire";', context);

  context.renderGraphTabs();

  const rankTab = context.document.getElementById("graphTabRankHire");
  const rankContainer = context.document.getElementById("lineageGraphRankHire");
  assert.equal(rankTab.getAttribute("aria-selected"), "true");
  assert.equal(rankContainer.classList.contains("is-active"), true);
});

test("same-school ranking rows navigate to the school detail tab", async () => {
  const { context, windowStub } = loadAppWithGraphMocks();
  context.document.getElementById("graphTabForce").dataset.graphMode = "force";
  context.document.getElementById("graphTabTree").dataset.graphMode = "tree";
  context.document.getElementById("graphTabRankHire").dataset.graphMode = "rank-hire";
  context.document.getElementById("graphTabRankLineage").dataset.graphMode = "rank-lineage";
  context.document.getElementById("graphTabSchoolDetail").dataset.graphMode = "school-detail";

  await windowStub.dispatchEvent("load");
  context.renderSameSchoolRankView([
    { school: "MIT", rate: 0.5, sameSchool: 5, known: 10 },
  ]);

  const rankHireContainer = context.document.getElementById("lineageGraphRankHire");
  assert.match(rankHireContainer.innerHTML, /data-school="MIT"/);

  rankHireContainer.dispatchEvent("click", {
    target: {
      closest() {
        return { dataset: { school: "MIT" } };
      },
    },
  });

  assert.equal(vm.runInContext("graphMode", context), "school-detail");
  assert.equal(vm.runInContext("selectedSchoolDetail", context), "MIT");
});

test("school detail graph builds nodes and advisor edges for the selected school", () => {
  const { context } = loadAppWithGraphMocks();
  const people = [
    {
      id: "advisor",
      name: "Advisor",
      aliases: [],
      summary: "",
      work: { institution: "MIT" },
      tracking: { status: "active" },
      stages: {
        undergraduate: { school: null },
        masters: { school: null },
        phd: { school: "Stanford", graduationYear: 2010, advisorPersonId: null, advisorLabel: null },
        postdoc: { school: null, advisorPersonId: null, advisorLabel: null },
      },
    },
    {
      id: "student",
      name: "Student",
      aliases: [],
      summary: "",
      work: { institution: "MIT" },
      tracking: { status: "active" },
      stages: {
        undergraduate: { school: null },
        masters: { school: null },
        phd: { school: "MIT", graduationYear: 2020, advisorPersonId: "advisor", advisorLabel: null },
        postdoc: { school: null, advisorPersonId: null, advisorLabel: null },
      },
    },
  ];

  context.buildIndexes(people);

  const detail = context.buildSchoolDetailData(
    people,
    "MIT"
  );

  const graphData = context.buildSchoolDetailGraphData(detail);
  assert.deepEqual(
    graphData.nodes.map((node) => node.id).sort(),
    ["advisor", "student"]
  );
  assert.equal(graphData.edges.length, 1);
  assert.equal(graphData.edges[0].from, "advisor");
  assert.equal(graphData.edges[0].to, "student");
  assert.equal(graphData.edges[0].label, "Internal advisor tie");
});

test("small family components are hidden from graph data", () => {
  const { context } = loadAppWithGraphMocks();

  vm.runInContext(
    `
      personById = new Map([
        ["a", { id: "a" }],
        ["b", { id: "b" }],
        ["c", { id: "c" }],
        ["d", { id: "d" }],
        ["e", { id: "e" }],
        ["f", { id: "f" }],
        ["g", { id: "g" }]
      ]);
    `,
    context
  );

  const result = context.pruneSmallFamilyComponents({
    nodes: [
      { id: "a" },
      { id: "b" },
      { id: "c" },
      { id: "d" },
      { id: "e" },
      { id: "f" },
      { id: "g" },
    ],
    edges: [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
      { from: "d", to: "e" },
      { from: "e", to: "f" },
      { from: "f", to: "g" },
    ],
    visiblePeopleCount: 7,
    nodeIds: new Set(["a", "b", "c", "d", "e", "f", "g"]),
  });

  assert.deepEqual(
    result.nodes.map((node) => node.id).sort(),
    ["d", "e", "f", "g"]
  );
  assert.equal(result.visiblePeopleCount, 4);
  assert.equal(result.treeCount, undefined);
});

test("tree count badge is shown in force mode too", () => {
  const { context } = loadAppWithGraphMocks();
  vm.runInContext('graphMode = "force";', context);

  context.dataset = { people: [] };
  context.renderStats(
    [],
    {
      nodes: [
        { id: "a" },
        { id: "b" },
        { id: "c" },
      ],
      edges: [{ from: "a", to: "b" }],
      nodeIds: new Set(["a", "b", "c"]),
      visiblePeopleCount: 0,
    }
  );

  const treeCount = context.document.getElementById("treeCount");
  assert.equal(treeCount.hidden, false);
  assert.equal(treeCount.textContent, "2 trees shown");
});

test("stats badge shows global average coverage instead of visible-only coverage", () => {
  const { context } = loadAppWithGraphMocks();

  const datasetPeople = [
    {
      id: "a",
      name: "A",
      work: { institution: "X" },
      tracking: { status: "active" },
      stages: {
        undergraduate: { school: "U1" },
        masters: { school: null },
        phd: { school: "P1", advisorPersonId: null, advisorLabel: "Adv" },
        postdoc: { school: null, advisorPersonId: null, advisorLabel: null },
      },
    },
    {
      id: "b",
      name: "B",
      work: { institution: null },
      tracking: { status: "active" },
      stages: {
        undergraduate: { school: null },
        masters: { school: null },
        phd: { school: null, advisorPersonId: null, advisorLabel: null },
        postdoc: { school: null, advisorPersonId: null, advisorLabel: null },
      },
    },
    {
      id: "c",
      name: "C",
      work: { institution: "Z" },
      tracking: { status: "active" },
      stages: {
        undergraduate: { school: "U1" },
        masters: { school: "M1" },
        phd: { school: "P1", advisorPersonId: "adv", advisorLabel: "Adv" },
        postdoc: { school: "PD1", advisorPersonId: null, advisorLabel: null },
      },
    },
  ];

  context.__testDataset = { people: datasetPeople };
  vm.runInContext("dataset = __testDataset;", context);
  context.renderStats(datasetPeople.slice(0, 2), {
    nodes: [{ id: "a" }, { id: "b" }],
    edges: [],
    nodeIds: new Set(["a", "b"]),
    visiblePeopleCount: 2,
  });

  const totalCount = context.document.getElementById("totalCount");
  assert.equal(totalCount.textContent, "41.7% avg coverage");
});

test("stats badge computes global average coverage for force family nodes", () => {
  const { context } = loadAppWithGraphMocks();
  const datasetPeople = [
    {
      id: "a",
      name: "A",
      work: { institution: "X" },
      tracking: { status: "active" },
      stages: {
        undergraduate: { school: "U1" },
        masters: { school: null },
        phd: { school: "P1", advisorPersonId: null, advisorLabel: "Adv" },
        postdoc: { school: null, advisorPersonId: null, advisorLabel: null }
      },
    },
    {
      id: "b",
      name: "B",
      work: { institution: null },
      tracking: { status: "active" },
      stages: {
        undergraduate: { school: null },
        masters: { school: null },
        phd: { school: null, advisorPersonId: null, advisorLabel: null },
        postdoc: { school: null, advisorPersonId: null, advisorLabel: null }
      },
    },
    {
      id: "c",
      name: "C",
      work: { institution: "Z" },
      tracking: { status: "active" },
      stages: {
        undergraduate: { school: "U1" },
        masters: { school: "M1" },
        phd: { school: "P1", advisorPersonId: "adv", advisorLabel: "Adv" },
        postdoc: { school: "PD1", advisorPersonId: null, advisorLabel: null }
      },
    },
  ];

  vm.runInContext(
    `
      personById = new Map([
        ["a", {
          id: "a",
          name: "A",
          work: { institution: "X" },
          tracking: { status: "active" },
          stages: {
            undergraduate: { school: "U1" },
            masters: { school: null },
            phd: { school: "P1", advisorPersonId: null, advisorLabel: "Adv" },
            postdoc: { school: null, advisorPersonId: null, advisorLabel: null }
          }
        }],
        ["b", {
          id: "b",
          name: "B",
          work: { institution: null },
          tracking: { status: "active" },
          stages: {
            undergraduate: { school: null },
            masters: { school: null },
            phd: { school: null, advisorPersonId: null, advisorLabel: null },
            postdoc: { school: null, advisorPersonId: null, advisorLabel: null }
          }
        }],
        ["c", {
          id: "c",
          name: "C",
          work: { institution: "Z" },
          tracking: { status: "active" },
          stages: {
            undergraduate: { school: "U1" },
            masters: { school: "M1" },
            phd: { school: "P1", advisorPersonId: "adv", advisorLabel: "Adv" },
            postdoc: { school: "PD1", advisorPersonId: null, advisorLabel: null }
          }
        }]
      ]);
      forceFamilyPersonIdsByNodeId = new Map([["family:1", ["a", "b"]]]);
    `,
    context
  );

  context.__testDataset = { people: datasetPeople };
  vm.runInContext("dataset = __testDataset;", context);
  context.renderStats(datasetPeople.slice(0, 2), {
    nodes: [{ id: "family:1" }],
    edges: [],
    nodeIds: new Set(["family:1"]),
    visiblePeopleCount: 2,
  });

  const totalCount = context.document.getElementById("totalCount");
  assert.equal(totalCount.textContent, "41.7% avg coverage");
});

test("stats badge computes academic inbreeding rate globally", () => {
  const { context } = loadAppWithGraphMocks();
  const datasetPeople = [
    {
      id: "a",
      name: "A",
      work: { institution: "School X" },
      tracking: { status: "active" },
      stages: {
        undergraduate: { school: null },
        masters: { school: null },
        phd: { school: "School X", graduationYear: 2020, advisorPersonId: null, advisorLabel: null },
        postdoc: { school: null, advisorPersonId: null, advisorLabel: null }
      },
    },
    {
      id: "b",
      name: "B",
      work: { institution: "School Y" },
      tracking: { status: "active" },
      stages: {
        undergraduate: { school: null },
        masters: { school: null },
        phd: { school: "School Z", graduationYear: 2018, advisorPersonId: null, advisorLabel: null },
        postdoc: { school: null, advisorPersonId: null, advisorLabel: null }
      },
    },
    {
      id: "c",
      name: "C",
      work: { institution: null },
      tracking: { status: "active" },
      stages: {
        undergraduate: { school: null },
        masters: { school: null },
        phd: { school: "School X", graduationYear: 2021, advisorPersonId: null, advisorLabel: null },
        postdoc: { school: null, advisorPersonId: null, advisorLabel: null }
      },
    },
    {
      id: "d",
      name: "D",
      work: { institution: "School Q" },
      tracking: { status: "active" },
      stages: {
        undergraduate: { school: null },
        masters: { school: null },
        phd: { school: "School Q", graduationYear: 2016, advisorPersonId: null, advisorLabel: null },
        postdoc: { school: null, advisorPersonId: null, advisorLabel: null }
      },
    },
    {
      id: "e",
      name: "E",
      work: { institution: "School X" },
      tracking: { status: "active" },
      stages: {
        undergraduate: { school: null },
        masters: { school: null },
        phd: { school: "School X", graduationYear: 2025, status: "PhD student", advisorPersonId: null, advisorLabel: null },
        postdoc: { school: null, advisorPersonId: null, advisorLabel: null }
      },
    },
    {
      id: "f",
      name: "F",
      work: { institution: "School X" },
      tracking: { status: "active" },
      stages: {
        undergraduate: { school: null },
        masters: { school: null },
        phd: { school: "School X", graduationYear: null, advisorPersonId: null, advisorLabel: null },
        postdoc: { school: null, advisorPersonId: null, advisorLabel: null }
      },
    },
  ];

  context.__testDataset = { people: datasetPeople };
  vm.runInContext("dataset = __testDataset;", context);
  context.renderStats(datasetPeople.slice(0, 3), {
    nodes: [{ id: "a" }, { id: "b" }, { id: "c" }],
    edges: [],
    nodeIds: new Set(["a", "b", "c"]),
    visiblePeopleCount: 3,
  });

  const inbreedingCount = context.document.getElementById("inbreedingCount");
  assert.equal(inbreedingCount.textContent, "66.7% same-school hires");
});

test("stats badge computes global internal-lineage faculty rate", () => {
  const { context } = loadAppWithGraphMocks();
  const datasetPeople = [
    {
      id: "advisor",
      name: "Advisor",
      work: { institution: "School X" },
      tracking: { status: "active" },
      stages: {
        undergraduate: { school: null },
        masters: { school: null },
        phd: { school: "School A", graduationYear: 2001, advisorPersonId: null, advisorLabel: null },
        postdoc: { school: null, advisorPersonId: null, advisorLabel: null }
      },
    },
    {
      id: "student",
      name: "Student",
      work: { institution: "School X" },
      tracking: { status: "active" },
      stages: {
        undergraduate: { school: null },
        masters: { school: null },
        phd: { school: "School X", graduationYear: 2010, advisorPersonId: "advisor", advisorLabel: null },
        postdoc: { school: null, advisorPersonId: null, advisorLabel: null }
      },
    },
    {
      id: "outside",
      name: "Outside",
      work: { institution: "School Y" },
      tracking: { status: "active" },
      stages: {
        undergraduate: { school: null },
        masters: { school: null },
        phd: { school: "School Z", graduationYear: 2012, advisorPersonId: null, advisorLabel: null },
        postdoc: { school: null, advisorPersonId: null, advisorLabel: null }
      },
    },
    {
      id: "student-phd",
      name: "Current Student",
      work: { institution: "School X" },
      tracking: { status: "active" },
      stages: {
        undergraduate: { school: null },
        masters: { school: null },
        phd: { school: "School X", graduationYear: 2026, status: "PhD student", advisorPersonId: "advisor", advisorLabel: null },
        postdoc: { school: null, advisorPersonId: null, advisorLabel: null }
      },
    },
    {
      id: "missing-year",
      name: "Missing Year",
      work: { institution: "School X" },
      tracking: { status: "active" },
      stages: {
        undergraduate: { school: null },
        masters: { school: null },
        phd: { school: "School X", graduationYear: null, advisorPersonId: "advisor", advisorLabel: null },
        postdoc: { school: null, advisorPersonId: null, advisorLabel: null }
      },
    },
  ];

  context.__testDataset = { people: datasetPeople };
  vm.runInContext("dataset = __testDataset;", context);
  vm.runInContext(
    `
      personById = new Map([
        ["advisor", __testDataset.people[0]],
        ["student", __testDataset.people[1]],
        ["outside", __testDataset.people[2]],
        ["student-phd", __testDataset.people[3]],
        ["missing-year", __testDataset.people[4]]
      ]);
    `,
    context
  );
  context.renderStats(datasetPeople, {
    nodes: [{ id: "advisor" }, { id: "student" }, { id: "outside" }],
    edges: [],
    nodeIds: new Set(["advisor", "student", "outside"]),
    visiblePeopleCount: 3,
  });

  const internalLineageCount = context.document.getElementById("internalLineageCount");
  assert.equal(internalLineageCount.textContent, "100.0% internal-lineage faculty");
});

test("genealogy tree can be filtered to the selected network family", () => {
  const { context } = loadAppWithGraphMocks();

  vm.runInContext(
    `
      personById = new Map([
        ["a", { id: "a", name: "A", tracking: { status: "active" }, work: { institution: "X" }, stages: { undergraduate: { school: null }, masters: { school: null }, phd: { school: "X" }, postdoc: { school: null } } }],
        ["b", { id: "b", name: "B", tracking: { status: "active" }, work: { institution: "X" }, stages: { undergraduate: { school: null }, masters: { school: null }, phd: { school: "X" }, postdoc: { school: null } } }],
        ["c", { id: "c", name: "C", tracking: { status: "active" }, work: { institution: "Y" }, stages: { undergraduate: { school: null }, masters: { school: null }, phd: { school: "Y" }, postdoc: { school: null } } }],
        ["d", { id: "d", name: "D", tracking: { status: "active" }, work: { institution: "Y" }, stages: { undergraduate: { school: null }, masters: { school: null }, phd: { school: "Y" }, postdoc: { school: null } } }]
      ]);
    `,
    context
  );

  const treeGraphData = {
    nodes: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
    edges: [{ from: "a", to: "b", label: "PhD advisor" }, { from: "c", to: "d", label: "PhD advisor" }],
    nodeIds: new Set(["a", "b", "c", "d"]),
    visiblePeopleCount: 4,
    treeHeights: new Map(),
    treeCount: 2,
  };

  const familyStructures = context.buildFamilyStructures(treeGraphData);
  context.syncFamilyStructures(familyStructures);
  context.setSelectedFamily("family:1");

  const filteredTree = context.buildSelectedFamilyTreeGraphData(treeGraphData);

  assert.deepEqual(filteredTree.nodes.map((node) => node.id).sort(), ["a", "b"]);
  assert.equal(filteredTree.treeCount, 2);
});

test("renderApp does not auto-select the first visible person", () => {
  const { context } = loadAppWithGraphMocks();
  const datasetPeople = [
    {
      id: "sizhe-chen",
      name: "Sizhe Chen",
      aliases: [],
      summary: "",
      work: { institution: "School X", note: null },
      tracking: { status: "active", priority: 0, note: null },
      sources: [],
      stages: {
        undergraduate: { school: null, note: null },
        masters: { school: null, note: null },
        phd: {
          school: "School X",
          graduationYear: 2020,
          advisorPersonId: null,
          advisorLabel: "Advisor",
          status: null,
          note: null,
        },
        postdoc: { school: null, advisorPersonId: null, advisorLabel: null, status: null, note: null },
      },
    },
  ];

  context.__testDataset = { people: datasetPeople };
  vm.runInContext('graphMode = "force"; dataset = __testDataset; selectedPersonId = null; selectedFamilyNodeId = null;', context);
  context.buildIndexes(datasetPeople);
  context.renderApp();

  assert.equal(vm.runInContext("selectedPersonId", context), null);
  assert.equal(context.document.getElementById("personName").textContent, "No selection");
});

test("same-school hire ranking excludes current phd students and missing graduation year", () => {
  const { context } = loadAppWithGraphMocks();

  const rows = context.buildSameSchoolHireRanking([
    {
      work: { institution: "School X" },
      stages: { phd: { school: "School X", graduationYear: 2020, status: null, note: null } },
    },
    {
      work: { institution: "School X" },
      stages: { phd: { school: "School X", graduationYear: null, status: null, note: null } },
    },
    {
      work: { institution: "School X" },
      stages: { phd: { school: "School X", graduationYear: 2025, status: "PhD student", note: null } },
    },
    {
      work: { institution: "School X" },
      stages: { phd: { school: "School Y", graduationYear: 2019, status: null, note: null } },
    },
  ]);

  assert.equal(rows[0].school, "School X");
  assert.equal(rows[0].known, 2);
  assert.equal(rows[0].sameSchool, 1);
  assert.equal(rows[0].rate, 0.5);
});

test("loadDataset fetches json first on hosted pages", async () => {
  const { context, windowStub } = loadAppWithGraphMocks();
  const inlineDataset = { people: [{ id: "ada-lovelace" }] };
  const fetchedDataset = { people: [{ id: "grace-hopper" }] };
  windowStub.__LINEAGE_DATASET__ = inlineDataset;
  let fetchCalls = 0;
  context.fetch = async (url, options) => {
    fetchCalls += 1;
    assert.equal(url, "./data/generated/lineage-dataset.json");
    assert.equal(options.cache, "no-store");
    return {
      ok: true,
      async json() {
        return fetchedDataset;
      },
    };
  };

  const dataset = await context.loadDataset();

  assert.equal(fetchCalls, 1);
  assert.equal(dataset, fetchedDataset);
});

test("loadDataset uses script fallback for direct file loads", async () => {
  const { context, windowStub } = loadAppWithGraphMocks();
  const inlineDataset = { people: [{ id: "ada-lovelace" }] };
  windowStub.location.protocol = "file:";

  context.document.createElement = () => ({
    set src(value) {
      this._src = value;
    },
    get src() {
      return this._src;
    },
  });
  context.document.head.append = (node) => {
    windowStub.__LINEAGE_DATASET__ = inlineDataset;
    node.onload();
  };

  const dataset = await context.loadDataset();

  assert.equal(dataset, inlineDataset);
});
