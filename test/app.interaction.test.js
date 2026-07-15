const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createElementStub() {
  return {
    hidden: false,
    innerHTML: "",
    textContent: "",
    value: "",
    dataset: {},
    clientWidth: 960,
    clientHeight: 640,
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() {
        return false;
      },
    },
    addEventListener() {},
    removeEventListener() {},
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
    addEventListener() {},
    removeEventListener() {},
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
  assert.equal(forceGraphInstances[0].lastGraphData.nodes[0].id, "ada-lovelace");
  assert.equal(windowStub.__lineageNetwork, forceGraphInstances[0]);
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

test("stats badge shows average coverage instead of total profiles", () => {
  const { context } = loadAppWithGraphMocks();

  const people = [
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
  ];

  context.dataset = { people };
  context.renderStats(people, {
    nodes: [{ id: "a" }, { id: "b" }],
    edges: [],
    nodeIds: new Set(["a", "b"]),
    visiblePeopleCount: 2,
  });

  const totalCount = context.document.getElementById("totalCount");
  assert.equal(totalCount.textContent, "28.6% avg coverage");
});

test("stats badge computes average coverage for force family nodes", () => {
  const { context } = loadAppWithGraphMocks();
  const people = [
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
        }]
      ]);
      forceFamilyPersonIdsByNodeId = new Map([["family:1", ["a", "b"]]]);
    `,
    context
  );

  context.dataset = { people };
  context.renderStats(people, {
    nodes: [{ id: "family:1" }],
    edges: [],
    nodeIds: new Set(["family:1"]),
    visiblePeopleCount: 2,
  });

  const totalCount = context.document.getElementById("totalCount");
  assert.equal(totalCount.textContent, "28.6% avg coverage");
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
