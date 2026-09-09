// Touch input is shared by solo and online play; it never pretends to lock a mouse.
export const touchInput = { x:0, z:0, sprint:false, crouch:false };
export const hasTouchControls = () => matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

export function createTouchControls({ camera, isPlaying, keydown, fire, clearKeys }) {
  const enabled = hasTouchControls();
  const root = document.documentElement;
  const panel = document.getElementById('touch-controls');
  const rotate = document.getElementById('rotate-device');
  const pause = document.getElementById('touch-pause-overlay');
  const stick = document.getElementById('move-stick');
  const knob = stick.querySelector('span');
  const look = document.getElementById('look-pad');
  let paused = false, moveId = null, lookId = null, lookX = 0, lookY = 0;
  let lookStart = null, previousTap = null;
  let tapTimer = null, crouchLatched = false;
  const held = new Map();
  let lastState = null;
  const landscape = () => innerWidth > innerHeight;
  const available = () => enabled && isPlaying() && landscape() && !paused && !document.hidden;
  const sendKey = code => keydown({code, repeat:false, preventDefault(){}});
  root.classList.toggle('touch-device', enabled);

  function cancelTap() {
    clearTimeout(tapTimer);
    tapTimer = previousTap = null;
  }
  function refreshCrouch() {
    touchInput.crouch = crouchLatched || [...held.values()].some(v => v.action === 'crouch');
    const button = panel.querySelector('[data-hold="crouch"]');
    button.classList.toggle('pressed', touchInput.crouch);
    button.setAttribute('aria-pressed', String(touchInput.crouch));
  }

  function reset() {
    touchInput.x = touchInput.z = 0;
    touchInput.sprint = touchInput.crouch = false;
    moveId = lookId = null;
    lookStart = previousTap = null;
    cancelTap();
    crouchLatched = false;
    held.clear();
    knob.style.transform = '';
    panel.querySelectorAll('.pressed').forEach(el => el.classList.remove('pressed'));
    refreshCrouch();
    clearKeys();
  }
  function sync() {
    if (!enabled) return;
    const playing = isPlaying();
    if (!playing) paused = false;
    const state = `${playing}:${landscape()}:${paused}:${document.hidden}`;
    if (state === lastState) return;
    lastState = state;
    panel.hidden = !available();
    document.getElementById('touch-pause').hidden = !available();
    rotate.hidden = !playing || landscape();
    pause.hidden = !playing || !paused || !landscape();
    root.classList.toggle('touch-playing', playing);
    if (!available()) reset();
  }
  async function enter() {
    if (!enabled) return;
    paused = false;
    reset(); sync();
    // Fullscreen/orientation are optional: Safari can still play after a manual turn.
    try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.(); } catch {}
    try { await screen.orientation?.lock?.('landscape'); } catch {}
    sync();
  }
  function capture(el, e) { e.preventDefault(); el.setPointerCapture(e.pointerId); }
  function move(e) {
    const rect = stick.getBoundingClientRect(), radius = rect.width * .32;
    let x = (e.clientX - rect.left - rect.width/2)/radius;
    let z = (e.clientY - rect.top - rect.height/2)/radius;
    const length = Math.hypot(x,z);
    if (length > 1) { x /= length; z /= length; }
    const strength = Math.max(0, (Math.min(length,1)-.14)/.86);
    touchInput.x = length ? x/Math.min(length,1) * strength : 0;
    touchInput.z = length ? z/Math.min(length,1) * strength : 0;
    knob.style.transform = `translate(${x*radius}px,${z*radius}px)`;
  }
  stick.addEventListener('pointerdown', e => {
    if (!available() || moveId !== null) return;
    moveId = e.pointerId; capture(stick,e); move(e);
  });
  stick.addEventListener('pointermove', e => { if (e.pointerId === moveId && available()) move(e); });
  function endMove(e) {
    if (e.pointerId !== moveId) return;
    moveId = null; touchInput.x = touchInput.z = 0; knob.style.transform = '';
  }
  for (const event of ['pointerup','pointercancel','lostpointercapture']) stick.addEventListener(event,endMove);
  look.addEventListener('pointerdown', e => {
    if (!available() || lookId !== null) return;
    lookId = e.pointerId; lookX = e.clientX; lookY = e.clientY; capture(look,e);
    lookStart = {x:e.clientX, y:e.clientY, time:performance.now(), moved:false};
  });
  look.addEventListener('pointermove', e => {
    if (e.pointerId !== lookId || !available()) return;
    if (Math.hypot(e.clientX-lookStart.x,e.clientY-lookStart.y) > 18) {
      lookStart.moved = true;
      cancelTap();
    }
    camera.rotation.order = 'YXZ';
    camera.rotation.y -= (e.clientX-lookX)*.004;
    camera.rotation.x = Math.max(-Math.PI/2+.05, Math.min(Math.PI/2-.05, camera.rotation.x-(e.clientY-lookY)*.004));
    camera.rotation.z = 0;
    lookX = e.clientX; lookY = e.clientY;
  });
  for (const event of ['pointerup','pointercancel','lostpointercapture']) look.addEventListener(event,e => {
    if (e.pointerId !== lookId) return;
    const now = performance.now();
    const isTap = event === 'pointerup' && available() && !lookStart.moved
      && now-lookStart.time <= 220
      && Math.hypot(e.clientX-lookStart.x,e.clientY-lookStart.y) <= 18;
    if (isTap) {
      if (previousTap && now-previousTap.time <= 280
          && Math.hypot(e.clientX-previousTap.x,e.clientY-previousTap.y) <= 40) {
        cancelTap();
        crouchLatched = !crouchLatched;
        refreshCrouch();
      } else {
        cancelTap();
        previousTap = {x:e.clientX,y:e.clientY,time:now};
        // Briefly distinguish a single tap from crouch: a double tap must not jump first.
        tapTimer = setTimeout(() => {
          tapTimer = previousTap = null;
          if (available()) sendKey('Space');
        },280);
      }
    } else cancelTap();
    lookId = null;
    lookStart = null;
  });
  for (const button of panel.querySelectorAll('button')) {
    button.addEventListener('pointerdown', e => {
      if (!available()) return;
      capture(button,e); button.classList.add('pressed');
      const action = button.dataset.hold;
      held.set(e.pointerId,{button,action});
      if (action === 'crouch') refreshCrouch();
      else if (action) touchInput[action] = true;
      else if (button.dataset.key) sendKey(button.dataset.key);
      else if (button.id === 'touch-fire') fire();
    });
    const release = e => {
      const entry = held.get(e.pointerId);
      if (!entry || entry.button !== button) return;
      held.delete(e.pointerId);
      if (entry.action === 'crouch') refreshCrouch();
      else {
        if (entry.action) touchInput[entry.action] = [...held.values()].some(v => v.action === entry.action);
        if (![...held.values()].some(v => v.button === button)) button.classList.remove('pressed');
      }
    };
    for (const event of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(event,release);
    // Suppress compatibility clicks so tapping digits never fires a pencil.
    button.addEventListener('click', e => e.preventDefault());
  }
  document.getElementById('touch-pause').addEventListener('click', () => { paused = true; reset(); sync(); });
  document.getElementById('touch-resume').addEventListener('click', () => { void enter(); });
  document.getElementById('touch-fullscreen').addEventListener('click', () => { void enter(); });
  document.getElementById('begin-match').addEventListener('click', () => { void enter(); });
  for (const event of ['blur','pagehide']) addEventListener(event, () => {
    if (enabled && isPlaying()) paused = true;
    reset(); sync();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && enabled && isPlaying()) paused = true;
    reset(); sync();
  });
  addEventListener('resize', () => { reset(); sync(); });
  panel.addEventListener('contextmenu', e => e.preventDefault());
  sync();
  return { enabled, enter, reset, sync, get active(){return available();}, get blocked(){return enabled && !available();} };
}
