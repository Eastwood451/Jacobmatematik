// The allowlist is shared by the host and browser: peers never supply asset URLs.
export const AVATARS = Object.freeze([
  { id:'dennis', name:'Divisions-Dennis', image:'assets/figurer/dennis-avatar.png' },
  { id:'luigi', name:'Luigi Lækkermat', image:'assets/figurer/luigi-laekkermat-cutout.webp' },
  { id:'kaptajn', name:'Kaptajn Kvadratrod', image:'assets/figurer/kaptajn-avatar.png' },
]);
export const normalizeAvatar = value => AVATARS.some(a=>a.id===value) ? value : 'dennis';
export const avatarFor = value => AVATARS.find(a=>a.id===normalizeAvatar(value));
