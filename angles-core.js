/* Pure angle-lesson helpers (no DOM). Used by angles.js, games, and unit tests. */
(() => {
  "use strict";

  function normalizeDeg(deg) {
    let d = Number(deg) || 0;
    d = ((d % 360) + 360) % 360;
    return d;
  }

  function shortestDelta(from, to) {
    from = normalizeDeg(from);
    to = normalizeDeg(to);
    let d = to - from;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  }

  function angleFromPoint(cx, cy, x, y) {
    // 0° = ray to the right (east); increases counter-clockwise.
    const rad = Math.atan2(cy - y, x - cx);
    let deg = (rad * 180) / Math.PI;
    if (deg < 0) deg += 360;
    if (deg > 180) deg = 360 - deg;
    return Math.round(deg);
  }

  /** Absolute screen heading of a point from center (0° = east, CCW, 0..360). */
  function headingFromPoint(cx, cy, x, y) {
    const rad = Math.atan2(cy - y, x - cx);
    let deg = (rad * 180) / Math.PI;
    if (deg < 0) deg += 360;
    return normalizeDeg(deg);
  }

  /** Acute/obtuse wedge (0..180) between two absolute headings. */
  function wedgeBetween(a, b) {
    let d = Math.abs(normalizeDeg(a) - normalizeDeg(b));
    if (d > 180) d = 360 - d;
    return Math.round(d);
  }

  /** Angle of a swipe line vs a reference heading (default 0° = horizontal right). */
  function swipeAngleVsReference(x0, y0, x1, y1, refDeg = 0) {
    const heading = headingFromPoint(x0, y0, x1, y1);
    return wedgeBetween(heading, refDeg);
  }

  function withinTolerance(actual, target, tol) {
    return Math.abs(Number(actual) - Number(target)) <= Number(tol);
  }

  function hintDirection(actual, target) {
    const a = Number(actual);
    const t = Number(target);
    if (Math.abs(a - t) <= 0.5) return "ok";
    return a < t ? "more" : "less";
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /**
   * Build up to `count` distinct angles as multiples of `increment` in 0..180.
   * When fewer distinct values exist, duplicates are allowed; callers should
   * vary rotation so identical angles look different.
   */
  function anglesForIncrement(increment, count = 16) {
    const inc = Math.max(1, Number(increment) || 45);
    const set = [];
    // Skip 0° — a single ray is not a meaningful angle for kids.
    for (let a = inc; a <= 180; a += inc) set.push(a);
    if (set[set.length - 1] !== 180 && 180 % inc !== 0) set.push(180);
    const unique = [...new Set(set)].filter((a) => a > 0 && a <= 180);
    if (unique.length >= count) return shuffle(unique).slice(0, count);
    const out = [];
    while (out.length < count) out.push(...shuffle(unique));
    return out.slice(0, count);
  }

  /** Round descriptors: base ray rotation (deg) + angle size. */
  function makeAngleTiles(increment, count = 16, varyRotation = true) {
    const sizes = anglesForIncrement(increment, count);
    return sizes.map((size, i) => ({
      id: i,
      degrees: size,
      // Random base orientation so the same angle is not always horizontal.
      baseDeg: varyRotation ? Math.floor(Math.random() * 360) : 0,
    }));
  }


  const ANGLE_REAL_NAMES = ["spids", "ret", "stump", "lige"];
  const ANGLE_DECOY_NAMES = ["åben", "hel", "ulige", "skarp", "flad", "kantet", "skrå", "bred", "skjult"];

  /** Classify 0..180 (excl. 0) into Danish school terms. */
  function nameAngleKind(degrees) {
    const d = Math.round(Number(degrees));
    if (!(d > 0 && d <= 180)) return null;
    if (d < 90) return "spids";
    if (d === 90) return "ret";
    if (d < 180) return "stump";
    return "lige";
  }

  function explainAngleKind(kind) {
    const map = {
      spids: "Spids betyder mindre end 90°.",
      ret: "Ret betyder præcis 90° – som hjørnet af et bord.",
      stump: "Stump betyder større end 90° men mindre end 180°.",
      lige: "Lige betyder præcis 180° – som en flad linje.",
    };
    return map[kind] || "";
  }

  /**
   * Build 9 word buttons: always the correct real name + 2 other reals + 6 decoys.
   * "lige" is never treated as a decoy (only as a real term).
   */
  function wordsForRound(correctKind) {
    const reals = ANGLE_REAL_NAMES.filter((n) => n !== correctKind);
    const otherReals = shuffle(reals).slice(0, 2);
    const decoys = shuffle(ANGLE_DECOY_NAMES).slice(0, 6);
    return shuffle([correctKind, ...otherReals, ...decoys]);
  }

  const ROUND_INCREMENTS = [45, 30, 15, 10, 5];
  const SHIP_COUNT = 5;

  const PRECISE_TASKS = [60, 45, 15];
  const FEEL_TASKS = [45, 90, 60];
  const PRECISE_TOL = 2;
  const FEEL_TOL = 8;
  const PIPE_TARGET = 60;
  const PIPE_TOL = 10;

  const api = {
    normalizeDeg,
    shortestDelta,
    angleFromPoint,
    headingFromPoint,
    wedgeBetween,
    swipeAngleVsReference,
    withinTolerance,
    hintDirection,
    shuffle,
    anglesForIncrement,
    makeAngleTiles,
    nameAngleKind,
    explainAngleKind,
    wordsForRound,
    ANGLE_REAL_NAMES,
    ANGLE_DECOY_NAMES,
    ROUND_INCREMENTS,
    SHIP_COUNT,
    PRECISE_TASKS,
    FEEL_TASKS,
    PRECISE_TOL,
    FEEL_TOL,
    PIPE_TARGET,
    PIPE_TOL,
  };

  if (typeof window !== "undefined") window.JacobAnglesCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
