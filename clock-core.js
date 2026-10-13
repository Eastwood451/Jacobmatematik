/* Danish clock language. Pure functions shared by the exercise and checks. */
(function (root) {
  "use strict";
  const TYPES = ["over", "to", "half", "quarter-over", "quarter-to"];
  const nextHour = hour => hour === 12 ? 1 : hour + 1;
  function describe(hour, minute, type) {
    if (!Number.isInteger(hour) || hour < 1 || hour > 12 || !Number.isInteger(minute) || minute < 1 || minute > 59) throw new RangeError("Invalid clock time");
    const upcoming = nextHour(hour);
    type = type || (minute === 15 ? "quarter-over" : minute === 30 ? "half" : minute === 45 ? "quarter-to" : minute < 30 ? "over" : "to");
    if (!TYPES.includes(type) || (type === "over" && minute >= 30) || (type === "to" && minute <= 30) || (type === "half" && minute !== 30) || (type === "quarter-over" && minute !== 15) || (type === "quarter-to" && minute !== 45)) throw new RangeError("Time does not match phrase");
    const namedHour = ["to", "half", "quarter-to"].includes(type) ? upcoming : hour;
    const count = type === "to" || type === "quarter-to" ? 60 - minute : minute;
    const prefix = type === "half" ? "halv" : type === "quarter-over" ? "kvart over" : type === "quarter-to" ? "kvart i" : `${count} ${count === 1 ? "minut" : "minutter"} ${type === "over" ? "over" : "i"}`;
    return { hour, minute, type, namedHour, count, prefix, phrase: `${prefix} ${namedHour}`, hourAngle: (hour % 12) * 30 + minute / 2, minuteAngle: minute * 6 };
  }
  function makeDeck(type = "mixed", step = 5, random = Math.random) {
    if (type !== "mixed" && !TYPES.includes(type)) throw new RangeError("Invalid phrase type");
    if (![1, 5].includes(step)) throw new RangeError("Invalid minute step");
    const minutes = ["half", "quarter-over", "quarter-to"].includes(type) ? [type === "half" ? 30 : type === "quarter-over" ? 15 : 45] : Array.from({length:59}, (_, i) => i + 1).filter(m => m % step === 0 && (type === "mixed" || (type === "over" ? m < 30 : m > 30)));
    const deck = [];
    for (let h = 1; h <= 12; h++) for (const m of minutes) deck.push(describe(h, m, type === "mixed" ? undefined : type));
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    return deck;
  }
  function fields(task, mode) {
    if (!["minutes", "hour", "both"].includes(mode)) throw new RangeError("Invalid answer mode");
    if (["half", "quarter-over", "quarter-to"].includes(task.type)) return ["hour"];
    return mode === "both" ? ["minutes", "hour"] : [mode];
  }
  function validate(task, mode, answers) {
    const expected = {minutes:task.count, hour:task.namedHour};
    const needed = fields(task, mode);
    const missing = needed.filter(key => !/^\d{1,2}$/.test(String(answers[key] ?? "").trim()));
    const wrong = needed.filter(key => missing.includes(key) || Number(answers[key]) !== expected[key]);
    return {correct:!wrong.length, missing, wrong, expected};
  }
  function hourGuide(task) {
    const before = task.minute < 30;
    return {
      side: task.minute === 30 ? "half" : before ? "right" : "left",
      direction: before ? "before" : "after",
      namedHour: task.namedHour,
      startAngle: task.hourAngle,
      endAngle: task.hourAngle + (before ? -task.minute / 2 : (60 - task.minute) / 2),
      label: task.minute === 30 ? "HALV · timen EFTER" : before ? "OVER · timen FØR" : "I · timen EFTER",
      rule: task.minute === 30 ? "Stor viser på 6: halv betyder den kommende time. Vælg timen EFTER den lille viser." : before ? "Stor viser i højre halvdel: vælg timen FØR den lille viser." : "Stor viser i venstre halvdel: vælg timen EFTER den lille viser.",
    };
  }
  function explain(task) {
    const hourText = ["to", "half", "quarter-to"].includes(task.type) ? `Den korte viser er på vej mod ${task.namedHour}.` : `Den korte viser har passeret ${task.hour}.`;
    const minuteText = task.type === "half" ? "Den lange viser står på 6: der er gået 30 minutter. Halv betyder halvvejs til den næste time." : task.type.startsWith("quarter") ? `En kvart time er 15 minutter. ${task.type === "quarter-to" ? "Der er 15 minutter til den næste time." : "Der er gået 15 minutter siden timen."}` : task.type === "to" ? `Der er ${task.count} ${task.count === 1 ? "minut" : "minutter"} tilbage til den næste time. Derfor siger vi “i”.` : `Der er gået ${task.count} ${task.count === 1 ? "minut" : "minutter"} siden timen. Derfor siger vi “over”.`;
    return `${minuteText} ${hourText}`;
  }
  const api = Object.freeze({TYPES, nextHour, describe, makeDeck, fields, validate, hourGuide, explain});
  root.JacobClockCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
