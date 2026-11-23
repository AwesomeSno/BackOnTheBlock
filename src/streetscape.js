import { drawPalm } from './harbour-view.js';

function rand(seed) {
  let n=2166136261;
  for(const c of String(seed)) n=Math.imul(n^c.charCodeAt(0),16777619);
  return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
}
function block(c,x,y,w,h,col){c.fillStyle=col;c.fillRect(Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h));}
function segment(c,x,y,ex,ey,col,w=1){c.strokeStyle=col;c.lineWidth=w;c.beginPath();c.moveTo(x,y);c.lineTo(ex,ey);c.stroke();}
function oval(c,x,y,rx,ry,col){c.fillStyle=col;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
function poly(c,points,col){c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);c.closePath();c.fillStyle=col;c.fill();}
function surface(w,h){const c=document.createElement('canvas');c.width=Math.ceil(w);c.height=Math.ceil(h);return c;}
function label(c,str,x,y,size,col,align='center',weight=700){c.textAlign=align;c.font=weight+' '+size+'px "Avenir Next", "Helvetica Neue", sans-serif';c.fillStyle=col;c.fillText(str,x,y);}
const themes={
  cafe:['#e9a379','#bd674c','#b14836'],home:['#e8c29d','#b39176','#197e88'],
  apartment:['#f1d9ba','#c8a996','#ca705b'],office:['#93b2be','#708991','#368496'],
  clinic:['#dfebe3','#a8c2c3','#148790'],garage:['#96b8ba','#718e94','#e2903a'],
  depot:['#d8bc91','#987e65','#3d6976'],shop:['#cfdfc9','#9fb49a','#26816e'],
  bar:['#c9a2a5','#a28689','#a54c64'],pawn:['#dec582','#a18c68','#536388'],
  police:['#c8d0d5','#8899a4','#446b89']
};
function treeImage(kind,seed){
  const img=surface(114,124),c=img.getContext('2d'),r=rand(seed);
  if(kind==='palm')drawPalm(c,56,119,.76+r()*.19,(r()-.5)*24,Math.floor(r()*65536));
  else{
    const tall=49+r()*14;
    poly(c,[[54,119],[60,119],[59,100],[63,119-tall],[57,119-tall],[54,96]],'#746448');
    segment(c,56,105,43,82,'#786c4d',3);segment(c,57,109,72,77,'#786c4d',3);
    for(let i=0;i<48;i++){
      const a=r()*Math.PI*2,rad=Math.sqrt(r()),x=56+Math.cos(a)*rad*27,y=112-tall+Math.sin(a)*rad*22;
      oval(c,x+2,y+3,7+r()*7,6+r()*7,['#245a3c','#347446','#38844d','#4e9250'][i%4]);
    }
    for(let i=0;i<86;i++){
      const x=30+r()*44,y=112-tall-23+r()*32;
      if(Math.hypot((x-51)/23,(y-101+tall)/19)>1)continue;
      block(c,x,y,2+r()*4,1+r()*2,['#77ac56','#9abd66','#528c4b'][i%3]);
    }
  }
  return {img,ox:56,oy:119};
}
const plantCache=new Map();
export function treeFor(plant){
  const key=(plant.kind||'palm')+'-'+(Math.round(plant.x+plant.y)%13);
  if(!plantCache.has(key))plantCache.set(key,treeImage(plant.kind||'palm',key));
  return plantCache.get(key);
}
function tide(c,x,w,h,r){
  const g=c.createLinearGradient(x,0,w,0);
  g.addColorStop(0,'#8ed7ba');g.addColorStop(.12,'#52bfb6');g.addColorStop(.38,'#1c9fac');g.addColorStop(1,'#167c9b');
  block(c,x,0,w-x,h,g);
  for(let i=0;i<Math.ceil(h*(w-x)/150);i++){
    const px=x+r()*(w-x),py=r()*h;
    block(c,px,py,2+r()*9,1, i%3?'#b3f4dd3b':'#116e8a3a');
  }
  const sand=[];
  for(let y=0;y<=h+16;y+=16)sand.push([x+13+Math.sin(y*.018)*5+Math.sin(y*.046)*2+Math.pow(.5+.5*Math.sin(y*.0042),2)*23,y]);
  poly(c,[[x,0],...sand,[x,h]],'#cbe4be');
  const beach=sand.map(([px,py])=>[px-5,py]);
  poly(c,[[x-8,0],...beach,[x-8,h]],'#e8d3a1');
}
function parkGround(c,p){
  const r=rand(p.id),{x,y,w,h}=p;
  block(c,x,y,w,h,'#77ad60');
  for(let i=0;i<w*h/28;i++){
    const px=x+2+r()*(w-4),py=y+2+r()*(h-4);
    block(c,px,py,1+r()*5,1,['#8cbe65','#599953','#a4c677','#679f54'][i%4]);
  }
  const details=p.plants||[];
  for(const t of details)oval(c,t.x+11,t.y+4,24,10,'#284f3d38');
  if((Number(p.id.match(/\d+/)?.[0])||0)%3===0){
    const px=x+w*.12,py=y+h*.18,pw=w*.76,ph=h*.64;
    block(c,px-3,py-3,pw+6,ph+6,'#d8cdac');
    block(c,px,py,pw,ph,'#639f93');
    const width=1.8;
    for(const cx of [px+4,px+pw-4,px+pw/2])segment(c,cx,py+4,cx,py+ph-4,'#e2e5ce',width);
    for(const cy of [py+4,py+ph-4])segment(c,px+4,cy,px+pw-4,cy,'#e2e5ce',width);
    c.strokeStyle='#e2e5ce';c.lineWidth=width;c.beginPath();c.ellipse(px+pw/2,py+ph/2,15,13,0,0,Math.PI*2);c.stroke();
    for(const xx of [px+3,px+pw-3]){block(c,xx-2,py+ph/2-7,5,15,'#d4d4c3');block(c,xx,py+ph/2-6,1,12,'#779193');}
  }else{
    block(c,x+w*.47,y,11,h,'#ddcaa6');block(c,x,y+h*.5,w,11,'#ddcaa6');
    for(let i=0;i<35;i++)block(c,x+w*.47+r()*10,y+r()*h,2,1,'#a79d81');
    if((Number(p.id.match(/\d+/)?.[0])||0)%2===1){
      oval(c,x+w*.5,y+h*.52,24,16,'#bec1aa');oval(c,x+w*.5,y+h*.52-1,20,12,'#58b7ae');
      oval(c,x+w*.5,y+h*.52-1,12,6,'#86d0be');
    }
  }
}
function pave(c,x,y,w,h,color,tile=14){
  block(c,x,y,w,h,color);
  for(let j=0;j<h;j+=tile){
    segment(c,x,y+j,x+w,y+j,'#5a696521');
    for(let i=j/tile%2?0:tile;i<w;i+=tile*2)segment(c,x+i,y+j,x+i,y+Math.min(h,j+tile),'#5a696522');
  }
}
function neighbourhoodSurfaces(c,world,r) {
  const {vertical:v,horizontal:h,width:roadWidth}=world.roads;
  const margin=roadWidth/2+21;
  for(let row=0;row<h.length-1;row++)for(let col=0;col<v.length-1;col++){
    const startX=v[col]+margin,endX=v[col+1]-margin,startY=h[row]+margin,endY=h[row+1]-margin;
    const midX=v[col]+329,midY=h[row]+317;
    const mixed=(col+row)%2;
    block(c,startX,startY,endX-startX,endY-startY,['#8ba46b','#99a874','#90a46b','#879e66'][(row+2*col)%4]);
    const patches=65;
    for(let j=0;j<patches;j++){
      const xx=startX+r()*(endX-startX),yy=startY+r()*(endY-startY);
      oval(c,xx,yy,3+r()*12,2+r()*4,['#81a36464','#a9b47674','#7f985f52'][j%3]);
    }
    for(let j=0;j<1600;j++){
      const xx=startX+r()*(endX-startX),yy=startY+r()*(endY-startY);
      block(c,xx,yy,1+r()*3,1,j%3?'#5e864933':'#ddd19a55');
    }
    // A service lane brings each courtyard back to the street at either end.
    pave(c,startX,midY,endX-startX,21,mixed?'#b9afa0':'#b6b0a2',13);
    pave(c,midX,startY,16,endY-startY,'#b6b2a0',12);
    for(let xx=startX+9;xx<endX;xx+=38)block(c,xx,midY+1,12,1,'#d5c9af');
    for(let i=0;i<2;i++){
      const yy=h[row]+72+i*249;
      pave(c,startX+4,yy,endX-startX-8,14,'#c9bfaa',12);
    }
  }
}
function lot(c,b){
  const r=rand(b.id),{x,y,w,h}=b;
  const garden=b.type==='home'||b.type==='apartment',industrial=b.type==='depot'||b.type==='garage';
  const apron=industrial?'#9c9e99':garden?'#cec0a8':'#c4bcb0';
  pave(c,x-7,y-8,w+14,h+47,apron,industrial?23:15);
  if(garden) {
    for(const side of [0,1]){
      const gx=side?x+w-37:x-6,gy=y+h+14;
      block(c,gx,gy,39,5,'#b3ac8c');block(c,gx+1,gy+1,37,3,'#64855c');
      for(let j=0;j<10;j++)block(c,gx+r()*35,gy+r()*3,1.6,1.5,j%3?'#8b9d62':'#c58c7f');
    }
  }else if(industrial){
    for(let j=0;j<9;j++)segment(c,x+17+j*11,y+h+4,x+13+j*11,y+h+10,'#e0bd70',2);
  }
  for(let i=0;i<65;i++)block(c,x-10+r()*(w+20),y+h+2+r()*36,1+r()*3,1,'#a49e91');
  const doorX=b.door.x;
  block(c,doorX-12,y+h,24,34,'#d9cbb0');
  for(let i=0;i<4;i++)segment(c,doorX-12,y+h+i*9,doorX+12,y+h+i*9,'#a39c8d');
  // Frontage shadows stay on the ground when a roof fades for the player.
  poly(c,[[x,y],[x+w,y],[x+w+12,y+14],[x+w+12,y+h+10],[x+9,y+h+11],[x,y+h]],'#293d4b29');
}
function drawStreet(c,start,end,pos,horizontal,width){
  c.save();if(horizontal){c.translate(start,pos); }else {c.translate(pos,start);c.rotate(Math.PI/2);}
  const length=end-start,half=width/2;
  block(c,0,-half-22,length,width+44,'#bdbaad');block(c,0,-half-17,length,width+34,'#d9d1bd');
  for(let x=0;x<length;x+=23){
    segment(c,x,-half-20,x,-half-2,'#9e9f913d');
    segment(c,x,half+2,x,half+19,'#9e9f913d');
  }
  block(c,0,-half,length,width,'#404d55');
  block(c,0,-half+3,length,width-6,'#556067');
  block(c,0,-half+6,length,4,'#616b6e');block(c,0,half-9,length,5,'#60696b');
  for(let ix=0;ix<length;ix+=52){
    block(c,ix,-2,22,2,'#e4c977');
    block(c,ix,-half+4,30,1,'#dad7c9');block(c,ix,half-5,30,1,'#dad7c9');
  }
  c.restore();
}
export function buildGround(world){
  const image=surface(world.width,world.height),c=image.getContext('2d'),r=rand('Port Lucero street surfaces');
  const shore=world.water?.shoreX||world.width-35,roadW=world.roads.width,{vertical,horizontal}=world.roads;
  block(c,0,0,world.width,world.height,'#c9c8a9');
  for(let i=0;i<6000;i++)block(c,r()*shore,r()*world.height,2+r()*4,1,['#adb69366','#d4cfaf88','#babb9e'][i%3]);
  neighbourhoodSurfaces(c,world,r);
  for(const b of world.buildings)lot(c,b);
  for(const p of world.parks||[])parkGround(c,p);
  for(const x of vertical)drawStreet(c,0,world.height,x,false,roadW);
  for(const y of horizontal)drawStreet(c,0,shore-5,y,true,roadW);
  for (const road of horizontal) for(let j=0;j<vertical.length-1;j++){
    const mid=(vertical[j]+vertical[j+1])/2;
    for(const side of [-1,1]){
      const lane=road+side*roadW*.24,dir=side;
      poly(c,[[mid+8*dir,lane],[mid-2*dir,lane-4.6],[mid-2*dir,lane-1.8],[mid-15*dir,lane-1.8],[mid-15*dir,lane+1.8],[mid-2*dir,lane+1.8],[mid-2*dir,lane+4.6]],'#d8d8bd88');
      const dx=vertical[j]+roadW*.5+61,dy=road+side*(roadW*.5-3);
      block(c,dx,dy-2,15,4,'#434d50');for(let t=1;t<14;t+=3)block(c,dx+t,dy-1,1,3,'#7c8482');
    }
  }
  for(const x of vertical)for(const y of horizontal){
    const half=roadW/2;
    // Restore the north/south carriageway across the cross street's pavement.
    block(c,x-half,y-half-23,roadW,roadW+46,'#556067');
    block(c,x-half-1,y-half,roadW+2,roadW,'#566167');
    for(let i=-half+6;i<half-1;i+=9){
      for(const s of [-1,1]){
        block(c,x+i,y+s*(half+8),4,10,'#dce0d4');
        block(c,x+s*(half+8),y+i,10,4,'#dce0d4');
      }
    }
    for(const s of [-1,1]){
      block(c,x+(s<0?-half:2),y+s*(half+21),half-3,2,'#d5d6c8');
      block(c,x+s*(half+21),y+(s>0?-half:2),2,half-3,'#d5d6c8');
    }
    oval(c,x+19,y+12,6,5,'#445054');for(let i=0;i<3;i++)segment(c,x+16,y+10+i*2,x+22,y+10+i*2,'#778084');
  }
  for(let i=0;i<8200;i++){
    const x=r()*shore,y=r()*world.height;
    if(vertical.some(v=>Math.abs(v-x)<roadW/2-6)||horizontal.some(v=>Math.abs(v-y)<roadW/2-6))block(c,x,y,r()*4+1,1,i%2?'#82909755':'#26394238');
  }
  for(const b of world.buildings){
    if(!['garage','clinic','shop','office','depot'].includes(b.type))continue;
    for(let j=0;j<3;j++){const xx=b.x+4+j*17;segment(c,xx,b.y+b.h+14,xx-4,b.y+b.h+29,'#e5dcca',1.3);}
  }
  for(const d of world.decorations||[])oval(c,d.x+4,d.y+2,d.kind==='bench'?13:6,d.kind==='bench'?4:3,'#2a44432d');
  block(c,shore-28,0,32,world.height,'#e2c99a');
  for(let i=0;i<world.height;i+=9)segment(c,shore-22,i,shore-7,i+2,'#cbba93',1);
  tide(c,shore,world.width,world.height,r);
  // A working quay has cleats, timber fenders and weathered shore stones.
  for(let y=54;y<world.height-60;y+=32){
    const ramp=horizontal.some(v=>Math.abs(v-y)<33);
    if(ramp)continue;
    block(c,shore-23,y,4,4,'#7f7e70');block(c,shore-24,y-1,6,2,'#a5a390');
    segment(c,shore-21,y+1,shore-21,y+27,'#8c8e786b');
    if(y%96===54){oval(c,shore+8,y+4,3.5,2.4,'#989a80');oval(c,shore+5,y+7,2.2,1.6,'#b0ab90');}
  }
  return image;
}
function windowUnit(c,x,y,w,h,tint,r,bars=false){
  block(c,x-1,y-1,w+2,h+3,'#687679');
  block(c,x,y,w,h,tint);
  block(c,x+1,y+1,w-2,Math.max(2,h*.28),r()>.4?'#a6c4ca':'#cad4d1');
  block(c,x,y,w,2,'#f0ddba');block(c,x+w*.51,y,1,h,'#d4c5ac');
  block(c,x-2,y+h,w+4,2,'#e2c9ab');
  if(bars)for(let j=2;j<w;j+=4)block(c,x+j,y+2,1,h-2,'#62787a');
}
function roof(c,x,y,w,h,b,r,industrial,theme){
  const domestic=['home','apartment'].includes(b.type);
  const color=industrial?'#a8a7a1':domestic?['#bd8065','#d6be96','#84aba9','#ba8c75'][b.variant%4]:theme[1];
  block(c,x,y,w,h,color);
  if(industrial||b.type==='garage'||b.type==='depot'){
    for(let xx=x+5;xx<x+w-3;xx+=7)segment(c,xx,y+2,xx,y+h-2,'#e2ddd33f',2);
  }else if(color==='#bd8065'){
    for(let yy=y+3;yy<y+h-2;yy+=5){
      segment(c,x+3,yy,x+w-3,yy,'#8f614e70',1);
      for(let xx=x+4+(yy%2)*4;xx<x+w-5;xx+=11)block(c,xx,yy-2,1,2,'#ecc09475');
    }
  }else for(let i=0;i<w*h/85;i++)block(c,x+3+r()*(w-6),y+3+r()*(h-6),1+r()*3,1,'#686f6a36');
  if(domestic && (b.type==='home'||b.variant%2===0)){
    const hip=Math.min(27,h*.23),mx=x+w*.53;
    poly(c,[[x,y],[mx,y+hip],[mx,y+h-hip],[x,y+h]],'#fff1d026');
    poly(c,[[x+w,y],[mx,y+hip],[mx,y+h-hip],[x+w,y+h]],'#374a4b33');
    poly(c,[[x,y+h],[mx,y+h-hip],[x+w,y+h]],'#4147442b');
    segment(c,x,y,mx,y+hip,'#dfb48b',2);segment(c,x+w,y,mx,y+hip,'#a48268',1.5);
    segment(c,mx,y+hip,mx,y+h-hip,'#d4ac86',3);
    segment(c,x,y+h,mx,y+h-hip,'#b48b6c');segment(c,x+w,y+h,mx,y+h-hip,'#bd9676');
    // A flue and ridge caps cast small directional shadows across the roof.
    const chimneyX=x+w*.75,chimneyY=y+h*.58;
    poly(c,[[chimneyX,chimneyY],[chimneyX+11,chimneyY-1],[chimneyX+15,chimneyY+9],[chimneyX+4,chimneyY+10]],'#584b3d44');
    block(c,chimneyX,chimneyY-6,9,12,'#ab7d6b');block(c,chimneyX-1,chimneyY-7,12,4,'#d8b397');
  }else if(!industrial){
    // Parapet shadow and stair enclosure around a maintenance landing.
    block(c,x+4,y+3,w-7,6,'#69797835');
    const xx=x+w*.23,yy=y+h*.61;
    block(c,xx+4,yy+4,30,18,'#3f51574d');block(c,xx,yy,29,15,'#bdbbb0');block(c,xx,yy+10,29,7,'#8d928e');
    block(c,xx+10,yy+8,6,9,'#667a7b');block(c,xx-1,yy-2,31,4,'#dbd4bf');
  }
  block(c,x,y,w,3,'#eee5d1');block(c,x,y,3,h,'#d6ccba');block(c,x+w-4,y,4,h,'#7d8586');
  block(c,x,y+h-3,w,3,'#ebd9ba');
  for(let i=0;i<(industrial?3:1);i++){
    const vx=x+w*(.67-i*.20),vy=y+h*.18+r()*9;
    block(c,vx+3,vy+4,17,13,'#41566359');block(c,vx,vy,16,12,'#d7d5c9');oval(c,vx+8,vy+6,4.5,4,'#718186');
    segment(c,vx+5,vy+4,vx+11,vy+8,'#b5b9b3',1);segment(c,vx+10,vy+4,vx+6,vy+8,'#a9b0ae',1);
  }
  if(h>62){
    if(b.variant%2===0){
      const sx=x+12,sy=y+h*.44;
      block(c,sx+2,sy+3,31,19,'#63747666');block(c,sx,sy,30,18,'#344f68');
      for(let i=0;i<5;i++)segment(c,sx+i*6,sy,sx+i*6,sy+17,'#91a8ae');
      for(let i=0;i<3;i++)segment(c,sx,sy+i*6,sx+30,sy+i*6,'#91a8ae');
    }else{
      block(c,x+18,y+h*.44,19,13,'#5a6c6d');oval(c,x+27.5,y+h*.44,9.5,3.6,'#9fa797');
      segment(c,x+23,y+h*.44+4,x+23,y+h*.44+13,'#88968e',1.4);
    }
  }
}
function clothesline(c,x,y,width) {
  segment(c,x,y,x+width*.5,y+3,'#596564',.8);
  segment(c,x+width*.5,y+3,x+width,y,'#596564',.8);
  const colours=['#df795f','#dedec6','#597fa1','#d6b35f','#83aea5','#ecddd0'];
  for(let i=0;i<6;i++){
    const dx=x+3+i*width/6,dy=y+Math.sin((i+.5)/6*Math.PI)*3;
    if(i===2||i===4)poly(c,[[dx,dy],[dx+7,dy],[dx+6,dy+9],[dx+4,dy+9],[dx+4,dy+5],[dx+2,dy+9],[dx,dy+9]],colours[i]);
    else poly(c,[[dx,dy],[dx+5,dy],[dx+8,dy+2],[dx+6,dy+4],[dx+5,dy+3],[dx+5,dy+8],[dx,dy+7],[dx-1,dy+3],[dx-2,dy+4],[dx-3,dy+2]],colours[i]);
    block(c,dx+1,dy-1,1,2,'#c6ae82');
  }
}
function verandah(c,x,y,w,accent){
  block(c,x+2,y+3,w,11,'#595c5730');
  block(c,x,y,w,9,'#cfbda2');block(c,x-1,y+8,w+2,3,'#8c8479');
  for(const dx of [9,w-14]){
    block(c,x+dx,y-4,6,6,'#5e797a');block(c,x+dx,y+1,7,2,'#ad895d');
    segment(c,x+dx,y+2,x+dx-1,y+6,'#735d49');segment(c,x+dx+6,y+2,x+dx+7,y+5,'#735d49');
  }
  const tx=x+w*.49;oval(c,tx,y+1,5,2.5,'#f1d8ae');segment(c,tx,y+1,tx,y+5,'#887e6b');
  block(c,tx+2,y-2,2,2,accent);
  for(let i=2;i<w;i+=6)block(c,x+i,y+3,1,6,'#789489');
  block(c,x,y+2,w,1.5,'#e8d8bb');
}
function crate(c,x,y,col,r){
  block(c,x+1,y+1,13,8,'#7b735e');block(c,x,y,13,7,'#a57d50');block(c,x+1,y+1,11,4,'#765943');
  for(let i=0;i<8;i++)oval(c,x+2+r()*8,y+1+r()*3,1.3,1.15,col);
  block(c,x,y+5,13,1,'#c59d65');
}
export function buildingImage(b){
  const r=rand(b.id+' facade'),theme=themes[b.type]||themes.home;
  const floors=Math.max(1,Math.min(16,b.floors||1)),storey=floors>5?22:26;
  const rise=28+(floors-1)*storey,side=floors>5?8:4;
  const img=surface(b.w+side+8,b.h+rise+9),c=img.getContext('2d'),x=3,y=3,w=b.w,h=b.h,front=y+h,base=front+rise;
  const tall=floors>=5,industry=b.type==='depot'||b.type==='garage';
  const themeWall=tall?['#b3c5ca','#bed1d1','#ddd6c5','#a8c0c8'][b.variant%4]:theme[0];
  poly(c,[[x+w,y],[x+w+side,y+6],[x+w+side,base-3],[x+w,base]],theme[1]);
  block(c,x,front,w,rise,themeWall);
  const cols=Math.max(3,Math.floor((w-14)/(tall?17:30))),cw=(w-17)/cols;
  for(let fl=1;fl<floors;fl++){
    const fy=base-28-fl*storey;
    const colAlternation=(fl+b.variant)%3;
    block(c,x,fy+storey-2,w,2,tall?'#99acb0':'#c3b4a3');
    for(let j=0;j<cols;j++){
      const wx=x+8+j*cw, ww=tall?cw-3:Math.min(18,cw-8);
      if(tall){
        const shades=['#577986','#6f949e','#5c8190','#8aa6a8'];
        const shade=shades[Math.floor(r()*shades.length)];block(c,wx,fy+3,ww,storey-7,shade);
        block(c,wx,fy+3,ww,3,r()>.3?'#a6c3c5':'#c2cccc');block(c,wx+ww-2,fy+6,1,storey-11,'#93aeb0');
        if(colAlternation===1&&j%3===0)block(c,wx,fy+storey-8,ww,3,'#dbb991');
      }else windowUnit(c,wx,fy+5,ww,storey-12,['#627f86','#829b9f','#a99d89'][Math.floor(r()*3)],r);
    }
    if(b.type==='home'&&fl===1){
      verandah(c,x+w*.09,fy+storey-10,w*.36,theme[2]);
      clothesline(c,x+w*.58,fy+6,w*.32);
    }else if(!tall && b.type==='apartment' && fl%2===1){
      for(let i=0;i<2;i++){
        const bx=x+w*(i?.65:.11),bw=w*.24;
        block(c,bx-2,fy+storey-5,bw+4,3,'#888c85');block(c,bx,fy+storey-12,bw,1,'#626f6e');
        for(let j=0;j<=bw;j+=5)block(c,bx+j,fy+storey-11,1,6,'#697775');
      }
    }
  }
  roof(c,x,y,w,h,b,r,industry,theme);
  block(c,x-1,front,w+2,4,tall?'#e1e5da':'#e2ceb0');
  block(c,x,base-3,w,3,'#858a83');
  const doorLocalX=Math.max(11,Math.min(w-22,b.door.x-b.x))+x,doorY=base-24;
  for(let j=0;j<cols;j++){
    const wx=x+8+j*cw,ww=Math.min(cw-5,industry?26:25);
    if(wx<doorLocalX+13&&wx+ww>doorLocalX-12)continue;
    if(industry){
      block(c,wx,doorY+2,ww,21,'#788b8d');
      for(let k=0;k<5;k++)segment(c,wx,doorY+5+k*3,wx+ww,doorY+5+k*3,'#aab1a7');
    }else windowUnit(c,wx,doorY+3,ww,16,'#6b969b',r,b.type==='pawn');
  }
  block(c,doorLocalX-9,doorY-2,18,26,'#dfd1b5');block(c,doorLocalX-7,doorY,14,24,theme[2]);
  block(c,doorLocalX-5,doorY+2,10,13,'#5e8086');block(c,doorLocalX+3,doorY+14,2,3,'#f2d080');
  for(let k=0;k<2;k++)block(c,doorLocalX-12-k*2,base+k*2,24+k*4,2,k?'#a6a59b':'#dcd3bd');
  const business=!['apartment','home'].includes(b.type);
  if(business){
    const signY=doorY-13,txt=(b.name||b.type).toUpperCase(),sw=Math.min(w*.9,Math.max(55,txt.length*5+14));
    block(c,doorLocalX-sw/2+1,signY+2,sw,13,'#40565944');
    block(c,doorLocalX-sw/2,signY,sw,13,theme[2]);
    label(c,txt,doorLocalX,signY+9.5,Math.min(9,sw/(txt.length*.72+1)),'#fff4d6');
    if(['shop','cafe','bar'].includes(b.type)){
      const aw=w*.25;
      for(const ax of [x+8,x+w-aw-8]){
        poly(c,[[ax,doorY],[ax+aw,doorY],[ax+aw+3,doorY+7],[ax-3,doorY+7]],theme[2]);
        for(let k=0;k<aw;k+=10)block(c,ax+k,doorY,5,7,'#efd6af');
        block(c,ax-3,doorY+7,aw+6,2,'#a27562');
      }
    }
  }else{
    block(c,doorLocalX+12,doorY+2,12,7,'#365865');
    label(c,String(parseInt(b.id.replace(/\D/g,''),10)+10),doorLocalX+18,doorY+8,6,'#fbebcd');
  }
  if(b.type==='home'){
    const sy=doorY-10;
    block(c,doorLocalX-24,sy,48,10,'#206b76');
    label(c,'BENNETT ROOMS',doorLocalX,sy+7.5,6.2,'#f4e8c8');
    verandah(c,x+9,base-9,w*.28,theme[2]);
    for(const gx of [x+w*.74,x+w*.9]){
      block(c,gx-3,base-6,7,6,'#c67e59');
      for(let i=0;i<7;i++){const a=i*1.11;segment(c,gx,base-5,gx+Math.cos(a)*5,base-10+Math.sin(a)*4,i%2?'#568050':'#729444',1.5);}
    }
  }else if(b.type==='cafe'||b.type==='shop'){
    const sx=x+w*.73,sy=base-7;
    for(let i=0;i<3;i++)crate(c,sx+(i%2)*14,sy-Math.floor(i/2)*6,['#e8b84b','#d87b4d','#81a45b'][i],r);
    if(b.type==='cafe'){
      verandah(c,x+7,base-9,w*.26,theme[2]);
      block(c,doorLocalX-18,base-13,8,12,'#895f47');block(c,doorLocalX-17,base-12,6,8,'#365651');
      for(let j=0;j<3;j++)block(c,doorLocalX-16,base-11+j*2,j%2?3:4,1,'#c4d3b7');
    }
  }else if(industry){
    for(let j=0;j<2;j++){oval(c,x+w-15+j*2,base-4-j*3,8,3,'#465054');oval(c,x+w-15+j*2,base-5-j*3,4,1.4,'#8b8d82');}
  }else if(b.type==='clinic'){
    block(c,x+8,doorY-9,15,10,'#436f78');block(c,x+14,doorY-8,3,8,'#e6eee5');block(c,x+11,doorY-5,9,3,'#e6eee5');
  }
  return {img,ox:x,oy:rise+y,top:b.y-rise,base:b.y+b.h};
}
export function shoreMotion(c,camera,viewport,world,t,still){
  const shore=world.water?.shoreX||world.width-35,halfW=viewport.width/camera.zoom/2,halfH=viewport.height/camera.zoom/2;
  if(camera.x+halfW<shore-3)return;
  const first=Math.floor((camera.y-halfH)/21)*21,last=Math.ceil((camera.y+halfH)/21)*21;
  for(let y=first;y<=last;y+=21){
    const phase=still?1:Math.sin(t*.8+y*.031);
    const xx=shore+14+Math.sin(y*.018)*5+Math.pow(.5+.5*Math.sin(y*.0042),2)*23+phase*3;
    segment(c,xx,y,xx+1,y+3+3*phase,'#f5f7d99e',2);
    for(let j=1;j<5;j++){
      const off=(y*17+j*41)%117;
      const dx=xx+6+j*36+off;
      segment(c,dx,y+6*phase,dx+5+4*phase,y+6*phase,'#cff4dd77',1);
    }
  }
  // Small anchored skiffs gently swing out from their buoys on the lee side.
  for(let i=Math.floor(first/315);i<=Math.ceil(last/315);i++){
    const x=shore+52+(Math.abs(i)*937%106), y=i*315+115;
    if(y<0||y>world.height)continue;
    c.save();c.translate(x,y);c.rotate(.46+(still?0:Math.sin(t*.23+i)*.045));
    oval(c,3,3,8,17,'#17667555');poly(c,[[0,-17],[6,-9],[7,9],[5,15],[-5,15],[-7,9],[-6,-9]],'#f1debc');
    poly(c,[[0,-11],[4,-5],[4,10],[-4,10],[-4,-5]],i%2?'#509895':'#bf785e');
    block(c,-5,1,10,2,'#f3cf9d');c.restore();
  }
}
