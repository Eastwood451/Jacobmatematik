/* Drawn, fitted equipment in the same 640 × 640 coordinates as Marley's films. */
(() => {
  'use strict';
  const svg = (body, box='-100 -70 200 140') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" aria-hidden="true" fill="none" stroke="#30203d" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;
  // Transparent painted atlas: use tight viewBoxes without resampling the artwork.
  const painted = box => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" aria-hidden="true"><image href="assets/figurer/marley-cartoon/wardrobe-painted.png?v=20261008-painted1" width="1280" height="1280"/></svg>`;
  const art = {
    cap: painted('150 65 1010 625'),
    hat: svg('<path d="M-52 27 L0-65 51 28Z" fill="#d865aa"/><path d="M-39 5l62-34M-21-29l56 32" stroke="#ffe17d" stroke-width="10"/><ellipse cy="27" rx="56" ry="12" fill="#ffe5a5"/><circle cy="-63" r="11" fill="#ffdd60"/>'),
    glasses: painted('65 785 1135 355'),
    skate: svg('<circle cx="-61" cy="29" r="13" fill="#ffc15b"/><circle cx="63" cy="29" r="13" fill="#ffc15b"/><path d="M-94-3Q-103 15-74 17H76Q104 14 94-4L76 5H-75Z" fill="#63c6a2"/><path d="M-66 8H66" stroke="#bff2d8"/><path d="M-22 6l15-9 15 9" stroke="#ffe284"/>'),
    bone: svg('<path d="M-53-15Q-80-42-90-21Q-101-4-79 6Q-96 29-74 36Q-56 43-47 20H48Q58 43 78 34Q99 25 79 6Q101-10 87-27Q72-43 51-15Z" fill="#fff0c8"/><path d="M-43-5H43" stroke="#fffbed" stroke-width="9"/><path d="M-43 20H47" stroke="#e6c78e" stroke-width="5"/>'),
    ball: svg('<circle r="47" fill="#bbd83b"/><path d="M-33-34Q18-22 12 0Q4 24 35 31M-44-13Q-17-5-22 15Q-27 34-10 46" stroke="#fff7cf" stroke-width="6"/>'),
  };
  // Head centre, head scale, tilt; sampled from the complete-character clips.
  const poses = {
    wag:[[0,411,245,1,9],[.33,405,248,1,7],[.66,408,246,1,8],[1,411,245,1,9]],
    smile:[[0,410,244,1,9],[.5,410,247,1,5],[1,410,244,1,9]],
    eat:[[0,365,394,.94,3],[.26,378,346,.95,0],[.52,416,256,.92,-6],[.76,408,241,1,4],[1,405,245,1,7]],
    run:[[0,438,260,.91,5],[.25,465,257,.84,0],[.5,386,253,.72,0],[.75,362,253,.82,0],[1,438,260,.91,5]],
    bed:[[0,382,260,.9,0],[.3,416,353,.86,13],[.65,369,431,.8,20],[1,369,431,.8,20]],
    sleep:[[0,369,431,.8,20],[1,369,431,.8,20]]
  };
  function sample(name,t) {
    const keys=poses[name]||poses.wag;
    let i=1;while(i<keys.length-1&&t>keys[i][0])i++;
    const a=keys[i-1],b=keys[i],u=Math.max(0,Math.min(1,(t-a[0])/(b[0]-a[0])));
    return a.slice(1).map((v,j)=>v+(b[j+1]-v)*u);
  }
  function create(room, onPlay) {
    const layer=document.createElement('div');layer.className='marley-fitted-gear';room.append(layer);
    let equipment={},nodes={},last='';
    function set(value) {
      equipment=value&&typeof value==='object'?{...value}:{};
      const key=JSON.stringify(equipment);if(key===last)return;last=key;
      layer.replaceChildren();nodes={};
      function add(id,kind,width,height,html) {
        const el=document.createElement(kind==='toy'?'button':'div');el.className='marley-fitted-item gear-'+id;
        el.style.width=width/640*100+'%';el.style.height=height/640*100+'%';
        el.innerHTML=html;layer.append(el);nodes[id]=el;
        if(kind==='toy'){el.type='button';el.setAttribute('aria-label',id==='bone'?'Giv Marley kødbenet igen':id==='ball'?'Leg med bolden igen':'Kør på skateboardet igen');el.addEventListener('click',()=>onPlay(id));}
        else el.setAttribute('aria-hidden','true');
      }
      if(equipment.board==='skate')add('skate','toy',275,105,art.skate);
      if(art[equipment.head])add(equipment.head,'wear',equipment.head==='cap'?210:150,equipment.head==='cap'?130:145,art[equipment.head]);
      if(equipment.eyes==='glasses')add('glasses','wear',151,47,art.glasses);
      if(['bone','ball'].includes(equipment.toy))add(equipment.toy,'toy',equipment.toy==='bone'?155:106,110,art[equipment.toy]);
    }
    function put(id,x,y,scale=1,angle=0){const n=nodes[id];if(!n)return;n.style.left=x/640*100+'%';n.style.top=y/640*100+'%';n.style.transform=`translate(-50%,-50%) rotate(${angle}deg) scale(${scale})`;}
    function frame(clip,t,activity,paused) {
      const [x,y,s,r]=sample(clip,t);
      put(equipment.head,x,y-98*s,s,r);put('glasses',x+7*s,y-17*s,s,r+15);
      put('skate',321+(clip==='run'?(x-411)*.75:0),clip==='run'?515:550,clip==='run'?s:1,clip==='run'?Math.sin(t*Math.PI*2)*5:0);
      if(nodes.bone){
        const chewing=activity==='bone';
        put('bone',chewing?x-12:480,chewing?y+57*s:550,chewing?.78:1,chewing?Math.sin(t*18)*4:-12);
      }
      if(nodes.ball){
        const playing=activity==='ball';
        put('ball',playing?120+400*t:510,playing?520-95*Math.abs(Math.sin(t*Math.PI*3)):538,1,playing?t*720:0);
      }
      layer.classList.toggle('is-paused',paused);
    }
    return {set,frame,destroy:()=>layer.remove()};
  }
  window.MarleyWardrobe={create};
})();


