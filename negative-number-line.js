/* Plus/minus bruger en retningspil. Gange bruger en række lige lange vektorer. */
class NegativeNumberLine {
  constructor(root, task, questionNumber, saveAnswer) {
    this.root = root;
    this.task = task;
    this.saveAnswer = saveAnswer;
    this.stage = "start";
    this.guideDuration = 0;
    this.audio = new Audio();
    const { a, op, b, answer } = task;
    this.product = op === "×";
    this.originValue = this.product ? 0 : a;
    const step = this.product && Math.abs(answer) > 12 ? Math.abs(a) : 1;
    const extent = this.product ? Math.max(3 * step, Math.abs(answer) + step) :
      Math.max(5, Math.ceil((Math.max(Math.abs(a), Math.abs(answer)) + 1) / 5) * 5);
    const first = -extent, count = 2 * extent / step + 1;
    const number = n => String(n).replace("-", "−");
    const sign = (symbol, id) => `<span class="nl-sign ${symbol === "+" ? "plus" : "minus"}" data-sign="${id}">${symbol}</span>`;
    root.classList.toggle("nl-product", this.product);
    const vectors = this.product ? `<div class="nl-vectors" hidden aria-hidden="true" style="width:${100 * Math.abs(answer) / (step * count)}%">
      ${Array.from({length:Math.abs(b)}, () => '<i class="nl-vector"></i>').join("")}
    </div>` : "";
    root.innerHTML = `<div class="nl-question">
      <span class="question-number">Opgave ${questionNumber}</span>
      <div class="expression" aria-label="${task.expression}"><span aria-hidden="true">${number(a)} ${this.product ? op : sign(op, "operation")} ${b < 0 ? `(${sign("−", "operand")}${Math.abs(b)})` : b}</span></div>
    </div>
    <div class="nl-lesson">
      <h2 class="nl-prompt" aria-live="polite">Hvor starter du?</h2>
      <p class="nl-tip">${this.product ? "Vælg 0, hvor vektoren begynder." : "Vælg starttallet på tallinjen."}</p>
      <div class="nl-scroll" role="group" aria-label="Tallinje fra ${first} til ${extent}">
        <div class="nl-track" style="--ticks:${count}; --start:${(this.originValue - first) / step + 0.5}">
          <div class="nl-axis" aria-hidden="true"></div>
          ${vectors || '<div class="nl-pivot" hidden aria-hidden="true"><i class="nl-pointer"></i></div>'}
          ${Array.from({ length:count }, (_, i) => {
            const n = first + i * step;
            return `<button class="nl-tick${n === 0 ? " zero" : ""}" type="button" data-value="${n}"><span>${number(n)}</span></button>`;
          }).join("")}
        </div>
      </div>
      <p id="answer-error" class="error" role="alert"></p>
      <button type="button" class="btn secondary nl-replay" hidden>Vis igen</button>
      <button type="button" class="btn nl-next" data-action="continue-after-correction" hidden>Næste opgave →</button>
    </div>`;
    this.prompt = root.querySelector(".nl-prompt");
    this.tip = root.querySelector(".nl-tip");
    this.pointer = root.querySelector(".nl-pointer");
    this.scroll = root.querySelector(".nl-scroll");
    this.replay = root.querySelector(".nl-replay");
    if (this.product) {
      this.resize = new ResizeObserver(() => this.spaceProductLabels());
      this.resize.observe(this.scroll);
      this.spaceProductLabels();
    }
    this.scroll.scrollLeft = (this.scroll.scrollWidth - this.scroll.clientWidth) / 2;
    root.addEventListener("click", event => {
      const tick = event.target.closest(".nl-tick");
      if (tick) this.choose(tick);
      if (event.target.closest(".nl-replay") && this.stage === "landing") this.guide();
    });
    this.play("start");
  }

  pauseAudio() {
    this.audio.pause();
  }

  dispose() {
    this.stage = "closed";
    clearTimeout(this.timer);
    clearTimeout(this.vectorTimer);
    this.resize?.disconnect();
    this.audio.onended = this.audio.onerror = null;
    this.pauseAudio();
  }

