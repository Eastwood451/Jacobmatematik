(() => {
  'use strict';

  function init() {
    const ammoEl = document.getElementById('ammo');
    const panel = document.querySelector('.math-panel');
    if (!ammoEl || !panel) return;

    // Show earned ammunition directly inside the maths panel.
    const ammoVisual = document.createElement('div');
    ammoVisual.className = 'math-ammo';
    ammoVisual.setAttribute('role', 'status');
    ammoVisual.setAttribute('aria-live', 'polite');
    panel.appendChild(ammoVisual);

    const style = document.createElement('style');
    style.textContent = `
      .math-panel .feedback{padding-left:86px;padding-right:86px}
      .math-ammo{
        position:absolute;left:12px;bottom:10px;min-width:66px;height:31px;
        display:flex;align-items:center;justify-content:center;gap:3px;
        padding:3px 7px;background:#fff7dc;border:3px solid #101317;border-radius:9px;
        box-shadow:2px 2px 0 #101317;transform:rotate(-2deg);
        font:900 12px/1 Inter,system-ui,sans-serif;white-space:nowrap;
      }
      .math-ammo .ammo-pencils{display:flex;align-items:center;gap:0;max-width:48px;overflow:hidden}
      .math-ammo .ammo-pencil{display:inline-block;font-size:19px;line-height:1;filter:drop-shadow(1px 1px 0 rgba(16,19,23,.2));margin-right:-4px}
      .math-ammo .ammo-zero{opacity:.28;filter:grayscale(1)}
      .math-ammo strong{font-size:12px;min-width:18px;text-align:right}
      .math-ammo.ammo-pop{animation:ammoPop .34s cubic-bezier(.2,1.7,.4,1)}
      @keyframes ammoPop{0%{transform:rotate(-2deg) scale(.78)}60%{transform:rotate(2deg) scale(1.18)}100%{transform:rotate(-2deg) scale(1)}}
      @media(max-width:600px){
        .math-panel .feedback{padding-left:74px;padding-right:74px}
        .math-ammo{left:8px;bottom:7px;min-width:58px;padding:2px 5px}
        .math-ammo .ammo-pencil{font-size:17px}
      }
    `;
    document.head.appendChild(style);

    let previousAmmo = -1;
    function renderAmmo() {
      const ammo = Math.max(0, Number.parseInt(ammoEl.textContent, 10) || 0);
      const visible = Math.min(ammo, 6);
      const pencils = ammo === 0
        ? '<span class="ammo-pencil ammo-zero">✏️</span>'
        : Array.from({length: visible}, () => '<span class="ammo-pencil">✏️</span>').join('');
      ammoVisual.innerHTML = `<span class="ammo-pencils" aria-hidden="true">${pencils}</span><strong>×${ammo}</strong>`;
      ammoVisual.setAttribute('aria-label', `${ammo} blyant${ammo === 1 ? '' : 'er'} ammunition`);
      if (previousAmmo >= 0 && ammo > previousAmmo) {
        ammoVisual.classList.remove('ammo-pop');
        void ammoVisual.offsetWidth;
        ammoVisual.classList.add('ammo-pop');
      }
      previousAmmo = ammo;
    }

    new MutationObserver(renderAmmo).observe(ammoEl, {childList:true,characterData:true,subtree:true});
    renderAmmo();

    // The main game listens for Digit0-Digit9 and Enter. Translate the
    // separate numeric keypad to those same events, including NumpadEnter.
    document.addEventListener('keydown', event => {
      const digitMatch = /^Numpad([0-9])$/.exec(event.code);
      if (digitMatch) {
        event.preventDefault();
        const digit = digitMatch[1];
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: digit,
          code: `Digit${digit}`,
          bubbles: true,
          cancelable: true
        }));
        return;
      }
      if (event.code === 'NumpadEnter') {
        event.preventDefault();
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          bubbles: true,
          cancelable: true
        }));
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
