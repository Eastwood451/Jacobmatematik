(() => {
  "use strict";
  const lines = [
    ["kom-nuuu", "Kom nuuu!"],
    ["10-mere", "10 mere!"],
    ["kaemp-for-det", "Kæmp for det!"],
    ["smerte", "Smerte er svaghed, der forlader kroppen!"],
    ["den-der-oever", "Den der øver, vinder!"],
    ["igen", "Vi gør det ordentligt eller vi gør det IGEN!"],
    ["smaakage", "Ingen smerte, ingen småkage!"],
    ["et-stykke", "Ét stykke ad gangen. Du kan godt!"],
    ["staerkt", "Stærkt arbejde! Bliv ved!"],
    ["gennemfoert", "Drill gennemført! Den der øver, vinder!"],
  ];
  let muted = false;
  try { muted = localStorage.getItem("jacobmatematik-obbe-muted") === "true"; } catch {}
  let last = -1, phrase = "Den der øver, vinder!", audio = null, speech = null;
  let round = null, milestone = -1, lastShout = 0, context = null;
  let effectNodes = [], playback = 0;
  const cards = () => document.querySelectorAll("[data-obbe-card]");

  function stop() {
    playback++;
    if (audio) { audio.pause(); audio = null; }
    if (speech) { window.speechSynthesis?.cancel(); speech = null; }
    effectNodes.forEach(node => { try { node.stop(); } catch {} });
    effectNodes = [];
    cards().forEach(card => card.classList.remove("is-speaking"));
  }

  function paint(speaking = false) {
    cards().forEach(card => {
      card.querySelector("[data-obbe-bubble]").textContent = phrase;
      card.classList.toggle("is-speaking", speaking);
      const toggle = card.querySelector("[data-obbe-mute]");
      toggle.textContent = muted ? "Lyd: fra" : "Lyd: til";
      toggle.setAttribute("aria-pressed", String(!muted));
    });
  }

  function whistle() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      context ||= new AudioContext();
      context.resume().catch(() => {});
      const oscillator = context.createOscillator(), gain = context.createGain();
      const now = context.currentTime;
      oscillator.frequency.setValueAtTime(1650, now);
      oscillator.frequency.linearRampToValueAtTime(1950, now + .1);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(.045, now + .025);
      gain.gain.exponentialRampToValueAtTime(.001, now + .2);
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.start(); oscillator.stop(now + .22);
      effectNodes.push(oscillator);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); effectNodes = effectNodes.filter(node => node !== oscillator); };
    } catch { /* The speech bubble remains available without audio support. */ }
  }

  function shout(index) {
    stop();
    const choices = lines.map((_, i) => i).filter(i => i !== last && i !== 9);
    if (index == null || index === last) index = choices[Math.floor(Math.random() * choices.length)];
    last = index; phrase = lines[index][1]; lastShout = Date.now();
    paint();
    if (muted || document.hidden) return;
    whistle();
    const token = playback;
    const done = () => { if (token === playback) { speech = null; paint(); } };
    const fallback = () => {
      if (token !== playback || muted || !cards().length) return;
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) { done(); return; }
      speech = new SpeechSynthesisUtterance(phrase);
      speech.lang = "da-DK"; speech.rate = 1.05; speech.pitch = .75;
      const voices = window.speechSynthesis.getVoices();
      speech.voice = voices.find(voice => /da[-_]DK/i.test(voice.lang) && /Jeppe|male/i.test(voice.name)) || voices.find(voice => /^da/i.test(voice.lang)) || null;
      speech.onend = done; speech.onerror = done;
      paint(true); window.speechSynthesis.speak(speech);
    };
    // Start within the click gesture so mobile browsers can unlock playback.
    audio = new Audio(`assets/figurer/audio/obbe-${lines[index][0]}.mp3`);
    audio.volume = .8;
    audio.onended = done;
    audio.play().then(() => { if (token === playback) paint(true); }).catch(fallback);
  }

  function render(login = false) {
    return `<section class="obbe-coach ${login ? "obbe-login" : "obbe-drill"}" data-obbe-card aria-label="Øbbe Øvdig">
      <button class="obbe-portrait" type="button" data-obbe-shout aria-label="Hør et tilråb fra Øbbe Øvdig"><img src="assets/figurer/obbe-ovdig.png" width="1254" height="1254" alt="Øbbe Øvdig, matematiksergenten" decoding="async"></button>
      <div class="obbe-message"><strong>Øbbe Øvdig</strong><p class="obbe-bubble" data-obbe-bubble role="status">${phrase}</p><button class="obbe-mute" type="button" data-obbe-mute aria-label="Lyd fra Øbbe Øvdig" aria-pressed="${!muted}">${muted ? "Lyd: fra" : "Lyd: til"}</button></div>
    </section>`;
  }

  function onDrill(drill) {
    paint(Boolean(audio && !audio.paused) || Boolean(speech));
    if (round !== drill.sessionId) {
      round = drill.sessionId; milestone = 0;
      shout(drill.troubleRound ? 5 : 0);
    } else if (drill.completedAt && milestone !== "complete") {
      milestone = "complete"; shout(9);
    } else if (!drill.completedAt && drill.currentIndex >= milestone + 10) {
      milestone = Math.floor(drill.currentIndex / 10) * 10;
      if (Date.now() - lastShout >= 12000) shout(drill.pairs.length - drill.currentIndex === 10 ? 1 : undefined);
    }
  }

  document.addEventListener("click", event => {
    if (event.target.closest("[data-obbe-mute]")) {
      muted = !muted;
      try { localStorage.setItem("jacobmatematik-obbe-muted", String(muted)); } catch {}
      if (muted) stop();
      paint();
    } else if (event.target.closest("[data-obbe-shout]")) shout();
    else if (event.target.closest("[data-erling-audio], [data-kaptajn-audio], [data-luigi-audio]")) stop();
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
  window.addEventListener("pagehide", stop);
  // Stop pending speech as soon as navigation removes the coach.
  new MutationObserver(() => { if (!cards().length) stop(); }).observe(document.getElementById("app"), { childList:true });
  window.ObbeCoach = { render, onDrill, stop };
})();
