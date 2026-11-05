/* Pure angle-lesson helpers (no DOM). Used by angles.js and unit tests. */
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
    // 0° = ray to the right (east); increases counter-clockwise (math convention for kids: open from the fixed ray).
    // For UI we use the absolute angle of the movable ray from the positive x-axis, 0..180 for the lesson.
    const rad = Math.atan2(cy - y, x - cx); // screen y grows down → flip
    let deg = (rad * 180) / Math.PI;
    if (deg < 0) deg += 360;
    // Clamp interactive lessons to the upper half (0..180) so kids drag a clean wedge.
    if (deg > 180) {
      // Mirror below the x-axis into 0..180 for the wedge size kids are building.
      deg = 360 - deg;
    }
    return Math.round(deg);
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
    withinTolerance,
    hintDirection,
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
