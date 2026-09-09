const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { webcrypto } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');

(async () => {
  let enabled = false, authCalls = 0, authError = null, session = true, lastSignup, assignment;
  let profile = { id:'student', role:'student', teacher_id:null, username:'søren7', name:'søren7' };
  const results = [{ id:'result-1', student_id:'student', data:{ topic:'addition', correct:true }, created_at:'2026-09-09T12:00:00Z' }];
  let school = { classes:[], users:[] }, saved;
  const client = {
    auth:{
      async signUp(values) { authCalls++; lastSignup=values; return { error:authError, data:{ session:session ? {} : null } }; },
      async getUser() { return { data:{ user:{ id:profile.id } } }; },
      async signInWithPassword() { return {}; },
    },
    async rpc(name, values) {
      if (name === 'self_registration_enabled') return { data:enabled };
      if (name === 'can_manage_self_registered') return { data:true };
      if (name === 'get_my_student_state') return { data:school };
      if (name === 'list_self_registered') { assert.equal(values.p_search, 'sø'); assert.equal(values.p_offset, 50); return { data:[{ id:'student' }] }; }
      if (name === 'assign_self_registered') { assignment=values; return {}; }
      throw new Error(name);
    },
    from(table) {
      const query = {
        select() { return this; }, eq() { return this; }, order() { return this; },
        async single() { return { data:table === 'profiles' ? profile : { data:school } }; },
        async range() { assert.equal(table, 'results'); return { data:results }; },
        async upsert(values) { saved=values; return {}; },
      }; return query;
    },
  };
  const context = { crypto:webcrypto, TextEncoder, Uint8Array, window:{ JACOBMATEMATIK_SUPABASE:{ url:'test', publishableKey:'test' }, supabase:{ createClient:() => client } } };
  vm.createContext(context); vm.runInContext(source('supabase-backend.js'), context);
  const backend = context.window.JacobBackend;
  await assert.rejects(backend.signUp('søren7', 'abcdef'), /ikke aktiveret/);
  assert.equal(authCalls, 0);
  enabled = true;
  await assert.rejects(backend.signUp('bad@name', 'abcdef'), /1–40/);
  await assert.rejects(backend.signUp('søren7', '123'), /mindst 6/);
  assert.equal(authCalls, 0);
  await backend.signUp(' SØREN7 ', 'test-password');
  assert.equal(lastSignup.options.data.username, 'søren7');
  assert.equal(lastSignup.options.data.registration_source, 'self');
  assert.equal(Object.hasOwn(lastSignup.options.data, 'role'), false);
  assert.match(lastSignup.email, /^[a-f0-9]{64}@unicode\.users/);
  await backend.signUp('Alma7', 'test-password');
  assert.equal(lastSignup.email, 'alma7@users.jacobmatematik.invalid');
  authError = { code:'user_already_exists' };
  await assert.rejects(backend.signUp('alma7', 'abcdef'), /allerede i brug/);
  authError = { status:429 };
  await assert.rejects(backend.signUp('alma7', 'abcdef'), /Vent lidt/);
  authError = null; session = false;
  await assert.rejects(backend.signUp('alma7', 'abcdef'), /afventer aktivering/);
  session = true;
  const loaded = await backend.loadDatabase();
  assert.equal(loaded.database.users[0].classId, null);
  assert.equal(loaded.database.users[0].results[0].remoteId, 'result-1');
  assert.equal(loaded.database.users[0].canManageRegistrations, false);
  await backend.assignSelfRegistered('student', 'class-7');
  assert.equal(assignment.target_student, 'student'); assert.equal(assignment.target_class, 'class-7');
  assert.equal((await backend.listSelfRegistered('sø', 50))[0].id, 'student');
  await backend.saveSchoolState({ classes:[], users:[{ id:'x', password:'secret', canManageRegistrations:true, results:[] }] }, 'teacher');
  assert.equal(JSON.stringify(saved).includes('secret'), false);
  assert.equal(JSON.stringify(saved).includes('canManageRegistrations'), false);

  // Execute real UI event handlers with a minimal DOM, without live accounts.
  const elements = new Map(); const listeners = {};
  const element = id => {
    if (!elements.has(id)) elements.set(id, { innerHTML:'', textContent:'', focus() {} });
    return elements.get(id);
  };
  let submitCount = 0, resolveSignup, failLoad = false;
  const uiBackend = { configured:true,
    signUp:() => { submitCount++; return new Promise(resolve => { resolveSignup=resolve; }); },
    loadDatabase:async () => { if (failLoad) throw new Error('offline'); return structuredClone(loaded); },
  };
  const ui = { console, Intl, Date, Math, Set, Map,
    localStorage:{ getItem:() => null }, sessionStorage:{ getItem:() => null },
    FormData:class { constructor(form) { this.data=form.values; } get(key) { return this.data[key]; } },
    document:{ getElementById:element, querySelector:() => null, addEventListener:(name, callback) => { listeners[name]=callback; } },
    window:{ JacobBackend:uiBackend, matchMedia:() => ({ matches:false }), addEventListener() {}, setInterval:() => 1, clearInterval() {} },
  };
  vm.createContext(ui);
  vm.runInContext(source('app.js').replace('  start();\n})();', '  window.testApi = { state, registrations, renderLogin, renderRegistrations, normalizeDatabase };\n})();'), ui);
  const api=ui.window.testApi;
  api.renderLogin();
  assert.match(element('app').innerHTML, /Opret bruger/);
  assert.doesNotMatch(element('app').innerHTML, /Gæst|fps\.html/);
  assert.doesNotMatch(source('index.html'), /<a[^>]+fps-launch/);
  api.state.view='signup'; api.renderLogin();
  assert.match(element('app').innerHTML, /autocomplete="new-password"/);
  assert.match(element('app').innerHTML, /minlength="6"/);
  assert.equal(api.normalizeDatabase(structuredClone(loaded.database), false).users[0].classId, null);
  const buttons=[{ disabled:false }, { disabled:false }];
  const form={ id:'signup-form', values:{ username:'søren7', password:'test-password' }, querySelectorAll:() => buttons, reset() { this.values.password=''; } };
  const event={ preventDefault() {}, target:form };
  const first=listeners.submit(event);
  await listeners.submit(event);
  assert.equal(submitCount, 1, 'Double submit must create at most one account');
  assert.equal(buttons.every(button => button.disabled), true);
  resolveSignup(); await first;
  assert.equal(api.state.view, 'student');
  assert.equal(api.state.user.classId, null);
  assert.equal(api.state.user.results.length, 1);
  assert.equal(form.values.password, '');
  assert.equal(buttons.some(button => button.disabled), false);
  assert.equal(api.renderRegistrations(), '', 'Students cannot see registry');
  api.state.user=null; api.state.view='signup'; api.renderLogin(); failLoad=true;
  form.values.password='test-password';
  const second=listeners.submit(event); resolveSignup(); await second;
  assert.equal(api.state.view, 'login');
  assert.match(element('login-error').textContent, /bruger er oprettet/);
  api.state.user={ id:'teacher', role:'teacher', canManageRegistrations:true };
  api.registrations.open=true;
  api.registrations.rows=[{ id:'student', username:'test', name:'<script>bad</script>', created_at:'2026-09-09T12:00:00Z', assigned:false }];
  const registry=api.renderRegistrations();
  assert.match(registry, /Placér i klasse/);
  assert.match(registry, /Uden klasse/);
  assert.match(registry, /&lt;script&gt;/);
  assert.doesNotMatch(registry, /<script>/);
  api.state.user.canManageRegistrations=false;
  assert.equal(api.renderRegistrations(), '', 'Other teachers cannot see registry');
  console.log('PASS: signup gating, validation, aliases, duplicate/rate errors, unassigned login and results, RPC parameters, secret stripping, login UI, double-submit and post-signup recovery.');
})().catch(error => { console.error(error); process.exitCode=1; });
