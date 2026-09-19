/* Shared coach rail. The four lesson engines and their result/permission logic stay unchanged. */
(() => {
  "use strict";
  const lessonAPI = window.JacobFractionLesson;
  if (!lessonAPI || window.JacobFractionObbe) return;
  const DANCE_MS = 4000;
  const PORTRAIT = "assets/figurer/obbe-ovdig.png";
  // The supplied .gif file contains one PNG frame. Preserve its picture and animate it in CSS.
  const CELEBRATION = "assets/figurer/obbe-techno.webp";
  const LINES = [
    ["kom-nuuu", "Kom nuuu!"],
    ["et-stykke", "Ét stykke ad gangen. Du kan godt!"],
    ["den-der-oever", "Den der øver, vinder!"],
    ["kaemp-for-det", "Kæmp for det!"],
    ["staerkt", "Stærkt arbejde! Bliv ved!"]
  ];
  function mount(root, options = {}) {
    if (!root || !lessonAPI.isEnabled(options.user)) return () => {};
    const doc = root.ownerDocument, view = doc.defaultView;
    let disposed = false, cleanupLesson = () => {}, timer = null, voice = null;
    let celebrating = false, wasDone = false, previous = "", lastMode = "";
    let lastLine = -1, lastVoiceAt = -Infinity, muted = false;
    try { muted = view.localStorage.getItem("jacobmatematik-obbe-muted") === "true"; } catch {}
    root.innerHTML = `<div class="fo-layout"><aside class="fo-rail" aria-label="Øbbe Øvdig, din brøkcoach"><section class="fo-card"><button type="button" class="fo-portrait" data-fo-shout aria-label="Hør et tilråb fra Øbbe Øvdig"><img data-fo-still src="${PORTRAIT}" width="1254" height="1254" alt="Øbbe Øvdig" decoding="async"><img data-fo-dance src="${CELEBRATION}" width="256" height="222" alt="Øbbe Øvdig fejrer din færdige brøk med en technodans" decoding="async" hidden></button><div class="fo-copy"><strong class="fo-name">Øbbe Øvdig</strong><p class="fo-bubble" data-fo-bubble role="status" aria-live="polite" aria-atomic="true">Ét stykke ad gangen. Du kan godt!</p><button type="button" class="fo-mute" data-fo-mute aria-label="Lyd fra Øbbe Øvdig"></button></div></section></aside><div class="fo-lesson" data-fo-lesson></div></div>`;
    const content = root.querySelector("[data-fo-lesson]");
    const card = root.querySelector(".fo-card"), bubble = root.querySelector("[data-fo-bubble]");
    const portrait = root.querySelector("[data-fo-still]"), dance = root.querySelector("[data-fo-dance]");
    const muteButton = root.querySelector("[data-fo-mute]");
    const nextButton = () => content.querySelector("[data-fl-next], [data-fa-next]");
    const page = () => content.querySelector("[data-fl-phase], [data-fa-phase]");
    const phaseOf = el => el?.dataset.flPhase || el?.dataset.faPhase || "";
    function paintMute() {
      muteButton.textContent = muted ? "Lyd: fra" : "Lyd: til";
      muteButton.setAttribute("aria-pressed", String(!muted));
    }
    function stopVoice() {
      if (!voice) return;
      voice.pause(); voice.removeAttribute("src"); voice = null;
    }
    function say(index, audible = false) {
      if (disposed || celebrating) return;
      if (index === lastLine) index = (index + 1) % LINES.length;
      lastLine = index; bubble.textContent = LINES[index][1];
      if (!audible || muted || doc.hidden || view.performance.now() - lastVoiceAt < 8000) return;
      stopVoice(); lastVoiceAt = view.performance.now();
      try {
        const sound = new view.Audio(`assets/figurer/audio/obbe-${LINES[index][0]}.mp3`);
        sound.volume = .65; voice = sound;
        sound.play().catch(() => { if (voice === sound) stopVoice(); });
      } catch { /* The speech bubble is available even when playback is blocked. */ }
    }
    function stopCelebration(unlock = true) {
      if (timer !== null) view.clearTimeout(timer);
      timer = null; celebrating = false;
      card.classList.remove("fo-celebrating"); card.dataset.celebrating = "false";
      dance.hidden = true; portrait.hidden = false;
      if (unlock && phaseOf(page()) === "done") nextButton()?.removeAttribute("disabled");
    }
    function celebrate() {
      stopVoice(); stopCelebration(false); celebrating = true;
      bubble.textContent = "Det dér fortjener en sejrsdans!";
      portrait.hidden = true; dance.hidden = false;
      card.classList.add("fo-celebrating"); card.dataset.celebrating = "true";
      nextButton()?.setAttribute("disabled", "");
      timer = view.setTimeout(() => {
        if (disposed) return;
        stopCelebration(); bubble.textContent = "Stærkt arbejde! Klar til næste brøk?";
      }, DANCE_MS);
    }
    function sync() {
      if (disposed) return;
      const el = page();
      if (!el) { stopVoice(); stopCelebration(false); return; }
      const phase = phaseOf(el), mode = content.querySelector('[data-fa-mode][aria-pressed="true"]')?.dataset.faMode || el.dataset.flMode || "";
      if (mode !== lastMode) { stopVoice(); stopCelebration(false); wasDone = false; previous = ""; lastMode = mode; }
      if (phase === "done") {
        if (!wasDone) { wasDone = true; celebrate(); }
        // The existing engines unlock after 600ms. Keep Next locked until this celebration ends.
        const next = nextButton();
        if (celebrating && next && !next.disabled) next.disabled = true;
        return;
      }
      if (wasDone || celebrating) stopCelebration(false);
      wasDone = false;
      const feedback = el.querySelector("#fl-feedback");
      const stage = el.querySelector("[data-ff-stage]")?.dataset.ffStage || "";
      const state = [mode, phase, stage, el.querySelector("#fl-question")?.textContent, feedback?.textContent].join("|");
      if (state === previous) return;
      const audible = previous !== "";
      previous = state;
      const index = feedback?.classList.contains("incorrect") ? 1 : feedback?.classList.contains("correct") ? 4 : (lastLine + 1) % LINES.length;
      say(index, audible);
    }
    function click(event) {
      const button = event.target.closest?.("button");
      if (!button || !root.contains(button) || disposed) return;
      if (celebrating && button.matches("[data-fl-next], [data-fa-next]")) {
        event.preventDefault(); event.stopImmediatePropagation(); return;
      }
      if (button.hasAttribute("data-fo-mute")) {
        muted = !muted; stopVoice();
        try { view.localStorage.setItem("jacobmatematik-obbe-muted", String(muted)); } catch {}
        paintMute();
      } else if (button.hasAttribute("data-fo-shout") && !celebrating) {
        lastVoiceAt = -Infinity; say((lastLine + 1) % LINES.length, true);
      }
    }
    function onHidden() {
      if (doc.hidden) { stopVoice(); if (celebrating) stopCelebration(); }
    }
    function onImageError() {
      if (celebrating) { stopCelebration(); bubble.textContent = "Stærkt arbejde! Bliv ved!"; }
    }
    const observer = new view.MutationObserver(sync);
    root.addEventListener("click", click, true);
    doc.addEventListener("visibilitychange", onHidden);
    view.addEventListener("pagehide", stopVoice);
    dance.addEventListener("error", onImageError);
    paintMute(); window.ObbeCoach?.stop();
    cleanupLesson = lessonAPI.mount(content, options);
    observer.observe(content, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["disabled"] });
    sync();
    return () => {
      if (disposed) return;
      disposed = true; observer.disconnect(); stopVoice(); stopCelebration(false);
      cleanupLesson();
      root.removeEventListener("click", click, true);
      doc.removeEventListener("visibilitychange", onHidden);
      view.removeEventListener("pagehide", stopVoice);
      dance.removeEventListener("error", onImageError);
    };
  }
  window.JacobFractionObbe = Object.freeze({ mount, duration: DANCE_MS });
  window.JacobFractionLesson = Object.freeze({ ...lessonAPI, mount });
})();
