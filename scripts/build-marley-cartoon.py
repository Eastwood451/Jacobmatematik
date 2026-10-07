"""Assemble complete drawn Marley poses into 60 fps films.

No body-part rig or CSS dog transforms: optical flow creates intermediate
whole-character frames, with a static room composited behind the artwork.
Dependencies: Pillow, numpy, opencv-python-headless, ffmpeg.
"""
import argparse
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

def room(size):
    yy = np.linspace(0, 1, size)[:, None, None]
    top = np.array([101, 68, 160])
    bottom = np.array([47, 29, 82])
    color = top[None, None, :] * (1 - yy) + bottom[None, None, :] * yy
    wall = Image.fromarray(np.repeat(color.astype('uint8'), size, axis=1))
    d = ImageDraw.Draw(wall)
    def rect(box, fill, radius=0, outline=None, width=1):
        b = tuple(int(v * size) for v in box)
        d.rounded_rectangle(b, radius=int(radius * size), fill=fill, outline=outline, width=width)
    rect((.065,.66,.935,1.05),(79,49,33),.035)
    for x in np.arange(.1,.96,.09):
        d.line((int(x*size),int(.66*size),int((x-.04)*size),size), fill=(66,40,29),width=2)
    d.ellipse(tuple(int(v*size) for v in (.16,.78,.85,.95)),fill=(116,47,81))
    rect((.7,.07,.91,.28),(33,20,59),.02)
    rect((.71,.08,.90,.27),(190,222,242),.016)
    d.line((int(.805*size),int(.08*size),int(.805*size),int(.27*size)),fill=(60,44,84),width=2)
    d.line((int(.71*size),int(.175*size),int(.90*size),int(.175*size)),fill=(60,44,84),width=2)
    d.line((int(.07*size),int(.12*size),int(.59*size),int(.12*size)),fill=(118,87,175),width=2)
    return np.asarray(wall,dtype=np.float32)