  // Hvis lyd er blokeret, får eleven stadig tid til at læse hvert trin.
  play(clip, after) {
    clearTimeout(this.timer);
    this.audio.onended = this.audio.onerror = null;
    this.pauseAudio();
    this.audio.src = `assets/negative-tal/${clip}.mp3`;
    let finished = false;
    const finish = () => {
      if (finished || this.stage === "closed") return;
      finished = true;
      clearTimeout(this.timer);
      this.audio.onended = this.audio.onerror = null;
      after?.();
    };
    const noAudio = () => {
      if (!finished && this.stage !== "closed" && after) {
        clearTimeout(this.timer);
        this.timer = setTimeout(finish, 2000);
      }
    };
    if (after) {
      this.timer = setTimeout(finish, 5000);
      this.audio.onended = finish;
      this.audio.onerror = noAudio;
    }
    this.audio.play().catch(noAudio);
  }

  async choose(tick) {
    const value = Number(tick.dataset.value);
    if (this.stage === "start") {
      if (value !== this.originValue) {
        this.tip.textContent = this.product ? "Vektoren begynder på 0. Vælg 0." : `Find det første tal i regnestykket, ${this.task.a}.`;
        return;
      }
      tick.classList.add("origin");
      this.guide();
      return;
    }
    if (this.stage !== "landing") return;
    this.stage = "saving";
    this.root.querySelector("#answer-error").textContent = "";
    if (!this.recorded) {
      const saved = await this.saveAnswer(value, this.guideDuration);
      if (this.stage === "closed") return;
      if (!saved) { this.stage = "landing"; return; }
      this.recorded = true;
    }
    if (value !== this.task.answer) {
      this.stage = "landing";
      this.prompt.textContent = "Prøv igen. Hvor lander du?";
      this.tip.textContent = this.product ? "Følg de lilla pile fra 0. Vælg tallet ved den sidste pilespids." :
        `Tæl ${Math.abs(this.task.b)} skridt mod ${this.task.answer < this.task.a ? "venstre" : "højre"} fra ${this.task.a}.`;
      return;
    }
    this.stage = "done";
    tick.classList.add("destination");
    this.prompt.textContent = "Flot!";
    this.tip.textContent = `${this.task.expression.replaceAll("-", "−")} = ${String(value).replace("-", "−")}`;
    this.replay.hidden = true;
    const next = this.root.querySelector(".nl-next");
    next.hidden = false;
    next.focus({ preventScroll:true });
    this.play("flot");
  }

  spaceProductLabels() {
    const ticks = [...this.scroll.querySelectorAll(".nl-tick")];
    const spacing = this.scroll.clientWidth / ticks.length;
    const widest = String(-Math.abs(this.task.answer)).length * 10 + 10;
    const stride = Math.max(1, Math.ceil(widest / spacing));
    const middle = (ticks.length - 1) / 2;
    const last = ticks.findIndex(tick => Number(tick.dataset.value) === Math.abs(this.task.answer));
    const labelled = new Set([middle, last, 2 * middle - last]);
    for (let offset = stride; offset <= middle; offset += stride) {
      if (Math.abs(last - middle - offset) < stride) continue;
      labelled.add(middle - offset);
      labelled.add(middle + offset);
    }
    ticks.forEach((tick, i) => { tick.disabled = !labelled.has(i); });
  }

  playProductFact(after) {
    const { a, b } = this.task;
    const copies = Math.abs(b);
    // Tal og sætningsdele er indtalt på dansk, også til enheder uden dansk systemstemme.
    const clips = a === 2 && copies === 3 ? ["eksempel"] : [
      ...(a < 0 ? ["minus"] : []), `${Math.abs(a)}-gange`, `${copies}-er`,
      ...(a < 0 ? ["minus"] : []), String(Math.abs(a * b)),
    ];
    const next = () => {
      if (clips.length) this.play(`gange/${clips.shift()}`, next);
      else after();
    };
    next();
  }

