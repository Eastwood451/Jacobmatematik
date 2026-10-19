// Verifies parallel result paging returns every row in order, with and without a count.
const assert = require('assert'); const fs = require('fs'); const vm = require('vm');
const source = fs.readFileSync(__dirname + '/../supabase-backend.js', 'utf8');
function load(total, withCount) {
  const all = Array.from({ length:total }, (_, i) => ({ id:`r${i}`, student_id:'s1', data:{ n:i }, created_at:new Date(1e12 + i * 1000).toISOString() }));
  const stats = { requests:0, inFlight:0, maxInFlight:0 };
  const client = { auth:{}, rpc(){}, from(table) {
    assert.equal(table, 'results'); let count = false;
    const q = { select(_c, opts) { count = Boolean(opts?.count); return q; }, order() { return q; }, gte() { return q; },
      range(a, b) { stats.requests++; stats.inFlight++; stats.maxInFlight = Math.max(stats.maxInFlight, stats.inFlight);
        return new Promise(r => setTimeout(() => { stats.inFlight--; r({ data:all.slice(a, b + 1), count:withCount && count ? total : null }); }, 5)); } };
    return q; } };
  const window = { JACOBMATEMATIK_SUPABASE:{ url:'u', publishableKey:'k' }, supabase:{ createClient:() => client } };
  vm.runInNewContext(source, { window, localStorage:{}, crypto:{}, TextEncoder, console });
  return { backend:window.JacobBackend, stats };
}
(async () => {
  for (const [total, withCount] of [[17332, true], [17332, false], [3000, true], [999, true], [0, true]]) {
    const { backend, stats } = load(total, withCount);
    const rows = await backend.loadResults();
    assert.equal(rows.length, total, `rows ${total} count=${withCount}`);
    rows.forEach((row, i) => assert.equal(row.remoteId, `r${i}`));
    if (withCount && total > 2000) assert.ok(stats.maxInFlight > 1 && stats.maxInFlight <= 6, `parallel ${stats.maxInFlight}`);
    console.log(`ok total=${total} count=${withCount} requests=${stats.requests} maxParallel=${stats.maxInFlight}`);
  }
})().catch(e => { console.error(e); process.exit(1); });
