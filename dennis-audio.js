(() => {
  'use strict';

  const LINES = [
    'Åhh hvor er det flot regnet!',
    'Du er en regnechamp!'
  ];
  let lastIndex = -1;

  function prepareDennis() {
    document.querySelectorAll('.character-card.dennis').forEach(card => {
      if (card.dataset.dennisAudio === 'true') return;
      card.dataset.dennisAudio = 'true';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', 'Afspil Divisions-Dennis replik');
      card.style.cursor = 'pointer';
    });
  }

  function chooseVoice() {
    const voices = speechSynthesis.getVoices();
    const danish = voices.filter(v => /^da(-|_)/i.test(v.lang) || /danish/i.test(v.name));
    return danish.find(v => /female|woman|sara|siri|sofie|ida|emma/i.test(v.name)) || danish[0] || null;
  }

  function speakDennis(card) {
    if (!('speechSynthesis' in window)) return;
    let index;
    do index = Math.floor(Math.random() * LINES.length); while (LINES.length > 1 && index === lastIndex);
    lastIndex = index;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(LINES[index]);
    utterance.lang = 'da-DK';
    utterance.rate = 0.94;
    utterance.pitch = 1.48;
    utterance.volume = 0.78;
    const voice = chooseVoice();
    if (voice) utterance.voice = voice;
    card?.classList.add('is-speaking');
    utterance.onend = utterance.onerror = () => card?.classList.remove('is-speaking');
    speechSynthesis.speak(utterance);
  }

  document.addEventListener('click', event => {
    const card = event.target.closest?.('.character-card.dennis');
    if (!card) return;
    speakDennis(card);
  });

  document.addEventListener('keydown', event => {
    const card = event.target.closest?.('.character-card.dennis');
    if (!card || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    speakDennis(card);
  });

  new MutationObserver(prepareDennis).observe(document.documentElement, {childList:true, subtree:true});
  prepareDennis();
})();
