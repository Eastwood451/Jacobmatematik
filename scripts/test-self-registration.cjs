const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { webcrypto } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');

(async () => {
  let enabled = false, authCalls = 0, registrationChecks = 0, assignment;
  let profile = { id:'student', role:'student', teacher_id:null, username:'søren7', name:'søren7' };
  const results = [{ id:'result-1', student_id:'student', data:{ topic:'addition', correct:true }, created_at:'2026-09-09T12:00:00Z' }];
  let school = { classes:[], users:[] }, saved;
  const client = {
    auth:{
      async signUp() { authCalls++; throw new Error('Signup must remain closed'); },
      async getUser() { return { data:{ user:{ id:profile.id } } }; },
      async signInWithPassword() { return {}; },
    },
    async rpc(name, values) {
      if (name === 'self_registration_enabled') { registrationChecks++; return { data:enabled }; }
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
  assert.equal(backend.selfRegistrationEnabled, false);
  await assert.rejects(backend.signUp('søren7', 'abcdef'), /midlertidigt lukket/);
  enabled = true;
  await assert.rejects(backend.signUp('alma7', 'abcdef'), /midlertidigt lukket/);
  // An altered exported flag must not bypass the private client-side guard.
  backend.selfRegistrationEnabled = true;
  await assert.rejects(backend.signUp('alma7', 'abcdef'), /midlertidigt lukket/);
  assert.equal(authCalls, 0, 'Paused registration must not call Auth');
  assert.equal(registrationChecks, 0, 'Paused registration must not send credentials or RPCs');
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
    if (!elements.has(id)) elements.set(id, { innerHTML:'', textContent:'', lastElementChild:{textContent:''}, classList:{remove(){}}, focus() {} });
    return elements.get(id);
  };
  let submitCount = 0;
  const uiBackend = { configured:true, selfRegistrationEnabled:false,
    signUp:async () => { submitCount++; },
    signIn:async () => structuredClone(loaded),
    loadDatabase:async () => structuredClone(loaded),
  };
  const ui = { console, Intl, Date, Math, Set, Map,
    localStorage:{ getItem:() => null }, sessionStorage:{ getItem:() => null },
    FormData:class { constructor(form) { this.data=form.values; } get(key) { return this.data[key]; } },
    document:{ hidden:true, body:{classList:{add(){},remove(){}}}, getElementById:element, querySelector:() => null, addEventListener:(name, callback) => { listeners[name]=callback; } },
    window:{ JacobBackend:uiBackend, matchMedia:() => ({ matches:false }), addEventListener() {}, setInterval:() => 1, clearInterval() {} },
  };
  vm.createContext(ui);
  vm.runInContext(source('app.js').replace('  start();\n})();', '  window.testApi = { state, registrations, renderLogin, renderRegistrations, renderTeacher, refreshTeacherResults, normalizeDatabase, setDatabase:value=>db=value, getDatabase:()=>db, flushSaves:()=>remoteSaveQueue };\n})();'), ui);
  const api=ui.window.testApi;
  api.renderLogin();
  assert.doesNotMatch(element('app').innerHTML, /Opret bruger|show-signup|signup-form/);
  assert.match(element('app').innerHTML, /Gæst/);
  assert.match(element('app').innerHTML, /href="fps\.html\?trial=1"/, 'The public banner opens the isolated trial');
  assert.doesNotMatch(source('index.html'), /<a[^>]+fps-launch/);
  api.state.view='signup'; api.renderLogin();
  assert.match(element('app').innerHTML, /id="login-form"/);
  assert.doesNotMatch(element('app').innerHTML, /signup-form|new-password|Opret bruger/);
  const showSignup={dataset:{action:'show-signup'}};
  await listeners.click({target:{closest:selector=>selector==='[data-action]'?showSignup:null}});
  assert.equal(api.state.view, 'login', 'Old signup actions resolve to login');
  const form={ id:'signup-form', dataset:{}, values:{ username:'søren7', password:'test-password' } };
  const event={ preventDefault() {}, target:form };
  await listeners.submit(event);
  assert.equal(submitCount, 0, 'Even an injected signup form cannot create an account');
  assert.match(element('login-error').textContent, /midlertidigt lukket/);
  assert.equal(api.normalizeDatabase(structuredClone(loaded.database), false).users[0].classId, null);
  form.id='login-form';
  await listeners.submit(event);
  assert.equal(api.state.view, 'student', 'Existing accounts can still log in');
  assert.equal(api.state.user.results[0].remoteId, 'result-1');
  assert.equal(api.renderRegistrations(), '', 'Students cannot see registry');
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
  // The same card, editor, exercise settings and history work before class placement.
  const teacher={ id:'teacher', role:'teacher', name:'Jacob', canManageRegistrations:true };
  const unclassified={ id:'self-student', role:'student', name:'Testkaj', username:'testkaj', classId:null, selfRegistered:true,
    results:[{ topic:'addition', problem:'2 + 3', correct:true, answer:5, correctAnswer:5, responseTime:2, timestamp:'2026-09-09T12:00:00Z', remoteId:'saved-1' }] };
  api.setDatabase(api.normalizeDatabase({ classes:[{id:'class-7',name:'7. klasse'}], users:[teacher,unclassified] }, false));
  api.state.user=teacher; api.state.view='teacher'; api.state.activeClassId='__unassigned__';
  api.state.expandedStudent=unclassified.id; api.state.teacherTopicDetail='tableDrill';
  api.renderTeacher();
  let card=element('app').innerHTML;
  assert.match(card, /Uden klasse/);
  assert.match(card, /id="student-profile-form"/);
  assert.match(card, /name="studentId" value="self-student"/);
  assert.match(card, /data-student-class="self-student"/);
  assert.match(card, /id="table-drill-history-title">Alle heatmaps/);
  assert.match(card, /Bogstavlæring til Testkaj/);
  assert.match(card, /Rigtige svar over tid/);
  assert.match(card, /data-action="delete-class" disabled/);
  let editCall, savedSchool;
  uiBackend.manageStudent=async (action,values)=>{ editCall={action,...values}; };
  uiBackend.saveSchoolState=async database=>{savedSchool=structuredClone(database);};
  await listeners.submit({ preventDefault(){}, target:{ id:'student-profile-form',dataset:{},values:{studentId:unclassified.id,studentName:'Kaj',studentUsername:'testkaj',studentPassword:''} } });
  assert.equal(editCall.action,'profile');
  assert.equal(editCall.studentId,'self-student');
  assert.equal(savedSchool.users.find(x=>x.id==='self-student').classId,null);
  assert.equal(savedSchool.users.find(x=>x.id==='self-student').name,'Kaj');
  listeners.change({target:{dataset:{tableStudent:'self-student'},value:'2',checked:false}});
  await api.flushSaves();
  assert.equal(savedSchool.users.find(x=>x.id==='self-student').assignedTables.includes(2),false);
  assert.equal(savedSchool.classes.some(x=>x.id==='__unassigned__'),false,'Virtual tab is never saved as a class');
  listeners.change({target:{dataset:{studentClass:'self-student'},value:'class-7'}});
  await api.flushSaves();
  assert.equal(api.state.activeClassId,'class-7');
  assert.equal(api.state.expandedStudent,'self-student');
  assert.equal(savedSchool.users.find(x=>x.id==='self-student').results[0].remoteId,'saved-1');
  // Registry link opens the common card for a classified account as well.
  uiBackend.loadDatabase=async()=>({database:structuredClone(api.getDatabase()),currentUserId:'teacher'});
  const openCard={dataset:{action:'open-registration-profile',registrationStudent:'self-student'}};
  await listeners.click({target:{closest:selector=>selector==='[data-action]'?openCard:null}});
  assert.equal(api.state.expandedStudent,'self-student');
  assert.equal(api.state.activeClassId,'class-7');
  // New accounts appear during a live lesson without replacing unsaved existing fields.
  ui.document.hidden=false;
  uiBackend.loadSchoolState=async()=>({users:[{id:'live-student',role:'student',name:'Ny elev',username:'ny',classId:null,selfRegistered:true}]});
  uiBackend.loadResults=async()=>[{studentId:'live-student',remoteId:'live-result',topic:'addition',correct:true,responseTime:3,timestamp:'2026-09-09T12:00:01Z',createdAt:'2026-09-09T12:00:01Z'}];
  ui.requestAnimationFrame=callback=>callback(); ui.window.scrollTo=()=>{};
  await api.refreshTeacherResults();
  assert.equal(api.getDatabase().users.find(x=>x.id==='live-student').results.length,1);
  assert.equal(api.getDatabase().users.find(x=>x.id==='self-student').name,'Kaj');
  ui.document.hidden=true;
  console.log('PASS: shared unclassified student card, profile editing, exercise settings, heatmaps, class placement, registry link and live newcomers.');
  console.log('PASS: paused signup rejects before network access, tampered flags/actions/forms cannot register, signup UI is absent, guest entry and existing-account login remain available.');
})().catch(error => { console.error(error); process.exitCode=1; });
