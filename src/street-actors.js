const DRESS={denim:'#397090',marigold:'#db9a32',graphite:'#454955'};
function shade(hex,value) {
  const h=hex?.replace('#','');
  if(!h||h.length!==6)return hex||'#6c8390';
  const n=parseInt(h,16),c=(s)=>Math.max(0,Math.min(255,((n>>s)&255)+value)).toString(16).padStart(2,'0');
  return '#'+c(16)+c(8)+c(0);
}
function box(c,x,y,w,h,col){c.fillStyle=col;c.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));}
function path(c,points,fill){c.beginPath();c.moveTo(...points[0]);for(const point of points.slice(1))c.lineTo(...point);c.closePath();c.fillStyle=fill;c.fill();}
function line(c,x,y,ex,ey,col,w=1){c.strokeStyle=col;c.lineWidth=w;c.beginPath();c.moveTo(x,y);c.lineTo(ex,ey);c.stroke();}
function oval(c,x,y,rx,ry,fill){c.fillStyle=fill;c.beginPath();c.ellipse(x,y,rx,ry,0,0,2*Math.PI);c.fill();}
function limb(c,top,joint,tip,color,thickness) {
  line(c,...top,...joint,color,thickness);line(c,...joint,...tip,color,thickness*.84);
}
const playerLook={skin:'#bd8767',hair:'#342d35',shirt:DRESS.denim,pants:'#303d4a',hairStyle:'wave',accessory:'none',height:1.02,build:.97};
export function paintResident(c,a,state,player,selected){
  if(a.vehicleId||a.passengerOf||a.inServiceVehicle)return;
  const look=a.appearance||playerLook,apron=look.accessory==='apron',badge=a.role==='police';
  const tall=(look.height||1)*.91,broad=(look.build||1)*.94,skin=look.skin,shirt=player?(DRESS[a.outfit]||DRESS.denim):look.shirt,pants=look.pants,hair=look.hair;
  const time=state.elapsed||0,angle=a.angle??Math.PI/2,side=Math.cos(angle),back=Math.sin(angle)<-.47;
  const down=a.pose==='fallen'||a.hp<=0,kneel=a.pose==='treat',handcuffs=a.pose==='cuffed';
  const gait=a.moving&&!down&&!kneel?Math.sin(time*(player&&state.player.stamina<95?13:9)+(a.x+a.y)*.007):0;
  const profile=Math.abs(side)>.72,track=profile?1.1:2.65;
  c.save();c.translate(Math.round(a.x),Math.round(a.y));c.lineCap='round';
  oval(c,4.8,1.5,down?12:7.5,down?4:3.5,'#1a34474c');
  if(player||selected){
    c.strokeStyle=player?'#eff6e3a6':'#ffe5a7b3';c.lineWidth=1.15;c.beginPath();c.ellipse(0,1.1,player?8.5:8.2,3.75,0,0,Math.PI*2);c.stroke();
  }
  c.save();c.scale(broad,tall);
  if(down){c.translate(-8,0);c.rotate(1.36);c.scale(1,.87);}
  if(kneel){c.translate(0,1);c.scale(1,.76);}
  const bounce=Math.abs(gait)*.55,lean=gait*(profile?.65:.2);
  const torso=profile?3.6:4.75;
  for(const i of [-1,1]){
    const swing=gait*i;
    const lx=i*track+lean,legShade=i<0?shade(pants,-10):pants;
    const footX=lx+(profile?swing*3.9:side*swing*.8),fy=-.8-(profile?Math.max(0,-swing)*1.85:swing*1.8);
    limb(c,[lx,-13+bounce],[lx+(profile?swing*1.9:0),-6.7+bounce+Math.min(0,swing)], [footX,fy-1],legShade,3.1);
    line(c,footX-.5,fy,footX+(profile?Math.sign(side)*2.7:1.2),fy+.12,'#323338',2.35);
  }
  const shouldY=-22+bounce,waistY=-11+bounce,neckX=lean+side*.4;
  path(c,[[-torso*.65+lean,shouldY],[-torso+lean,shouldY+1.1],[-torso*.73,waistY],[torso*.72,waistY],[torso+lean,shouldY+1.4],[torso*.48+lean,shouldY]],shirt);
  path(c,[[1+lean,shouldY+.5],[torso+lean,shouldY+2],[torso*.75,waistY],[1,waistY]],shade(shirt,-16));
  box(c,-torso*.7,waistY,torso*1.4,1.3,shade(pants,-10));
  for(const i of [-1,1]){
    const ax=lean+i*torso,arm=gait*-i,fold=handcuffs?(-i*3):kneel?i*-3:0;
    const handX=ax+arm*(profile?3:.9)+fold,handY=shouldY+(kneel?7:11)+(a.pose==='talk'&&i===1?-2.8:0);
    limb(c,[ax,shouldY+1.7],[ax+i*.55+arm*.8,shouldY+6.5],[handX,handY],i<0?shade(skin,-8):skin,2);
    line(c,ax,shouldY+2,ax+i*.45+arm*.3,shouldY+5,i<0?shirt:shade(shirt,-13),2.7);
  }
  if(apron&&!back){
    path(c,[[-2.6,shouldY+4],[2.3,shouldY+4],[3.4,waistY+2],[-3.2,waistY+2]],'#d8c6a5');box(c,-1,shouldY+7,3,1,'#91765e');
  }else if(look.accessory==='vest'&&!back){
    for(const i of [-1,1])box(c,i*1.9,shouldY+1,1.3,8,'#dbb560');
    box(c,-3.6,shouldY+7,7.2,1,'#ede1a4');
  }else if(badge&&!back)box(c,-2.4,shouldY+3,1.5,2,'#f0d184');
  if(player&&!back){
    line(c,-2.1,shouldY+.6,0,shouldY+4,'#b4c3bc',.9);line(c,2,shouldY+.6,0,shouldY+4,'#bfd2d2',.9);
  }
  box(c,neckX-1.2,shouldY-2,2.4,3,shade(skin,-8));
  const hx=neckX+side*.4,hy=shouldY-4.4;
  oval(c,hx,hy,profile?2.5:2.8,3.5,skin);
  if(back)oval(c,hx,hy-.5,2.9,3.25,hair);
  else{
    path(c,[[hx-2.8,hy+.4],[hx-3,hy-1.8],[hx-1.7,hy-3.5],[hx+.6,hy-3.8],[hx+2.7,hy-2.2],[hx+2.5,hy-.9],[hx+.9,hy-1.65],[hx-1.5,hy-1.2]],hair);
    if(profile){box(c,hx+Math.sign(side)*2.2,hy+.1,1.2,1,shade(skin,7));box(c,hx-Math.sign(side)*2.5,hy-1,1.2,2,hair);}
    else{box(c,hx-1.8,hy+.1,1,.7,shade(skin,-44));box(c,hx+1.1,hy+.1,1,.7,shade(skin,-44));}
  }
  if(look.hairStyle==='bun')oval(c,hx-(profile?Math.sign(side)*2.2:1.9),hy-2.05,1.7,1.8,hair);
  if(look.hairStyle==='braid')line(c,hx-2,hy+.6,hx-3.5,hy+5.7,hair,1.7);
  if(look.hairStyle==='curls')for(let j=0;j<4;j++)oval(c,hx-2.2+j*1.4,hy-2.7-Math.sin(j),1.25,1.1,hair);
  if(look.hairStyle==='wave')path(c,[[hx-2.7,hy-1],[hx-2.7,hy-3.3],[hx-.4,hy-4.7],[hx+2.4,hy-3.1],[hx+1.6,hy-1.8]],hair);
  if(look.accessory==='cap'||badge){
    oval(c,hx,hy-2.9,3.1,1.6,badge?'#2d475b':shade(shirt,-26));
    box(c,hx-2.3+(profile?Math.sign(side)*1.8:0),hy-2.3,5.2,1,badge?'#293947':shade(shirt,-40));
  }
  if(look.accessory==='glasses'&&!back)line(c,hx-2.5,hy+.02,hx+2.5,hy+.02,'#3f4c51',1);
  if(player&&a.equipped){const dx=Math.cos(angle),dy=Math.sin(angle);line(c,dx*4,shouldY+7,dx*9,shouldY+7+dy*3,'#3c4248',1.6);}
  c.restore();
  if(selected&&!player){
    const name=a.name||'Resident';c.font='600 10px "Avenir Next", sans-serif';const w=c.measureText(name).width+9;
    box(c,-w/2,-31*tall-12,w,13,'#18212ad1');c.fillStyle='#fff6df';c.textAlign='center';c.fillText(name,0,-31*tall-2.5);
  }
  c.restore();
}
export function paintVehicle(c,v,state,selected,still=false) {
  const model=v.model,unit=v.service||(v.police?'police':null);
  const van=unit==='ambulance'||model==='van'||model===1,small=model===3;
  const w=unit==='ambulance'?14:van?13:small?11:12,l=unit==='ambulance'?29:van?26.5:small?21:24.5;
  const body=unit==='ambulance'?'#e7e5d4':unit==='police'?'#e6e9e6':v.color||'#547d90';
  const night=(state.time<355||state.time>1110),t=state.elapsed||0;
  c.save();c.translate(Math.round(v.x),Math.round(v.y));c.rotate((v.angle||0)+Math.PI/2);
  const outline=[[-w+2,-l+1],[-w+5,-l],[w-5,-l],[w-2,-l+1],[w,-l+6],[w,l-4],[w-3,l],[-w+3,l],[-w,l-4],[-w,-l+6]];
  c.save();c.translate(3,3);path(c,outline,'#172b3560');c.restore();
  if(night){
    const beam=c.createLinearGradient(0,-l-65,0,-l);beam.addColorStop(0,'#fbf4bd00');beam.addColorStop(1,'#fff3ac63');
    for(const i of [-1,1])path(c,[[w*.65*i-1,-l],[w*.65*i-11,-l-70],[w*.65*i+12,-l-70],[w*.65*i+2,-l]],beam);
  }
  for(const xx of [-w-.6,w-1])for(const yy of [-l*.58,l*.5])box(c,xx,yy,2.5,6,'#292e32');
  path(c,outline,'#354450');
  c.save();c.scale(.94,.97);path(c,outline,body);c.restore();
  const rim=shade(body,-22), hi=shade(body,21);
  line(c,-w+2,-l+5,-w+2,l-4,hi,1.1);line(c,w-2,-l+5,w-2,l-4,rim,1.7);
  // Shaped glass and roof seams distinguish the direction of travel at street scale.
  const top=van?-l*.71:-l*.46,bottom=van?l*.74:l*.43;
  path(c,[[-w+2,top],[w-2,top],[w-3,top+6],[-w+3,top+6]],'#3d5968');
  path(c,[[-w+3,top+1],[w-2,top],[w-4,top+2],[-w+2.5,top+4]],'#a1c8cc');
  path(c,[[-w+2,top+6],[-w+4,top+8],[-w+4,bottom],[-w+2,bottom+2]],'#547584');
  path(c,[[w-2,top+6],[w-4,top+8],[w-4,bottom],[w-2,bottom+2]],'#3d5360');
  box(c,-w+4,top+7,w*2-8,bottom-top-8,hi);
  if(!van)path(c,[[-w+3,bottom-1],[w-3,bottom-1],[w-2,bottom+4],[-w+2,bottom+4]],'#567584');
  for(const i of [-1,1]){
    box(c,i*(w+1)-1,top+4,3,2,rim);box(c,i*(w-5)-1,-l+1,4,2,night?'#fffbc2':'#e8e6c8');
    box(c,i*(w-4)-1,l-3,3.5,2,v.braking?'#ff7860':'#b14b46');
  }
  box(c,-w+4,l-1,(w-4)*2,1,'#677375');
  if(unit){
    const sick=unit==='ambulance';
    if(sick){for(const i of [-1,1])box(c,i*(w-1.5)-1,-l+7,2,l*2-10,'#de7361');box(c,-5,1,10,3,'#358fb0');box(c,-1.5,-2,3,10,'#358fb0');}
    else {
      box(c,-w+3,-l+3,w*2-6,Math.max(2,top+l-4),'#40546d');
      box(c,-2,bottom+6,4,2,'#d5ba87');
    }
    const glow=v.siren&&(still||Math.floor(t*5)%2===0);
    for(const i of [-1,1]){
      const lit=v.siren&&(still||((i<0)===glow)),color=i<0?'#278dff':'#ff5d52';
      box(c,i*4-3,top+9,6,3,lit?color:(i<0?'#42517d':'#925152'));
      if(lit){oval(c,i*11,top+10,14,8,i<0?'#3995ff37':'#ff756438');box(c,i*4-2,top+10,3,1,'#fffbe9');}
    }
  }else if(v.health<40){
    for(let j=0;j<3;j++){const a=(still?0:t*11+j*8)%28;oval(c,Math.sin(t*.8+j)*3,-l+2-a*.63,2+a*.11,1+a*.13,'#53646c76');}
  }
  if((Math.abs(v.speed||0)>32||v.siren)&&!still){
    const progress=(t*1.8+Math.abs(v.x)*.002)%1;
    oval(c,w*.58,l+3+progress*9,1.5+progress*2,1+progress,'#aab1a23c');
  }
  if(selected||state.player.vehicleId===v.id){
    c.strokeStyle=selected?'#ffc481aa':'#e9f1ea82';c.lineWidth=1.4;
    for(const i of [-1,1])for(const j of [-1,1]){
      const x=(w+2)*i,y=(l+2)*j; c.beginPath();c.moveTo(x-i*3,y);c.lineTo(x,y);c.lineTo(x,y-j*3);c.stroke();
    }
  }
  c.restore();
}
