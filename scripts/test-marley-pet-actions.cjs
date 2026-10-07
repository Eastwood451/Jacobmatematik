const fs = require("fs");
const vm = require("vm");
const assert = require("assert");
const path = require("path");

let now = 0;
let rafCbs = [];
let intervals = [];
let timeouts = [];

class FakeEl {
  constructor(tag) {
    this.tag = tag;
    this.style = {};
    this.dataset = {};
    this.classList = {
      _s: new Set(),
      add(...a) {
        a.forEach((x) => this._s.add(x));
      },
      remove(...a) {
        a.forEach((x) => this._s.delete(x));
      },
      toggle(c, f) {
        if (f === undefined) this._s.has(c) ? this._s.delete(c) : this._s.add(c);
        else if (f) this._s.add(c);
        else this._s.delete(c);
      },
      contains(c) {
        return this._s.has(c);
      }
    };
    this.children = [];
    this.attrs = {};
  }
  setAttribute(k, v) {
    this.attrs[k] = v;
  }
  append(...n) {
    this.children.push(...n);
  }
  set src(v) {
    this._src = v;
    FakeEl.srcs.push(v);
  }
  get src() {
    return this._src;
  }
  set textContent(v) {
    this._t = v;
  }
  get textContent() {
    return this._t;
  }
  set innerHTML(v) {
    this._h = v;
  }
  get innerHTML() {
    return this._h;
  }
  set hidden(v) {
    this._hidden = v;
  }
  get hidden() {
    return this._hidden;
  }
  play() {
    this._playing = true;
    return Promise.resolve();
  }
  pause() {
    this._playing = false;
  }
  load() {}
  removeAttribute(k) {
    delete this.attrs[k];
    if (k === "src") this._src = "";
  }
}
FakeEl.srcs = [];

function tick(ms) {
  now += ms;
  const cbs = rafCbs.splice(0);
  cbs.forEach((f) => f(now));
  intervals.forEach((iv) => {
    iv.acc += ms;
    while (iv.acc >= iv.ms) {
      iv.acc -= iv.ms;
      iv.fn();
    }
  });
  timeouts = timeouts.filter((t) => {
    t.ms -= ms;
    if (t.ms <= 0) {
      t.fn();
      return false;
    }
    return true;
  });
}

function makeHost() {
  return {
    replaceChildren() {
      this.children = [];
      for (const k of Object.keys(this.dataset)) delete this.dataset[k];
    },
    append(...n) {
      this.children = (this.children || []).concat(n);
    },
    dataset: {},
    children: []
  };
}

