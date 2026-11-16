/* Картинки зданий и воинов. Рисуются кодом, поэтому ничего не загружают и не весят. */
(function(){
'use strict';
const TAU=Math.PI*2;
const FB="'Alegreya Sans',system-ui,sans-serif";
const FR="'Noto Sans Runic','Segoe UI Historic','Segoe UI Symbol',serif";
const RM=typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const MINE_COL='#4a7ec0',FOE_COL='#a3402f';
function hexRgb(h){h=h.replace('#','');return [parseInt(h.substr(0,2),16),parseInt(h.substr(2,2),16),parseInt(h.substr(4,2),16)];}
function shade(h,a){const c=hexRgb(h).map(v=>Math.max(0,Math.min(255,Math.round(a>=0?v+(255-v)*a:v*(1+a)))));return 'rgb('+c.join(',')+')';}
function srand(seed){let s=seed>>>0;return function(){s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
function hashStr(s){let h=7;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return h;}
/* ----- примитивы ----- */
function pine(c,x,y,s,snow){
  c.fillStyle='rgba(0,0,0,.22)';c.beginPath();c.ellipse(x,y+1,6*s,2*s,0,0,TAU);c.fill();
  c.fillStyle='#2a1d14';c.fillRect(x-1.5*s,y-4*s,3*s,5*s);
  const cols=['#1b3a2e','#21493a','#2a5a47'];
  for(let i=0;i<3;i++){
    const w=(11-i*2.5)*s,yy=y-4*s-i*7*s;
    c.fillStyle=cols[i];c.beginPath();c.moveTo(x-w,yy);c.lineTo(x,yy-11*s);c.lineTo(x+w,yy);c.closePath();c.fill();
    if(snow){c.fillStyle='rgba(235,242,245,.85)';c.beginPath();c.moveTo(x-w*.45,yy-5*s);c.lineTo(x,yy-11*s);c.lineTo(x+w*.45,yy-5*s);c.closePath();c.fill();}
  }
}
function rock(c,x,y,s,col){
  col=col||'#7d878d';
  c.fillStyle='rgba(0,0,0,.25)';c.beginPath();c.ellipse(x,y+1,7*s,2.4*s,0,0,TAU);c.fill();
  c.fillStyle=col;c.beginPath();c.moveTo(x-7*s,y);c.lineTo(x-5*s,y-6*s);c.lineTo(x-1*s,y-9*s);c.lineTo(x+4*s,y-7*s);c.lineTo(x+7*s,y-1*s);c.lineTo(x+6*s,y);c.closePath();c.fill();
  c.fillStyle=shade(col,.25);c.beginPath();c.moveTo(x-5*s,y-6*s);c.lineTo(x-1*s,y-9*s);c.lineTo(x+1*s,y-6*s);c.lineTo(x-3*s,y-4*s);c.closePath();c.fill();
}
function mountain(c,x,y,s){
  c.fillStyle='#4e5961';c.beginPath();c.moveTo(x-18*s,y);c.lineTo(x,y-30*s);c.lineTo(x+18*s,y);c.closePath();c.fill();
  c.fillStyle='#3d474e';c.beginPath();c.moveTo(x,y-30*s);c.lineTo(x+18*s,y);c.lineTo(x+4*s,y);c.closePath();c.fill();
  c.fillStyle='rgba(235,242,246,.9)';c.beginPath();c.moveTo(x,y-30*s);c.lineTo(x-6*s,y-19*s);c.lineTo(x-2*s,y-21*s);c.lineTo(x+1*s,y-17*s);c.lineTo(x+5*s,y-21*s);c.closePath();c.fill();
}
function smoke(c,x,y,T,k){
  for(let i=0;i<3;i++){
    const p=((T*0.00035*(k||1))+i/3)%1;
    c.fillStyle='rgba(205,210,214,'+((1-p)*0.28).toFixed(3)+')';
    c.beginPath();c.arc(x+p*9+Math.sin(p*6+i)*2,y-p*30,2.5+p*6,0,TAU);c.fill();
  }
}
function roof(c,x,y,w,hh,col,over,dragon){
  const ow=w/2+over,sl=hh*0.8;
  c.fillStyle=col;c.beginPath();c.moveTo(x-ow,y+4);c.lineTo(x-ow+sl,y-hh);c.lineTo(x+ow-sl,y-hh);c.lineTo(x+ow,y+4);c.closePath();c.fill();
  c.strokeStyle=shade(col,-.4);c.lineWidth=1;
  for(let i=1;i<4;i++){
    const yy=y-hh+(hh+4)*i/4,u=(yy-(y-hh))/(hh+4),l=x-ow+sl*(1-u),r=x+ow-sl*(1-u);
    c.beginPath();c.moveTo(l,yy);c.lineTo(r,yy);c.stroke();
  }
  c.fillStyle=shade(col,.22);c.fillRect(x-ow+sl,y-hh,2*(ow-sl),2.5);
  c.fillStyle='rgba(0,0,0,.18)';c.fillRect(x-ow,y+1,2*ow,3);
  if(dragon){
    c.strokeStyle='#c9a24f';c.lineWidth=2;c.lineCap='round';
    const xl=x-ow+sl,xr=x+ow-sl;
    c.beginPath();c.moveTo(xl,y-hh);c.quadraticCurveTo(xl-7,y-hh-3,xl-5,y-hh-11);c.stroke();
    c.beginPath();c.moveTo(xr,y-hh);c.quadraticCurveTo(xr+7,y-hh-3,xr+5,y-hh-11);c.stroke();
    c.lineCap='butt';
  }
}
function hut(c,x,y,o,T){
  const w=o.w,h=o.h,rh=o.rh,wall=o.wall||'#6b4a30',rc=o.roof||'#3b3f45',ov=o.over||5;
  c.fillStyle='rgba(0,0,0,.28)';c.beginPath();c.ellipse(x,y+1,w*0.62,5,0,0,TAU);c.fill();
  c.fillStyle=wall;c.fillRect(x-w/2,y-h,w,h);
  c.strokeStyle=shade(wall,-.35);c.lineWidth=1;
  for(let i=x-w/2+5;i<x+w/2;i+=6){c.beginPath();c.moveTo(i,y-h);c.lineTo(i,y);c.stroke();}
  c.fillStyle=shade(wall,-.3);c.fillRect(x-w/2,y-4,w,4);
  const dw=o.dw||10,dh=o.dh||Math.min(h-4,16);
  c.fillStyle='#1a120c';c.beginPath();c.moveTo(x-dw/2,y);c.lineTo(x-dw/2,y-dh+4);c.quadraticCurveTo(x,y-dh-3,x+dw/2,y-dh+4);c.lineTo(x+dw/2,y);c.closePath();c.fill();
  if(o.glow){const f=0.75+0.25*Math.sin(T*0.006+x);c.fillStyle='rgba(240,180,90,'+(0.55*f).toFixed(2)+')';c.fillRect(x-dw/2+1.5,y-dh+5,dw-3,dh-6);}
  if(o.win){
    const f=0.7+0.3*Math.sin(T*0.005+x*0.3);
    [-0.32,0.32].forEach(k=>{const wx=x+w*k;c.fillStyle='#120d08';c.fillRect(wx-3,y-h*0.7,6,6);c.fillStyle='rgba(240,190,100,'+(0.8*f).toFixed(2)+')';c.fillRect(wx-2,y-h*0.7+1,4,4);});
  }
  roof(c,x,y-h,w,rh,rc,ov,o.dragon);
  if(o.chimney){c.fillStyle='#55504a';c.fillRect(x+w*0.25,y-h-rh-2,6,10);smoke(c,x+w*0.25+3,y-h-rh-2,T,1);}
}
function person(c,x,y,col,T,ph,carry,face){
  c.save();c.translate(x,y);c.scale(face||1,1);
  c.fillStyle='rgba(0,0,0,.25)';c.beginPath();c.ellipse(0,0,4,1.6,0,0,TAU);c.fill();
  const st=Math.sin(T*0.014+ph)*2;
  c.strokeStyle='#2a2018';c.lineWidth=1.6;c.beginPath();c.moveTo(-1,-4);c.lineTo(-1+st*0.5,0);c.moveTo(1,-4);c.lineTo(1-st*0.5,0);c.stroke();
  c.fillStyle=col;c.fillRect(-2.6,-10,5.2,6.5);
  c.fillStyle='#e0b896';c.beginPath();c.arc(0,-12.2,2.5,0,TAU);c.fill();
  c.fillStyle='#4a3524';c.beginPath();c.arc(0,-13,2.7,Math.PI,TAU);c.fill();
  if(carry){c.fillStyle=carry;c.fillRect(-3,-17,6,4.2);c.strokeStyle='rgba(0,0,0,.4)';c.lineWidth=1;c.strokeRect(-3,-17,6,4.2);}
  c.restore();
}
function soldier(c,x,y,type,s,T,face,col,mode,ph,tier){
  tier=tier||1;
  c.save();c.translate(x,y);c.scale(face*s,s);
  const bob=mode==='walk'?-Math.abs(Math.sin(T*0.012+ph))*1.8:(mode==='idle'?Math.sin(T*0.003+ph)*0.6:0);
  c.fillStyle='rgba(0,0,0,.3)';c.beginPath();c.ellipse(0,0,type==='cav'?9:5,2,0,0,TAU);c.fill();
  const sw=mode==='fight'?Math.sin(T*0.02+ph)*0.7:0;
  const lg=Math.sin(T*0.014+ph)*(mode==='walk'?2.5:0.5);
  if(tier>=3){c.fillStyle='#8a2f2f';c.beginPath();
    if(type==='cav'){c.moveTo(-2,-19+bob*.5);c.lineTo(-9,-8);c.lineTo(-4,-9);c.lineTo(1,-19+bob*.5);}
    else{c.moveTo(-3,-12+bob);c.lineTo(-7,-3);c.lineTo(-1.5,-4);c.lineTo(0,-12+bob);}
    c.closePath();c.fill();}
  if(type==='cav'){
    c.strokeStyle='#3a281c';c.lineWidth=1.8;c.beginPath();
    c.moveTo(-5,-7);c.lineTo(-5+lg,0);c.moveTo(-2,-7);c.lineTo(-2-lg,0);c.moveTo(4,-7);c.lineTo(4+lg,0);c.moveTo(7,-7);c.lineTo(7-lg,0);c.stroke();
    c.fillStyle='#7a5a3a';c.beginPath();c.ellipse(1,-9+bob*.5,8,4,0,0,TAU);c.fill();
    c.beginPath();c.moveTo(7,-11);c.lineTo(11,-16+bob*.5);c.lineTo(13,-14);c.lineTo(9,-8);c.closePath();c.fill();
    c.fillStyle=col;c.fillRect(-2,-19+bob*.5,5,8);
    c.fillStyle='#e0b896';c.beginPath();c.arc(0.5,-21+bob*.5,2.4,0,TAU);c.fill();
    c.fillStyle='#8a9399';c.beginPath();c.arc(0.5,-21.6+bob*.5,2.6,Math.PI,TAU);c.fill();
    c.strokeStyle='#cfd3d6';c.lineWidth=1.2;c.beginPath();c.moveTo(3,-15);c.lineTo(13+sw*3,-24+sw*4);c.stroke();
  }else{
    c.strokeStyle='#2a2018';c.lineWidth=1.8;c.beginPath();c.moveTo(-1.2,-5);c.lineTo(-1.2+lg*0.5,0);c.moveTo(1.2,-5);c.lineTo(1.2-lg*0.5,0);c.stroke();
    c.fillStyle=col;c.fillRect(-3,-12+bob,6,8);
    c.fillStyle='#e0b896';c.beginPath();c.arc(0,-14.5+bob,2.6,0,TAU);c.fill();
    c.fillStyle=type==='archer'?'#4a5a3a':'#8a9399';c.beginPath();c.arc(0,-15+bob,2.9,Math.PI,TAU);c.fill();
    if(type==='spear'){
      c.fillStyle=shade('#8a3b30',-.1);c.beginPath();c.arc(-3,-8+bob,3.6,0,TAU);c.fill();
      c.fillStyle='#c9a24f';c.beginPath();c.arc(-3,-8+bob,1,0,TAU);c.fill();
      c.save();c.translate(3,-8+bob);c.rotate(-0.15+sw);
      c.strokeStyle='#6b4a30';c.lineWidth=1.3;c.beginPath();c.moveTo(0,6);c.lineTo(0,-20);c.stroke();
      c.fillStyle='#cfd3d6';c.beginPath();c.moveTo(-1.6,-20);c.lineTo(0,-25);c.lineTo(1.6,-20);c.fill();
      c.restore();
    }else{
      c.strokeStyle='#6b4a30';c.lineWidth=1.3;c.beginPath();c.arc(1,-8+bob,7,-1.1+sw*0.3,1.1+sw*0.3);c.stroke();
      c.strokeStyle='#d8d2c0';c.lineWidth=0.6;c.beginPath();c.moveTo(1+7*Math.cos(-1.1),-8+bob+7*Math.sin(-1.1));c.lineTo(1+7*Math.cos(1.1),-8+bob+7*Math.sin(1.1));c.stroke();
    }
  }
  if(tier>=2){
    if(type==='cav'){
      c.fillStyle='rgba(180,190,198,.55)';c.fillRect(-2,-19+bob*.5,5,8);
      c.fillStyle='#b9c2c8';c.beginPath();c.arc(0.5,-21.6+bob*.5,2.7,Math.PI,TAU);c.fill();
      c.fillStyle=tier>=3?'#c9a24f':'#7c8a93';c.fillRect(-7,-10+bob*.5,12,1.6);
      if(tier>=3){c.fillStyle='#c9a24f';c.fillRect(-0.3,-26.5+bob*.5,1.6,3);}
    }else{
      c.fillStyle='rgba(180,190,198,.6)';c.fillRect(-3,-12+bob,6,8);
      c.fillStyle='rgba(60,70,78,.55)';for(let r=0;r<3;r++)c.fillRect(-3,-11+bob+r*2.6,6,.5);
      c.fillStyle='#c4ccd1';c.beginPath();c.arc(0,-15+bob,2.9,Math.PI,TAU);c.fill();
      c.fillStyle='#8a949b';c.fillRect(-.5,-15+bob,1,2.6);
      if(tier>=3){c.fillStyle='#c9a24f';c.fillRect(-3,-12.4+bob,6,.9);c.beginPath();c.moveTo(-.9,-17.6+bob);c.lineTo(0,-21+bob);c.lineTo(.9,-17.6+bob);c.fill();}
    }
  }
  c.restore();
}

/* ----- здания ----- */
const SLOT={
  hall:{x:200,y:222,w:136,h:100},oracle:{x:337,y:174,w:92,h:84},vault:{x:66,y:178,w:84,h:88},
  ironmine:{x:54,y:296,w:100,h:70},silvermine:{x:348,y:290,w:100,h:70},
  barracks:{x:120,y:396,w:128,h:92},storehouse:{x:292,y:384,w:96,h:84},
  farm:{x:82,y:494,w:136,h:60},sawmill:{x:216,y:490,w:92,h:68},quarry:{x:334,y:492,w:96,h:62}
};
const DRAW={};
function field(c,fx,fy,w,h,T,seed){
  c.fillStyle='#4b3a28';c.beginPath();c.moveTo(fx,fy);c.lineTo(fx+w,fy);c.lineTo(fx+w+4,fy+h);c.lineTo(fx-4,fy+h);c.closePath();c.fill();
  c.strokeStyle='#d0b95e';c.lineWidth=1.2;
  for(let r=0;r<4;r++){const yy=fy+6+r*(h-8)/3;for(let k=0;k<5;k++){const xx=fx+3+k*(w-4)/4,sw=Math.sin(T*0.002+k+seed)*1.2;c.beginPath();c.moveTo(xx,yy);c.lineTo(xx+sw,yy-6);c.stroke();}}
}
DRAW.hall=(c,x,y,L,T)=>{
  const s=1+Math.min(L,10)*0.03;
  if(L>=6)hut(c,x-66*s,y-6,{w:42,h:20,rh:12,wall:'#5c4029',roof:'#343a40',dw:8,over:3},T);
  hut(c,x,y,{w:96*s,h:34*s,rh:26*s,wall:'#6b4a30',roof:'#3d4248',dw:14,dh:22,glow:true,win:true,over:7,chimney:true,dragon:true},T);
  const n=Math.min(6,1+Math.floor(L/2)),cols=['#9b3b30','#c9a24f','#3a5b7a'];
  for(let i=0;i<n;i++){
    const px=x-32*s+(n>1?i*64*s/(n-1):32*s);if(Math.abs(px-x)<11)continue;
    c.fillStyle=cols[i%3];c.beginPath();c.arc(px,y-22*s,4,0,TAU);c.fill();
    c.fillStyle='#e6dcc0';c.beginPath();c.arc(px,y-22*s,1.2,0,TAU);c.fill();
  }
  if(L>=3){
    const bx=x+60*s;c.strokeStyle='#4a3524';c.lineWidth=2;c.beginPath();c.moveTo(bx,y);c.lineTo(bx,y-66*s);c.stroke();
    const w=Math.sin(T*0.004)*3;c.fillStyle='#9b3b30';c.beginPath();c.moveTo(bx,y-64*s);c.lineTo(bx+17,y-59*s+w);c.lineTo(bx,y-50*s);c.closePath();c.fill();
  }
};
DRAW.farm=(c,x,y,L,T)=>{
  const n=Math.min(4,2+Math.floor(L/4));
  for(let i=0;i<n;i++)field(c,x-66+i*31,y-6,28,24,T,i*1.7);
  hut(c,x+52,y-16,{w:34,h:18,rh:14,wall:'#7a5230',roof:'#5a4a30',dw:9,over:4},T);
  if(L>=5){
    const sx=x+26,sy=y-4;c.strokeStyle='#5a3f28';c.lineWidth=1.6;c.beginPath();c.moveTo(sx,sy);c.lineTo(sx,sy-16);c.moveTo(sx-7,sy-12);c.lineTo(sx+7,sy-12);c.stroke();
    c.fillStyle='#c9b25a';c.beginPath();c.arc(sx,sy-18,3,0,TAU);c.fill();
  }
};
DRAW.sawmill=(c,x,y,L,T)=>{
  const piles=Math.min(3,1+Math.floor(L/3));
  for(let p=0;p<piles;p++)for(let j=0;j<3;j++)for(let k=0;k<3-j;k++){
    const lx=x-40-p*16+k*6+j*3,ly=y-3-j*5;
    c.fillStyle='#7a5230';c.beginPath();c.arc(lx,ly,3.2,0,TAU);c.fill();
    c.fillStyle='#c9a06a';c.beginPath();c.arc(lx,ly,1.6,0,TAU);c.fill();
  }
  c.fillStyle='rgba(0,0,0,.28)';c.beginPath();c.ellipse(x+6,y+1,32,5,0,0,TAU);c.fill();
  c.fillStyle='#5a3f28';c.fillRect(x-20,y-28,4,28);c.fillRect(x+26,y-28,4,28);
  roof(c,x+5,y-26,50,12,'#5a4a30',5);
  c.fillStyle='#8a5e38';c.fillRect(x-14,y-9,40,6);
  c.save();c.translate(x+5,y-17);c.rotate(T*0.01);
  c.strokeStyle='#d5d9dc';c.lineWidth=1.5;c.beginPath();c.arc(0,0,8,0,TAU);c.stroke();
  for(let k=0;k<8;k++){const a=k/8*TAU;c.beginPath();c.moveTo(8*Math.cos(a),8*Math.sin(a));c.lineTo(10.5*Math.cos(a+0.2),10.5*Math.sin(a+0.2));c.stroke();}
  c.restore();
  c.fillStyle='rgba(225,200,150,.7)';for(let i=0;i<4;i++){const p=((T*0.0012)+i/4)%1;c.fillRect(x+10+p*14,y-12+p*10,1.5,1.5);}
};
DRAW.quarry=(c,x,y,L,T)=>{
  c.fillStyle='#2d3236';c.beginPath();c.ellipse(x-4,y-6,44,15,0,0,TAU);c.fill();
  c.fillStyle='#1f2326';c.beginPath();c.ellipse(x-4,y-4,34,10,0,0,TAU);c.fill();
  const n=3+Math.min(6,L);
  for(let i=0;i<n;i++){const bx=x+22+(i%3)*11,by=y-2-Math.floor(i/3)*8;
    c.fillStyle=i%2?'#8a949a':'#9aa4aa';c.fillRect(bx,by-8,10,8);c.fillStyle='rgba(255,255,255,.18)';c.fillRect(bx,by-8,10,2);c.strokeStyle='rgba(0,0,0,.3)';c.lineWidth=1;c.strokeRect(bx,by-8,10,8);}
  const cx=x-26,bob=Math.sin(T*0.002)*3;
  c.strokeStyle='#6b4a30';c.lineWidth=2.4;c.beginPath();c.moveTo(cx-8,y);c.lineTo(cx,y-30);c.lineTo(cx+8,y);c.moveTo(cx,y-30);c.lineTo(cx+22,y-26);c.stroke();
  c.strokeStyle='#bbb';c.lineWidth=1;c.beginPath();c.moveTo(cx+20,y-26);c.lineTo(cx+20,y-12+bob);c.stroke();
  c.fillStyle='#8a949a';c.fillRect(cx+15,y-12+bob,10,7);
  c.fillStyle='rgba(200,205,208,.35)';for(let i=0;i<3;i++){const p=((T*0.001)+i/3)%1;c.beginPath();c.arc(x-10+i*10,y-8-p*10,1.5+p*2,0,TAU);c.fill();}
};
function mine(c,x,y,L,T,ore){
  const g=c.createLinearGradient(0,y-48,0,y);g.addColorStop(0,'#66655f');g.addColorStop(1,'#3d3c39');
  c.fillStyle='rgba(0,0,0,.28)';c.beginPath();c.ellipse(x,y+1,54,6,0,0,TAU);c.fill();
  c.fillStyle=g;c.beginPath();c.moveTo(x-52,y);c.quadraticCurveTo(x-36,y-44,x-6,y-48);c.quadraticCurveTo(x+24,y-52,x+52,y);c.closePath();c.fill();
  c.fillStyle='rgba(232,240,244,.85)';c.beginPath();c.moveTo(x-22,y-38);c.quadraticCurveTo(x-6,y-51,x+18,y-44);c.quadraticCurveTo(x+2,y-42,x-6,y-36);c.quadraticCurveTo(x-14,y-39,x-22,y-38);c.fill();
  c.fillStyle='#07090a';c.fillRect(x-11,y-24,22,24);
  c.fillStyle='#6b4a30';c.fillRect(x-14,y-26,4,26);c.fillRect(x+10,y-26,4,26);c.fillRect(x-15,y-29,30,5);
  c.strokeStyle='#8a9399';c.lineWidth=1.3;c.beginPath();c.moveTo(x-8,y);c.lineTo(x-14,y+8);c.moveTo(x+8,y);c.lineTo(x+14,y+8);c.stroke();
  const cx=x+30+Math.sin(T*0.0012)*2;
  c.fillStyle='#4a4f54';c.beginPath();c.moveTo(cx-8,y-8);c.lineTo(cx+8,y-8);c.lineTo(cx+6,y-1);c.lineTo(cx-6,y-1);c.closePath();c.fill();
  c.fillStyle=ore;for(let i=0;i<4;i++){c.beginPath();c.arc(cx-5+i*3.4,y-9.5,1.9,0,TAU);c.fill();}
  c.fillStyle='#111';c.beginPath();c.arc(cx-4,y,2,0,TAU);c.arc(cx+4,y,2,0,TAU);c.fill();
  const f=0.7+0.3*Math.sin(T*0.007+x);
  const lg=c.createRadialGradient(x-13,y-31,1,x-13,y-31,14);lg.addColorStop(0,'rgba(255,200,110,'+(0.6*f).toFixed(2)+')');lg.addColorStop(1,'rgba(255,200,110,0)');
  c.fillStyle=lg;c.fillRect(x-28,y-46,30,30);c.fillStyle='#ffd27a';c.fillRect(x-14,y-33,3,4);
  for(let i=0;i<3+Math.min(3,Math.floor(L/3));i++){
    const a=0.5+0.5*Math.sin(T*0.004+i*2.1),gx=x-38+i*20+(i%2)*6,gy=y-12-(i*7)%16;
    c.strokeStyle=ore;c.globalAlpha=a;c.lineWidth=1.3;c.beginPath();c.moveTo(gx-3,gy);c.lineTo(gx+3,gy);c.moveTo(gx,gy-3);c.lineTo(gx,gy+3);c.stroke();c.globalAlpha=1;
  }
}
DRAW.ironmine=(c,x,y,L,T)=>mine(c,x,y,L,T,'#8fa6c2');
DRAW.silvermine=(c,x,y,L,T)=>mine(c,x,y,L,T,'#eef2f4');
DRAW.storehouse=(c,x,y,L,T)=>{
  if(L>=5)hut(c,x-46,y-4,{w:28,h:16,rh:12,wall:'#6b4a30',roof:'#3f3425',dw:8,over:3},T);
  hut(c,x,y,{w:56,h:34,rh:26,wall:'#7a5a38',roof:'#4a3d2b',dw:22,dh:24,over:5},T);
  c.fillStyle='#5a4028';c.fillRect(x-10,y-22,9.5,22);c.fillRect(x+0.5,y-22,9.5,22);
  c.strokeStyle='#2a1d12';c.lineWidth=1;c.strokeRect(x-10,y-22,20,22);
  const sacks=Math.min(5,1+Math.floor(L/2));
  for(let i=0;i<sacks;i++){const sx=x+36+(i%2)*9,sy=y-1-Math.floor(i/2)*7;c.fillStyle='#c9b78a';c.beginPath();c.ellipse(sx,sy-4,5,5.5,0,0,TAU);c.fill();c.fillStyle='#8a7a56';c.fillRect(sx-2,sy-10,4,2);}
  for(let i=0;i<2;i++){const bx=x-38-i*9;c.fillStyle='#6b4a30';c.fillRect(bx-4,y-12,8,12);c.strokeStyle='#8a9399';c.lineWidth=1;c.strokeRect(bx-4,y-9,8,2);c.strokeRect(bx-4,y-4,8,2);}
};
DRAW.vault=(c,x,y,L,T)=>{
  if(L>=3){c.fillStyle='#656c71';c.fillRect(x-46,y-12,92,12);c.fillStyle='#7b8388';c.fillRect(x-46,y-12,92,3);for(let i=0;i<5;i++)c.fillRect(x-46+i*20,y-16,10,4);}
  c.fillStyle='rgba(0,0,0,.28)';c.beginPath();c.ellipse(x,y+1,26,5,0,0,TAU);c.fill();
  c.fillStyle='#727a81';c.fillRect(x-18,y-56,36,56);
  c.fillStyle='#5f666c';c.fillRect(x+4,y-56,14,56);
  c.strokeStyle='rgba(0,0,0,.28)';c.lineWidth=1;
  for(let r=1;r<8;r++){c.beginPath();c.moveTo(x-18,y-r*7);c.lineTo(x+18,y-r*7);c.stroke();}
  for(let i=0;i<4;i++){c.fillStyle='#727a81';c.fillRect(x-18+i*10,y-62,6,6);}
  c.fillStyle='#14181b';c.beginPath();c.moveTo(x-8,y);c.lineTo(x-8,y-18);c.quadraticCurveTo(x,y-28,x+8,y-18);c.lineTo(x+8,y);c.closePath();c.fill();
  c.strokeStyle='#8a9399';c.lineWidth=1.6;c.beginPath();c.moveTo(x-8,y-8);c.lineTo(x+8,y-8);c.moveTo(x-8,y-15);c.lineTo(x+8,y-15);c.stroke();
  c.fillStyle='#0c0f11';c.fillRect(x-2,y-46,4,10);c.fillRect(x-2,y-32,4,8);
  const px=x+10;c.strokeStyle='#4a3524';c.lineWidth=2;c.beginPath();c.moveTo(px,y-62);c.lineTo(px,y-84);c.stroke();
  const w=Math.sin(T*0.004)*3;c.fillStyle='#9b3b30';c.beginPath();c.moveTo(px,y-83);c.lineTo(px+15,y-79+w);c.lineTo(px,y-72);c.closePath();c.fill();
  const a=0.5+0.5*Math.sin(T*0.005);c.strokeStyle='rgba(240,205,110,'+a.toFixed(2)+')';c.lineWidth=1.2;c.beginPath();c.moveTo(x-3,y-4);c.lineTo(x+3,y-4);c.moveTo(x,y-7);c.lineTo(x,y-1);c.stroke();
};
DRAW.barracks=(c,x,y,L,T)=>{
  c.fillStyle='rgba(95,76,54,.6)';c.beginPath();c.ellipse(x,y-18,66,27,0,0,TAU);c.fill();
  const stake=(sx,sy)=>{c.fillStyle='#6b4a30';c.beginPath();c.moveTo(sx-2.5,sy);c.lineTo(sx-2.5,sy-12);c.lineTo(sx,sy-16);c.lineTo(sx+2.5,sy-12);c.lineTo(sx+2.5,sy);c.closePath();c.fill();c.strokeStyle='rgba(0,0,0,.35)';c.lineWidth=0.8;c.stroke();};
  for(let i=0;i<=16;i++)stake(x-58+i*7.3,y-46);
  hut(c,x,y-40,{w:46,h:20,rh:14,wall:'#6b4a30',roof:'#3b3f45',dw:9,dh:12,glow:true,over:4},T);
  for(let i=0;i<5;i++){stake(x-62+(i*0.4),y-40+i*7);stake(x+62-(i*0.4),y-40+i*7);}
  if(L>=3){
    [[-66,-4],[66,-4]].forEach(p=>{const tx=x+p[0],ty=y+p[1];c.fillStyle='#8a6a43';c.beginPath();c.moveTo(tx-12,ty);c.lineTo(tx,ty-22);c.lineTo(tx+12,ty);c.closePath();c.fill();c.fillStyle='#1a120c';c.beginPath();c.moveTo(tx-3,ty);c.lineTo(tx,ty-9);c.lineTo(tx+3,ty);c.closePath();c.fill();});
  }
  c.strokeStyle='#6b4a30';c.lineWidth=2;c.beginPath();c.moveTo(x-52,y-14);c.lineTo(x-52,y-34);c.moveTo(x-40,y-14);c.lineTo(x-40,y-34);c.moveTo(x-54,y-30);c.lineTo(x-38,y-30);c.stroke();
  c.strokeStyle='#cfd3d6';c.lineWidth=1.2;for(let i=0;i<3;i++){c.beginPath();c.moveTo(x-50+i*5,y-30);c.lineTo(x-50+i*5,y-40);c.stroke();}
  troopsAt(c,x,y,T);
  if(L>=5){const bx=x+62;c.strokeStyle='#4a3524';c.lineWidth=2;c.beginPath();c.moveTo(bx,y-4);c.lineTo(bx,y-50);c.stroke();const w=Math.sin(T*0.004)*3;c.fillStyle=MINE_COL;c.beginPath();c.moveTo(bx,y-50);c.lineTo(bx+15,y-46+w);c.lineTo(bx,y-38);c.closePath();c.fill();}
};
DRAW.oracle=(c,x,y,L,T)=>{
  const n=5+Math.min(3,Math.floor(L/3)),cy=y-6;
  c.fillStyle='rgba(120,140,150,.22)';c.beginPath();c.ellipse(x,cy,42,15,0,0,TAU);c.fill();
  const st=[];for(let i=0;i<n;i++){const a=i/n*TAU+0.3;st.push({x:x+Math.cos(a)*36,y:cy+Math.sin(a)*12,h:20+((i*7)%5)*3});}
  st.sort((a,b)=>a.y-b.y);
  const stone=(s)=>{c.fillStyle='rgba(0,0,0,.25)';c.beginPath();c.ellipse(s.x,s.y+1,6,2,0,0,TAU);c.fill();c.fillStyle='#7d878d';c.beginPath();c.moveTo(s.x-5,s.y);c.lineTo(s.x-4,s.y-s.h);c.lineTo(s.x+1,s.y-s.h-3);c.lineTo(s.x+5,s.y-s.h+2);c.lineTo(s.x+5,s.y);c.closePath();c.fill();c.fillStyle='rgba(0,0,0,.2)';c.fillRect(s.x+1,s.y-s.h+2,4,s.h-2);c.fillStyle='#4f6b4a';c.fillRect(s.x-5,s.y-3,10,3);};
  st.filter(s=>s.y<cy).forEach(stone);
  const pulse=0.6+0.4*Math.sin(T*0.003);
  const gl=c.createRadialGradient(x,y-22,2,x,y-22,34);gl.addColorStop(0,'rgba(134,174,192,'+(0.35*pulse+0.05*Math.min(L,10)/10).toFixed(2)+')');gl.addColorStop(1,'rgba(134,174,192,0)');
  c.fillStyle=gl;c.fillRect(x-36,y-58,72,72);
  c.fillStyle='#5b666c';c.beginPath();c.moveTo(x-9,y-2);c.lineTo(x-8,y-40);c.lineTo(x,y-46);c.lineTo(x+8,y-39);c.lineTo(x+9,y-2);c.closePath();c.fill();
  c.fillStyle='rgba(0,0,0,.22)';c.fillRect(x+1,y-40,8,38);
  c.font='18px '+FR;c.textAlign='center';c.textBaseline='middle';c.fillStyle='rgba(150,205,225,'+(0.65+0.35*pulse).toFixed(2)+')';c.fillText('ᚨ',x-1,y-24);c.textBaseline='alphabetic';
  st.filter(s=>s.y>=cy).forEach(stone);
  for(let i=0;i<3;i++){const p=((T*0.0004)+i/3)%1;c.globalAlpha=(1-p)*0.8;c.font='10px '+FR;c.fillStyle='#86aec0';c.fillText(['ᚠ','ᚹ','ᛟ'][i],x-16+i*16,y-48-p*26);c.globalAlpha=1;}
};

/* Казарма: несколько воинов во дворе (для миниатюры) */
function troopsAt(c,x,y,T){
  const k=['spear','archer','spear','cav','spear','archer'];
  k.forEach((t,i)=>{const px=x-34+(i%3)*28+(i>2?9:0),py=y-26+Math.floor(i/3)*13;soldier(c,px,py,t,1.05,T,i%2?-1:1,MINE_COL,'idle',i*1.3);});
}
/* Габариты рисунка (ширина, высота над землёй) для кадрирования миниатюр */
const EXT={hall:[205,112,-6],farm:[150,58,5,0.74],sawmill:[104,52,0],quarry:[114,58,3],ironmine:[108,58,0],silvermine:[108,58,0],storehouse:[108,60,-3],vault:[106,92,0],barracks:[166,76,0],oracle:[100,72,0]};
function emptyPlot(c,w){
  c.save();c.strokeStyle='rgba(210,154,71,.75)';c.setLineDash([5,4]);c.lineWidth=1.6;
  c.strokeRect(-w*0.32,-w*0.36,w*0.64,w*0.36);c.setLineDash([]);
  c.fillStyle='rgba(210,154,71,.12)';c.fillRect(-w*0.32,-w*0.36,w*0.64,w*0.36);
  c.fillStyle='rgba(210,154,71,.85)';c.font='700 '+Math.round(w*0.26)+'px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('+',0,-w*0.18);
  c.restore();
}
function tile(c,W,H){
  const g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,'#1d2a33');g.addColorStop(1,'#16211a');
  c.fillStyle=g;c.fillRect(0,0,W,H);
  c.fillStyle='rgba(222,232,236,.12)';c.beginPath();c.ellipse(W*0.5,H*0.9,W*0.46,H*0.1,0,0,TAU);c.fill();
  c.fillStyle='#2f4235';c.beginPath();c.ellipse(W*0.5,H*0.9,W*0.4,H*0.075,0,0,TAU);c.fill();
}
/* Готовые картинки (window.PIC: имя -> список адресов). Пока картинка не загрузилась, рисуем кодом. */
const IMGS={};
function picAt(id,i,redraw){
  const list=window.PIC&&window.PIC[id];if(!list||!list[i])return null;
  const key=id+i;let im=IMGS[key];
  if(!im){im=IMGS[key]=new Image();im.src=list[i];}
  if(im.complete&&im.naturalWidth)return im;
  im.addEventListener('load',()=>{try{redraw();}catch(e){}},{once:true});
  return null;
}
const STAGE_LV=[1,5,10,15,20,25,30];
/* Здание: 6 картинок, каждая на 5 уровней. */
function bldPic(cv,id,L){
  const n=(window.PIC&&window.PIC[id]||[]).length;if(!n)return false;
  const im=picAt(id,Math.min(n-1,Math.ceil(L/5)-1),()=>drawThumb(cv,id,L));if(!im)return false;
  const c=cv.getContext('2d'),W=cv.width,H=cv.height;
  c.drawImage(im,W*0.03,H*0.9-W*0.94,W*0.94,W*0.94);
  return true;
}
/* Воин или герой в рост на тёмной плитке. */
function figPic(cv,key,idx,redraw){
  const im=picAt(key,idx,redraw);if(!im)return false;
  const c=cv.getContext('2d'),W=cv.width,H=cv.height;
  const hh=H*0.9,ww=hh*im.naturalWidth/im.naturalHeight;
  c.drawImage(im,(W-ww)/2,H*0.93-hh,ww,hh);
  return true;
}
/* Здание заданного уровня. Чем выше уровень, тем богаче рисунок. L=0: пустой участок. */
function drawThumb(cv,id,L){
  if(!cv||!DRAW[id])return;
  const c=cv.getContext('2d'),W=cv.width,H=cv.height;
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,W,H);
  tile(c,W,H);
  if(L>0&&bldPic(cv,id,L))return;
  if(L===0){const pl=picAt('plot',0,()=>drawThumb(cv,id,0));if(pl){c.drawImage(pl,W*0.03,H*0.9-W*0.94,W*0.94,W*0.94);return;}}
  const e=EXT[id]||[130,80,0,0.88];
  const sc=Math.min(W*0.94/e[0],H*0.84/e[1]);
  c.translate(W/2-e[2]*sc,H*(e[3]||0.88));c.scale(sc,sc);
  if(L>0)DRAW[id](c,0,0,L,0);else emptyPlot(c,e[0]*0.8);
}
/* Воин: тип spear, archer или cav. */
function drawUnit(cv,type,tier){
  if(!cv)return;
  const c=cv.getContext('2d'),W=cv.width,H=cv.height;
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,W,H);
  tile(c,W,H);
  const s=type==='cav'?W/44:type==='spear'?W/40:W/30;
  if(figPic(cv,type,(tier||1)-1,()=>drawUnit(cv,type,tier)))return;
  soldier(c,W*(type==='cav'?0.46:0.5),H*0.88,type,s,0,1,MINE_COL,'idle',0,tier||1);
}
/* Герой: ярл. Чем выше уровень, тем богаче снаряжение. */
function drawHero(cv,lv,std){
  if(!cv)return;
  lv=lv||1;
  const c=cv.getContext('2d'),W=cv.width,H=cv.height;
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,W,H);
  tile(c,W,H);
  let st=0;STAGE_LV.forEach((v,k)=>{if(lv>=v)st=k;});
  const look=std?0:(window.Core&&Core.S&&Core.S.hero&&Core.S.hero.look)|0;
  if(look>0){const im=picAt('herop',look-1,()=>drawHero(cv,lv));if(im){const sw=im.naturalWidth,sh=Math.min(im.naturalHeight,sw*H/W),sy=Math.min(im.naturalHeight-sh,im.naturalHeight*0.2);c.drawImage(im,0,sy,sw,sh,0,0,W,H);}return;}
  if(figPic(cv,'hero',st,()=>drawHero(cv,lv,std)))return;
  c.save();c.translate(W*0.5,H*0.9);const s=W/34;c.scale(s,s);
  c.fillStyle='#7a2a2a';c.beginPath();c.moveTo(-4,-17);c.lineTo(-9,-1);c.lineTo(2,-2);c.lineTo(4,-17);c.closePath();c.fill();
  c.strokeStyle='#2a2018';c.lineWidth=2.2;c.beginPath();c.moveTo(-1.6,-7);c.lineTo(-2,0);c.moveTo(1.6,-7);c.lineTo(2,0);c.stroke();
  c.fillStyle=MINE_COL;c.fillRect(-4,-17,8,11);
  c.fillStyle='rgba(180,190,198,.5)';c.fillRect(-4,-17,8,11);
  c.fillStyle=lv>=10?'#c9a24f':'#6b4a30';c.fillRect(-4,-9,8,1.6);
  c.fillStyle='#6a5a4a';c.beginPath();c.ellipse(0,-17,5.6,2.2,0,0,TAU);c.fill();
  c.fillStyle='#e0b896';c.beginPath();c.arc(0,-21,3.2,0,TAU);c.fill();
  c.fillStyle='#a8662f';c.beginPath();c.moveTo(-3,-20);c.lineTo(3,-20);c.lineTo(2,-15.5);c.lineTo(-2,-15.5);c.closePath();c.fill();
  c.fillStyle=lv>=5?'#c9a24f':'#9aa4ab';c.beginPath();c.arc(0,-22,3.7,Math.PI,TAU);c.fill();
  c.strokeStyle='#e4e0d0';c.lineWidth=1.3;c.beginPath();c.moveTo(-3.6,-22);c.quadraticCurveTo(-7,-24,-6,-28);c.moveTo(3.6,-22);c.quadraticCurveTo(7,-24,6,-28);c.stroke();
  if(lv>=10){c.fillStyle='#86aec0';c.beginPath();c.arc(0,-25,1.1,0,TAU);c.fill();}
  c.fillStyle='#8a3b30';c.beginPath();c.arc(-6,-9,4.6,0,TAU);c.fill();
  c.strokeStyle=lv>=5?'#c9a24f':'#2a2018';c.lineWidth=1;c.stroke();
  c.save();c.translate(6,-10);c.rotate(0.25);
  c.strokeStyle='#6b4a30';c.lineWidth=1.5;c.beginPath();c.moveTo(0,8);c.lineTo(0,-13);c.stroke();
  c.fillStyle='#cfd3d6';c.beginPath();c.moveTo(0,-13);c.quadraticCurveTo(7,-14,6,-7);c.lineTo(0,-8);c.closePath();c.fill();
  c.restore();
  c.restore();
}
/* Нарисовать все холсты с атрибутами data-b (здание) и data-u (воин) внутри узла. */
function paintIn(root,levelOf){
  root.querySelectorAll('canvas[data-b]').forEach(cv=>drawThumb(cv,cv.dataset.b,levelOf(cv.dataset.b)));
  root.querySelectorAll('canvas[data-u]').forEach(cv=>drawUnit(cv,cv.dataset.u,+cv.dataset.t||1));
  root.querySelectorAll('canvas[data-hero]').forEach(cv=>drawHero(cv,+cv.dataset.hero||1));
}

