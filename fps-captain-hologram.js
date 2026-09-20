const CAPTAIN_LINES = [
  'Ved den hellige lommeregner! Du er den udvalgte!',
  'Du besejrer surheden med klogheden!',
  'Jeg er stolt af dig, unge græshoppe!',
];

export function createCaptainHologram({ playVoice = () => {}, stopVoice = () => {} } = {}) {
  let expiresAt = 0;
  let lineIndex = 0;
  let overlay = null;

  function ensureOverlay() {
    if (overlay?.isConnected) return overlay;
    overlay = document.createElement('aside');
    overlay.id = 'captain-hologram';
    overlay.setAttribute('aria-live','assertive');
    overlay.style.cssText = [
      'position:fixed','z-index:60','left:50%','top:50%','transform:translate(-50%,-50%)',
      'width:min(470px,78vw)','height:min(520px,72vh)','pointer-events:none','display:none',
      'align-items:center','justify-content:flex-end','flex-direction:column','overflow:visible',
      'filter:drop-shadow(0 0 18px rgba(71,226,255,.75))'
    ].join(';');
    overlay.innerHTML = `
      <div aria-hidden="true" style="position:absolute;inset:2% 12% 15%;border-radius:50%;background:radial-gradient(ellipse,rgba(126,240,255,.24),rgba(45,196,255,.08) 45%,transparent 72%);filter:blur(10px)"></div>
      <div style="position:relative;height:76%;width:72%;display:grid;place-items:end center;overflow:hidden">
        <img src="assets/figurer/kaptajn-kvadratrod.webp" alt="" style="max-width:100%;max-height:100%;object-fit:contain;opacity:.82;filter:sepia(1) saturate(5) hue-rotate(145deg) brightness(1.65) contrast(1.1);mix-blend-mode:screen">
        <div aria-hidden="true" style="position:absolute;inset:0;background:repeating-linear-gradient(to bottom,rgba(170,247,255,.09) 0 2px,transparent 2px 7px);mix-blend-mode:screen"></div>
      </div>
      <div aria-hidden="true" style="width:56%;height:22px;border:3px solid rgba(137,241,255,.85);border-radius:50%;box-shadow:0 0 18px #61e8ff, inset 0 0 13px #61e8ff;margin-top:-9px"></div>
      <div data-captain-line style="position:relative;margin-top:12px;max-width:100%;padding:12px 16px;border:2px solid rgba(148,241,255,.82);border-radius:14px;background:rgba(8,31,49,.78);box-shadow:0 0 18px rgba(74,219,255,.6);color:#eaffff;text-align:center;font:900 clamp(15px,2.4vw,22px)/1.15 Arial,sans-serif;text-shadow:0 0 8px #4ee6ff"></div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  function show(now) {
    const text = CAPTAIN_LINES[lineIndex++ % CAPTAIN_LINES.length];
    const el = ensureOverlay();
    el.querySelector('[data-captain-line]').textContent = text;
    el.style.display = 'flex';
    expiresAt = now + 7000;

    el.getAnimations().forEach(animation => animation.cancel());
    el.animate(
      [
        {opacity:0,transform:'translate(-50%,-46%) scale(.72)'},
        {opacity:1,transform:'translate(-50%,-50%) scale(1.03)',offset:.16},
        {opacity:.72,transform:'translate(-50%,-50%) scale(.99)',offset:.28},
        {opacity:1,transform:'translate(-50%,-50%) scale(1)',offset:.40},
        {opacity:.96,transform:'translate(-50%,-50%) scale(1)',offset:.86},
        {opacity:0,transform:'translate(-50%,-53%) scale(.96)'}
      ],
      {duration:7000,easing:'ease-out'}
    );

    void playVoice(text);
    return text;
  }

  function update(now) {
    if (overlay?.isConnected && overlay.style.display !== 'none' && now >= expiresAt) {
      overlay.style.display = 'none';
    }
  }

  function hide({ stopAudio = true } = {}) {
    expiresAt = 0;
    if (overlay) {
      overlay.getAnimations().forEach(animation => animation.cancel());
      overlay.style.display = 'none';
    }
    if (stopAudio) stopVoice();
  }

  ensureOverlay();

  return {
    show,
    update,
    hide,
    get lines() { return [...CAPTAIN_LINES]; },
  };
}
