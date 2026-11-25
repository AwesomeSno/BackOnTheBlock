const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
// Solid car body is a capsule: a short wheelbase segment with rounded bumpers.
function halfAxle(car){return car.model==='van'||car.service?14:12;}
export function axle(car){const a=car.angle||0,l=halfAxle(car);return [Math.cos(a)*l,Math.sin(a)*l];}
function pointToAxle(x,y,car){
  const [dx,dy]=axle(car),t=clamp(((x-car.x)*dx+(y-car.y)*dy)/(dx*dx+dy*dy),-1,1);
  return Math.hypot(x-car.x-t*dx,y-car.y-t*dy);
}
export function hitsCar(x,y,car,radius=7){return Math.abs(x-car.x)<36&&Math.abs(y-car.y)<36&&pointToAxle(x,y,car)<10+radius;}
export function touchesCar(a,b){
  if(Math.abs(a.x-b.x)>52||Math.abs(a.y-b.y)>52)return false;
  const [ax,ay]=axle(a),[bx,by]=axle(b);
  return pointToAxle(a.x+ax,a.y+ay,b)<20||pointToAxle(a.x-ax,a.y-ay,b)<20||
    pointToAxle(b.x+bx,b.y+by,a)<20||pointToAxle(b.x-bx,b.y-by,a)<20||pointToAxle(a.x,a.y,b)<20;
}
