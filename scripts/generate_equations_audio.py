"""Generate complete Danish/English narration; pip install edge-tts."""
import asyncio, os, subprocess
from pathlib import Path
import certifi
if os.environ.get('CODEX_PROXY_CERT'):
    certifi.where = lambda: os.environ['CODEX_PROXY_CERT']
import edge_tts
ROOT=Path(__file__).resolve().parents[1]/'assets/equations'
LINES={
 'da':('da-DK-ChristelNeural', {'intro':'Ligninger er en vægt i ligevægt!', 'remove':'Prøv at fjerne en vægt.', 'same':'Du skal gøre det samme på begge sider.', 'alone':'Eks skal stå for sig selv.', 'done':'Nu står eks for sig selv. Eks er lig med fire!'}),
 'en':('en-GB-SoniaNeural', {'intro':'An equation is a balanced scale!', 'remove':'Try removing a weight.', 'same':'You must do the same on both sides.', 'alone':'X must stand on its own.', 'done':'Now X is on its own. X equals four!'})
}
async def main():
 ROOT.mkdir(parents=True,exist_ok=True)
 for lang,(voice,lines) in LINES.items():
  for key,text in lines.items():
   out=ROOT/f'{lang}-{key}.mp3'
   if out.exists() and out.stat().st_size>1000: continue
   raw=ROOT/f'{lang}-{key}.raw.mp3'
   await edge_tts.Communicate(text,voice,rate='-10%',proxy=os.environ.get('HTTPS_PROXY')).save(str(raw))
   subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(raw),'-af','loudnorm=I=-16:TP=-1.5:LRA=7','-b:a','96k',str(out)],check=True)
   raw.unlink()
   print(out.name,flush=True)
if __name__=='__main__': asyncio.run(main())
