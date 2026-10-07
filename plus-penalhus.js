/* Plus-penalhus: Øbbe & Luigi kaster penalhus-ting. Tæl dem — 0. klasse addition. */
(() => {
  'use strict';

  const isEnabled = user => !!user?.id && ['student', 'teacher', 'guest'].includes(user.role);

  const ITEM_KINDS = [
    { id: 'blyant', label: 'Blyant', emoji: '✏️' },
    { id: 'viskelader', label: 'Viskelæder', emoji: '🧽' },
    { id: 'spidser', label: 'Blyantspidser', emoji: '🔶' },
    { id: 'farvekridt', label: 'Farvekridt', emoji: '🖍️' },
    { id: 'lineal', label: 'Lineal', emoji: '📏' },
    { id: 'saks', label: 'Saks', emoji: '✂️' },
    { id: 'limstift', label: 'Limstift', emoji: '🧴' },
    { id: 'tusch', label: 'Tusch', emoji: '🖊️' },
  ];

  // Every cel is a complete drawing of the original character, not a body-part rig.
  const CEL_COLS = 6;
  const CEL_ROWS = 4;
  const CEL_FPS = 24;
  const CEL_MS = 1000 / CEL_FPS;
  const THROW_CELS = {
    obbe: [19, 4, 6, 7, 11, 9, 5, 12, 8, 10, 13, 14, 15, 17, 18, 19],
    luigi: [19, 4, 5, 13, 16, 8, 6, 9, 10, 7, 11, 12, 14, 15, 18, 19],
  };
  const RELEASE_STEP = 10;
  const FLIGHT_MS = 620;
  const CEL_ASSETS = {
    obbe: 'assets/figurer/plus-penalhus/obbe-cartoon-v3.webp',
    luigi: 'assets/figurer/plus-penalhus/luigi-cartoon-v3.webp',
  };
  // Palm positions in normalized cell coordinates, following the drawn hand.
  const CEL_HANDS = {
    obbe: [[0.766,0.66],[0.773,0.667],[0.766,0.667],[0.763,0.667],[0.465,0.752],[0.752,0.663],[0.217,0.646],[0.198,0.682],[0.746,0.717],[0.835,0.566],[0.756,0.594],[0.199,0.54],[0.824,0.55],[0.784,0.437],[0.841,0.36],[0.877,0.377],[0.747,0.615],[0.711,0.632],[0.756,0.658],[0.766,0.658]],
    luigi: [[0.347,0.69],[0.344,0.687],[0.502,0.611],[0.355,0.682],[0.228,0.681],[0.264,0.671],[0.174,0.653],[0.17,0.594],[0.199,0.725],[0.158,0.575],[0.241,0.63],[0.25,0.565],[0.115,0.551],[0.481,0.691],[0.117,0.332],[0.148,0.382],[0.576,0.679],[0.258,0.47],[0.325,0.639],[0.343,0.656]],
  };
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
    const left = 8 + ((serial * 37 + (who === 'obbe' ? 0 : 17)) % 74);
    const top = 10 + ((serial * 53 + (who === 'obbe' ? 11 : 29)) % 68);
    const rot = ((serial * 23) % 36) - 18;
    return {
      id: serial,
      who,
      kind: kind.id,
      label: kind.label,
      emoji: kind.emoji,
      left,
      top,
      rot,
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

    function paintCel(who, frame) {
      const actor = actors[who];
      if (!actor?.image || actor.frame === frame) return;
      actor.frame = frame;
      const w = actor.image.naturalWidth / CEL_COLS;
      const h = actor.image.naturalHeight / CEL_ROWS;
      actor.context.clearRect(0, 0, 256, 384);
      actor.context.drawImage(actor.image, (frame % CEL_COLS) * w,
        Math.floor(frame / CEL_COLS) * h, w, h, 0, 0, 256, 384);
      const hand = CEL_HANDS[who][frame] || CEL_HANDS[who][0];
      const grip = $(`[data-pp-hand="${who}"]`);
      grip.style.left = `${hand[0] * 100}%`;
      grip.style.top = `${hand[1] * 100}%`;
    }

    function animate(now) {
      if (disposed) return;
      const reduced = prefersReducedMotion();
      for (const who of ['obbe', 'luigi']) {
        const actor = actors[who];
        if (!actor?.image) continue;
        if (actor.throw) {
          const t = actor.throw;
          const step = Math.max(0, Math.floor((now - t.start) / CEL_MS));
          const cels = THROW_CELS[who];
          paintCel(who, cels[Math.min(cels.length - 1, step)]);
          if (!t.released && step >= RELEASE_STEP) {
            t.released = true;
            setHandItem(actor.button, '');
            t.onRelease();
          }
          if (step >= cels.length) actor.throw = null;
        } else if (phase === 'done' || actor.cheerUntil > now) {
          paintCel(who, reduced ? 20 : 20 + Math.floor(now / 140) % 4);
        } else {
          const idle = [0, 1, 3, 1];
          paintCel(who, reduced ? 0 : idle[Math.floor(now / 180) % idle.length]);
        }
      }
      for (const [el, flight] of activeFlights) {
        const t = Math.min(1, Math.max(0, (now - flight.start) / FLIGHT_MS));
        const x = flight.x + (flight.targetX - flight.x) * t;
        const y = flight.y + (flight.targetY - flight.y) * t - 4 * flight.arc * t * (1 - t);
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.transform = `translate(-50%,-50%) rotate(${(flight.who === 'obbe' ? 1 : -1) * t * 300}deg)`;
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
          paintCel(who, 0);
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

    function paintItems(landingId = null) {
      const canvas = $('#pp-canvas');
      canvas.innerHTML = items.map(item => {
        const landing = item.id === landingId ? ' pp-landing' : '';
        const counted = item.counted ? ' pp-counted' : '';
        return `<button type="button" class="pp-item pp-item-${item.who}${counted}${landing}" data-pp-item="${item.id}" style="left:${item.left}%;top:${item.top}%;--pp-rot:${item.rot}deg" aria-pressed="${item.counted ? 'true' : 'false'}" aria-label="${item.label} fra ${item.who === 'obbe' ? 'Øbbe' : 'Luigi'}${item.counted ? ', talt' : ''}"><span class="pp-item-emoji" aria-hidden="true">${item.emoji}</span></button>`;
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

    function spawnFlight(who, item, charBtn, canvas) {
      const token = actionToken;
      const reduced = prefersReducedMotion();
      const canvasBox = canvas.getBoundingClientRect();
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
      const targetLeft = canvasBox.left + (item.left / 100) * canvasBox.width;
      const targetTop = canvasBox.top + (item.top / 100) * canvasBox.height;
      const arc = 48 + (Math.abs(targetLeft - startX) * 0.12) + ((item.id * 7) % 28);

      if (reduced) {
        if (token !== actionToken) return;
        items.push(item);
        busy[who] = false;
        clearThrowClasses(charBtn);
        paintItems(item.id);
        maybeEnterAnswerPhase();
        update();
        return;
      }

      const fly = document.createElement('div');
      fly.className = `pp-flight pp-flight-${who}`;
      fly.innerHTML = `<span aria-hidden="true">${item.emoji}</span>`;
      fly.style.left = `${startX}px`;
      fly.style.top = `${startY}px`;
      document.body.append(fly);
      flights.add(fly);
      activeFlights.set(fly, { start: performance.now(), x: startX, y: startY,
        targetX: targetLeft, targetY: targetTop, arc, who });

      later(() => {
        fly.remove();
        flights.delete(fly);
        activeFlights.delete(fly);
        if (disposed || token !== actionToken) return;
        items.push(item);
        busy[who] = false;
        clearThrowClasses(charBtn);
        paintItems(item.id);
        maybeEnterAnswerPhase();
        update();
      }, FLIGHT_MS);
    }

    function setHandItem(charBtn, emoji) {
      const grip = charBtn.querySelector('[data-pp-hand]');
      if (!grip) return;
      if (emoji) {
        grip.innerHTML = `<span class="pp-hand-emoji" aria-hidden="true">${emoji}</span>`;
        grip.classList.add('pp-hand-loaded');
      } else {
        grip.innerHTML = '';
        grip.classList.remove('pp-hand-loaded');
      }
    }

    function runThrowPose(charBtn, who, itemEmoji, onRelease) {
      const actor = actors[who];
      busy[who] = true;
      clearThrowClasses(charBtn);
      charBtn.classList.add('pp-busy');
      setHandItem(charBtn, itemEmoji);
      if (prefersReducedMotion()) {
        paintCel(who, THROW_CELS[who][RELEASE_STEP]);
        setHandItem(charBtn, '');
        onRelease();
      } else {
        actor.throw = { start: performance.now(), released: false, onRelease };
        paintCel(who, THROW_CELS[who][0]);
      }
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
      const charBtn = $(`[data-pp-throw="${who}"]`);
      const canvas = $('#pp-canvas');

      updateProgress();

      runThrowPose(charBtn, who, item.emoji, () => {
        if (disposed) return;
        spawnFlight(who, item, charBtn, canvas);
      });
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
          paintCel(who, 0);
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
