/* Presentation state only. Never changes authentication, roles or school data. */
(function (root) {
  'use strict';
  const JACOB = 'c8b8e1c4-3264-40e9-a43d-0eb6214a0183';
  const KEY = 'jm-student-view';
  const PROGRESS = 'jm-student-view-results:' + JACOB;
  let enabled = false, user = null, onExit = null, lastSaved = null, storageError = false;
  const loaded = new WeakSet();
  try { enabled = root.sessionStorage.getItem(KEY) === JACOB; } catch (_) {}
  const isJacob = profile => profile?.id === JACOB && profile.role === 'teacher';
  function save() {
    if (!enabled || !isJacob(user)) return;
    const json = JSON.stringify(user.results || []);
    if (json === lastSaved) return;
    try { root.localStorage.setItem(PROGRESS, json); lastSaved = json; storageError = false; }
    catch (_) { storageError = true; }
    paint();
  }
  function bind(profile, exit) {
    user = profile; onExit = exit || null;
    if (!isJacob(profile)) { set(false); return; }
    if (!loaded.has(profile)) {
      try {
        const results = JSON.parse(root.localStorage.getItem(PROGRESS) || '[]');
        if (Array.isArray(results)) {
          const seen = new Set((profile.results || []).map(item => JSON.stringify(item)));
          profile.results = [...(profile.results || []), ...results.filter(item => item && typeof item === 'object' && !seen.has(JSON.stringify(item)))];
        }
      } catch (_) {}
      loaded.add(profile);
    }
    paint();
  }
  function set(value) {
    save();
    enabled = Boolean(value && isJacob(user));
    try { if (enabled) root.sessionStorage.setItem(KEY, JACOB); else root.sessionStorage.removeItem(KEY); } catch (_) {}
    paint();
  }
  function paint() {
    if (!root.document?.body) return;
    let banner = root.document.getElementById('jm-student-view-banner');
    if (!enabled) { banner?.remove(); root.document.documentElement.style.removeProperty('--jm-student-view-height'); return; }
    if (!banner) {
      banner = root.document.createElement('aside');
      banner.id = 'jm-student-view-banner';
      banner.setAttribute('data-i18n-skip', '');
      banner.innerHTML = '<div><strong></strong><small></small></div><button type="button"></button>';
      banner.querySelector('button').onclick = () => {
        if (onExit) onExit();
        else { set(false); root.location.assign('/'); }
      };
      root.document.body.prepend(banner);
    }
    let preference;
    try { preference = root.localStorage.getItem('jm-lang'); } catch (_) {}
    const en = (root.JacobLang?.get?.() || preference || root.document.documentElement.lang) === 'en';
    banner.querySelector('strong').textContent = en ? 'You are viewing as a student' : 'Du ser som elev';
    banner.querySelector('small').textContent = storageError
      ? (en ? 'Progress could not be saved on this device.' : 'Progression kunne ikke gemmes på denne enhed.')
      : (en ? 'Your own progress is saved on this device.' : 'Din egen progression gemmes på denne enhed.');
    banner.querySelector('button').textContent = en ? 'Back to my view' : 'Tilbage til min visning';
    root.document.documentElement.style.setProperty('--jm-student-view-height', banner.offsetHeight + 'px');
  }
  root.JacobStudentView = { isJacob, bind, set, save, active: () => enabled && isJacob(user) };
  root.document.addEventListener('DOMContentLoaded', paint);
  root.document.addEventListener('jm-langchange', paint);
  root.document.addEventListener('visibilitychange', save);
  root.addEventListener('pagehide', save);
  root.addEventListener('resize', paint);
  // Includes module-owned results without changing protected exercise code.
  root.setInterval(save, 1000);
})(window);