  guideProduct(started) {
    const { a, b } = this.task;
    const count = Math.abs(b);
    const number = n => String(n).replace("-", "−");
    const chain = this.root.querySelector(".nl-vectors");
    const segments = [...chain.children];
    const minus = this.root.querySelector('[data-sign="operand"]');
    const landing = () => {
      minus?.classList.remove("active");
      this.stage = "landing";
      this.guideDuration += Date.now() - started;
      this.prompt.textContent = "Hvor lander du?";
      this.tip.textContent = "Vælg tallet ved den sidste lilla pilespids.";
      this.replay.hidden = false;
      this.root.querySelector(".origin").focus({ preventScroll:true });
      this.play("landing");
    };
    const turn = () => {
      if (b > 0) { landing(); return; }
      minus.classList.add("active");
      this.prompt.textContent = "Minus vender retningen.";
      this.tip.textContent = "Hele rækken drejer om 0.";
      this.play("gange/vending", () => {
        chain.style.transform = a > 0 ? "rotate(-180deg)" : "rotate(0deg)";
        this.vectorTimer = setTimeout(landing, 1450);
      });
    };
    const build = () => {
      minus?.classList.remove("active");
      this.prompt.textContent = `${number(a)} × ${count} er ${number(a * count)}.`;
      let visible = 1, spoken = false;
      const whenReady = () => {
        if (spoken && visible === count) this.vectorTimer = setTimeout(turn, 650);
      };
      const reveal = () => {
        this.tip.textContent = `${visible} af ${count} ${count === 1 ? "pil" : "pile"} · Spidsen er på ${number(visible * a)}.`;
        if (visible === count) { whenReady(); return; }
        this.vectorTimer = setTimeout(() => {
          segments[visible++].classList.add("visible");
          reveal();
        }, 600);
      };
      reveal();
      this.playProductFact(() => { spoken = true; whenReady(); });
    };
    chain.hidden = false;
    chain.style.transition = "none";
    chain.style.transform = a < 0 ? "rotate(-180deg)" : "rotate(0deg)";
    segments.forEach((segment, i) => segment.classList.toggle("visible", i === 0));
    chain.getBoundingClientRect(); // Nulstil også replay til den første vektors retning.
    chain.style.removeProperty("transition");
    this.tip.textContent = `Den lilla vektor går fra 0 til ${a > 0 ? "+" : ""}${number(a)}.`;
    this.prompt.textContent = b < 0 ? "Minus vender retningen." : "Se på den lilla vektor.";
    minus?.classList.add("active");
    this.play(b < 0 ? "gange/vending" : "gange/vektor", build);
  }

  guide() {
    const { a, op, b } = this.task;
    const started = Date.now();
    this.stage = "guide";
    this.replay.hidden = true;
    if (this.product) { this.guideProduct(started); return; }
    this.root.querySelector(".nl-pivot").hidden = false;
    this.pointer.style.transition = "none";
    this.pointer.style.transform = "rotate(0deg)";
    const origin = this.root.querySelector(".origin");
    this.scroll.scrollLeft += origin.getBoundingClientRect().left + origin.offsetWidth / 2
      - this.scroll.getBoundingClientRect().left - this.scroll.clientWidth / 2;
    this.pointer.style.removeProperty("transition");
    this.tip.textContent = `Du står på ${a}.`;
    const showSign = (id, message, clip, angle, after) => {
      this.root.querySelector(".nl-sign.active")?.classList.remove("active");
      this.root.querySelector(`[data-sign="${id}"]`).classList.add("active");
      this.prompt.textContent = message;
      this.play(clip, () => {
        this.pointer.style.transform = `rotate(${angle}deg)`;
        this.timer = setTimeout(after, 850);
      });
    };
    const landing = () => {
      this.root.querySelector(".nl-sign.active")?.classList.remove("active");
      this.guideDuration += Date.now() - started;
      this.stage = "landing";
      const twice = op === "−" && b < 0;
      this.prompt.textContent = twice ? "Hvor lander du nu?" : "Hvor lander du?";
      this.tip.textContent = `Gå ${Math.abs(b)} skridt i pilens retning. Vælg tallet.`;
      this.replay.hidden = false;
      origin.focus({ preventScroll:true });
      this.play(twice ? "landing-igen" : "landing");
    };
    const operand = () => {
      if (b > 0) { landing(); return; }
      if (op === "−") showSign("operand", "Endnu et minus vender retningen igen!", "igen", 0, landing);
      else showSign("operand", "Minus betyder, at retningen vender.", "minus", -180, landing);
    };
    if (op === "+") showSign("operation", "Plus betyder: Gå til højre.", "plus", 0, operand);
    else showSign("operation", "Minus betyder, at retningen vender.", "minus", -180, operand);
  }
}
