/* CPU projection fallback for browsers without WebGL. Uses the same Three.js scene,
   transforms, geometry and orthographic camera; no separate game simulation. */
(() => {
  'use strict';
  function create(canvas,T) {
    const ctx=canvas.getContext('2d',{alpha:true});
    if(!ctx)throw new Error('Canvas unavailable');
    let width=1,height=1,ratio=1;
    const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),center=new T.Vector3(),axis=new T.Vector3(),normal=new T.Vector3(),v1=new T.Vector3(),v2=new T.Vector3();
    const world=new T.Matrix4(),projectMatrix=new T.Matrix4(),color=new T.Color(),light=new T.Vector3(-.4,.65,1).normalize();
    const screen=v=>{v.applyMatrix4(projectMatrix);return {x:(v.x+1)*width*.5,y:(1-v.y)*height*.5,z:v.z};};
    const css=(value,multiplier=1)=>{color.copy(value);color.multiplyScalar(multiplier);return '#'+color.getHexString(T.SRGBColorSpace);};
    function paintSphere(object) {
      const radius=object.geometry.parameters.radius??1;
      center.set(0,0,0).applyMatrix4(object.matrixWorld);const p=screen(a.copy(center));
      const vectors=[];
      for(const xyz of [[radius,0,0],[0,radius,0],[0,0,radius]]) {axis.set(...xyz).applyMatrix4(object.matrixWorld);const q=screen(axis);vectors.push([q.x-p.x,q.y-p.y]);}
      let xx=0,xy=0,yy=0;for(const [x,y] of vectors){xx+=x*x;xy+=x*y;yy+=y*y;}
      const trace=xx+yy,delta=Math.sqrt((xx-yy)*(xx-yy)+4*xy*xy),rx=Math.sqrt(Math.max(0,(trace+delta)/2)),ry=Math.sqrt(Math.max(0,(trace-delta)/2)),angle=.5*Math.atan2(2*xy,xx-yy);
      if(rx<.15||ry<.15)return;
      const material=object.material;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);ctx.scale(rx,ry);
      const gradient=ctx.createRadialGradient(-.3,-.4,.05,0,0,1.13);gradient.addColorStop(0,css(material.color,1.45));gradient.addColorStop(.48,css(material.color,1));gradient.addColorStop(1,css(material.color,.31));
      ctx.globalAlpha=material.opacity;ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(0,0,1,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    function paintTexture(object) {
      const image=object.material.map.image;if(!image)return;
      const w=object.geometry.parameters.width??1,h=object.geometry.parameters.height??1;
      const p=screen(a.set(-w/2,h/2,0).applyMatrix4(object.matrixWorld));
      const q=screen(b.set(w/2,h/2,0).applyMatrix4(object.matrixWorld));
      const r=screen(c.set(-w/2,-h/2,0).applyMatrix4(object.matrixWorld));
      const iw=image.width,ih=image.height;
      ctx.save();ctx.globalAlpha=object.material.opacity;ctx.transform((q.x-p.x)/iw,(q.y-p.y)/iw,(r.x-p.x)/ih,(r.y-p.y)/ih,p.x,p.y);ctx.drawImage(image,0,0);ctx.restore();
    }
    function paintTriangles(object) {
      const position=object.geometry.attributes.position,index=object.geometry.index,material=Array.isArray(object.material)?object.material[0]:object.material;
      const triangles=[];const count=index?index.count:position.count;
      for(let i=0;i<count;i+=3) {
        a.fromBufferAttribute(position,index?index.getX(i):i).applyMatrix4(object.matrixWorld);
        b.fromBufferAttribute(position,index?index.getX(i+1):i+1).applyMatrix4(object.matrixWorld);
        c.fromBufferAttribute(position,index?index.getX(i+2):i+2).applyMatrix4(object.matrixWorld);
        normal.crossVectors(v1.copy(b).sub(a),v2.copy(c).sub(a)).normalize();
        if(material.side!==T.DoubleSide&&normal.z<=0)continue;
        const shade=.42+.7*Math.max(0,normal.dot(light));
        triangles.push({p:screen(a),q:screen(b),r:screen(c),shade});
      }
      triangles.sort((u,v)=>(v.p.z+v.q.z+v.r.z)-(u.p.z+u.q.z+u.r.z));
      ctx.globalAlpha=material.opacity;
      for(const f of triangles) {
        ctx.fillStyle=css(material.color,f.shade);ctx.beginPath();ctx.moveTo(f.p.x,f.p.y);ctx.lineTo(f.q.x,f.q.y);ctx.lineTo(f.r.x,f.r.y);ctx.closePath();ctx.fill();
      }
      ctx.globalAlpha=1;
    }
    function paintLine(object) {
      const position=object.geometry.attributes.position,m=object.material;
      ctx.strokeStyle=css(m.color);ctx.globalAlpha=m.opacity;ctx.lineWidth=1;
      ctx.setLineDash(m.isLineDashedMaterial?[4,6]:[]);ctx.beginPath();
      for(let i=0;i<position.count;i++){const p=screen(a.fromBufferAttribute(position,i).applyMatrix4(object.matrixWorld));if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);}
      ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
    }
    function paintTorus(object) {
      const params=object.geometry.parameters,points=[];
      for(let n=0;n<=80;n++)points.push(screen(a.set(Math.cos(n/80*Math.PI*2)*params.radius,Math.sin(n/80*Math.PI*2)*params.radius,0).applyMatrix4(object.matrixWorld)));
      ctx.strokeStyle=css(object.material.color,1.25);ctx.lineWidth=Math.max(1.5,params.tube*height/8.9);ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=5;ctx.beginPath();
      for(let i=0;i<points.length;i++){if(i)ctx.lineTo(points[i].x,points[i].y);else ctx.moveTo(points[i].x,points[i].y);}ctx.stroke();ctx.shadowBlur=0;
    }
    function render(scene,camera) {
      scene.updateMatrixWorld();camera.updateMatrixWorld();projectMatrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
      ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
      const items=[];
      function visit(object) {
        if(!object.visible)return;
        if(object.isMesh||object.isLine||object.isPoints) {
          center.setFromMatrixPosition(object.matrixWorld).applyMatrix4(projectMatrix);items.push({object,z:center.z});
        }
        for(const child of object.children)visit(child);
      }
      visit(scene);items.sort((u,v)=>v.z-u.z);
      for(const {object} of items) {
        if(object.isLine){paintLine(object);continue;}
        if(object.isPoints){const position=object.geometry.attributes.position;ctx.fillStyle='#bca8ed';ctx.globalAlpha=.4;for(let i=0;i<position.count;i++){const p=screen(a.fromBufferAttribute(position,i).applyMatrix4(object.matrixWorld));ctx.fillRect(p.x,p.y,1.5,1.5);}ctx.globalAlpha=1;continue;}
        const type=object.geometry.type;
        if(object.material.map&&type==='PlaneGeometry')paintTexture(object);
        else if(type==='SphereGeometry')paintSphere(object);
        else if(type==='TorusGeometry')paintTorus(object);
        else paintTriangles(object);
      }
    }
    return {render,setPixelRatio(value){ratio=Math.min(1.3,value);},setSize(w,h){width=w;height=h;canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);},dispose(){ctx.clearRect(0,0,width,height);},forceContextLoss(){},software:true};
  }
  window.JacobIncomingRenderer={create};
})();
