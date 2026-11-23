import {generateWorld,legacyWorld,distance} from './world.js';

const names=new Map(Object.entries({
  Nikhil:'Miles',Kavya:'Elena',Leela:'June',Rafi:'Samir',Sana:'Grace',Dev:'Dean',Varun:'Victor',
  Meera:'Isabel',Asha:'Alma',Imran:'Tomas',Balan:'Reed',Roy:'Santos',Tara:'Emilia',Manu:'Oscar',
  Priya:'Leila',Joseph:'Felix',Anu:'Rosa',Gopi:'Theo',Fathima:'Asha',Vinod:'Darren',Neha:'Cass',
  Suraj:'Hugo',Latha:'Pearl',Arun:'Leon'
}));
const oldName=new RegExp('\\b('+[...names.keys()].join('|')+')\\b','g');
function localize(text) {
  return typeof text==='string'?text.replaceAll('₹','$').replace(oldName,token=>names.get(token)):text;
}
export function migrateIslandSave(original) {
  if(typeof original.seed!=='string'&&typeof original.seed!=='number')return original;
  const save=JSON.parse(JSON.stringify(original));
  const previous=legacyWorld(String(save.seed).slice(0,120));
  const island=generateWorld();
  const mapping=new Map(previous.buildings.map(old=>{
    const options=island.buildings.filter(b=>b.type===old.type);
    const chosen=options.find(b=>b.id===old.id)||options.sort((a,b)=>distance(a,old)-distance(b,old))[0];
    return [old.id,chosen?.id??null];
  }));
  function translatePlace(item) {
    if(!item||typeof item!=='object')return;
    for(const key of ['interior','targetId','fromId','toId','homeId','workId'])if(mapping.has(item[key]))item[key]=mapping.get(item[key]);
  }
  for(const item of [save.player,save.player?.lastSeen,save.job,...(Array.isArray(save.events)?save.events:[]),...(Array.isArray(save.npcs)?save.npcs:[]),...(Array.isArray(save.cases)?save.cases:[])])translatePlace(item);
  if(save.worldChanges&&typeof save.worldChanges==='object') {
    const changes={};
    for(const [key,value] of Object.entries(save.worldChanges)) {
      const m=/^(b\d+)-stash$/.exec(key);
      if(m&&mapping.get(m[1]))changes[mapping.get(m[1])+'-stash']=value;
      if(key==='homeSupplies')changes[key]=value;
    }
    save.worldChanges=changes;
  }
  for(const item of [...(Array.isArray(save.journal)?save.journal:[]),...(Array.isArray(save.npcs)?save.npcs:[]).flatMap(n=>Array.isArray(n?.memories)?n.memories:[])])if(item&&typeof item==='object')item.text=localize(item.text);
  save.version=2;
  return save;
}
