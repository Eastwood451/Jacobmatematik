/* Language choice and English exercise phrases. No browser required. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const context = {};
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, "lang.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(root, "i18n-strings.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(root, "i18n-en.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(root, "i18n.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(root, "brok-loeb-core.js"), "utf8"), context);
context.JacobLang = { get() { return context.__lang || "da"; } };

const resolve = context.JacobLangResolve;
const t = context.JacobI18n.translate;

assert.equal(resolve({ path: "/", search: "", stored: null, languages: ["da"], allowRedirect: true }).lang, "da");
assert.equal(resolve({ path: "/", search: "", stored: null, languages: ["da-DK"], allowRedirect: true }).redirect, null);
assert.equal(resolve({ path: "/", search: "", stored: "da", languages: ["en-GB"], allowRedirect: true }).lang, "da");
assert.equal(resolve({ path: "/", search: "", stored: "da", languages: ["en-GB"], allowRedirect: true }).redirect, null);
assert.equal(resolve({ path: "/", search: "", stored: "en", languages: ["da"], allowRedirect: true }).lang, "en");
assert.equal(resolve({ path: "/", search: "", stored: "en", languages: ["da"], allowRedirect: true }).redirect, null);

const explicit = resolve({ path: "/en/", search: "", stored: "da", languages: ["da"], allowRedirect: true });
assert.equal(explicit.lang, "en");
assert.equal(explicit.persist, "en");
assert.equal(explicit.redirect, null);

const query = resolve({ path: "/", search: "?lang=en&start=multiplication", stored: null, languages: ["da"], allowRedirect: true });
assert.equal(query.lang, "en");
assert.equal(query.persist, "en");
assert.equal(query.redirect, null);
assert.equal(query.stripLang, true);

const deep = resolve({ path: "/", search: "?start=tableDrill", stored: null, languages: ["en-US"], isBot: false, allowRedirect: true });
assert.equal(deep.lang, "en");
assert.equal(deep.persist, "en");
assert.equal(deep.redirect, null);

const danishDeep = resolve({ path: "/", search: "?start=tableDrill", stored: null, languages: ["da"], allowRedirect: true });
assert.equal(danishDeep.lang, "da");
assert.equal(danishDeep.persist, null);

const bounce = resolve({ path: "/", search: "", stored: null, languages: ["en-GB"], isBot: false, hasSession: false, allowRedirect: true, enHref: "/en/" });
assert.equal(bounce.redirect, "/en/");
assert.equal(resolve({ path: "/", search: "", stored: null, languages: ["en-GB"], hasSession: true, allowRedirect: true }).redirect, null);
assert.equal(resolve({ path: "/", search: "", stored: null, languages: ["en-GB"], isBot: true, allowRedirect: true }).redirect, null);

assert.equal(t("Det korrekte svar er"), "The correct answer is");
assert.equal(context.JacobI18n.t("exercise_hint_type_below"), "Skriv dit svar nedenfor.");
context.__lang = "en";
assert.equal(context.JacobI18n.t("exercise_hint_type_below"), "Type your answer below.");
assert.equal(context.JacobI18n.t("exercise_question_n", { n: 4 }), "Question 4");
assert.equal(context.JacobI18n.t("angles_canvas_groove", { deg: 60 }), "Groove: 60°");
assert.equal(context.JacobI18n.t("angles_canvas_pipe_to_groove"), "Pipe cleaner → groove");
assert.equal(context.JacobI18n.t("runner_canvas_duck"), "DUCK!");
assert.equal(context.JacobI18n.t("runner_canvas_school"), "SCHOOL");
assert.equal(context.JacobI18n.t("exercise_undefined_answer"), "Cannot be calculated");
assert.equal(context.JacobI18n.t("not_a_semantic_key"), null);
assert.equal(t("Skriv dit svar nedenfor."), "Type your answer below.");
assert.equal(t("Gang før plus."), "Multiply before you add.");

const coverage = context.JacobI18n.coverage();
assert.equal(coverage.legacyPhrases, 0, "All static phrases must live under semantic keys in window.JacobI18nStrings");
assert.equal(coverage.legacyIsNotSemantic, false);
assert.ok(coverage.semanticKeys.length >= 1350, "Expected at least 1350 semantic keys");
assert.ok(coverage.semanticKeys.includes("home_prompt"));
assert.ok(coverage.semanticKeys.includes("runner_canvas_school"));
assert.ok(coverage.semanticKeys.includes("runner_canvas_duck"));
assert.ok(coverage.semanticKeys.includes("angles_canvas_groove"));
assert.ok(coverage.semanticKeys.includes("exercise_undefined_answer"));
for (const key of coverage.semanticKeys) {
  const entry = context.JacobI18nStrings[key];
  assert.equal(typeof entry.da, "string", key);
  assert.equal(typeof entry.en, "string", key);
  assert.ok(entry.da.length > 0, key + ".da must not be empty");
  assert.ok(entry.en.length > 0, key + ".en must not be empty");
}

// Verify all BrokLoebCore levels, rules, questions, and verbal answers/distractors translate cleanly
const brokCore = context.window.JacobBrokLoebCore;
for (const lv of brokCore.LEVELS) {
  assert.notEqual(t(lv.name), lv.name, "Untranslated BrokLoeb level: " + lv.name);
}
for (const [rk, rv] of Object.entries(brokCore.RULES)) {
  assert.notEqual(t(rv.title), rv.title, "Untranslated BrokLoeb rule title: " + rk);
  assert.notEqual(t(rv.rule), rv.rule, "Untranslated BrokLoeb rule body: " + rk);
}
for (const item of brokCore.BANK) {
  if (/[a-zæøå]/i.test(item.q)) {
    assert.notEqual(t(item.q), item.q, "Untranslated BrokLoeb question: " + item.q);
  }
  for (const opt of [item.a, ...item.d]) {
    if (/[a-zæøå]/i.test(opt)) {
      assert.notEqual(t(opt), opt, "Untranslated BrokLoeb option: " + opt);
    }
  }
}

context.__lang = "da";
assert.equal(t("Skriv dit svar nedenfor."), "Type your answer below.");
assert.equal(t("Vælg eller skriv et svar først."), "Choose or type an answer first.");
assert.equal(t("Hej Gæst!"), "Hi Guest!");
assert.equal(t("Opgave 4"), "Question 4");
assert.equal(t("1 opgaver"), "1 problem");
assert.equal(t("3 opgaver"), "3 problems");
assert.equal(t("Hvad er 7 × 8?"), "What is 7 × 8?");
assert.equal(t("Gang før plus."), "Multiply before you add.");
assert.equal(t("Brugernavn eller adgangskode passer ikke."), "That username or password does not match.");
assert.equal(t("Løb med Øbbe og knus brøkreglerne!"), "Run with Paul and smash the fraction rules!");
assert.equal(t("ERLING FPS"), "ISAAC ISUCK FPS");
assert.equal(t("Ja! Det er et gangestykke."), "Yes! This is multiplication.");
assert.equal(t("FLOT! Du cooker de brøker!"), "YES! You are cooking these fractions!");
assert.equal(t("7 gange 8 er 56, forkert på 6.2 sekunder"), "7 times 8 is 56, wrong in 6.2 seconds");
assert.equal(t("4 + 5"), "4 + 5");
assert.equal(t("Jeg slapper din matematik-eksamen!"), "Jeg slapper din matematik-eksamen!");
assert.equal(t("Må vi måle besøg?"), "May we measure visits?");
assert.equal(t("Vælg vinkel, tryk Gå – hjælp Dennis til pizzaen."), "Choose an angle, press Go – help Dennis reach the pizza.");
assert.equal(t("Vil du slette Fixture class? 1 elev og deres fremskridt slettes permanent."), "Delete Fixture class? 1 student and their progress will be deleted permanently.");
assert.equal(t("Ja! Først gør vi nævnerne ens. Vi bruger fællesnævneren 6."), "Yes! First we make the denominators match. We use the common denominator 6.");
assert.equal(t("Koden findes ikke. Tjek den og prøv igen."), "That code does not exist. Check it and try again.");
assert.equal(t("Jeg slapper din matematik-eksamen!"), "Jeg slapper din matematik-eksamen!");

const luigi = fs.readFileSync(path.join(root, "scripts/generate_luigi_audio.py"), "utf8");
assert.match(luigi, /it-IT-DiegoNeural/);
const slapper = fs.readFileSync(path.join(root, "fps-voice-lines.json"), "utf8");
assert.match(slapper, /Jeg slapper din matematik-eksamen!/);
for (const file of ["plus-penalhus.js", "clock.js", "clock-core.js", "clock-course.js", "marley.js", "marley-pet.js"]) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  assert.equal(source.includes("JacobI18n"), false, file + " must stay untouched");
  assert.equal(source.includes("data-i18n-key"), false, file + " must not gain semantic keys");
}
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.equal(index.match(/<script src="app\.js/g).length, 1);
assert.match(index, /i18n-strings\.js/);
const englishLanding = fs.readFileSync(path.join(root, "en/index.html"), "utf8");
assert.match(englishLanding, /href="\/\?lang=en"/);
assert.doesNotMatch(englishLanding, /JacobI18nStrings/);

console.log("i18n tests passed (" + coverage.semanticKeys.length + " semantic keys verified)");
