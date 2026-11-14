"""Create Danish Captain one-liners as real MP3 files, independent of browser language."""
import asyncio, os, subprocess
from pathlib import Path
import edge_tts
ROOT = Path(__file__).resolve().parents[1] / 'assets/incoming/audio'
LINES = ["Tag dén, dummert!", "Lad klogheden sejre!", "Æd mit sigma!", "Plus på dig, Erling!", "Gå hjem og læs!", "Smag på mit gangetegn!", "Jeg brøk'er dig midt over!", "Kom nærmere! Matematik-tæsk på tilbud!"]
async def main():
    ROOT.mkdir(parents=True,exist_ok=True)
    for i,line in enumerate(LINES):
        output=ROOT/f'captain-{i+1}.mp3'
        if output.exists() and output.stat().st_size>1000: continue
        raw=ROOT/f'captain-{i+1}.raw.mp3'
        await edge_tts.Communicate(line,'da-DK-JeppeNeural',rate='-8%',pitch='-25Hz',volume='+10%',proxy=os.environ.get('HTTPS_PROXY')).save(str(raw))
        subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(raw),'-af','highpass=f=55,lowpass=f=6000,bass=g=5:f=140:w=.7,acompressor=threshold=-22dB:ratio=4:attack=4:release=120,loudnorm=I=-15:TP=-1.2:LRA=8','-b:a','96k',str(output)],check=True)
        raw.unlink(); print(output.name,flush=True)
if __name__=='__main__': asyncio.run(main())