/* ---------- оживление картинок: огонь, дым, мерцание ---------- */
/* Координаты точек в долях картинки (0..1). Стадия = номер картинки здания (1..6). */
const FXPT={
  hall:      {1:[['fire',.15,.86]],2:[['smoke',.57,.13],['fire',.29,.55],['fire',.47,.63]],3:[['glow',.2,.72,.10]],4:[['glow',.3,.78,.08]],5:[['fire',.29,.63],['fire',.52,.78]],6:[['fire',.30,.53],['fire',.60,.73],['fire',.90,.53]]},
  farm:      {1:[['fire',.12,.82]],2:[['glow',.25,.78,.08]],3:[['smoke',.39,.13]],4:[['glow',.3,.7,.08]],5:[['fire',.29,.63],['fire',.52,.78]],6:[['fire',.30,.53],['fire',.60,.73],['fire',.90,.53]]},
  sawmill:   {1:[['fire',.1,.86]],2:[['glow',.4,.8,.08]],3:[['smoke',.4,.12]],4:[['fire',.16,.88]],5:[['fire',.29,.63],['fire',.52,.78]],6:[['fire',.30,.53],['fire',.60,.73],['fire',.90,.53]]},
  quarry:    {1:[['fire',.5,.8]],2:[['glow',.55,.7,.08]],3:[['smoke',.9,.42]],4:[['glow',.5,.7,.1]],5:[['fire',.7,.7]],6:[['fire',.2,.9],['fire',.7,.7]]},
  ironmine:  {1:[['fire',.1,.86]],2:[['fire',.25,.7],['smoke',.2,.5]],3:[['glow',.3,.78,.09]],4:[['glow',.45,.78,.09]],5:[['fire',.2,.75],['smoke',.45,.55]],6:[['fire',.2,.88],['fire',.7,.9]]},
  silvermine:{1:[['fire',.5,.86],['twinkle',.78,.55],['twinkle',.3,.6]],2:[['twinkle',.5,.7],['twinkle',.7,.8]],3:[['twinkle',.5,.85],['twinkle',.35,.7]],4:[['twinkle',.4,.4],['twinkle',.7,.6]],5:[['smoke',.7,.5],['twinkle',.3,.7]],6:[['fire',.17,.9],['fire',.35,.7],['twinkle',.7,.8]]},
  storehouse:{1:[['twinkle',.8,.35]],2:[['smoke',.46,.14]],3:[['glow',.55,.78,.08]],4:[['glow',.4,.8,.08]],5:[['fire',.29,.63],['fire',.52,.78]],6:[['fire',.30,.53],['fire',.60,.73],['fire',.90,.53]]},
  vault:     {1:[['fire',.15,.84],['twinkle',.5,.7]],2:[['fire',.1,.65],['twinkle',.55,.6]],3:[['twinkle',.55,.5],['twinkle',.25,.75]],4:[['twinkle',.4,.5]],5:[['fire',.29,.63],['fire',.52,.78],['twinkle',.6,.4]],6:[['fire',.30,.53],['fire',.60,.73],['fire',.90,.53],['twinkle',.5,.45]]},
  oracle:    {1:[['fire',.28,.86],['smoke',.5,.5]],2:[['smoke',.55,.2],['smoke',.75,.35],['fire',.18,.75]],3:[['glow',.18,.8,.13,'#5ee6ff'],['glow',.43,.88,.12,'#5ee6ff'],['fire',.65,.8],['smoke',.78,.35]],4:[['fire',.5,.18],['fire',.3,.86],['glow',.5,.17,.1]],5:[['fire',.29,.63],['fire',.52,.78],['glow',.5,.35,.1,'#5ee6ff']],6:[['fire',.30,.53],['fire',.60,.73],['fire',.90,.53],['glow',.6,.1,.14]]},
  barracks:  {1:[['fire',.12,.87]],2:[['smoke',.46,.1],['fire',.2,.76]],3:[['glow',.3,.78,.08]],4:[['glow',.5,.78,.08]],5:[['fire',.29,.63],['fire',.52,.78]],6:[['fire',.30,.53],['fire',.60,.73],['fire',.90,.53]]}
};
function fxFire(c,x,y,r,t,k){
  const f=1+0.12*Math.sin(t*0.011+k*2.3)+0.08*Math.sin(t*0.027+k);
  const g=c.createRadialGradient(x,y,0,x,y,r*3.2*f);
  g.addColorStop(0,'rgba(255,170,60,.38)');g.addColorStop(1,'rgba(255,120,30,0)');
  c.fillStyle=g;c.beginPath();c.arc(x,y,r*3.2*f,0,TAU);c.fill();
  for(let i=0;i<3;i++){
    const ph=t*0.008+i*2.1+k,w=Math.sin(ph)*r*0.35,h=r*(1.1+0.5*Math.sin(ph*1.7+i)),x0=x+(i-1)*r*0.5;
    c.fillStyle=i===1?'rgba(255,220,120,.8)':'rgba(255,140,40,.65)';
    c.beginPath();c.moveTo(x0-r*0.3,y);c.quadraticCurveTo(x0+w,y-h*0.6,x0+w*1.4,y-h);c.quadraticCurveTo(x0+r*0.1+w,y-h*0.5,x0+r*0.3,y);c.closePath();c.fill();
  }
  for(let i=0;i<3;i++){
    const u=((t*0.0004+i/3+k*0.17)%1),ex=x+Math.sin(u*9+i)*r*1.2,ey=y-u*r*5;
    c.fillStyle='rgba(255,190,90,'+(0.8*(1-u))+')';c.fillRect(ex,ey,1.4,1.4);
  }
}
function fxSmoke(c,x,y,r,t,k){
  for(let i=0;i<4;i++){
    const u=((t*0.00018+i/4+k*0.21)%1),px=x+Math.sin(u*5+i+k)*r*0.9+u*r*1.2,py=y-u*r*7,rr=r*(0.5+u*1.1);
    c.fillStyle='rgba(205,205,210,'+(0.4*(1-u)*(u<0.1?u*10:1))+')';
    c.beginPath();c.arc(px,py,rr,0,TAU);c.fill();
  }
}
function fxGlow(c,x,y,r,t,k,col){
  const a=0.35+0.2*Math.sin(t*0.003+k*1.7);
  const g=c.createRadialGradient(x,y,0,x,y,r);
  const rgb=col==='#5ee6ff'?'94,230,255':'255,185,90';
  g.addColorStop(0,'rgba('+rgb+','+a+')');g.addColorStop(1,'rgba('+rgb+',0)');
  c.fillStyle=g;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();
}
function fxTwinkle(c,x,y,r,t,k){
  const u=((t*0.0006+k*0.37)%1),a=Math.max(0,Math.sin(u*Math.PI))**3,s=r*0.9*a;
  c.strokeStyle='rgba(255,246,210,'+a+')';c.lineWidth=1;
  c.beginPath();c.moveTo(x-s,y);c.lineTo(x+s,y);c.moveTo(x,y-s);c.lineTo(x,y+s);c.stroke();
}
/* Рисует картинку здания и поверх неё живые эффекты. */
function animThumb(cv,id,L,t){
  drawThumb(cv,id,L);
  const n=(window.PIC&&window.PIC[id]||[]).length;if(!n||!FXPT[id]||L<1)return;
  const st=Math.min(n,Math.ceil(L/5)),list=FXPT[id][st];if(!list)return;
  const c=cv.getContext('2d'),W=cv.width,H=cv.height,x0=W*0.03,y0=H*0.9-W*0.94,S=W*0.94;
  list.forEach((e,i)=>{
    const x=x0+e[1]*S,y=y0+e[2]*S,r=S*0.028;
    if(e[0]==='fire')fxFire(c,x,y,r,t,i);
    else if(e[0]==='smoke')fxSmoke(c,x,y,r,t,i);
    else if(e[0]==='glow')fxGlow(c,x,y,S*(e[3]||0.1),t,i,e[4]);
    else if(e[0]==='twinkle')fxTwinkle(c,x,y,S*0.04,t,i);
  });
}
let animOn=false,animList=new Set(),animObs=null;
function animLoop(now){
  if(!animOn)return;
  if(!document.hidden&&animList.size){
    animList.forEach(cv=>{ if(!cv.isConnected){animList.delete(cv);return;} try{animThumb(cv,cv.dataset.b,cv._L||1,now);}catch(e){} });
  }
  setTimeout(()=>requestAnimationFrame(animLoop),66);   // примерно 15 кадров в секунду
}
/* Включить оживление для холстов зданий внутри узла; анимируются только те, что видны на экране. */
function animateIn(root,levelOf){
  if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  if(!('IntersectionObserver' in window))return;
  if(!animObs)animObs=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)animList.add(e.target);else animList.delete(e.target);}),{threshold:0.1});
  root.querySelectorAll('canvas[data-b]').forEach(cv=>{cv._L=levelOf(cv.dataset.b);if(cv._L>0&&FXPT[cv.dataset.b])animObs.observe(cv);});
  if(!animOn){animOn=true;requestAnimationFrame(animLoop);}
}
window.Art={drawThumb,drawUnit,drawHero,paintIn,animateIn,animThumb,DRAW,soldier};

})();
