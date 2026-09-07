// Bundled Danish recordings: playback never depends on browser/OS voices.
export function createGameVoicePlayer() {
  const sources = fetch(new URL('./fps-voice-lines.json?v=20260907-danish1', import.meta.url))
    .then(response => {
      if (!response.ok) throw new Error(`Voice manifest: HTTP ${response.status}`);
      return response.json();
    })
    .then(manifest => new Map(manifest.lines.map(line => [line.text,
      new URL(`./assets/figurer/audio/${line.id}.mp3`, import.meta.url).href])))
    .catch(error => { console.warn('Danske replikker kunne ikke indlæses.', error); return new Map(); });
  let active = null;
  let pending = false;
  let generation = 0;

  function stop() {
    generation++;
    pending = false;
    if (active) { active.pause(); active.currentTime = 0; active = null; }
  }
  async function play(text, { volume = .92 } = {}) {
    // Do not queue taunts: an old line should not play long after its event.
    if (pending || active) return false;
    const ticket = generation;
    pending = true;
    const src = (await sources).get(text);
    if (ticket !== generation) return false;
    if (!src) { pending = false; return false; }
    const audio = new Audio(src);
    audio.volume = Math.max(0, Math.min(1, volume));
    active = audio;
    const release = () => { if (active === audio) { active = null; pending = false; } };
    audio.addEventListener('ended', release, { once:true });
    audio.addEventListener('error', release, { once:true });
    try { await audio.play(); pending = false; return true; }
    catch (error) { release(); console.info('Replikken kunne ikke afspilles.', error); return false; }
  }
  addEventListener('pagehide', stop);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  return { play, stop, get speaking() { return pending || active !== null; } };
}
