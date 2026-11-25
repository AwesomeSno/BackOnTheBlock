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
export function paintResident(c,a,state,player,selected,still=false){
  if(a.vehicleId||a.passengerOf||a.inServiceVehicle)return;
  const look=a.appearance||playerLook,apron=look.accessory==='apron',badge=a.role==='police';
  const tall=(look.height||1)*.91,broad=(look.build||1)*.94,skin=look.skin,shirt=player?(DRESS[a.outfit]||DRESS.denim):look.shirt,pants=look.pants,hair=look.hair;
  const time=state.elapsed||0, angle=a.angle??Math.PI/2, side=Math.cos(angle), depth=Math.sin(angle);
  const back=depth<-.47,profile=Math.abs(side)>.72,track=profile?1.1:2.65;
  const injury=a.injury,injured=Boolean(injury&&injury.until>time),critical=injured&&injury.severity==='critical';
  const down=a.pose==='fallen'||a.hp<=0||critical||a.knockdownUntil>time;
  const kneel=a.pose==='treat',handcuffs=a.pose==='cuffed';
  const pace=Number.isFinite(a.motion?.pace)?a.motion.pace:(a.moving?74:0);
  const travel=Number.isFinite(a.motion?.distance)?a.motion.distance:(a.x*.72+a.y*.69);
  const phase=travel*Math.PI*2/(54*tall),run=Math.max(0,Math.min(1,(pace-85)/94));
  const stepping=pace>2&&!down&&!kneel;
  const amplitude=stepping?Math.min(1,pace/38):0;
  const gait=Math.sin(phase)*amplitude;
  const posturePhase=(a.name||'Alex').length*.79+time*1.7;
  const idle=stepping||down||still?0:Math.sin(posturePhase);
  const active=a.action&&time>=a.action.at&&time<a.action.at+a.action.duration?a.action:null;
  const actionPhase=active?(time-active.at)/Math.max(.001,active.duration):0;
  const strike=active?.kind==='punch'?Math.sin(actionPhase*Math.PI)**.7:0;
  const kick=active?.kind==='fire'?1-actionPhase:0;
  const load=active?.kind==='reload'?Math.sin(actionPhase*Math.PI):0;
  const age=Number.isFinite(a.hitAt)?time-a.hitAt:Infinity;
  const recoil=age>=0&&age<.26?Math.sin(Math.PI*age/.26)*1.65:0;
  const downSince=injury?.downSince??a.hitAt;
  let fall=down ? (Number.isFinite(downSince)?Math.max(0,Math.min(1,(time-downSince)/.22)):1) : 0;
  if(!down&&a.knockdownUntil>0&&time>=a.knockdownUntil&&time<a.knockdownUntil+.48)fall=1-(time-a.knockdownUntil)/.48;
  if(still&&fall)fall=down?1:0;
  const direction=Math.cos(a.hitAngle??angle)>=0?1:-1;
  c.save();c.translate(Math.round(a.x),Math.round(a.y));c.lineCap='round';
  oval(c,4.8+direction*fall*2,1.5,7.5+fall*5,3.5+fall*.6,'#1a34474c');
  if(player||selected){
    c.strokeStyle=player?'#eff6e3a6':'#ffe5a7b3';c.lineWidth=1.15;c.beginPath();c.ellipse(0,1.1,player?8.5:8.2,3.75,0,0,Math.PI*2);c.stroke();
  }
  c.save();c.scale(broad,tall);
  if(fall){c.translate(-direction*7*fall,fall);c.rotate(direction*1.42*fall);c.scale(1,1-.12*fall);}
  if(kneel){c.translate(0,1);c.scale(1,.72);}
  const limp=injured&&!down&&stepping ? Math.max(0,Math.sin(phase))*(injury.severity==='serious'?1.5:.68):0;
  const bounce=amplitude*Math.abs(Math.cos(phase))*(.56+run*.8)+limp;
  const lean=gait*(profile?.41:.62)+side*(run*1.75+strike*1.5-kick*.85)+idle*.18+Math.cos(a.hitAngle??angle)*recoil;
  const torso=profile?3.5:4.6;
  for(const i of [-1,1]){
    const swing=gait*i,swingLift=stepping?Math.max(0,Math.cos(phase)*i)*amplitude:0;
    const lx=i*track+lean*.3,legShade=i<0?shade(pants,-13):pants;
    const footX=i*track+side*swing*(4+run*2.45)+(down?i*.7:0);
    const fy=-.85+depth*swing*(2.7+run)-swingLift*(1.15+run*1.65);
    const kneeX=lx+side*(swing*1.65+swingLift*(.5+run*1.05));
    const kneeY=-6.6+bounce*.55-swingLift*(1.5+run*.6);
    limb(c,[lx,-13+bounce],[kneeX,kneeY],[footX,fy-1],legShade,3.1);
    line(c,footX-.45,fy,footX+(profile?Math.sign(side)*2.7:1.18),fy+.12,'#323338',2.35);
  }
  const shouldY=-22+bounce-idle*.32+limp*.45,waistY=-11+bounce,neckX=lean+side*.4;
  path(c,[[-torso*.65+lean,shouldY],[-torso+lean,shouldY+1.1],[-torso*.73,waistY],[torso*.72,waistY],[torso+lean,shouldY+1.4],[torso*.48+lean,shouldY]],shirt);
  path(c,[[1+lean,shouldY+.5],[torso+lean,shouldY+2],[torso*.75,waistY],[1,waistY]],shade(shirt,-16));
  box(c,-torso*.7,waistY,torso*1.4,1.3,shade(pants,-10));
  let rightHand=null;
  for(const i of [-1,1]){
    const ax=lean+i*torso,arm=-i*gait;
    let handX=ax+side*arm*(3+run*1.7),handY=shouldY+10.6+depth*arm*2-run*1.5;
    let elbowX=ax+i*.65+arm*side,elbowY=shouldY+6.3;
    if(handcuffs){handX=i*1.2;handY=waistY-.7;elbowX=ax+i*1.3;}
    else if(kneel){handX=ax+side*(3+i)+i*Math.sin(time*3.4)*.7;handY=shouldY+10+Math.sin(time*3.4+i)*.9;}
    else if(active?.kind==='punch'&&i===1){
      handX=ax+side*(3+strike*10);handY=shouldY+7+depth*(2+6*strike)-strike*4;
      elbowX=(ax+handX)*.5+i*(1-strike)*2;elbowY=shouldY+4;
    }else if((player&&a.equipped)||active?.kind==='fire'||active?.kind==='reload'){
      handX=side*(5+(i===1?1.5:0)-kick*2.4-load*3)+i*.5;
      handY=shouldY+5+depth*4+load*(i===1?1.5:3.8)-kick*.8;
      elbowX=ax+i*1.6;elbowY=shouldY+6;
    }else if(a.pose==='talk'&&i===1){handX+=i*(1.3+idle);handY-=3.3+idle*1.4;}
    else if(injured&&i===-1){handX=lean+1.3;handY=shouldY+7.3;}
    limb(c,[ax,shouldY+1.7],[elbowX,elbowY],[handX,handY],i<0?shade(skin,-8):skin,2);
    line(c,ax,shouldY+2,ax+(elbowX-ax)*.52,shouldY+4.7,i<0?shirt:shade(shirt,-13),2.7);
    if(i===1)rightHand={x:handX,y:handY};
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
  const glance=stepping||down||kneel?0:idle*.29;
  const hx=neckX+side*.4+glance,hy=shouldY-4.4+kick*.34+(injured ? .38 : 0);
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
  if(player&&a.equipped&&rightHand){
    const tipX=rightHand.x+side*4.8,tipY=rightHand.y+depth*3.8-load*1.7;
    line(c,rightHand.x,rightHand.y,tipX,tipY,'#343e46',1.6);
    if(kick>.78&&!still)oval(c,tipX+side,tipY+depth,1.5,.9,'#ffe3a0');
  }
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
  const health=v.health??100,damage=v.damage||{};
  const front=Math.min(1,(damage.front??Math.max(0,90-health)*.7)/75),rear=Math.min(1,(damage.rear||0)/72);
  const left=Math.min(1,(damage.left||0)/70),right=Math.min(1,(damage.right||0)/70);
  const age=v.lastCollision ? t-v.lastCollision.at : Infinity;
  if(!still&&age>=0&&age<.22){
    const force=Math.min(1,(v.lastCollision.speed||0)/140),shake=Math.sin(age*48)*(1-age/.22)*force;
    c.translate(shake*(right-left)*1.2,shake*(front>=rear?1:-1)*1.25);
  }
  const nose=-l+front*2.9,tail=l-rear*2.5;
  const outline=[[-w+2,nose+1],[-w+5,nose-front*.6],[1,nose+front*1.4],[w-5,nose],[w-2,nose+1],[w,-l+6],[w-right*2,2],[w,tail-4],[w-3,tail],[1,tail-rear],[-w+3,tail],[-w,tail-4],[-w+left*2,0],[-w,-l+6]];
  c.save();c.translate(3,3);path(c,outline,'#172b3560');c.restore();
  if(night){
    const beam=c.createLinearGradient(0,-l-65,0,-l);beam.addColorStop(0,'#fbf4bd00');beam.addColorStop(1,'#fff3ac63');
    for(const i of [-1,1])if(!(front>.7&&i===1))path(c,[[w*.65*i-1,-l],[w*.65*i-11,-l-70],[w*.65*i+12,-l-70],[w*.65*i+2,-l]],beam);
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
    if((i<0?left:right)<.75)box(c,i*(w+1)-1,top+4,3,2,rim);
    const broken=front>.7&&i===1;
    box(c,i*(w-5)-1,nose+1,4,2,broken?'#484945':night?'#fffbc2':'#e8e6c8');
    const lampX=i*(w-4)-.5;
    box(c,lampX,tail-3,3.4,2,v.braking?'#ff8962':'#b14b46');
    if(v.braking)oval(c,lampX+1,tail-2,4.7,2.4,'#ff55354b');
  }
  box(c,-w+4,tail-1,(w-4)*2,1,'#677375');
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
  }
  if(front>.14){
    const y=nose+2,depth=front*4.8;
    path(c,[[-w+4,y],[1,y+depth],[w-5,y],[4,y+depth+2],[-3,y+depth]],shade(body,-36));
    line(c,-w+5,y+2,-2,y+depth+1,shade(body,30),.85);
    if(front>.48 || health<48){
      const hubX=w*.3,hubY=top+2;
      for(const [dx,dy] of [[-5,-1],[-3,3],[2,2],[4,-1],[.8,3.5]])line(c,hubX,hubY,hubX+dx,hubY+dy,'#d8dfcfbf',.65);
      line(c,hubX-3,hubY+3,hubX-5,hubY+3.6,'#d8dfcf9e',.6);
    }
  }
  if(rear>.18){
    line(c,-w+4,tail-4,1,tail-3-rear*3,'#6d7574',1.5);
    line(c,1,tail-3-rear*3,w-3,tail-5,shade(body,24),.8);
  }
  for(const [sign,amount] of [[-1,left],[1,right]]){
    if(amount<.13)continue;
    const x=(w-2)*sign;
    line(c,x,-5,x-sign*amount*2,6,shade(body,-46),1.5);
    line(c,x-sign,1,x-sign*(1+amount),6,shade(body,31),.9);
    if(amount>.5)line(c,x,5,x-sign*2.4,9,'#b1a392',.8);
  }
  if(health<58){
    const heavy=health<27;
    for(let i=0;i<(heavy?5:3);i++){
      const progress=(i*.31+(still?.2:t*(heavy?.67:.45)))%1;
      const dx=w*.35+Math.sin(t*.8+i)*progress*4,dy=nose+5-progress*(heavy?30:18);
      const alpha=(1-progress)*(heavy?.48:.28);
      c.globalAlpha=alpha;
      oval(c,dx,dy,1.6+progress*(heavy?7:4),1.7+progress*(heavy?7:4),heavy?'#3a4348':'#c8d0cb');
    }
    c.globalAlpha=1;
  }
  if(v.braking&&Math.abs(v.speed||0)>67&&!still){
    for(const i of [-1,1]){
      const f=(t*2.7+(i+1)*.15)%1,xx=i*(w-2)+i*f*1.5;
      c.globalAlpha=(1-f)*.32;oval(c,xx,tail+4+f*11,2+f*3,1.5+f*2,'#c3c4bb');
    }
    c.globalAlpha=1;
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
