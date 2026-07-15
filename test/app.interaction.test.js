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
