// Requires Playwright in NODE_PATH. Tests real MP3 playback in English Chrome
// with browser speech synthesis deliberately unavailable.
const {chromium}=require('playwright');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.mp3':'audio/mpeg','.webp':'image/webp'};
const server=http.createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://local').pathname;
  if(pathname==='/voice-test'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="en"><body>Voice playback test</body></html>');return;}
  const file=path.resolve(root,'.'+decodeURIComponent(pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}
  catch{res.writeHead(404).end();}
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try{
    browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
    const page=await browser.newPage({locale:'en-US'});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{
      Object.defineProperty(window,'speechSynthesis',{get(){throw new Error('Browser TTS must not be used');}});
      window.__voicePlayback=[];
      const play=HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play=function(){window.__voicePlayback.push(this.src);return play.call(this);};
    });
    const base=`http://127.0.0.1:${server.address().port}`;
    await page.goto(base+'/fps.html');
    await page.locator('#start-button:enabled').waitFor({timeout:30000});
    await page.locator('#start-button').click();
    await page.waitForFunction(()=>window.__voicePlayback.some(src=>src.endsWith('/erling-nu-kommer-erling.mp3')));
    console.log('English Chrome: the actual game starts with the bundled Danish Erling MP3.');
    await page.goto(base+'/voice-test');
    const result=await page.evaluate(async()=>{
      const manifest=await (await fetch('/fps-voice-lines.json')).json();
      const {createGameVoicePlayer}=await import('/fps-voice.js');
      const voice=createGameVoicePlayer();
      const clips=[];
      for(const line of manifest.lines){
        const audio=new Audio(`/assets/figurer/audio/${line.id}.mp3`);
        await new Promise((resolve,reject)=>{
          audio.addEventListener('loadedmetadata',resolve,{once:true});audio.addEventListener('error',reject,{once:true});audio.load();
        });
        if(!(audio.duration>0))throw new Error(`Empty clip: ${line.id}`);
        if(!await voice.play(line.text))throw new Error(`Playback failed: ${line.id}`);
        if(!voice.speaking)throw new Error(`Missing playback state: ${line.id}`);
        if(await voice.play(line.text))throw new Error('Overlapping voice was allowed');
        voice.stop();
        if(voice.speaking)throw new Error('Stop did not clear the voice');
        clips.push({id:line.id,seconds:Math.round(audio.duration*100)/100});
      }
      if(await voice.play('Ukendt replik'))throw new Error('Unknown text must not use TTS');
      return {locale:navigator.language,clips};
    });
    assert.equal(result.locale,'en-US');assert.equal(result.clips.length,10);assert.deepEqual(errors,[]);
    console.log(JSON.stringify(result,null,2));
    console.log('PASS: all 10 clips load/play, overlap prevention and stop work, no browser TTS and no runtime errors.');
  }finally{await browser?.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
