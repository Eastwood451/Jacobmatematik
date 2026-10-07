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

  const OBBE_SRC = 'assets/figurer/obbe-ovdig.png';
  const OBBE_HAPPY = 'assets/figurer/obbe-techno.webp';
  const LUIGI_SRC = 'assets/figurer/luigi-laekkermat-cutout.webp';

  const THROW_WINDUP_MS = 160;
  const THROW_RELEASE_MS = 220;
  const THROW_FOLLOW_MS = 280;
  const FLIGHT_MS = 580;
  const FLIGHT_RELEASE_AT = THROW_WINDUP_MS + 90;
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
    const editable = () => !disposed && !pending && phase === 'throw';
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
          <button type="button" class="pp-char pp-obbe" data-pp-throw="obbe" aria-label="Øbbe Øvdig">
            <span class="pp-char-body">
              <img class="pp-char-img" src="${OBBE_SRC}" alt="" width="160" height="160" decoding="async">
              <img class="pp-char-happy" src="${OBBE_HAPPY}" alt="" width="160" height="160" decoding="async" hidden>
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
              <img class="pp-char-img" src="${LUIGI_SRC}" alt="" width="160" height="192" decoding="async">
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
      const obbeBtn = $('[data-pp-throw="obbe"]');
      const luigiBtn = $('[data-pp-throw="luigi"]');
      obbeBtn.classList.add('pp-celebrate');
      luigiBtn.classList.add('pp-celebrate');
      later(() => {
        obbeBtn.classList.remove('pp-celebrate');
        luigiBtn.classList.remove('pp-celebrate');
      }, 1400);
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
      const charBox = charBtn.getBoundingClientRect();
      const canvasBox = canvas.getBoundingClientRect();
      const body = charBtn.querySelector('.pp-char-body') || charBtn;
      const bodyBox = body.getBoundingClientRect();

      // Start near "hand" — upper-inner corner toward canvas
      const towardCanvas = who === 'obbe' ? 0.72 : 0.28;
      const startX = bodyBox.left + bodyBox.width * towardCanvas;
      const startY = bodyBox.top + bodyBox.height * 0.38;
      const targetLeft = canvasBox.left + (item.left / 100) * canvasBox.width;
      const targetTop = canvasBox.top + (item.top / 100) * canvasBox.height;
      const arc = 48 + (Math.abs(targetLeft - startX) * 0.12) + ((item.id * 7) % 28);

      if (reduced) {
        if (token !== actionToken) return;
        items.push(item);
        paintItems(item.id);
        if (quotasFilled() && phase === 'throw') enterAnswerPhase();
        else update();
        return;
      }

      const fly = document.createElement('div');
      fly.className = `pp-flight pp-flight-${who}`;
      fly.innerHTML = `<span aria-hidden="true">${item.emoji}</span>`;
      fly.style.left = `${startX}px`;
      fly.style.top = `${startY}px`;
      fly.style.setProperty('--pp-dx', `${targetLeft - startX}px`);
      fly.style.setProperty('--pp-dy', `${targetTop - startY}px`);
      fly.style.setProperty('--pp-arc', `${arc}px`);
      fly.style.setProperty('--pp-land-rot', `${item.rot}deg`);
      document.body.append(fly);
      flights.add(fly);

      later(() => {
        fly.remove();
        flights.delete(fly);
        if (disposed || token !== actionToken) return;
        items.push(item);
        paintItems(item.id);
        if (quotasFilled() && phase === 'throw') enterAnswerPhase();
        else update();
      }, FLIGHT_MS);
    }

    function runThrowPose(charBtn, who, onRelease) {
      const reduced = prefersReducedMotion();
      const token = actionToken;
      busy[who] = true;
      clearThrowClasses(charBtn);
      charBtn.classList.add('pp-busy');
      update();

      if (reduced) {
        onRelease();
        if (token === actionToken) {
          busy[who] = false;
          clearThrowClasses(charBtn);
          update();
        }
        return;
      }

      charBtn.classList.add('pp-windup');
      later(() => {
        if (disposed || token !== actionToken) return;
        charBtn.classList.remove('pp-windup');
        charBtn.classList.add('pp-throwing');
      }, THROW_WINDUP_MS);

      later(() => {
        if (disposed || token !== actionToken) return;
        onRelease();
      }, FLIGHT_RELEASE_AT);

      later(() => {
        if (disposed || token !== actionToken) return;
        charBtn.classList.remove('pp-throwing');
        charBtn.classList.add('pp-follow');
      }, THROW_WINDUP_MS + THROW_RELEASE_MS);

      later(() => {
        if (disposed || token !== actionToken) return;
        busy[who] = false;
        clearThrowClasses(charBtn);
        update();
      }, THROW_WINDUP_MS + THROW_RELEASE_MS + THROW_FOLLOW_MS);
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

      runThrowPose(charBtn, who, () => {
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
      $('.pp-obbe .pp-char-img').hidden = true;
      $('.pp-obbe .pp-char-happy').hidden = false;
      $('[data-pp-throw="obbe"]').classList.add('pp-celebrate');
      $('[data-pp-throw="luigi"]').classList.add('pp-celebrate');
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

      const happy = $('.pp-obbe .pp-char-happy');
      const normal = $('.pp-obbe .pp-char-img');
      if (happy) happy.hidden = true;
      if (normal) normal.hidden = false;

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

    return () => {
      disposed = true;
      timers.forEach(clearTimeout);
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
