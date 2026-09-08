const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { stripTypeScriptTypes } = require('node:module');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

(async () => {
  const profiles = new Map([['teacher', { id:'teacher', role:'teacher' }]]);
  const accounts = new Map(); let nextId = 1, callerId = 'teacher', handler, authWrites = 0;
  const admin = {
    auth:{ admin:{
      async createUser(values) {
        authWrites++;
        if ([...accounts.values()].some(item => item.email === values.email)) return { error:{ message:'duplicate email' } };
        const id = `student-${nextId++}`; accounts.set(id, { ...values }); return { data:{ user:{ id } } };
      },
      async updateUserById(id, values) { authWrites++; Object.assign(accounts.get(id), values); return {}; },
      async deleteUser(id) { accounts.delete(id); profiles.delete(id); return {}; },
    } },
    from(table) {
      assert.equal(table, 'profiles');
      const filters = []; let update;
      const query = {
        select() { return this; },
        eq(key, value) { filters.push(row => row[key] === value); return this; },
        neq(key, value) { filters.push(row => row[key] !== value); return this; },
        update(value) { update = value; return this; },
        async insert(row) {
          if ([...profiles.values()].some(item => item.username === row.username)) return { error:{ message:'duplicate username' } };
          profiles.set(row.id, { ...row }); return {};
        },
        async single() { return { data:structuredClone([...profiles.values()].find(row => filters.every(test => test(row))) || null) }; },
        async maybeSingle() { return this.single(); },
        then(resolve, reject) {
          for (const row of profiles.values()) if (filters.every(test => test(row))) Object.assign(row, update);
          return Promise.resolve({}).then(resolve, reject);
        },
      }; return query;
    },
  };
  const serverSource = fs.readFileSync(path.join(root, 'supabase/functions/manage-student/index.ts'), 'utf8').replace(/^import[^\n]+\n/, '');
  const server = { crypto:webcrypto, TextEncoder, Uint8Array, Request, Response,
    Deno:{ env:{ get:key => key === 'SUPABASE_SERVICE_ROLE_KEY' ? 'test-service' : 'test-public' }, serve:callback => handler = callback },
    createClient:(_, key) => key === 'test-service' ? admin : { auth:{ getUser:async () => ({ data:{ user:callerId ? { id:callerId } : null } }) } },
  };
  vm.createContext(server); vm.runInContext(stripTypeScriptTypes(serverSource), server);
  async function invoke(body) {
    const response = await handler(new Request('https://example.invalid', { method:'POST', body:JSON.stringify(body) }));
    return { status:response.status, data:await response.json() };
  }
  const clientSource = fs.readFileSync(path.join(root, 'supabase-backend.js'), 'utf8');
  let emailUsed, oldServer = false, managed = 0;
  const client = { auth:{
    signInWithPassword:async values => { emailUsed = values.email; return { error:new Error('test-stop-after-auth') }; },
  }, functions:{ invoke:async (_, { body }) => {
    if (body.action === 'capabilities') return oldServer ? { error:new Error('old server') } : { data:{ danishUsernames:true } };
    managed++; return { data:{ ok:true } };
  } } };
  const browser = { crypto:webcrypto, TextEncoder, Uint8Array, window:{ JACOBMATEMATIK_SUPABASE:{ url:'test', publishableKey:'test' }, supabase:{ createClient:() => client } } };
  vm.createContext(browser); vm.runInContext(clientSource, browser);
  const api = browser.window.JacobBackend;
  async function loginEmail(username) { await assert.rejects(api.signIn(username, 'test'), /test-stop/); return emailUsed; }
  for (const username of ['æGIR7', 'SØREN7', 'Åse7', 'ø'.repeat(40)]) {
    const normal = username.normalize('NFC').toLowerCase();
    const created = await invoke({ action:'create', username, name:'Test', password:'test-only' });
    assert.equal(created.status, 200);
    assert.equal(profiles.get(created.data.id).username, normal);
    const email = accounts.get(created.data.id).email;
    assert.equal(email, await loginEmail(username));
    assert.match(email, /^[a-z0-9]+@unicode\.users\.jacobmatematik\.invalid$/);
    assert.equal(email.split('@')[0].length, 64);
  }
  assert.equal(await loginEmail(' Jacob '), 'jacob@users.jacobmatematik.invalid');
  assert.equal(await loginEmail('ÅSE7'), await loginEmail('A\u030aSE7'));
  const first = await loginEmail('søren7'), second = await loginEmail('soren7'), third = await loginEmail('soeren7');
  assert.equal(new Set([first, second, third]).size, 3);
  const id = 'student-1';
  let renamed = await invoke({ action:'profile', studentId:id, username:' ØRN7 ', name:'Updated', password:'' });
  assert.equal(renamed.status, 200); assert.equal(profiles.get(id).username, 'ørn7'); assert.equal(accounts.get(id).email, await loginEmail('ØRN7'));
  renamed = await invoke({ action:'username', studentId:id, username:'ÆØÅ7' });
  assert.equal(renamed.status, 200); assert.equal(profiles.get(id).name, 'Updated'); assert.equal(accounts.get(id).email, await loginEmail('æøå7'));
  const duplicate = await invoke({ action:'profile', studentId:id, username:'søren7', name:'Test' });
  assert.equal(duplicate.status, 409); assert.equal(profiles.get(id).username, 'æøå7');
  for (const action of ['create', 'profile', 'username']) for (const username of ['bad name', 'bad@name', 'x<script>', 'æ'.repeat(41), 'ö']) {
    const before = authWrites;
    const response = await invoke({ action, studentId:id, username, name:'Test', password:'test-only' });
    assert.equal(response.status, 400); assert.equal(authWrites, before);
  }
  const capabilities = await invoke({ action:'capabilities' }); assert.equal(capabilities.data.danishUsernames, true);
  oldServer = true;
  await assert.rejects(api.manageStudent('create', { username:'søren7' }), /afventer opdatering/); assert.equal(managed, 0);
  await api.manageStudent('create', { username:'soren7' }); assert.equal(managed, 1);
  oldServer = false; await api.manageStudent('profile', { username:'ØRN7' }); assert.equal(managed, 2);
  callerId = id; assert.equal((await invoke({ action:'create', username:'test' })).status, 403);
  callerId = null; assert.equal((await invoke({ action:'capabilities' })).status, 401);
  console.log('PASS: Danish names, NFC/case, create/edit/rename/login mapping, old ASCII login, distinct names, length/character validation, duplicates, authorization and old-server protection.');
})().catch(error => { console.error(error); process.exitCode = 1; });
