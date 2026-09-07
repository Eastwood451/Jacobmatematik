// Run with Playwright available in NODE_PATH. Uses two isolated browser sessions
// and the real configured Supabase project; ephemeral rooms are closed afterward.
const { chromium }=require('playwright');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.mp3':'audio/mpeg'};
const server=http.createServer(async(req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));
  if(!file.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
  try{res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}
  catch{res.writeHead(404).end();}
});
async function waitText(page,selector,pattern){await page.locator(selector).filter({hasText:pattern}).waitFor({timeout:20000});}
async function solve(page){
  const problem=await page.locator('#problem').innerText();
  const [a,b]=problem.split('×').map(Number);
  await page.keyboard.type(String(a*b));await page.keyboard.press('Enter');
  await waitText(page,'#ammo',/^1$/);
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}/fps.html`;
  const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
  const errors=[];
  try{
    const a=await browser.newPage({viewport:{width:1365,height:900}}),b=await browser.newPage({viewport:{width:1365,height:900}});
    for(const p of [a,b]) {
      p.on('pageerror',e=>{errors.push(e.message);console.error('Browser error:',e.message);});
      p.on('requestfailed',r=>console.error('Request failed:',r.url(),r.failure()?.errorText));
    }
    await Promise.all([a.goto(base),b.goto(base)]);
    await Promise.all([a.locator('#start-button:enabled').waitFor({timeout:30000}),b.locator('#start-button:enabled').waitFor({timeout:30000})]);
    await fs.mkdir(path.join(root,'test-results'),{recursive:true});
    for(const mode of ['deathmatch','coop']){
      if(mode==='deathmatch') await Promise.all([a.locator('#online-button').click(),b.locator('#online-button').click()]);
      await a.locator('#online-name').fill('Test Anna');await b.locator('#online-name').fill('Test Bo');
      await a.locator(`[name=online-mode][value=${mode}]`).check();await a.locator('#create-room').click();
      await waitText(a,'#lobby-code',/^[A-Z2-9]{8}$/);
      const code=await a.locator('#lobby-code').innerText();
      await b.locator('#room-code').fill(code);await b.locator('#join-room').click();
      await waitText(a,'#lobby-players',/Test Bo/);await waitText(b,'#lobby-players',/Test Anna/);
      await a.screenshot({path:path.join(root,`test-results/${mode}-lobby.png`)});
      await a.locator('#begin-match').click();
      await Promise.all([a.locator('#online-overlay').waitFor({state:'hidden'}),b.locator('#online-overlay').waitFor({state:'hidden'})]);
      await solve(a);await solve(b);
      if(mode==='deathmatch') {
        // Both spawn in the main corridor facing each other. Exercise a real
        // pointer-lock shot and observe the victim's host-owned health remotely.
        await a.locator('#game').click({position:{x:682,y:400}});
        await a.waitForTimeout(3300);
        await a.mouse.click(682,400);
        await waitText(a,'#ammo',/^0$/);
        await waitText(b,'#online-scores',/Test Bo \(dig\) — 0 point · 4 ♥/);
        await a.keyboard.press('Escape');
      }
      await a.screenshot({path:path.join(root,`test-results/${mode}-match.png`)});
      assert.match(await b.locator('#online-match-label').innerText(),mode==='coop'?/CO-OP/:/DEATHMATCH/);
      if(mode==='coop') assert.match(await b.locator('#online-objective').innerText(),/Bølge 1\/5/);
      await a.locator('#exit-match').click();
      await waitText(b,'#online-status',/lukket serveren/);
      console.log(`${mode}: real Supabase lobby, two players, start, individual maths/ammo and host disconnect passed (${code})`);
    }
    // Unknown room must return a readable error, not leave the join screen stuck.
    await b.locator('#room-code').fill('ZZZZ9999');await b.locator('#join-room').click();
    await waitText(b,'#online-status',/Ingen server fundet/);
    await b.locator('#leave-room').click();
    await b.locator('#start-button').click();
    await b.keyboard.press('Escape');
    await solve(b);
    assert.deepEqual(errors,[]);console.log('Invalid room and zero browser runtime errors: passed');
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
