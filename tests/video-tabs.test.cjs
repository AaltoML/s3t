const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

class EventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatchEvent(event) {
    event.target ||= this;
    event.preventDefault ||= () => {};
    for (const listener of this.listeners.get(event.type) || []) listener(event);
  }
}

class Tab extends EventTarget {
  constructor(panelId, selected = false) {
    super();
    this.attributes = new Map([
      ["aria-controls", panelId],
      ["aria-selected", String(selected)],
    ]);
    this.tabIndex = selected ? 0 : -1;
    this.focused = false;
  }

  getAttribute(name) {
    return this.attributes.get(name);
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  focus() {
    this.focused = true;
  }
}

class Video extends EventTarget {
  constructor({ rejectPlay = false } = {}) {
    super();
    this.currentTime = 7;
    this.pauseCount = 0;
    this.playCount = 0;
    this.rejectPlay = rejectPlay;
  }

  pause() {
    this.pauseCount += 1;
  }

  play() {
    this.playCount += 1;
    return this.rejectPlay
      ? Promise.reject(new Error("autoplay blocked"))
      : Promise.resolve();
  }
}

class Panel {
  constructor(id, video = null, hidden = true) {
    this.id = id;
    this.video = video;
    this.hidden = hidden;
  }

  querySelector(selector) {
    return selector === "video" ? this.video : null;
  }

  querySelectorAll(selector) {
    return selector === "video" && this.video ? [this.video] : [];
  }
}

function createPage({ rejectFirstPlay = false } = {}) {
  const videos = [
    new Video({ rejectPlay: rejectFirstPlay }),
    new Video(),
    new Video(),
  ];
  const panels = [
    new Panel("video-a-panel", videos[0], false),
    new Panel("video-b-panel", videos[1]),
    new Panel("video-c-panel", videos[2]),
    new Panel("prefix-panel"),
  ];
  const tabs = panels.map((panel, index) => new Tab(panel.id, index === 0));
  const panelById = new Map(panels.map((panel) => [panel.id, panel]));
  const root = {
    dataset: { tabs: "videos" },
    querySelectorAll: (selector) => selector === '[role="tab"]' ? tabs : [],
  };

  const topButton = new EventTarget();
  topButton.classList = { toggle() {} };
  const worksButton = new EventTarget();
  worksButton.attributes = new Map([["aria-expanded", "false"]]);
  worksButton.getAttribute = (name) => worksButton.attributes.get(name);
  worksButton.setAttribute = (name, value) => worksButton.attributes.set(name, value);
  const worksPanel = { hidden: true };
  const closeButton = new EventTarget();

  const document = new EventTarget();
  document.body = {};
  document.querySelector = (selector) => ({
    ".scroll-to-top": topButton,
    ".more-works-btn": worksButton,
    ".more-works-dropdown": worksPanel,
    ".close-btn": closeButton,
  })[selector];
  document.querySelectorAll = (selector) => selector === "[data-tabs]" ? [root] : [];
  document.getElementById = (id) => panelById.get(id);

  const window = new EventTarget();
  window.scrollY = 0;
  window.scrollTo = () => {};

  const scriptPath = path.join(__dirname, "..", "static", "js", "index.js");
  vm.runInNewContext(fs.readFileSync(scriptPath, "utf8"), {
    document,
    window,
  });
  document.dispatchEvent({ type: "DOMContentLoaded" });

  return { tabs, panels, videos };
}

function selectedTabIndex(tabs) {
  return tabs.findIndex((tab) => tab.getAttribute("aria-selected") === "true");
}

test("ending the active video selects and plays the next video sample", () => {
  const { tabs, panels, videos } = createPage();

  videos[0].dispatchEvent({ type: "ended" });

  assert.equal(selectedTabIndex(tabs), 1);
  assert.equal(panels[1].hidden, false);
  assert.equal(videos[1].currentTime, 0);
  assert.equal(videos[1].playCount, 1);
});

test("manual selection sets the starting point for the next automatic advance", () => {
  const { tabs, videos } = createPage();

  tabs[1].dispatchEvent({ type: "click" });
  videos[1].dispatchEvent({ type: "ended" });

  assert.equal(selectedTabIndex(tabs), 2);
  assert.equal(videos[2].playCount, 1);
});

test("the last video wraps to the first and skips tabs without video", async () => {
  const { tabs, videos } = createPage({ rejectFirstPlay: true });

  tabs[2].dispatchEvent({ type: "click" });
  videos[2].dispatchEvent({ type: "ended" });
  await Promise.resolve();

  assert.equal(selectedTabIndex(tabs), 0);
  assert.equal(videos[0].playCount, 1);
});

test("ending a hidden video does not change the selected sample", () => {
  const { tabs, videos } = createPage();

  videos[1].dispatchEvent({ type: "ended" });

  assert.equal(selectedTabIndex(tabs), 0);
  assert.equal(videos[2].playCount, 0);
});
