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

  return { context, networkInstances, windowStub };
}

test("renderGraph keeps canvas dragging enabled in force mode", () => {
  const { context, networkInstances, windowStub } = loadAppWithGraphMocks();
  vm.runInContext('graphMode = "force";', context);

  context.renderGraph({
    nodes: [{ id: "ada-lovelace", label: "Ada Lovelace", group: "person-active", title: "Ada" }],
    edges: [],
    nodeIds: new Set(["ada-lovelace"]),
  });

  assert.equal(networkInstances.length, 1);
  assert.equal(networkInstances[0].options.interaction.dragView, true);
  assert.equal(networkInstances[0].options.interaction.dragNodes, true);
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
