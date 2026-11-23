// Waterfront viewed from the ferry approach. Cache the architecture and animate the water traffic.
function generator(seed) {
  let n = seed >>> 0;
  return () => { n = (Math.imul(1664525, n) + 1013904223) >>> 0; return n / 4294967296; };
}
function box(c,x,y,w,h,fill) {
  c.fillStyle=fill; c.fillRect(Math.floor(x),Math.floor(y),Math.ceil(w),Math.ceil(h));
}
function path(c, points, fill) {
  c.fillStyle=fill; c.beginPath(); c.moveTo(...points[0]);
  for (const point of points.slice(1)) c.lineTo(...point);
  c.closePath(); c.fill();
}
function stroke(c, points, color, width=1) {
  c.strokeStyle=color; c.lineWidth=width; c.beginPath(); c.moveTo(...points[0]);
  for (const point of points.slice(1)) c.lineTo(...point);
  c.stroke();
}
function oval(c,x,y,rx,ry,color) {
  c.fillStyle=color; c.beginPath(); c.ellipse(x,y,rx,ry,0,0,Math.PI*2); c.fill();
}
function gradient(c,y1,y2,stops) {
  const g=c.createLinearGradient(0,y1,0,y2);
  for (const [t,color] of stops) g.addColorStop(t,color);
  return g;
}
function palm(c,x,y,s,lean,seed,backlit=false) {
  const r=generator(seed), topX=x+lean*s, topY=y-105*s;
  const dark=backlit?'#182e37':'#235942', mid=backlit?'#294345':'#318253', light=backlit?'#46544b':'#67a857';
  path(c,[[x-2.8*s,y],[x+3.4*s,y],[x+lean*s*.28+3*s,y-34*s],[topX+1.6*s,topY],[topX-1.8*s,topY],[x+lean*s*.28-2*s,y-34*s]],backlit?'#30383b':'#81735a');
  stroke(c,[[x-1.6*s,y],[x+lean*s*.27-1.6*s,y-35*s],[topX,topY+2*s]], backlit?'#5e5550':'#b2956a',1.25*s);
  for(let i=0;i<13;i++) {
    const theta=i*2.39996+.23, dx=Math.cos(theta)*(35+r()*18)*s;
    const dy=(Math.sin(theta)*20+18)*s, lift=(20+r()*12)*s, color=[dark,mid,dark,light][i%4];
    const point=t=>[topX+dx*t,topY+dy*t-Math.sin(Math.PI*t)*lift];
    const stem=Array.from({length:8},(_,j)=>point(j/7));
    stroke(c,stem,color,1.5*s);
    for(let f=1;f<=16;f++){
      const t=f/18,p=point(t),q=point(Math.min(1,t+.075)),norm=Math.max(1,Math.hypot(q[0]-p[0],q[1]-p[1]));
      const tx=(q[0]-p[0])/norm,ty=(q[1]-p[1])/norm;
      const length=(Math.sin(Math.PI*t)*8+.6)*s;
      for(const side of [-1,1]){
        const leaf=[p[0]+(tx*.6-ty*side)*length,p[1]+(ty*.6+tx*side*.48+.40)*length];
        path(c,[p,leaf,q],color);
      }
    }
  }
}
export {palm as drawPalm};
function tower(c,x,base,width,height,kind,r) {
  const y=base-height, side=Math.max(3,width*.17), front=width-side;
  const colors=[
    ['#b4a1a0','#686e86','#667887','#868e98'],['#8d9aa9','#58667a','#416879','#7399a4'],
    ['#e1c7a8','#94848b','#7e8390','#b3a099'],['#b8a6a1','#657082','#617584','#879ba6']
  ][kind%4];
  box(c,x+front,y+3,side,height-3,colors[1]);box(c,x,y,front,height,colors[0]);
  if(kind%3===1){
    box(c,x+4,y-8,front-7,10,colors[0]);box(c,x+7,y-12,front-13,5,colors[1]);
    stroke(c,[[x+front*.5,y-11],[x+front*.5,y-23]],colors[1],1);
  }else{
    box(c,x+3,y-3,front-5,3,'#e1d0b4');box(c,x+front*.26,y-7,front*.4,5,colors[1]);
  }
  const spacing=kind%3===0?6:8;
  for(let yy=y+4;yy<base-2;yy+=spacing) {
    if(kind%3===2){
      box(c,x+1,yy,front-2,3,colors[2]);box(c,x+1,yy+3,front-1,1,'#dac6b5');
      box(c,x+front,yy+1,side,2,colors[2]);
    }else{
      for(let xx=x+2;xx<x+front-2;xx+=5){
        const shade=r(); const col=shade>.92?'#ffcb87':shade>.65?colors[3]:colors[2];
        box(c,xx,yy,3,kind%3===0?3:5,col);
      }
      box(c,x+front+1,yy+1,Math.max(1,side-2),2,colors[2]);
    }
  }
  if(kind%3===2){box(c,x+front*.37,y+1,2,height-1,colors[0]);box(c,x+front*.7,y+1,2,height-1,colors[0]);}
  box(c,x,y,1,height,'#ddbe9d');
}
function crane(c,x,y,s,shade) {
  c.save(); c.translate(x,y);c.scale(s,s);
  stroke(c,[[-13,0],[-6,-57],[4,-57],[13,0]],shade,3);
  stroke(c,[[-16,-45],[23,-55],[75,-92]],shade,3);stroke(c,[[-16,-50],[22,-61],[75,-92]],shade,2);
  for(let k=0;k<6;k++)stroke(c,[[-6,-k*9],[5,-k*9-8],[-6,-k*9-8]],shade,.9);
  stroke(c,[[48,-76],[48,-34],[46,-30]],shade,.8);box(c,-10,-60,15,11,shade);
  c.restore();
}
const SCENE_W=1120,SCENE_H=630,HORIZON=383;
function paintHarbour(c,world) {
  const rng=generator(91527);
  box(c,0,0,SCENE_W,HORIZON,gradient(c,0,HORIZON,[[0,'#426985'],[.38,'#7997ac'],[.64,'#d6b5a6'],[.87,'#ffc68d'],[1,'#ffd09b']]));
  const glow=c.createRadialGradient(820,276,3,820,276,220);
  glow.addColorStop(0,'#ffdc9b');glow.addColorStop(.29,'#ffbf7b90');glow.addColorStop(1,'#efae7c00');
  box(c,570,55,510,400,glow);
  oval(c,813,265,35,35,'#ffdfa1');
  for(let band=0;band<6;band++){
    const yy=44+band*42;
    for(let n=0;n<5;n++){
      const x=rng()*SCENE_W,y=yy+rng()*19,w=25+rng()*130;
      path(c,[[x,y+2],[x+w*.16,y-2],[x+w*.37,y-2],[x+w*.49,y-5],[x+w*.65,y-5],[x+w*.8,y-2],[x+w,y],[x+w*.9,y+2]],band<3?'#e5c8bb35':'#ffdab35c');
    }
  }
  for(let i=0;i<10;i++){
    const x=600+i*24+25*rng(),y=120+Math.sin(i*.75)*14+rng()*21;
    stroke(c,[[x-3,y-1],[x,y+1],[x+3,y-2]],'#40556977',1);
  }
  // Two distant ridge lines separate the bank of towers from the sky.
  for(let k=0;k<2;k++) {
    const points=[[0,HORIZON]];
    for(let x=0;x<=1130;x+=9){
      const h=14+10*Math.sin(x*.012+k)+8*Math.sin(x*.021+.7*k)+12*Math.sin(x*.005);
      points.push([x,HORIZON-h-k*6-rng()*4]);
    }
    points.push([1130,HORIZON]);path(c,points,k?'#937f88':'#aca0a7');
  }
  for(let i=0;i<125;i++){
    const x=i*9;const ave=17+28*Math.max(0,Math.sin((x-500)*.006));
    const h=5+rng()*ave;
    box(c,x,HORIZON-h,4+rng()*13,h,'#797c89');
  }
  const blocks=world?.buildings||[];
  for(let i=0,x=315;x<1155;i++){
    const w=12+rng()*34;
    const district=Math.exp(-Math.pow((x-858)/180,2));
    const floors=blocks.length?blocks[(i*13)%blocks.length].floors:3;
    const height=16+rng()*28+district*(19+Math.min(13,floors)*4+rng()*82);
    tower(c,x,HORIZON+2,w,height,i,rng); x+=w-2+rng()*9;
  }
  tower(c,885,HORIZON+5,58,188,1,rng);
  tower(c,951,HORIZON+5,35,127,2,rng);
  for(let i=0;i<66;i++){
    const x=315+i*12+rng()*9,y=HORIZON+1+rng()*4;
    box(c,x,y-9-rng()*7,16+rng()*12,19,['#b18e80','#dba982','#836d70','#b7ab99'][i%4]);
    box(c,x,y-10,17,2,'#d9b79a');
    for(let j=0;j<3;j++)box(c,x+3+j*5,y-5,2,4,'#526171');
  }
  crane(c,540,HORIZON,.63,'#655b65');crane(c,592,HORIZON,.53,'#746772');
  for(let i=0;i<42;i++){
    const x=325+i*20+rng()*8;
    palm(c,x,HORIZON+7,.15+rng()*.11,(rng()-.5)*13,100+i,true);
  }
  box(c,0,HORIZON+5,SCENE_W,SCENE_H-HORIZON,gradient(c,HORIZON,SCENE_H,[[0,'#77999d'],[.3,'#518e99'],[.7,'#357786'],[1,'#185b70']]));
  for(let i=0;i<1300;i++){
    const y=HORIZON+6+rng()*250, x=rng()*SCENE_W;
    const v=(y-HORIZON)/250;
    const reflection=Math.abs(x-810) < 21 + v*135 + rng()*26;
    const col=reflection?['#ffdaaa99','#ffa87969','#d7a18c99'][i%3]:['#c0c9c54e','#3968795a','#98c3bd64'][i%3];
    box(c,x,y,2+rng()*(7+v*21),1+v,col);
  }
  // A working breakwater and mooring bollards establish a human scale at the skyline.
  path(c,[[557,405],[685,391],[1120,391],[1120,400],[692,397],[552,409]],'#645f63');
  for(let x=570;x<1100;x+=13)box(c,x,404-Math.min(11,(x-557)*.085),2,4,'#434b53');
  for(let i=0;i<7;i++){
    const x=609+i*57; const y=398-Math.min(8,(x-600)*.06);
    stroke(c,[[x,y],[x,y-11],[x+3,y-12]],'#59626b',1);
    box(c,x+2,y-12,2,1,'#ffcf8e');
  }
  // Rooftops at the edge of frame place the camera on the old ferry landing.
  path(c,[[815,632],[1024,524],[1120,516],[1120,630]],'#253f4a');
  for(let i=0;i<5;i++){
    const x=862+i*61,y=601-i*16,h=29+rng()*25;
    path(c,[[x,y],[x+40,y-8],[x+40,y+h],[x,y+h+10]],['#987e75','#c89d84','#aa8279'][i%3]);
    path(c,[[x+40,y-8],[x+62,y+1],[x+62,y+h+2],[x+40,y+h]],'#685e64');
    path(c,[[x-5,y],[x+17,y-15],[x+45,y-15],[x+62,y],[x+39,y-6]],'#815e59');
    for(let j=0;j<3;j++)box(c,x+5+j*10,y+9-j*2,5,11,'#40545c');
  }
  palm(c,1096,629,1.61,-24,3,true);palm(c,1052,599,.74,-17,17,true);
  stroke(c,[[926,586],[981,562],[1048,535],[1119,507]],'#263d4c',2);
}
function launch(c,x,y,s) {
  c.save();c.translate(x,y);c.scale(s,s);
  for(let i=0;i<5;i++)stroke(c,[[-12-i*4,4+i],[-37-i*6,7+i*1.4],[-62-i*8,6+i*1.7]],i%2?'#d6d6b957':'#b7c9bd82',1.3);
  path(c,[[-21,0],[18,-2],[27,-4],[22,1],[13,4],[-17,5]],'#2d4457');
  path(c,[[-21,-2],[19,-4],[26,-5],[22,-2],[-20,2]],'#e3bc97');
  path(c,[[-13,-2],[-11,-11],[6,-12],[12,-5]],'#d7b99d');
  for(let j=0;j<4;j++)box(c,-9+j*5,-10,3,4,'#536776');
  stroke(c,[[-5,-11],[-5,-18]],'#5d6a6e',.9);c.restore();
}
export function createHarbourView() {
  let cached=null,cachedWorld=null;
  return function drawHarbour(ctx,viewport,world,time=0,still=false){
    if(!cached||world!==cachedWorld){
      cached=document.createElement('canvas');cached.width=SCENE_W;cached.height=SCENE_H;
      paintHarbour(cached.getContext('2d'),world);cachedWorld=world;
    }
    ctx.save();
    ctx.setTransform(viewport.dpr,0,0,viewport.dpr,0,0);
    const ratio=Math.max(viewport.width/SCENE_W,viewport.height/SCENE_H);
    const drawW=SCENE_W*ratio,drawH=SCENE_H*ratio;
    // Keep the harbour skyline visible in portrait and ultrawide windows.
    const dx=(viewport.width-drawW)*(viewport.width<700?.77:.5),dy=(viewport.height-drawH)*.55;
    ctx.translate(dx,dy);ctx.scale(ratio,ratio);ctx.drawImage(cached,0,0);
    const t=still?18:time, x=lane=>((lane+t*4.6)%1250)-80;
    launch(ctx,x(690),456+Math.sin(t*.85)*.4,.85);
    for(let i=0;i<22;i++){
      const wx=610+(i*37%380),wy=412+i*7%125;
      const a=.1+.28*(.5+.5*Math.sin(i*9.4+t*1.2));
      ctx.globalAlpha=a;box(ctx,wx,wy,6+i%14,1,'#ffe3b1');
    }
    ctx.restore();
  };
}