function loadPet(reduced, fetchImpl) {
  now = 0;
  rafCbs = [];
  intervals = [];
  timeouts = [];
  FakeEl.srcs = [];
  const ctx = {
    window: {},
    matchMedia: () => ({ matches: !!reduced }),
    performance: { now: () => now },
    requestAnimationFrame: (f) => {
      rafCbs.push(f);
      return 1;
    },
    cancelAnimationFrame() {},
    setInterval: (fn, ms) => {
      const id = { fn, ms, acc: 0 };
      intervals.push(id);
      return id;
    },
    clearInterval: (id) => {
      intervals = intervals.filter((x) => x !== id);
    },
    setTimeout: (fn, ms) => {
      const id = { fn, ms };
      timeouts.push(id);
      return id;
    },
    clearTimeout: (id) => {
      timeouts = timeouts.filter((x) => x !== id);
    },
    document: { createElement: (t) => new FakeEl(t) },
    fetch:
      fetchImpl ||
      (() => Promise.resolve({ ok: false })),
    Date,
    Math,
    Set,
    Object,
    Error,
    Promise
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../marley-pet.js"), "utf8"), ctx);
  return ctx.window.MarleyPetScene;
}

(async () => {
  const Scene = loadPet(false);
  const host = makeHost();
  const scene = await Scene.create(host, () => {});

  assert.strictEqual(Scene.CACHE, "20261007-premium1", "CACHE premium1");
  assert(/wag-a\.png/.test(Scene.POSES.wagA), "POSES.wagA");
  assert(/wag-b\.png/.test(Scene.POSES.wagB), "POSES.wagB");

  FakeEl.srcs = [];
  for (let i = 0; i < 30; i++) tick(20);
  assert(
    FakeEl.srcs.filter((u) => /walk-[ab]/.test(u)).length >= 2,
    "idle roam walk-a/b"
  );

  FakeEl.srcs = [];
  scene.play("wag");
  assert(FakeEl.srcs.some((u) => /wag-a/.test(u)), "wag → wag-a");
  for (let i = 0; i < 40; i++) tick(20);
  assert(FakeEl.srcs.some((u) => /wag-b/.test(u)), "wag → wag-b");

  FakeEl.srcs = [];
  scene.play("smile");
  assert(FakeEl.srcs.some((u) => /sit\.png/.test(u)), "smile → sit");

  FakeEl.srcs = [];
  scene.play("run");
  for (let i = 0; i < 50; i++) tick(20);
  assert(FakeEl.srcs.filter((u) => /walk-[ab]/.test(u)).length >= 2, "run walk swap");

  FakeEl.srcs = [];
  scene.play("bed");
  assert(FakeEl.srcs.some((u) => /sit\.png/.test(u)), "bed → sit");

  const n = FakeEl.srcs.length;
  scene.pause(true);
  for (let i = 0; i < 30; i++) tick(20);
  assert.strictEqual(FakeEl.srcs.length, n, "pause freezes");

  // Second Logre must still animate (never no-op)
  scene.pause(false);
  scene.play("wag");
  FakeEl.srcs = [];
  for (let i = 0; i < 25; i++) tick(20);
  assert(FakeEl.srcs.some((u) => /wag-[ab]/.test(u)), "wag never no-op");

  const SceneR = loadPet(true);
  const hostR = makeHost();
  const sceneR = await SceneR.create(hostR, () => {});
  assert.strictEqual(hostR.dataset.placeholder, "1");
  FakeEl.srcs = [];
  sceneR.play("wag");
  for (let i = 0; i < 20; i++) tick(140);
  assert(
    FakeEl.srcs.some((u) => /wag-a/.test(u)) && FakeEl.srcs.some((u) => /wag-b/.test(u)),
    "reduced wag swaps wag-a/b"
  );

  FakeEl.srcs = [];
  sceneR.play("run");
  for (let i = 0; i < 30; i++) tick(110);
  assert(
    FakeEl.srcs.some((u) => /walk-a/.test(u)) && FakeEl.srcs.some((u) => /walk-b/.test(u)),
    "reduced run swaps walk-a/b"
  );

  // Video loops preferred when HEAD probe succeeds (G&M wag-loop / walk-loop)
  const okUrls = new Set([
    "assets/figurer/marley-pet/wag-loop.webm?v=20261007-premium1",
    "assets/figurer/marley-pet/walk-loop.webm?v=20261007-premium1"
  ]);
  const SceneV = loadPet(false, (url) =>
    Promise.resolve({ ok: okUrls.has(String(url).split("#")[0]) })
  );
  assert(SceneV.LOOP_CANDIDATES.wag[0].includes("wag-loop.webm"), "loop candidates");
  const hostV = makeHost();
  const sceneV = await SceneV.create(hostV, () => {});
  function findVideo(node, acc = []) {
    if (!node) return acc;
    if (node.tag === "video") acc.push(node);
    (node.children || []).forEach((c) => findVideo(c, acc));
    return acc;
  }
  const vids = findVideo({ children: hostV.children });
  assert.strictEqual(vids.length, 1, "video plate mounted when loops probe OK");
  FakeEl.srcs = [];
  sceneV.play("wag");
  for (let i = 0; i < 10; i++) tick(20);
  assert.strictEqual(vids[0].hidden, false, "wag shows video");
  assert(/wag-loop/.test(vids[0].src || vids[0].attrs.src || ""), "wag-loop src");
  assert(
    !FakeEl.srcs.some((u) => /wag-[ab]\.png/.test(u)),
    "no PNG wag swap when video present"
  );

  console.log("PASS: marley pet actions (wag/smile/run/bed/pause + reduced + webm prefer)");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
