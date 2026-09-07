// The allowlist is shared by the host and browser: peers never supply asset URLs.
// Reuse existing artwork unchanged, including backgrounds. Do not redesign characters.
export const AVATARS = Object.freeze([
  { id:'dennis', name:'Divisions-Dennis', image:'assets/figurer/divisions-dennis.webp' },
  { id:'luigi', name:'Luigi Lækkermat', image:'assets/figurer/luigi-laekkermat-cutout.webp' },
  { id:'kaptajn', name:'Kaptajn Kvadratrod', image:'assets/figurer/kaptajn-kvadratrod.webp' },
]);
export const normalizeAvatar = value => AVATARS.some(a=>a.id===value) ? value : 'dennis';
export const avatarFor = value => AVATARS.find(a=>a.id===normalizeAvatar(value));
