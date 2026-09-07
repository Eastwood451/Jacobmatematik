export const DUCT_WIDTH=1.6;
export const DUCT_HEIGHT=1.2;

// A low opening through the masonry only. No duct shell extends into either room.
export function createDuctBuilder({box,wallMaterial,wallHeight}) {
  function partition(x,z,w,d,hasDuct=false) {
    if(!hasDuct){box(x,wallHeight/2,z,w,wallHeight,d,wallMaterial,true);return;}
    const alongX=w>d,span=alongX?w:d,side=(span-DUCT_WIDTH)/2;
    function part(u,y,width,height) {
      return box(x+(alongX?u:0),y,z+(alongX?0:u),
        alongX?width:w,height,alongX?d:width,wallMaterial,true);
    }
    // Side masonry and lintel preserve the opening and the wall's exact depth.
    for(const sign of [-1,1])part(sign*(DUCT_WIDTH+side)/2,wallHeight/2,side,wallHeight);
    part(0,(wallHeight+DUCT_HEIGHT)/2,DUCT_WIDTH,wallHeight-DUCT_HEIGHT);
  }
  return partition;
}
