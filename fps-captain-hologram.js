import * as THREE from 'three';

const CAPTAIN_LINES = [
  'Ved den hellige lommeregner! Du er den udvalgte!',
  'Du besejrer surheden med klogheden!',
  'Jeg er stolt af dig, unge græshoppe!',
];

export function createCaptainHologram({ camera }) {
  let group = null;
  let texture = null;
  let loading = null;
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

  function showOverlay(text) {
    const el=ensureOverlay();
    const line=el.querySelector('[data-captain-line]');
    line.textContent=text;
    el.style.display='flex';
    el.animate(
      [
        {opacity:0,transform:'translate(-50%,-46%) scale(.72)',filter:'drop-shadow(0 0 2px rgba(71,226,255,.2))'},
        {opacity:1,transform:'translate(-50%,-50%) scale(1.03)',offset:.16},
        {opacity:.72,transform:'translate(-50%,-50%) scale(.99)',offset:.28},
        {opacity:1,transform:'translate(-50%,-50%) scale(1)',offset:.40},
        {opacity:.94,transform:'translate(-50%,-50%) scale(1)',offset:.86},
        {opacity:0,transform:'translate(-50%,-53%) scale(.96)'}
      ],
      {duration:5200,easing:'ease-out'}
    );
  }

  function loadTexture() {
    if (texture) return Promise.resolve(texture);
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      new THREE.TextureLoader().load(
        'assets/figurer/kaptajn-kvadratrod.webp',
        source => {
          source.colorSpace = THREE.SRGBColorSpace;
          texture = source;
          resolve(source);
        },
        undefined,
        reject,
      );
    }).catch(error => {
      console.warn('Kaptajn Kvadratrods 3D-hologram kunne ikke indlæses.', error);
      return null;
    });
    return loading;
  }

  function chooseDanishVoice() {
    if (!window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    return voices.find(voice => /^da([-_]|$)/i.test(voice.lang))
      || voices.find(voice => /danish|dansk/i.test(`${voice.name} ${voice.lang}`))
      || null;
  }

  function speak(text) {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = 'da-DK';
    utterance.rate = .76;
    utterance.pitch = .45;
    utterance.volume = 1;
    const voice = chooseDanishVoice();
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  }

  function build(source) {
    if (group || !source) return;
    group = new THREE.Group();
    group.name = 'Kaptajn Kvadratrod · Jedi-hologram';
    group.position.set(0, -.1, -4.4);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: source, color:0x40dfff, transparent:true, opacity:.17,
      depthTest:false, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false,
    }));
    glow.scale.set(3.5,4.6,1);
    glow.position.z=.03;

    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: source, color:0x83ecff, transparent:true, opacity:.78,
      depthTest:false, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false,
    }));
    sprite.scale.set(2.75,3.75,1);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(.55,1.05,48),
      new THREE.MeshBasicMaterial({
        color:0x65e7ff,transparent:true,opacity:.68,depthTest:false,depthWrite:false,
        blending:THREE.AdditiveBlending,side:THREE.DoubleSide,toneMapped:false,
      })
    );
    ring.position.set(0,-1.55,.06);
    ring.scale.y=.28;

    group.add(glow,sprite,ring);
    group.visible=false;
    group.renderOrder=30;
    group.userData={glow,sprite,ring};
    camera.add(group);
  }

  async function show(now) {
    const text = CAPTAIN_LINES[lineIndex++ % CAPTAIN_LINES.length];
    expiresAt = now + 5200;
    showOverlay(text);
    speak(text);
    const source = await loadTexture();
    if (!source || now >= expiresAt) return text;
    build(source);
    group.visible = true;
    return text;
  }

  function update(now) {
    if (overlay?.isConnected && now >= expiresAt) overlay.style.display='none';
    if (!group?.visible) return;
    if (now >= expiresAt) {
      group.visible=false;
      return;
    }
    const t=now*.001;
    group.userData.sprite.material.opacity=.66+Math.sin(t*11)*.08;
    group.userData.glow.material.opacity=.12+(.5+.5*Math.sin(t*7.5))*.10;
    group.userData.ring.material.opacity=.48+(.5+.5*Math.sin(t*9))*.28;
    group.position.x=Math.sin(t*17)*.018;
    group.position.y=-.1+Math.sin(t*4.2)*.025;
  }

  function hide({ stopVoice = true } = {}) {
    expiresAt=0;
    if (group) group.visible=false;
    if (overlay) overlay.style.display='none';
    if (stopVoice && window.speechSynthesis) window.speechSynthesis.cancel();
  }

  // Warm the asset cache before the first 10-kill milestone.
  void loadTexture();
  ensureOverlay();

  return {
    show,
    update,
    hide,
    get lines() { return [...CAPTAIN_LINES]; },
  };
}
