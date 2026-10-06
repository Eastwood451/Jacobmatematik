/* Full-character animation clips for browsers without WebGL. */
(() => {
  "use strict";
  function create(host,onChange=()=>{}) {
    const video=document.createElement("video");
    video.muted=true;video.defaultMuted=true;video.autoplay=true;video.playsInline=true;
    video.preload="auto";video.setAttribute("playsinline","");video.setAttribute("aria-label","Marley logrer");
    video.style.cssText="display:block;width:100%;height:100%;object-fit:contain";
    host.append(video);host.dataset.renderer="video";
    const labels={wag:"Marley logrer",smile:"Marley smiler",run:"Marley løber i cirkler",eat:"Marley spiser en godbid",bed:"Marley lægger sig i kurven",sleep:"Marley hviler i kurven"};
    let state="wag",paused=false,disposed=false;
    function resume(){const p=video.play();if(p)p.catch(()=>{});}
    function play(name){
      if(disposed||!labels[name])return;
      state=name;paused=false;host.dataset.action=name;
      video.setAttribute("aria-label",labels[name]);video.loop=name==="wag"||name==="sleep";
      video.src="assets/figurer/marley-video/"+name+".mp4?v=20261006-video1";
      onChange(name);resume();
    }
    function ended(){play(state==="bed"?"sleep":"wag");}
    video.addEventListener("ended",ended);
    return {
      play,setEquipment(){},getState(){return state;},
      pause(){paused=!paused;if(paused)video.pause();else resume();return paused;},
      destroy(){disposed=true;video.pause();video.removeEventListener("ended",ended);video.removeAttribute("src");video.load();video.remove();}
    };
  }
  window.MarleyVideoScene={create};
})();
