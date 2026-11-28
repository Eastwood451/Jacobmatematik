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
      <div class="nl-controls" hidden>
        <div class="nl-clock" role="timer" aria-live="off" aria-label="Tid til næste trin"><span></span></div>
        <div class="nl-arrows" role="group" aria-label="Forklaringens trin">
          <button type="button" data-step="-1" aria-label="Forrige trin" title="Forrige trin">←</button>
          <button type="button" data-step="1" aria-label="Næste trin" title="Næste trin">→</button>
        </div>
      </div>
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
    this.controls = root.querySelector(".nl-controls");
    this.clock = root.querySelector(".nl-clock");
    this.seconds = this.clock.firstElementChild;
    this.forward = root.querySelector('[data-step="1"]');
    this.steps = this.lessonSteps();
    if (this.product) {
      this.resize = new ResizeObserver(() => this.spaceProductLabels());
      this.resize.observe(this.scroll);
      this.spaceProductLabels();
    }
    this.scroll.scrollLeft = (this.scroll.scrollWidth - this.scroll.clientWidth) / 2;
    root.addEventListener("click", event => {
      const tick = event.target.closest(".nl-tick");
      if (tick) this.choose(tick);
      const arrow = event.target.closest("[data-step]");
      if (arrow && (this.stage === "guide" || this.stage === "landing")) {
        this.showStep(this.stepIndex + Number(arrow.dataset.step));
      }
      if (event.target.closest(".nl-replay") && this.stage === "landing") this.guide();
    });
    this.play("start");
  }

  pauseAudio() {
    this.audio.pause();
  }

  dispose() {
    this.stage = "closed";
    cancelAnimationFrame(this.frame);
    this.resize?.disconnect();
    this.audio.onended = null;
    this.pauseAudio();
  }

  play(clip, after = null) {
    this.audio.onended = null;
    this.pauseAudio();
    this.audio.src = `assets/negative-tal/${clip}.mp3`;
    this.audio.onended = after;
    // Tekst, nedtælling og animation følger samme tidsplan, også uden lyd.
    this.audio.play().catch(() => {});
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
    this.controls.hidden = true;
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

  playProductFact() {
    const { a, b } = this.task;
    const copies = Math.abs(b);
    // Tal og sætningsdele er indtalt på dansk, også til enheder uden dansk systemstemme.
    const clips = a === 2 && copies === 3 ? ["eksempel"] : [
      ...(a < 0 ? ["minus"] : []), `${Math.abs(a)}-gange`, `${copies}-er`,
      ...(a < 0 ? ["minus"] : []), String(Math.abs(a * b)),
    ];
    const next = () => {
      if (clips.length) this.play(`gange/${clips.shift()}`, next);

    };
    next();
  }

  lessonSteps() {
    const { a, b, op } = this.task;
    if (this.product) {
      const copies = Math.abs(b);
      const initial = a < 0 ? -180 : 0;
      const steps = [
        { kind:"vector", angle:initial, duration:2600 },
        { kind:"build", angle:initial, duration:Math.max(600 * (copies - 1) + 850,
          a === 2 && copies === 3 ? 2600 : a < 0 ? 8200 : 6200) },
      ];
      if (b < 0) steps.push({ kind:"turn", angle:initial, endAngle:a < 0 ? 0 : -180, duration:3850 });
      return steps;
    }
    const firstMinus = op === "−";
    const steps = [{
      kind:"sign", sign:"operation", clip:firstMinus ? "minus" : "plus",
      message:firstMinus ? "Minus betyder, at retningen vender." : "Plus betyder: Gå til højre.",
      angle:0, endAngle:firstMinus ? -180 : 0, duration:firstMinus ? 4850 : 3900,
    }];
    if (b < 0) steps.push({
      kind:"sign", sign:"operand", clip:firstMinus ? "igen" : "minus",
      message:firstMinus ? "Endnu et minus vender retningen igen!" : "Minus betyder, at retningen vender.",
      angle:steps[0].endAngle, endAngle:firstMinus ? 0 : -180, duration:firstMinus ? 4250 : 4850,
    });
    return steps;
  }

  setPose(angle, copies = 1) {
    const shape = this.product ? this.root.querySelector(".nl-vectors") : this.pointer;
    shape.style.transition = "none";
    shape.style.transform = `rotate(${angle}deg)`;
    if (this.product) {
      shape.hidden = false;
      [...shape.children].forEach((segment, i) => segment.classList.toggle("visible", i < copies));
    } else {
      this.pointer.parentElement.hidden = false;
    }
    shape.getBoundingClientRect();
    shape.style.removeProperty("transition");
    return shape;
  }

  guide() {
    const origin = this.root.querySelector(".origin");
    if (!this.product) {
      this.scroll.scrollLeft += origin.getBoundingClientRect().left + origin.offsetWidth / 2
        - this.scroll.getBoundingClientRect().left - this.scroll.clientWidth / 2;
    }
    this.showStep(0);
  }

  showStep(index) {
    cancelAnimationFrame(this.frame);
    if (this.stage === "guide") this.guideDuration += Date.now() - this.stepStarted;
    this.stepIndex = index;
    this.root.querySelector(".nl-sign.active")?.classList.remove("active");
    this.replay.hidden = true;
    this.controls.hidden = index < 0;
    this.clock.hidden = index < 0 || index === this.steps.length;
    this.forward.disabled = index === this.steps.length;
    const origin = this.root.querySelector(".origin");
    const { a, b, op } = this.task;
    const copies = Math.abs(b);
    if (index < 0) {
      this.stage = "start";
      origin.classList.remove("origin");
      this.root.querySelector(this.product ? ".nl-vectors" : ".nl-pivot").hidden = true;
      this.prompt.textContent = "Hvor starter du?";
      this.tip.textContent = this.product ? "Vælg 0, hvor vektoren begynder." : "Vælg starttallet på tallinjen.";
      origin.focus({ preventScroll:true });
      this.play("start");
      return;
    }
    if (index === this.steps.length) {
      const last = this.steps[index - 1];
      this.setPose(last.endAngle ?? last.angle, copies);
      this.stage = "landing";
      const twice = op === "−" && b < 0;
      this.prompt.textContent = twice ? "Hvor lander du nu?" : "Hvor lander du?";
      this.tip.textContent = this.product ? "Vælg tallet ved den sidste lilla pilespids." : `Gå ${copies} skridt i pilens retning. Vælg tallet.`;
      this.replay.hidden = false;
      origin.focus({ preventScroll:true });
      this.play(twice ? "landing-igen" : "landing");
      return;
    }

    this.stage = "guide";
    this.stepStarted = Date.now();
    const step = this.steps[index];
    const shape = this.setPose(step.angle, step.kind === "turn" ? copies : 1);
    const number = n => String(n).replace("-", "−");
    if (step.kind === "sign") {
      this.root.querySelector(`[data-sign="${step.sign}"]`).classList.add("active");
      this.prompt.textContent = step.message;
      this.tip.textContent = `Du står på ${a}.`;
      this.play(step.clip);
    } else if (step.kind === "build") {
      this.prompt.textContent = `${number(a)} × ${copies} er ${number(a * copies)}.`;
      this.playProductFact();
    } else {
      this.root.querySelector('[data-sign="operand"]')?.classList.add("active");
      this.prompt.textContent = b < 0 ? "Minus vender retningen." : "Se på den lilla vektor.";
      this.tip.textContent = step.kind === "turn" ? "Hele rækken drejer om 0." :
        `Den lilla vektor går fra 0 til ${a > 0 ? "+" : ""}${number(a)}.`;
      this.play(b < 0 ? "gange/vending" : "gange/vektor");
    }

    const began = performance.now();
    let visible = 0, rotated = false;
    const tick = () => {
      const elapsed = performance.now() - began;
      const remaining = Math.max(0, step.duration - elapsed);
      this.clock.style.setProperty("--remaining", (100 * remaining / step.duration).toFixed(2) + "%");
      const label = Math.ceil(remaining / 1000) + " s";
      if (this.seconds.textContent !== label) this.seconds.textContent = label;
      if (step.kind === "build") {
        const next = Math.min(copies, 1 + Math.floor(elapsed / 600));
        if (next !== visible) {
          for (let i = visible; i < next; i++) shape.children[i].classList.add("visible");
          visible = next;
          this.tip.textContent = `${visible} af ${copies} ${copies === 1 ? "pil" : "pile"} · Spidsen er på ${number(visible * a)}.`;
        }
      }
      if (!rotated && step.endAngle !== undefined && remaining <= (this.product ? 1450 : 850)) {
        shape.style.transform = `rotate(${step.endAngle}deg)`;
        rotated = true;
      }
      if (remaining > 0) this.frame = requestAnimationFrame(tick);
      else this.showStep(index + 1);
    };
    tick();
  }
}
