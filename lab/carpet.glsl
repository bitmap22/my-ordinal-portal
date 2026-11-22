vec2 WU;vec3 CM,CG;float CS;
// the calm carpet: one woven tile (drawn once by the page into three masks: the deeper tone, the light tone, the accent),
// coloured by the block's fees: sapphire, teal, emerald, amber, flame, crimson, violet (field, deeper tone, light tone)
const vec3 PF[7]=vec3[7](vec3(.106,.239,.478),vec3(.039,.298,.333),vec3(.086,.333,.196),vec3(.612,.408,.102),vec3(.612,.200,.059),vec3(.400,.047,.102),vec3(.231,.098,.404));
const vec3 PD[7]=vec3[7](vec3(.047,.118,.275),vec3(.016,.153,.176),vec3(.035,.176,.098),vec3(.380,.231,.043),vec3(.365,.094,.024),vec3(.208,.020,.051),vec3(.114,.039,.224));
const vec3 PL[7]=vec3[7](vec3(.698,.827,.949),vec3(.561,.851,.816),vec3(.682,.851,.635),vec3(1.,.914,.706),vec3(1.,.776,.553),vec3(.949,.647,.671),vec3(.808,.714,1.));
vec3 carpet(int k){
 vec3 L=mix(PL[k],vec3(1.,.957,.863),uLitM),A=mix(vec3(.863,.694,.333),uAccC,uAccM);
 vec3 c=mix(PF[k],PD[k],CM.r);c=mix(c,A,CM.b);c=mix(c,L,CM.g);
 return c*(CS+CG);}
// (in main, once for the pixel: the masks, the pile, and the hall's light on it)
void carpetLook(){
 bool rm=uRm>.5;vec2 u=rm?WU:WU*.42;
 CM=texture(uCpt,vec2(u.x/uTile.x+.5,u.y/uTile.y)).rgb;CG=vec3(0.);
 float px=max(fwidth(u.x),fwidth(u.y));vec2 w=vec2(u.x,mod(u.y,96.));   // (the grain keeps to a short stretch of floor, so it stays fine however far the halls run)
 float g1=mix(ns(w*210.),.5,clamp(px*150.,0.,1.)),g2=mix(ns(w*85.+7.),.5,clamp(px*60.,0.,1.)),g3=mix(ns(w*26.+3.),.5,clamp(px*18.,0.,1.));
 CS=(.875+.10*g1+.10*g2+.05*g3)*(.925+.07*ns(u*.7+3.)+.08*ns(vec2(w.x*2.1,w.y*.3)+5.));   // the pile: fine tufts close up, smooth far off; soft clouds in the wool, and the long strokes of a brushed nap
 if(rm){float ax=abs(WU.x);vec2 dv=WU-uFO;float gz=1.-1.62/sqrt(dot(dv,dv)+2.62),sh=mix(.5,1.,smoothstep(3.45,1.5,ax));
  CS*=sh*(1.+.35*gz*gz*gz);   // the tall shelves shade its edges; it catches the light where you look along it, as velvet does
  CS*=1.+.8*exp(-max(3.33-ax,0.)*6.);   // (the lights along the shelves' feet wash over it)
  if(uHall.z>.5){vec3 nc=mix(vec3(1.),uNeonC/max(max(uNeonC.r,uNeonC.g),max(uNeonC.b,.01)),.3);   // the hall's neon falls on it: a soft band under each rib, a pool at each doorway
   float rb=.5+.5*cos((WU.y-uHall.x+1.8)*2.41661),dd=min(abs(WU.y-uHall.x),abs(WU.y-uHall.x+uHall.y));
   CG=nc*(.22*rb*rb*sh+.9*exp(-dd*.85)*smoothstep(2.9,.6,ax));}}
}
