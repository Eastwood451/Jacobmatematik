"""Apply a small, checked integration to the existing framework-free app.

One-time installer used on the feature branch. It refuses ambiguous anchors and
is safe to re-run. The resulting app.js is normal source, not a runtime patch.
"""
from pathlib import Path
import re

path = Path('app.js')
text = path.read_text(encoding='utf-8')
marker = '  // Jacob fraction pilot: view state is not an authorization role.'

def replace_once(old, new):
    global text
    if text.count(old) != 1:
        raise SystemExit(f'Expected one app anchor, found {text.count(old)}: {old[:100]}')
    text = text.replace(old, new, 1)

if marker not in text:
    # Teacher preview answers must not be submitted as student results.
    old = 'backend.appendResult(state.user.id,'
    if old not in text:
        raise SystemExit('No existing result writer found')
    text = text.replace(old, 'appendCurrentPracticeResult(')
    bridge = r'''
  // Jacob fraction pilot: view state is not an authorization role.
  const isFractionTester = () => window.JacobFractionLesson?.isEnabled(state.user) === true;
  let jacobFrontend = false;
  let switchingJacobView = false;
  let disposeFractionLesson = null;
  const appendCurrentPracticeResult = result => isFractionTester()
    ? Promise.resolve(null) // Teacher preview is session-only; never impersonate a student.
    : backend.appendResult(state.user.id, result);
  function leaveFractionLesson() {
    disposeFractionLesson?.(); disposeFractionLesson = null;
  }
  function renderFractionLesson() {
    leaveFractionLesson();
    if (!isFractionTester()) { state.view = state.user?.role === "teacher" ? "teacher" : "student"; render(); return; }
    jacobFrontend = true;
    app.innerHTML = `${header()}<div id="fraction-lesson-root"></div>`;
    disposeFractionLesson = window.JacobFractionLesson.mount(document.getElementById("fraction-lesson-root"), {
      user: state.user,
      onExit() { leaveFractionLesson(); state.view="student"; renderStudentHome(); window.scrollTo(0,0); },
    });
  }
  function jacobViewButton() {
    if (!isFractionTester()) return "";
    return `<button type="button" class="jacob-view-switch" data-action="toggle-jacob-view" role="switch" aria-checked="${jacobFrontend}" aria-label="Front-end" title="Skift mellem front-end og back-end"><span class="${jacobFrontend ? "active" : ""}">Front-end</span><span class="${!jacobFrontend ? "active" : ""}">Back-end</span></button>${!jacobFrontend ? `<button type="button" class="btn secondary fraction-pilot-link" data-action="learn-fractions">Lær brøkregning · test</button>` : ""}`;
  }
  function fractionPilotCard() {
    return isFractionTester() ? `<button type="button" class="topic-card fraction-pilot-card" data-action="learn-fractions"><em>Test · kun Jacob</em><span class="topic-icon">½ : ¾</span><strong>Lær brøkregning</strong><small>Find regnearten, og vælg den rigtige regneregel.</small></button>` : "";
  }
'''
    anchor = '  const usingCentralDatabase = Boolean(backend?.configured);'
    replace_once(anchor, anchor + '\n' + bridge)
    replace_once('    const userLabel = state.user.role === "teacher"', '    const userLabel = isFractionTester() && jacobFrontend ? "Jacob · Front-end" : state.user.role === "teacher"')
    replace_once('${passwordButton}<button class="btn ghost" data-action="logout">', '${passwordButton}${jacobViewButton()}<button class="btn ghost" data-action="logout">')
    replace_once('<section class="topic-grid">${availableTopics.map', '<section class="topic-grid">${fractionPilotCard()}${availableTopics.map')
    replace_once('  function renderLogin() {\n    leaveFoodtruck();', '  function renderLogin() {\n    leaveFractionLesson(); jacobFrontend=false;\n    leaveFoodtruck();')
    replace_once('  function newTask() {\n    const topic', '  function newTask() {\n    if (!state.user || state.view !== "exercise") return;\n    const topic')
    replace_once('  function render() { if (!state.user)', '  function render() { if (state.view !== "learn-fractions") leaveFractionLesson(); if (!state.user)')
    replace_once('else if (state.view==="foodtruck") renderFoodtruck();', 'else if (state.view==="learn-fractions") renderFractionLesson(); else if (state.view==="foodtruck") renderFoodtruck();')
    replace_once('    if (topicButton) {\n      if (isGuest()', '    if (topicButton) {\n      leaveFractionLesson();\n      if (isGuest()')
    handlers = r'''
    if (["toggle-jacob-view", "learn-fractions"].includes(action)) {
      event.preventDefault();
      if (!isFractionTester() || switchingJacobView) return;
      switchingJacobView=true;
      const userId=state.user.id;
      try {
        if (state.matrixDrill && !state.matrixDrill.finalizedAt) await finalizeMatrixDrillSession("abandoned");
        if (state.user?.id !== userId || !isFractionTester()) return;
        leaveFractionLesson(); leaveFoodtruck(); stopMatrixDrillTimer(); stopTeacherLiveUpdates();
        stopErlingAudio(); stopKaptajnAudio(); stopLuigiAudio(); stopLetterLearningAudio();
        clearDivisionLollipopDrag(); clearBorrowingSubtractionDrag();
        state.task=null; state.matrixDrill=null;
        jacobFrontend=action === "learn-fractions" ? true : !jacobFrontend;
        state.view=action === "learn-fractions" ? "learn-fractions" : jacobFrontend ? "student" : "teacher";
        render(); window.scrollTo(0,0);
      } finally { switchingJacobView=false; }
      return;
    }
    if (["logout", "home", "change-password", "foodtruck", "foodtruck-home"].includes(action)) leaveFractionLesson();
    if (action === "logout") jacobFrontend=false;
'''
    replace_once('    const action=actionButton.dataset.action;\n', '    const action=actionButton.dataset.action;\n' + handlers)
    replace_once('leaveFoodtruck(); state.view=state.user?.role === "teacher" ? "teacher" : "student";', 'leaveFoodtruck(); state.view=state.user?.role === "teacher" && !jacobFrontend ? "teacher" : "student";')
    replace_once('  window.addEventListener("pagehide", () => {\n', '  window.addEventListener("pagehide", () => {\n    leaveFractionLesson();\n')
    path.write_text(text,encoding='utf-8')

index = Path('index.html')
html = index.read_text(encoding='utf-8')
if 'fraction-lesson.css' not in html:
    anchor = '  <link rel="stylesheet" href="foodtruck.css?v=20260914-food1">'
    if html.count(anchor) != 1: raise SystemExit('Missing stylesheet anchor')
    html = html.replace(anchor, anchor + '\n  <link rel="stylesheet" href="fraction-lesson.css?v=20260918-fraction1">')
if 'fraction-lesson.js' not in html:
    html, count = re.subn(r'  <script src="app\.js\?v=[^"]+" defer></script>', '  <script src="fraction-lesson.js?v=20260918-fraction1" defer></script>\n  <script src="app.js?v=20260918-fraction1" defer></script>', html)
    if count != 1: raise SystemExit('Missing app script anchor')
index.write_text(html,encoding='utf-8')
print('Fraction pilot integrated. No account roles or database policies changed.')