def assemble(sheet, out, columns, rows, duration, loop, size, start=0, circle=False, hearts=False):
    source = Image.open(sheet).convert('RGBA')
    sw, sh = source.size
    pixels=np.asarray(source)
    component_count,labels,stats,centers=cv2.connectedComponentsWithStats((pixels[:,:,3]>30).astype('uint8'))
    figures=[(i,s) for i,s in enumerate(stats) if i and s[4]>2000]
    figures.sort(key=lambda p:(int((p[1][1]+p[1][3]/2)/(sh/rows)),p[1][0]))
    if len(figures)!=columns*rows:
        raise ValueError(f'Expected {columns*rows} separate whole figures, found {len(figures)}')
    cells=[]
    factor=320/max(s[3] for _,s in figures)
    # Isolate whole figures, which can extend past nominal grid boundaries.
    # A shared scale and paw baseline keep the dog grounded, without resizing
    # each pose independently or accidentally retaining neighbouring ears.
    for label,s in figures:
        x,y,w,h,_=s
        part=pixels[y:y+h,x:x+w].copy()
        part[:,:,3]*=(labels[y:y+h,x:x+w]==label)
        foot_y,foot_x=np.where(part[int(h*.62):,:,3]>30)
        pivot=(foot_x.min()+foot_x.max())/2
        figure=Image.fromarray(part).resize((round(w*factor),round(h*factor)),Image.Resampling.LANCZOS)
        cell=Image.new('RGBA',(384,384))
        cell.alpha_composite(figure,(round(384*.54-pivot*factor),round(356-h*factor)))
        cells.append(np.asarray(cell,dtype=np.float32)/255)
    cells=cells[start:]
    count = len(cells)
    pairs = count if loop else count-1
    steps = max(1,round(duration*60/pairs))
    flow_engine = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    grid = np.stack(np.meshgrid(np.arange(384,dtype=np.float32),np.arange(384,dtype=np.float32)),axis=-1)
    background = room(size)
    def composite(dog,u):
        angle=u*np.pi*2
        scale=.85+.15*np.cos(angle) if circle else 1
        cx=.5+.105*np.sin(angle) if circle else .5
        baseline=.80+.07*np.cos(angle) if circle else .87
        frame_w=round(size*.80*scale)
        x0=round(size*cx-.54*frame_w)
        y0=round(size*baseline-(356/384)*frame_w)
        resized=cv2.resize(dog,(frame_w,frame_w),interpolation=cv2.INTER_CUBIC)
        resized=np.clip(resized,0,1)
        shadow=Image.new('RGBA',(size,size))
        sd=ImageDraw.Draw(shadow)
        sd.ellipse((size*(cx-.17*scale),size*(baseline-.018),size*(cx+.17*scale),size*(baseline+.023)),fill=(18,10,31,90))
        shadow=shadow.filter(ImageFilter.GaussianBlur(size*.012))
        sa=np.asarray(shadow,dtype=np.float32)/255
        frame=background*(1-sa[:,:,3:4])+sa[:,:,:3]*255*sa[:,:,3:4]
        if x0<0 or y0<0 or x0+frame_w>size or y0+frame_w>size:
            raise ValueError('Character canvas extends outside film')
        patch=frame[y0:y0+frame_w,x0:x0+frame_w]
        patch[:]=patch*(1-resized[:,:,3:4])+resized[:,:,:3]*255
        rendered=Image.fromarray(np.clip(frame,0,255).astype('uint8'))
        if hearts and .48<u<.92:
            d=ImageDraw.Draw(rendered)
            for h in range(3):
                life=((u-.48)*3+h*.23)%1
                hx=size*(.63+(h-1)*.055+.012*np.sin(life*6))
                hy=size*(.39-life*.25)
                r=size*.017*np.sin(np.pi*life)
                a=np.linspace(0,2*np.pi,40)
                coords=[(hx+r*np.sin(t)**3,hy-r*(13*np.cos(t)-5*np.cos(2*t)-2*np.cos(3*t)-np.cos(4*t))/16) for t in a]
                d.polygon(coords,fill=(255,113+h*20,163+h*12))
        return np.asarray(rendered)
    out.parent.mkdir(parents=True,exist_ok=True)
    command = ['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-pixel_format','rgb24','-video_size',f'{size}x{size}','-framerate','60','-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',str(out)]
    process = subprocess.Popen(command,stdin=subprocess.PIPE)
    flow_max=[]
    try:
        for i in range(pairs):
            a, b = cells[i],cells[(i+1)%count]
            def grey(im):
                rgb=(im[:,:,:3]*im[:,:,3:4]+.17*(1-im[:,:,3:4]))*255
                return cv2.cvtColor(rgb.astype('uint8'),cv2.COLOR_RGB2GRAY)
            ga,gb=grey(a),grey(b)
            forward=flow_engine.calc(ga,gb,None)
            backward=flow_engine.calc(gb,ga,None)
            flow_max.append(float(np.max(np.linalg.norm(forward,axis=2))))
            # Premultiplied pixels prevent translucent orange edges.
            ap=np.concatenate((a[:,:,:3]*a[:,:,3:4],a[:,:,3:4]),axis=2)
            bp=np.concatenate((b[:,:,:3]*b[:,:,3:4],b[:,:,3:4]),axis=2)
            for j in range(steps):
                t=j/steps
                amap=grid-t*forward
                bmap=grid-(1-t)*backward
                aw=cv2.remap(ap,amap[:,:,0],amap[:,:,1],cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
                bw=cv2.remap(bp,bmap[:,:,0],bmap[:,:,1],cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
                mixed=(1-t)*aw+t*bw
                frame=composite(mixed,(i+t)/pairs)
                if i==0 and j==0 and out.stem=='wag':
                    Image.fromarray(frame).save(out.with_name('poster.webp'),quality=90)
                process.stdin.write(frame.tobytes())
        if not loop:
            final=cells[-1].copy();final[:,:,:3]*=final[:,:,3:4]
            process.stdin.write(composite(final,1).tobytes())
    finally:
        process.stdin.close()
    if process.wait(): raise RuntimeError('ffmpeg encoding failed')
    print(f'{out}: {pairs*steps} frames at 60fps; max motion {max(flow_max):.1f}px',flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('sheet',type=Path);p.add_argument('out',type=Path)
    p.add_argument('--columns',type=int,default=6);p.add_argument('--rows',type=int,default=4)
    p.add_argument('--duration',type=float,default=2);p.add_argument('--size',type=int,default=640)
    p.add_argument('--loop',action='store_true');p.add_argument('--circle',action='store_true');p.add_argument('--hearts',action='store_true')
    p.add_argument('--start',type=int,default=0);args=p.parse_args()
    assemble(**vars(args))
