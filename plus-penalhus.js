/* Plus-penalhus: Øbbe & Luigi kaster penalhus-ting. Tæl dem — 0. klasse addition. */
(() => {
  'use strict';

  const isEnabled = user => !!user?.id && ['student', 'teacher', 'guest'].includes(user.role);

  // Draw the actual stationery, rather than unrelated emoji stand-ins.
  function stationeryIcon(drawing) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true" focusable="false"><g stroke="#302044" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${drawing}</g></svg>`;
  }

  const ITEM_KINDS = [
    { id: 'blyant', label: 'Blyant', drawing: '<path fill="#ffc34d" d="M13 43 43 13 51 21 21 51Z"/><path fill="#f9d7ad" d="m13 43-4 12 12-4Z"/><path fill="#302044" d="m9 55 2-6 4 4Z"/><path fill="#ff86a8" d="m43 13 5-5q2-2 4 0l4 4q2 2 0 4l-5 5Z"/><path fill="none" d="m18 47 29-29"/>' },
    { id: 'viskelader', label: 'Viskelæder', drawing: '<path fill="#ff99b5" d="M9 37 27 17q2-2 5 0l23 17q2 2 0 4L37 55q-2 2-5 0L9 41Z"/><path fill="#c9bcf2" d="m38 22 17 12q2 2 0 4L37 55q-2 2-5 0L20 46Z"/><path fill="none" d="m9 37 23 17 23-20"/>' },
    { id: 'spidser', label: 'Blyantspidser', drawing: '<path fill="#58bfca" d="M10 23 45 14 55 23v27l-35 8-10-9Z"/><path fill="#a5e5e9" d="m10 23 10 9 35-9-10-9Z"/><path fill="none" d="M20 32v26"/><path fill="#dce3ed" d="m20 24 24-6 6 5-24 6Z"/><circle cx="35" cy="23" r="2" fill="#71849a"/><ellipse cx="37" cy="42" rx="9" ry="8" fill="#302044"/><ellipse cx="38" cy="41" rx="4" ry="4" fill="#c8d4de"/>' },
    { id: 'farveblyant', label: 'Farveblyant', drawing: '<path fill="#f9755f" d="M13 43 45 11 53 19 21 51Z"/><path fill="#f9d7ad" d="m13 43-4 12 12-4Z"/><path fill="#e44343" d="m9 55 2-6 4 4Z"/><path fill="none" d="m18 47 31-31"/><path fill="#ffb59d" d="m45 11 3-3 8 8-3 3Z"/>' },
    { id: 'lineal', label: 'Lineal', drawing: '<rect x="6" y="21" width="52" height="23" rx="3" fill="#ffd86b" transform="rotate(-20 32 32)"/><g transform="rotate(-20 32 32)" fill="none"><path d="M13 22v12m7-12v7m7-7v12m7-12v7m7-7v12m7-12v7"/></g>' },
    { id: 'saks', label: 'Saks', drawing: '<path fill="#dbe4ed" d="m25 35 4-7L51 9q3-2 2 2L37 38Z"/><path fill="#c0cbd9" d="m32 36-5-7L12 9q-2-3-3 1l11 28Z"/><path fill="none" stroke="#54bfc3" stroke-width="7" d="M25 38c-15-12-23 11-10 16 8 3 17-6 10-16Zm8 0c15-12 23 11 10 16-8 3-17-6-10-16Z"/><circle cx="29" cy="34" r="3" fill="#71849a"/>' },
    { id: 'limstift', label: 'Limstift', drawing: '<rect x="21" y="22" width="22" height="32" rx="3" fill="#ffcb4f"/><rect x="20" y="9" width="24" height="17" rx="4" fill="#9168ca"/><rect x="22" y="32" width="20" height="13" rx="1" fill="#fff7de"/><path fill="none" d="M27 37h10m-8 4h6"/><rect x="20" y="50" width="24" height="7" rx="2" fill="#9168ca"/>' },
    { id: 'tusch', label: 'Tusch', drawing: '<g transform="rotate(35 32 32)"><rect x="26" y="23" width="12" height="29" rx="2" fill="#a8e4c8"/><path fill="#3aaf83" d="M25 10q0-3 3-3h8q3 0 3 3v17H25Z"/><path fill="none" d="M38 11h4v12"/><path fill="#3aaf83" d="M26 48h12v7H26Z"/><path fill="none" d="M29 32v9"/></g>' },
    { id: 'passer', label: 'Passer', drawing: '<path fill="none" stroke="#8195ac" stroke-width="6" d="m31 22-15 31m17-31 15 31"/><path fill="#302044" d="m16 51-3 8m35-8 3 8"/><path fill="none" d="M22 37h20"/><rect x="28" y="5" width="8" height="12" rx="2" fill="#8b70d0"/><circle cx="32" cy="21" r="7" fill="#a78be8"/><circle cx="32" cy="21" r="2" fill="#fff"/>' },
    { id: 'lommeregner', label: 'Lommeregner', drawing: '<rect x="14" y="6" width="36" height="52" rx="5" fill="#627a9e"/><rect x="20" y="12" width="24" height="12" rx="2" fill="#d1efce"/><path fill="none" d="M33 17h6v4h-6Z"/><g fill="#fff2d7"><rect x="20" y="30" width="6" height="6" rx="1"/><rect x="29" y="30" width="6" height="6" rx="1"/><rect x="20" y="39" width="6" height="6" rx="1"/><rect x="29" y="39" width="6" height="6" rx="1"/><rect x="20" y="48" width="15" height="5" rx="1"/></g><g fill="#ffb655"><rect x="38" y="30" width="6" height="6" rx="1"/><rect x="38" y="39" width="6" height="14" rx="1"/></g>' },
    { id: 'vinkelmaler', label: 'Vinkelmåler', drawing: '<path fill="#a6dfeebf" d="M5 49a27 27 0 0 1 54 0Z"/><path fill="#fffaf0" d="M20 49a12 12 0 0 1 24 0Z"/><path fill="none" d="M9 46h6m-3-10 5 3m3-11 3 5m9-9v7m12-3-3 5m11 3-5 3m8 7h-6M32 46v6"/>' },
  ].map(({ drawing, ...kind }) => ({ ...kind, icon: stationeryIcon(drawing) }));

  // Every cel is a complete drawing of the original character, not a body-part rig.
  const CEL_COLS = 4;
  const CEL_ROWS = 3;
  const CEL_FPS = 20;
  const CEL_MS = 1000 / CEL_FPS;
  // Consecutive poses: one planted stance and one throwing arm per character.
  const THROW_CELS = {
    obbe: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0],
    luigi: [11, 1, 2, 5, 7, 8, 9, 10, 11],
  };
  const IDLE_CEL = { obbe: 0, luigi: 11 };
  const RELEASE_STEP = { obbe: 7, luigi: 4 };
  const ORIGINAL_THROW_MS = 1500;
  const FLIGHT_SCALE = .5; // Only airborne time changes; character poses keep their tempo.
  const AUDIO_BASE = 'assets/figurer/plus-penalhus/audio-v2/';
  const CEL_ASSETS = {
    obbe: 'assets/figurer/plus-penalhus/obbe-cartoon-v5.webp',
    luigi: 'assets/figurer/plus-penalhus/luigi-cartoon-v5.webp',
  };
  // Palms registered with the complete drawings, anchored by the boot soles.
  const CEL_HANDS = {"obbe":[[0.3034,0.6145],[0.3034,0.6145],[0.1822,0.6079],[0.1223,0.5926],[0.5889,0.6149],[0.648,0.5755],[0.7464,0.499],[0.8809,0.418],[0.8908,0.355],[0.648,0.5956],[0.2936,0.6171],[0.2936,0.6197]],"luigi":[[0.2328,0.65],[0.2922,0.6953],[0.2906,0.6734],[0.2547,0.6729],[0.6187,0.6828],[0.3375,0.6453],[0.6891,0.5953],[0.2586,0.5297],[0.2656,0.4781],[0.3352,0.6297],[0.3102,0.6901],[0.257,0.6667]]};
  function prefersReducedMotion() {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function shuffle(values) {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /** Deck: a,b ∈ 1..9 med a+b ≤ 10 (niveau 1 for 0. klasse). */
  function makeDeck() {
    const deck = [];
    for (let a = 1; a <= 9; a++) {
      for (let b = 1; b <= 9; b++) {
        if (a + b <= 10) deck.push({ a, b });
      }
    }
    return shuffle(deck);
  }

  function pickItem(who, serial) {
    const kind = ITEM_KINDS[serial % ITEM_KINDS.length];
    return {
      id: serial,
      who,
      kind: kind.id,
      label: kind.label,
      icon: kind.icon,
      counted: false,
    };
  }

  function mount(root, { user, onExit = () => {}, onResult = async () => {}, tasks } = {}) {
    if (!root || !isEnabled(user)) return () => {};

    const sequence = tasks?.length
      ? tasks.map(({ a, b }) => ({ a, b }))
      : makeDeck();

    if (sequence.some(({ a, b }) => !Number.isInteger(a) || !Number.isInteger(b) || a < 0 || a > 9 || b < 0 || b > 9 || a + b > 18)) {
      throw Error('Plus-penalhus bruger heltal fra 0 til 9.');
    }

    let index = 0;
    let serial = 0;
    let items = [];
    let obbeClicks = 0;
    let luigiClicks = 0;
    let answer = '';
    let solved = 0;
    let phase = 'throw';
    let pending = false;
    let disposed = false;
    let started = performance.now();
    const timers = new Set();
    const flights = new Set();
    const busy = { obbe: false, luigi: false };
    let actionToken = 0;
    let assetsReady = false;
    let animationFrame = null;
    const actors = {};
    const activeFlights = new Map();
    let columns = 1;
    let rows = 1;
    const voice = new Audio();
    voice.preload = 'auto';
    let voiceQueue = [];
    let currentVoice = null;
    let speaking = false;
    let voiceToken = 0;

    function stopVoice() {
      voiceToken++;
      voiceQueue = [];
      currentVoice = null;
      speaking = false;
      voice.pause();
      voice.removeAttribute('src');
      voice.load();
    }

    function playNextVoice() {
      if (disposed || speaking || !voiceQueue.length) return;
      speaking = true;
      const token = ++voiceToken;
      currentVoice = voiceQueue.shift();
      voice.src = AUDIO_BASE + currentVoice.clip + '.mp3';
      voice.play().catch(() => {
        if (token !== voiceToken || disposed) return;
        voiceFinished();
      });
    }

    function voiceFinished() {
      if (!speaking) return;
      const finished = currentVoice;
      currentVoice = null;
      speaking = false;
      finished?.onEnd?.();
      playNextVoice();
    }
    voice.addEventListener('ended', voiceFinished);
    voice.addEventListener('error', voiceFinished);

    function say(clip, replace = false, onEnd = null) {
      if (replace) stopVoice();
      voiceQueue.push({ clip, onEnd });
      playNextVoice();
    }


    const later = (fn, ms) => {
      const id = setTimeout(() => {
        timers.delete(id);
        if (!disposed) fn();
      }, ms);
      timers.add(id);
      return id;
    };

    const task = () => sequence[index];
    const quotasFilled = () => obbeClicks >= task().a && luigiClicks >= task().b;
    const editable = () => assetsReady && !disposed && !pending && phase === 'throw';
    const answerable = () => !disposed && !pending && phase === 'answer';

    root.innerHTML = `<section class="pp-game" aria-label="Plus-penalhus: Øbbe og Luigi">
      <nav class="pp-nav">
        <button type="button" data-pp-exit>← Tilbage</button>
        <span class="pp-score">0 rigtige</span>
      </nav>
      <header class="pp-heading">
        <span class="pp-eyebrow">Øbbe &amp; Luigi · penalhuset</span>
        <h1>Plus-penalhus</h1>
        <p>Klik på figurerne, så de kaster ting ud. Tæl dem bagefter!</p>
      </header>
      <div class="pp-equation" aria-label="Plusstykke">
        <span class="pp-term pp-obbe-term" id="pp-a">5</span>
        <span aria-hidden="true">+</span>
        <span class="pp-term pp-luigi-term" id="pp-b">4</span>
        <span aria-hidden="true">=</span>
        <output id="pp-answer" aria-label="Dit svar">?</output>
      </div>
      <div class="pp-stage">
        <div class="pp-characters">
          <button type="button" class="pp-char pp-obbe pp-pose-char" data-pp-throw="obbe" aria-label="Øbbe Øvdig">
            <span class="pp-char-body">
              <canvas class="pp-cel" data-pp-cel="obbe" width="256" height="384" aria-hidden="true"></canvas>
              <span class="pp-hand-grip" data-pp-hand="obbe" aria-hidden="true"></span>
            </span>
            <strong>Øbbe</strong>
            <span class="pp-progress" id="pp-obbe-progress" aria-live="polite">0/5</span>
          </button>
          <div class="pp-canvas-wrap">
            <div class="pp-canvas" id="pp-canvas" aria-label="Penalhus-ting på bordet"></div>
            <p class="pp-canvas-hint" id="pp-canvas-hint">Klik på Øbbe og Luigi</p>
          </div>
          <button type="button" class="pp-char pp-luigi" data-pp-throw="luigi" aria-label="Luigi Lækkermat">
            <span class="pp-char-body">
              <canvas class="pp-cel" data-pp-cel="luigi" width="256" height="384" aria-hidden="true"></canvas>
              <span class="pp-hand-grip" data-pp-hand="luigi" aria-hidden="true"></span>
            </span>
            <strong>Luigi</strong>
            <span class="pp-progress" id="pp-luigi-progress" aria-live="polite">0/4</span>
          </button>
        </div>
      </div>
      <section class="pp-answer-panel" id="pp-answer-panel" hidden>
        <h2 id="pp-question">Hvor mange ting er der i alt?</h2>
        <p class="pp-answer-tip">Tæl alle tingene på bordet. Tryk på en ting for at markere den, mens du tæller.</p>
        <div class="pp-keypad" aria-label="Tastatur">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(n =>
          `<button type="button" data-pp-digit="${n}" aria-label="Tast ${n}">${n}</button>`
        ).join('')}<button type="button" data-pp-delete aria-label="Slet sidste tal">⌫</button></div>
        <button type="button" class="pp-submit" data-pp-submit>Tjek svar</button>
      </section>
      <p class="pp-feedback" id="pp-feedback" role="status" aria-live="polite"></p>
      <button type="button" class="pp-next" data-pp-next hidden>Næste plusstykke →</button>
    </section>`;

    const $ = selector => root.querySelector(selector);

    function feedback(text, tone = '') {
      const el = $('#pp-feedback');
      el.textContent = text;
      el.dataset.tone = tone;
    }

    function clearThrowClasses(btn) {
      btn.classList.remove('pp-windup', 'pp-throwing', 'pp-follow', 'pp-busy');
    }

    function paintCel(who, frame, nextFrame = frame, mix = 0) {
      const actor = actors[who];
      if (!actor?.image || (actor.frame === frame && actor.nextFrame === nextFrame && actor.mix === mix)) return;
      actor.frame = frame;
      actor.nextFrame = nextFrame;
      actor.mix = mix;
      const w = actor.image.naturalWidth / CEL_COLS;
      const h = actor.image.naturalHeight / CEL_ROWS;
      actor.context.clearRect(0, 0, 256, 384);
      const draw = (cel, alpha) => {
        actor.context.globalAlpha = alpha;
        actor.context.drawImage(actor.image, (cel % CEL_COLS) * w,
          Math.floor(cel / CEL_COLS) * h, w, h, 0, 0, 256, 384);
      };
      // Brief whole-drawing dissolves soften cel changes without a body-part rig.
      draw(frame, 1 - mix);
      if (mix > 0) {
        actor.context.globalCompositeOperation = 'lighter';
        draw(nextFrame, mix);
        actor.context.globalCompositeOperation = 'source-over';
      }
      actor.context.globalAlpha = 1;
      const from = CEL_HANDS[who][frame];
      const to = CEL_HANDS[who][nextFrame];
      const hand = from.map((v, axis) => v + (to[axis] - v) * mix);
      const grip = $(`[data-pp-hand="${who}"]`);
      grip.style.left = `${hand[0] * 100}%`;
      grip.style.top = `${hand[1] * 100}%`;
    }

    function animate(now) {
      if (disposed) return;
      for (const who of ['obbe', 'luigi']) {
        const actor = actors[who];
        if (!actor?.image) continue;
        if (actor.throw) {
          const t = actor.throw;
          const step = Math.max(0, Math.floor((now - t.start) / t.celMs));
          const cels = THROW_CELS[who];
          const at = Math.min(cels.length - 1, step);
          const next = Math.min(cels.length - 1, at + 1);
          const mix = next === at ? 0 : ((now - t.start) / t.celMs) % 1;
          paintCel(who, cels[at], cels[next], mix);
          if (!t.released && step >= RELEASE_STEP[who]) {
            t.released = true;
            setHandItem(actor.button, '');
            t.onRelease();
          }
          if (step >= cels.length) actor.throw = null;
        } else {
          paintCel(who, IDLE_CEL[who]);
        }
      }
      for (const [el, flight] of activeFlights) {
        // Follow the reserved slot even if the phone rotates during a throw.
        const target = itemTarget(flight.item);
        flight.targetX = target.x;
        flight.targetY = target.y;
        const t = Math.min(1, Math.max(0, (now - flight.start) / flight.duration));
        const x = flight.x + (flight.targetX - flight.x) * t;
        const y = flight.y + (flight.targetY - flight.y) * t - 4 * flight.arc * t * (1 - t);
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.transform = `translate(-50%,-50%) rotate(${flight.spin * t}deg)`;
      }
      animationFrame = requestAnimationFrame(animate);
    }

    function loadActor(who) {
      const canvas = $(`[data-pp-cel="${who}"]`);
      const actor = actors[who] = {
        button: $(`[data-pp-throw="${who}"]`),
        context: canvas.getContext('2d'), frame: -1, image: null, throw: null,
      };
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          if (disposed) return resolve();
          actor.image = img;
          paintCel(who, IDLE_CEL[who]);
          resolve();
        };
        img.onerror = () => reject(new Error(`Animationen for ${who} kunne ikke hentes.`));
        img.src = CEL_ASSETS[who];
      });
    }

    function maybeEnterAnswerPhase() {
      // Quotas count clicks; only the landed objects are available to count.
      if (phase === 'throw' && quotasFilled() && items.length === task().a + task().b) {
        enterAnswerPhase();
      }
    }

    function updateProgress() {
      const { a, b } = task();
      const obbeLeft = Math.max(0, a - obbeClicks);
      const luigiLeft = Math.max(0, b - luigiClicks);
      $('#pp-obbe-progress').textContent = `${obbeClicks}/${a}`;
      $('#pp-luigi-progress').textContent = `${luigiClicks}/${b}`;
      $('[data-pp-throw="obbe"]').setAttribute(
        'aria-label',
        obbeLeft === 0
          ? `Øbbe Øvdig er færdig med at kaste ${a} ting`
          : `Øbbe Øvdig — klik for at kaste. ${obbeClicks} af ${a} kastet, ${obbeLeft} tilbage`
      );
      $('[data-pp-throw="luigi"]').setAttribute(
        'aria-label',
        luigiLeft === 0
          ? `Luigi Lækkermat er færdig med at kaste ${b} ting`
          : `Luigi Lækkermat — klik for at kaste. ${luigiClicks} af ${b} kastet, ${luigiLeft} tilbage`
      );
    }

    function update() {
      if (disposed) return;
      const lockedThrow = !editable();
      const lockedAnswer = !answerable();
      const filled = quotasFilled();

      $('#pp-answer').textContent = answer || '?';
      $('.pp-game').classList.toggle('pp-ready', phase === 'answer' || phase === 'done');
      $('.pp-game').classList.toggle('pp-done', phase === 'done');
      $('.pp-game').classList.toggle('pp-glow', phase === 'done');

      const obbeBtn = $('[data-pp-throw="obbe"]');
      const luigiBtn = $('[data-pp-throw="luigi"]');
      obbeBtn.disabled = lockedThrow || busy.obbe || obbeClicks >= task().a;
      luigiBtn.disabled = lockedThrow || busy.luigi || luigiClicks >= task().b;
      obbeBtn.classList.toggle('pp-complete', obbeClicks >= task().a && !busy.obbe);
      luigiBtn.classList.toggle('pp-complete', luigiClicks >= task().b && !busy.luigi);

      $('#pp-answer-panel').hidden = phase === 'throw';
      root.querySelectorAll('[data-pp-digit], [data-pp-delete]').forEach(btn => {
        btn.disabled = lockedAnswer;
      });
      $('[data-pp-submit]').disabled = lockedAnswer || answer === '';
      $('[data-pp-submit]').hidden = phase !== 'answer';
      $('[data-pp-next]').hidden = phase !== 'done';

      const hint = $('#pp-canvas-hint');
      if (phase === 'throw' && !filled) {
        hint.hidden = items.length > 0;
        hint.textContent = 'Klik på Øbbe og Luigi';
      } else {
        hint.hidden = true;
      }

      updateProgress();
      $('.pp-score').textContent = `${solved} ${solved === 1 ? 'rigtigt' : 'rigtige'}`;
    }

    function itemPosition(item) {
      return { left: ((item.id - 1) % columns + .5) * 100 / columns,
        top: (Math.floor((item.id - 1) / columns) + .5) * 100 / rows };
    }

    function itemTarget(item) {
      const canvas = $('#pp-canvas');
      const box = canvas.getBoundingClientRect();
      const pos = itemPosition(item);
      return { x: box.left + canvas.clientLeft + pos.left / 100 * canvas.clientWidth,
        y: box.top + canvas.clientTop + pos.top / 100 * canvas.clientHeight };
    }

    function layoutItems() {
      if (disposed) return;
      const canvas = $('#pp-canvas');
      const total = Math.max(1, task().a + task().b);
      // Reserve all slots up front; each 56px card has at least 20px of air.
      columns = Math.min(total, Math.max(1, Math.floor(canvas.clientWidth / 76)));
      rows = Math.ceil(total / columns);
      canvas.style.height = `${Math.max(180, rows * 76 + 6)}px`;
      canvas.querySelectorAll('[data-pp-item]').forEach(el => {
        const pos = itemPosition({ id: Number(el.dataset.ppItem) });
        el.style.left = `${pos.left}%`;
        el.style.top = `${pos.top}%`;
      });
    }

    function paintItems(landingId = null) {
      const canvas = $('#pp-canvas');
      layoutItems();
      canvas.innerHTML = items.map(item => {
        const pos = itemPosition(item);
        const landing = item.id === landingId ? ' pp-landing' : '';
        const counted = item.counted ? ' pp-counted' : '';
        return `<button type="button" class="pp-item pp-item-${item.who}${counted}${landing}" data-pp-item="${item.id}" style="left:${pos.left}%;top:${pos.top}%" aria-pressed="${item.counted ? 'true' : 'false'}" aria-label="${item.label} fra ${item.who === 'obbe' ? 'Øbbe' : 'Luigi'}${item.counted ? ', talt' : ''}"><span class="pp-item-icon" aria-hidden="true">${item.icon}</span></button>`;
      }).join('');
      update();
    }

    function celebrateQuota() {
      for (const who of ['obbe', 'luigi']) if (actors[who]) actors[who].cheerUntil = performance.now() + 900;
    }

    function enterAnswerPhase() {
      phase = 'answer';
      answer = '';
      celebrateQuota();
      feedback('Hvor mange ting er der i alt? Tæl dem én ad gangen.');
      paintItems();
      later(() => {
        if (!disposed && phase === 'answer') $('[data-pp-digit="1"]')?.focus({ preventScroll: true });
      }, 50);
    }

    function spawnFlight(who, item, charBtn, onLand) {
      const reduced = prefersReducedMotion();
      const hand = charBtn.querySelector('[data-pp-hand]') || charBtn.querySelector('.pp-hand-grip');
      const body = charBtn.querySelector('.pp-char-body') || charBtn;
      let startX;
      let startY;
      if (hand) {
        const handBox = hand.getBoundingClientRect();
        startX = handBox.left + handBox.width / 2;
        startY = handBox.top + handBox.height / 2;
      } else {
        const bodyBox = body.getBoundingClientRect();
        const towardCanvas = who === 'obbe' ? 0.78 : 0.22;
        startX = bodyBox.left + bodyBox.width * towardCanvas;
        startY = bodyBox.top + bodyBox.height * 0.42;
      }
      const target = itemTarget(item);
      const targetLeft = target.x;
      const targetTop = target.y;
      // The throw explains where each counted object comes from. Keep this
      // essential movement visible, with a smaller arc and no spin in reduced motion.
      const arc = reduced ? 20 : 48 + (Math.abs(targetLeft - startX) * 0.12) + ((item.id * 7) % 28);
      const duration = (ORIGINAL_THROW_MS - item.windupMs) * FLIGHT_SCALE;

      const fly = document.createElement('div');
      fly.className = `pp-flight pp-flight-${who}`;
      fly.dataset.ppFlight = item.id;
      fly.innerHTML = `<span aria-hidden="true">${item.icon}</span>`;
      fly.style.left = `${startX}px`;
      fly.style.top = `${startY}px`;
      document.body.append(fly);
      flights.add(fly);
      item.flight = fly;
      activeFlights.set(fly, { item, start: performance.now(), x: startX, y: startY,
        targetX: targetLeft, targetY: targetTop, arc, duration,
        spin: reduced ? 0 : (who === 'obbe' ? 300 : -300) });
      later(onLand, duration);
    }

    function setHandItem(charBtn, icon) {
      const grip = charBtn.querySelector('[data-pp-hand]');
      if (!grip) return;
      if (icon) {
        grip.innerHTML = `<span class="pp-hand-icon" aria-hidden="true">${icon}</span>`;
        grip.classList.add('pp-hand-loaded');
      } else {
        grip.innerHTML = '';
        grip.classList.remove('pp-hand-loaded');
      }
    }

    function runThrowPose(charBtn, who, itemIcon, onRelease, celMs) {
      const actor = actors[who];
      busy[who] = true;
      clearThrowClasses(charBtn);
      charBtn.classList.add('pp-busy');
      setHandItem(charBtn, itemIcon);
      actor.throw = { start: performance.now(), celMs,
        released: false, onRelease };
      paintCel(who, THROW_CELS[who][0]);
      update();
    }

    function throwItem(who) {
      if (!editable() || busy[who]) return;
      const { a, b } = task();
      if (who === 'obbe' && obbeClicks >= a) return;
      if (who === 'luigi' && luigiClicks >= b) return;

      if (who === 'obbe') obbeClicks++;
      else luigiClicks++;

      const item = pickItem(who, ++serial);
      const celMs = prefersReducedMotion() ? 80 : CEL_MS;
      item.windupMs = RELEASE_STEP[who] * celMs;
      const token = actionToken;
      const charBtn = $(`[data-pp-throw="${who}"]`);

      updateProgress();
      item.voiceDone = false;
      item.released = false;
      const unlock = () => {
        if (disposed || token !== actionToken || !item.voiceDone || !item.released) return;
        busy[who] = false;
        clearThrowClasses(charBtn);
        update();
      };
      say(`count-${who === 'obbe' ? obbeClicks : luigiClicks}`, false, () => {
        item.voiceDone = true;
        unlock();
      });

      const land = () => {
        if (token !== actionToken) return;
        if (item.flight) {
          item.flight.remove();
          flights.delete(item.flight);
          activeFlights.delete(item.flight);
        }
        items.push(item);
        paintItems(item.id);
        maybeEnterAnswerPhase();
      };

      runThrowPose(charBtn, who, item.icon, () => {
        if (disposed || token !== actionToken || items.includes(item)) return;
        item.released = true;
        spawnFlight(who, item, charBtn, land);
        unlock();
      }, celMs);
    }

    function enterDigit(digit) {
      if (!answerable()) return;
      if (answer.length >= 2) return;
      answer = answer === '0' ? digit : answer + digit;
      update();
    }

    function celebrate() {
      phase = 'done';
      solved++;
      const { a, b } = task();
      say(`sum-${a}-${b}${a + b === 10 ? '-ti-v3' : ''}`, true);
      feedback(`Sådan! ${a} + ${b} = ${a + b}. Der er ${a + b} ting i alt!`, 'success');
      update();
      later(() => {
        if (!disposed && phase === 'done') $('[data-pp-next]')?.focus({ preventScroll: true });
      }, 100);
    }

    async function submit() {
      if (!answerable() || answer === '') return;
      pending = true;
      update();
      const value = Number(answer);
      const { a, b } = task();
      const correct = value === a + b;
      const result = {
        topic: 'plusPenalhus',
        problem: `${a} + ${b}`,
        answer: value,
        correctAnswer: a + b,
        correct,
        responseTime: Math.max(0, (performance.now() - started) / 1000),
        timestamp: new Date().toISOString(),
      };
      try {
        await onResult(result);
      } catch (error) {
        if (disposed) return;
        pending = false;
        update();
        feedback('Svaret kunne ikke gemmes. Tryk igen.', 'error');
        return;
      }
      if (disposed) return;
      pending = false;
      if (correct) celebrate();
      else {
        answer = '';
        update();
        feedback('Tæl dem en gang til', 'error');
      }
    }

    function startTask() {
      stopVoice();
      actionToken += 1;
      flights.forEach(el => el.remove());
      flights.clear();
      items = [];
      obbeClicks = 0;
      luigiClicks = 0;
      answer = '';
      phase = 'throw';
      pending = false;
      started = performance.now();
      serial = 0;
      busy.obbe = false;
      busy.luigi = false;

      $('.pp-game').classList.remove('pp-ready', 'pp-done', 'pp-glow');
      const obbeBtn = $('[data-pp-throw="obbe"]');
      const luigiBtn = $('[data-pp-throw="luigi"]');
      clearThrowClasses(obbeBtn);
      clearThrowClasses(luigiBtn);
      obbeBtn.classList.remove('pp-celebrate', 'pp-complete');
      luigiBtn.classList.remove('pp-celebrate', 'pp-complete');
      setHandItem(obbeBtn, '');
      setHandItem(luigiBtn, '');

      for (const who of ['obbe', 'luigi']) {
        if (actors[who]) {
          actors[who].throw = null;
          actors[who].cheerUntil = 0;
          paintCel(who, IDLE_CEL[who]);
        }
      }
      activeFlights.clear();

      const { a, b } = task();
      $('#pp-a').textContent = a;
      $('#pp-b').textContent = b;
      paintItems();
      feedback(`Klik ${a} gange på Øbbe og ${b} gange på Luigi.`);
    }

    function nextTask() {
      if (phase !== 'done') return;
      index = (index + 1) % sequence.length;
      if (!tasks?.length && index === 0) {
        const next = makeDeck();
        sequence.splice(0, sequence.length, ...next);
      }
      startTask();
    }

    function click(event) {
      const button = event.target.closest('button');
      if (!button || !root.contains(button) || button.disabled) return;
      if (button.hasAttribute('data-pp-exit')) {
        onExit();
        return;
      }
      if (button.dataset.ppThrow) throwItem(button.dataset.ppThrow);
      if (button.dataset.ppItem) {
        if (phase !== 'answer' && phase !== 'done') return;
        const item = items.find(i => i.id === Number(button.dataset.ppItem));
        if (item) {
          item.counted = !item.counted;
          if (item.counted) say(`count-${items.filter(i => i.counted).length}`);
          paintItems();
        }
      }
      if (button.hasAttribute('data-pp-digit')) enterDigit(button.dataset.ppDigit);
      if (button.hasAttribute('data-pp-delete') && answerable()) {
        answer = answer.slice(0, -1);
        update();
      }
      if (button.hasAttribute('data-pp-submit')) void submit();
      if (button.hasAttribute('data-pp-next')) nextTask();
    }

    function keydown(event) {
      if (event.ctrlKey || event.metaKey || event.altKey || !root.isConnected) return;
      if (event.target.closest('input,textarea,select') || event.target.isContentEditable) return;
      if (/^[0-9]$/.test(event.key) && answerable()) {
        event.preventDefault();
        enterDigit(event.key);
      } else if (event.key === 'Backspace' && answerable()) {
        event.preventDefault();
        answer = answer.slice(0, -1);
        update();
      } else if (event.key === 'Enter' && answerable() && answer !== '') {
        event.preventDefault();
        void submit();
      } else if (event.key === 'Enter' && phase === 'done') {
        event.preventDefault();
        nextTask();
      }
    }

    root.addEventListener('click', click);
    document.addEventListener('keydown', keydown);
    const resizeObserver = new ResizeObserver(layoutItems);
    resizeObserver.observe($('#pp-canvas'));
    startTask();
    feedback('Øbbe og Luigi gør sig klar …');
    Promise.all(['obbe', 'luigi'].map(loadActor)).then(() => {
      if (disposed) return;
      assetsReady = true;
      animationFrame = requestAnimationFrame(animate);
      update();
      maybeEnterAnswerPhase();
      if (phase === 'throw') feedback(`Klik ${task().a} gange på Øbbe og ${task().b} gange på Luigi.`);
    }).catch(() => {
      if (!disposed) feedback('Animationerne kunne ikke hentes. Prøv at åbne øvelsen igen.', 'error');
    });

    return () => {
      disposed = true;
      stopVoice();
      voice.removeEventListener('ended', voiceFinished);
      voice.removeEventListener('error', voiceFinished);
      resizeObserver.disconnect();
      if (animationFrame != null) cancelAnimationFrame(animationFrame);
      activeFlights.clear();
      timers.forEach(id => {
        clearTimeout(id);
        clearInterval(id);
      });
      timers.clear();
      flights.forEach(el => el.remove());
      flights.clear();
      root.removeEventListener('click', click);
      document.removeEventListener('keydown', keydown);
      root.innerHTML = '';
    };
  }

  window.PlusPenalhus = { isEnabled, mount, makeDeck };
})();
