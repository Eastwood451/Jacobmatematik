const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { stripTypeScriptTypes } = require('node:module');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

(async () => {
  const profiles = new Map([
    ['teacher', { id:'teacher', role:'teacher', username:'lærer', teacher_id:null }],
    ['pupil-a', { id:'pupil-a', role:'student', username:'anna', teacher_id:'teacher' }],
    ['pupil-b', { id:'pupil-b', role:'student', username:'bo', teacher_id:'teacher' }],
  ]);
  const schools = new Map([['teacher', { data:{ classes:[{ id:'c1', name:'3A' }], users:[
    { id:'pupil-a', name:'Anna', classId:'c1' },
    { id:'pupil-b', name:'Bo', classId:'c1' },
  ] } }]]);
  const deleted = [];
  const signedOut = [];
  let callerId = 'pupil-a';
  let failDelete = false;

  function matching(table, filters) {
    if (table !== 'profiles') return [];
    return [...profiles.values()].filter(row => filters.every(([key, value]) => row[key] === value));
  }

  const admin = {
    auth:{ admin:{
      async signOut(jwt, scope) { signedOut.push([jwt, scope]); },
      async deleteUser(id) {
        if (failDelete) return { error:{ message:'blocked' } };
        deleted.push(id);
        profiles.delete(id);
        return {};
      },
    } },
    from(table) {
      const filters = [];
      let pending = null;
      return {
        select() { return this; },
        update(value) { pending = value; return this; },
        eq(key, value) { filters.push([key, value]); return this; },
        async maybeSingle() {
          if (table === 'school_state') {
            const teacherId = filters.find(([key]) => key === 'teacher_id')?.[1];
            const row = schools.get(teacherId);
            return { data:row ? structuredClone(row) : null, error:null };
          }
          const found = matching(table, filters)[0] || null;
          return { data:found ? structuredClone(found) : null, error:null };
        },
        then(resolve, reject) {
          if (pending && table === 'school_state') {
            const teacherId = filters.find(([key]) => key === 'teacher_id')?.[1];
            const row = schools.get(teacherId);
            if (row) row.data = structuredClone(pending.data);
          }
          const data = table === 'profiles' ? matching(table, filters).map(row => structuredClone(row)) : null;
          return Promise.resolve({ data, error:null }).then(resolve, reject);
        },
      };
    },
  };

  let handler;
  const serverSource = fs.readFileSync(path.join(root, 'supabase/functions/delete-own-account/index.ts'), 'utf8').replace(/^import[^\n]+\n/, '');
  const server = {
    crypto:webcrypto, TextEncoder, Uint8Array, Request, Response,
    Deno:{ env:{ get:key => key === 'SUPABASE_SERVICE_ROLE_KEY' ? 'test-service' : 'test-public' }, serve:callback => { handler = callback; } },
    createClient:(_, key) => key === 'test-service' ? admin : { auth:{ getUser:async () => ({ data:{ user:callerId ? { id:callerId } : null } }) } },
  };
  vm.createContext(server);
  vm.runInContext(stripTypeScriptTypes(serverSource), server);

  async function invoke(body, token = 'caller-token') {
    const response = await handler(new Request('https://example.invalid', {
      method:'POST',
      headers:{ Authorization:`Bearer ${token}` },
      body:JSON.stringify(body),
    }));
    return { status:response.status, data:await response.json() };
  }

  const other = await invoke({ confirmUsername:'anna', userId:'pupil-b' });
  assert.equal(other.status, 200);
  assert.deepEqual(deleted, ['pupil-a']);
  assert.deepEqual(signedOut, [['caller-token', 'global']]);
  assert.equal(profiles.has('pupil-a'), false);
  assert.equal(profiles.has('pupil-b'), true);
  assert.deepEqual(schools.get('teacher').data.users.map(user => user.id), ['pupil-b']);
  assert.equal(schools.get('teacher').data.classes.length, 1);

  deleted.length = 0;
  callerId = 'pupil-b';
  const mismatch = await invoke({ confirmUsername:'anna', userId:'pupil-a' });
  assert.equal(mismatch.status, 400);
  assert.equal(mismatch.data.error, 'username_mismatch');
  assert.deepEqual(deleted, []);

  callerId = 'teacher';
  const blocked = await invoke({ confirmUsername:'LÆRER' });
  assert.equal(blocked.status, 409);
  assert.equal(blocked.data.error, 'teacher_has_students');
  assert.equal(profiles.has('teacher'), true);
  assert.equal(profiles.has('pupil-b'), true);
  assert.deepEqual(deleted, []);

  profiles.delete('pupil-b');
  const teacherGone = await invoke({ confirmUsername:'lærer' });
  assert.equal(teacherGone.status, 200);
  assert.deepEqual(deleted, ['teacher']);

  callerId = null;
  assert.equal((await invoke({ confirmUsername:'lærer' })).status, 401);

  profiles.set('pupil-a', { id:'pupil-a', role:'student', username:'anna', teacher_id:'teacher' });
  schools.set('teacher', { data:{ classes:[{ id:'c1', name:'3A' }], users:[{ id:'pupil-a', name:'Anna' }, { id:'pupil-b', name:'Bo' }] } });
  callerId = 'pupil-a';
  failDelete = true;
  const restored = await invoke({ confirmUsername:'anna' });
  assert.equal(restored.status, 500);
  assert.deepEqual(schools.get('teacher').data.users.map(user => user.id), ['pupil-a', 'pupil-b']);
  failDelete = false;

  const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261111180000_restrict_teacher_delete.sql'), 'utf8');
  assert.match(migration, /on delete restrict/i);
  assert.doesNotMatch(migration, /on delete cascade/i);

  const storage = new Map([
    ['jm-local-progress-v1:pupil-a', '{"results":[1]}'],
    ['jm-local-consent-v1:pupil-a', '2026-09-30'],
    ['jm-lang', 'da'],
  ]);
  const localStorage = {
    getItem:key => storage.has(key) ? storage.get(key) : null,
    setItem:(key, value) => storage.set(key, String(value)),
    removeItem:key => storage.delete(key),
  };
  let invokeBody = null;
  let clientSignedOut = false;
  let passwordAccepted = true;
  const client = {
    auth:{
      signInWithPassword:async () => passwordAccepted ? { data:{ user:{ id:'pupil-a' } } } : { error:{ message:'Invalid login credentials' } },
      signOut:async () => { clientSignedOut = true; },
    },
    functions:{ invoke:async (name, options) => { invokeBody = { name, body:options.body }; return { data:{ ok:true } }; } },
  };
  const browser = {
    crypto:webcrypto, TextEncoder, Uint8Array, localStorage,
    window:{ JACOBMATEMATIK_SUPABASE:{ url:'test', publishableKey:'test' }, supabase:{ createClient:() => client }, JacobLang:{ get:() => 'da' } },
  };
  vm.createContext(browser);
  vm.runInContext(fs.readFileSync(path.join(root, 'supabase-backend.js'), 'utf8'), browser);
  await browser.window.JacobBackend.deleteOwnAccount('Anna', 'hemmelig');
  assert.equal(invokeBody.name, 'delete-own-account');
  assert.deepEqual(Object.keys(invokeBody.body), ['confirmUsername']);
  assert.equal(invokeBody.body.confirmUsername, 'Anna');
  assert.equal(storage.has('jm-local-progress-v1:pupil-a'), false);
  assert.equal(storage.has('jm-local-consent-v1:pupil-a'), false);
  assert.equal(storage.get('jm-lang'), 'da');
  assert.equal(clientSignedOut, true);

  passwordAccepted = false;
  invokeBody = null;
  await assert.rejects(browser.window.JacobBackend.deleteOwnAccount('Anna', 'forkert'), /forkert/);
  assert.equal(invokeBody, null);

  console.log('PASS: own-account deletion ignores foreign ids, keeps classmates, blocks teachers with pupils, restores a failed scrub, and clears only that account locally.');
})().catch(error => { console.error(error); process.exitCode = 1; });
