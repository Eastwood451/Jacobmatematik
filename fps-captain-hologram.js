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
      console.warn('Kaptajn Kvadratrods hologram kunne ikke indlæses.', error);
      return null;
    });
    return loading;
  }

  function chooseDanishVoice() {
    if (!window.speechSynthesis) return null;
    const voices = speechSynthesis.getVoices();
    return voices.find(voice => /^da([-_]|$)/i.test(voice.lang))
      || voices.find(voice => /danish|dansk/i.test(`${voice.name} ${voice.lang}`))
      || null;
  }

  function speak(text) {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'da-DK';
    utterance.rate = .78;
    utterance.pitch = .55;
    utterance.volume = 1;
    const voice = chooseDanishVoice();
    if (voice) utterance.voice = voice;
    speechSynthesis.speak(utterance);
  }

  function build(source) {
    if (group || !source) return;
    group = new THREE.Group();
    group.name = 'Kaptajn Kvadratrod · Jedi-hologram';
    group.position.set(0, -.1, -4.4);

    const glowMaterial = new THREE.SpriteMaterial({
      map: source,
      color: 0x40dfff,
      transparent: true,
      opacity: .17,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const glow = new THREE.Sprite(glowMaterial);
    glow.scale.set(3.5, 4.6, 1);
    glow.position.z = .03;
    glow.name = 'captain-hologram-glow';

    const material = new THREE.SpriteMaterial({
      map: source,
      color: 0x83ecff,
      transparent: true,
      opacity: .78,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2.75, 3.75, 1);
    sprite.name = 'captain-hologram-sprite';

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x65e7ff,
      transparent: true,
      opacity: .68,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(.55, 1.05, 48), ringMaterial);
    ring.position.set(0, -1.55, .06);
    ring.scale.y = .28;
    ring.name = 'captain-hologram-ring';

    group.add(glow, sprite, ring);
    group.visible = false;
    group.renderOrder = 30;
    group.userData = { glow, sprite, ring };
    camera.add(group);
  }

  async function show(now) {
    const text = CAPTAIN_LINES[lineIndex++ % CAPTAIN_LINES.length];
    speak(text);
    const source = await loadTexture();
    if (!source) return text;
    build(source);
    expiresAt = now + 5200;
    group.visible = true;
    return text;
  }

  function update(now) {
    if (!group?.visible) return;
    if (now >= expiresAt) {
      group.visible = false;
      return;
    }
    const t = now * .001;
    const pulse = .66 + Math.sin(t * 11) * .08;
    group.userData.sprite.material.opacity = pulse;
    group.userData.glow.material.opacity = .12 + (.5 + .5 * Math.sin(t * 7.5)) * .10;
    group.userData.ring.material.opacity = .48 + (.5 + .5 * Math.sin(t * 9)) * .28;
    group.position.x = Math.sin(t * 17) * .018;
    group.position.y = -.1 + Math.sin(t * 4.2) * .025;
  }

  function hide({ stopVoice = true } = {}) {
    expiresAt = 0;
    if (group) group.visible = false;
    if (stopVoice && window.speechSynthesis) speechSynthesis.cancel();
  }

  return {
    show,
    update,
    hide,
    get lines() { return [...CAPTAIN_LINES]; },
  };
}
