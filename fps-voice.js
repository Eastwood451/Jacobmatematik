// Bundled recordings only: playback never depends on browser/OS voices.
export function createGameVoicePlayer() {
  const voiceData = fetch(new URL('./fps-voice-lines.json?v=20260911-erling3', import.meta.url))
    .then(response => {
      if (!response.ok) throw new Error(`Voice manifest: HTTP ${response.status}`);
      return response.json();
    })
    .then(manifest => {
      const lines = manifest.lines.map(line => ({
        ...line,
        src:new URL(`./assets/figurer/audio/${line.id}.mp3`, import.meta.url).href,
      }));
      const byText = new Map(lines.map(line => [line.text, line]));
      const byCharacter = new Map();
      for (const line of lines) {
        if (!byCharacter.has(line.character)) byCharacter.set(line.character, []);
        byCharacter.get(line.character).push(line);
      }
      return { byText, byCharacter };
    })
    .catch(error => {
      console.warn('Replikker kunne ikke indlæses.', error);
      return { byText:new Map(), byCharacter:new Map() };
    });

  let active = null;
  let pending = false;
  let generation = 0;
  let lastErlingText = '';

  function stop() {
    generation++;
    pending = false;
    if (active) {
      active.pause();
      active.currentTime = 0;
      active = null;
    }
  }

  async function play(requestedText, { volume = .92 } = {}) {
    // Do not queue taunts: an old line should not play long after its event.
    if (pending || active) return false;
    const ticket = generation;
    pending = true;
    const data = await voiceData;
    if (ticket !== generation) return false;

    let entry = data.byText.get(requestedText);
    if (!entry) {
      pending = false;
      return false;
    }

    // Every Erling trigger may choose from his full pool.
    // Never use the same Erling line twice in a row.
    if (entry.character === 'erling') {
      const pool = data.byCharacter.get('erling') || [entry];
      const choices = pool.filter(line => line.text !== lastErlingText);
      const candidates = choices.length ? choices : pool;
      entry = candidates[Math.floor(Math.random() * candidates.length)] || entry;
      lastErlingText = entry.text;
    }

    const audio = new Audio(entry.src);
    audio.volume = Math.max(0, Math.min(1, volume));
    active = audio;
    const release = () => {
      if (active === audio) {
        active = null;
        pending = false;
      }
    };
    audio.addEventListener('ended', release, { once:true });
    audio.addEventListener('error', release, { once:true });
    try {
      await audio.play();
      pending = false;
      return true;
    } catch (error) {
      release();
      console.info('Replikken kunne ikke afspilles.', error);
      return false;
    }
  }

  addEventListener('pagehide', stop);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
  });
  return {
    play,
    stop,
    get speaking() { return pending || active !== null; },
  };
}
