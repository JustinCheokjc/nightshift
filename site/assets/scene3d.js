(function(){
var $=function(i){return document.getElementById(i)};var c0=$("c3");if(!c0)return;
function init3d(){var cv=$("c3");if(!cv)return;var ld=$("ld3");if(ld)ld.remove();
function fb(m){var p=document.createElement("p");p.style.cssText="padding:48px 20px;text-align:center;color:#8FA9B2";p.textContent=m;cv.parentNode.replaceChild(p,cv)}
if(!window.THREE){fb("The 3D view could not load. Check your connection.");return}
var T=THREE,R;try{R=new T.WebGLRenderer({canvas:cv,antialias:true,alpha:true})}catch(e){fb("Your browser could not start the 3D view.");return}
R.setPixelRatio(Math.min(window.devicePixelRatio||1,2));R.shadowMap.enabled=true;R.shadowMap.type=T.PCFSoftShadowMap;R.outputEncoding=T.sRGBEncoding;R.toneMapping=T.ACESFilmicToneMapping;R.toneMappingExposure=1.15;
var rm=matchMedia("(prefers-reduced-motion: reduce)").matches;
var S=new T.Scene(),cam=new T.PerspectiveCamera(42,1,.1,120),G=new T.Group();S.add(G);G.rotation.x=.14;S.fog=new T.Fog(0x0B1A20,24,70);
S.add(new T.HemisphereLight(0xbfe9f2,0x0b1a20,.75));
var dl=new T.DirectionalLight(0xffffff,.95);dl.position.set(6,12,8);dl.castShadow=true;dl.shadow.mapSize.set(1024,1024);var sh=dl.shadow.camera;sh.left=-14;sh.right=14;sh.top=10;sh.bottom=-10;S.add(dl);
var TEAL=0x46D1BF,AMB=0xE0A93A,GRY=0x6B8793,WHT=0xF2F7F8,GRN=0x7BE08F,RED=0xFF6B5A;
function M(c){return new T.MeshStandardMaterial({color:c,roughness:.45,metalness:.3})}
function tx(w,h,fn){var c=document.createElement("canvas");c.width=w;c.height=h;var x=c.getContext("2d");fn(x,w,h);var t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;return t}
var glow=tx(64,64,function(x){var g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,"rgba(255,255,255,1)");g.addColorStop(.35,"rgba(255,255,255,.35)");g.addColorStop(1,"rgba(255,255,255,0)");x.fillStyle=g;x.fillRect(0,0,64,64)});
var keys=tx(256,128,function(x,w,h){x.fillStyle="#0c161b";x.fillRect(0,0,w,h);x.fillStyle="#26394380";for(var r=0;r<5;r++)for(var c=0;c<14;c++){x.fillStyle="#2a3d47";x.fillRect(6+c*17.6,6+r*16,15,13)}x.fillStyle="#1d2d35";x.fillRect(88,100,80,22)});
function spr(col,sz,op){var s=new T.Sprite(new T.SpriteMaterial({map:glow,color:col,blending:T.AdditiveBlending,transparent:true,depthWrite:false,opacity:op}));s.scale.set(sz,sz,1);return s}
var fl=new T.Mesh(new T.CircleGeometry(16,64),new T.MeshStandardMaterial({color:0x0F232B,roughness:.9}));fl.rotation.x=-Math.PI/2;fl.position.y=-.06;fl.receiveShadow=true;G.add(fl);
var gr=new T.GridHelper(26,26,0x24505a,0x173943);gr.position.y=-.04;gr.material.transparent=true;gr.material.opacity=.45;G.add(gr);
var L=[],B=[],LED=[],ST=[],idle=[],LM=[],night=true,stage=0,i,j,k,m;
for(i=0;i<6;i++){var g=new T.Group(),cn=document.createElement("canvas");cn.width=160;cn.height=100;var tex=new T.CanvasTexture(cn);tex.encoding=T.sRGBEncoding;
g.userData={i:i,cx:cn.getContext("2d"),tex:tex};
var base=new T.Mesh(new T.BoxGeometry(1.4,.1,1),M(0x40596a));base.castShadow=true;g.add(base);
var kb=new T.Mesh(new T.PlaneGeometry(1.2,.6),new T.MeshBasicMaterial({map:keys}));kb.rotation.x=-Math.PI/2;kb.position.set(0,.052,.12);g.add(kb);
var lg=new T.Mesh(new T.SphereGeometry(.03,8,8),new T.MeshBasicMaterial({color:GRN}));lg.position.set(.6,.055,.44);g.add(lg);
var sg=new T.Group();sg.position.set(0,.05,-.5);sg.rotation.x=-.3;
var bz=new T.Mesh(new T.BoxGeometry(1.4,.9,.05),M(0x22333c));bz.position.y=.45;bz.castShadow=true;sg.add(bz);
var sc=new T.Mesh(new T.PlaneGeometry(1.28,.8),new T.MeshBasicMaterial({map:tex,toneMapped:false}));sc.position.set(0,.45,.03);sg.add(sc);g.add(sg);
g.position.set(-6.5,0,-5+i*2);g.rotation.y=Math.PI/2;G.add(g);L.push(g);ST[i]=0}
var C=new T.Group(),core=new T.Mesh(new T.IcosahedronGeometry(1,1),new T.MeshStandardMaterial({color:0x1F8A7D,emissive:0x0E6A5F,emissiveIntensity:.9,roughness:.3,metalness:.4,flatShading:true}));core.castShadow=true;C.add(core);
C.add(new T.Mesh(new T.IcosahedronGeometry(1.35,1),new T.MeshBasicMaterial({color:TEAL,wireframe:true,transparent:true,opacity:.22})));
var rA=new T.Mesh(new T.TorusGeometry(1.7,.03,8,90),new T.MeshBasicMaterial({color:TEAL})),rB=new T.Mesh(new T.TorusGeometry(2.1,.025,8,90),new T.MeshBasicMaterial({color:0x7FB8FF,transparent:true,opacity:.7}));
rA.rotation.x=Math.PI/2.3;rB.rotation.y=Math.PI/2.5;C.add(rA);C.add(rB);C.add(spr(TEAL,6.5,.55));var pl=new T.PointLight(TEAL,1.4,16);C.add(pl);C.position.set(0,1.2,0);G.add(C);
var ped=new T.Mesh(new T.CylinderGeometry(1.5,1.8,.16,40),M(0x1b3a44));ped.position.y=.06;ped.receiveShadow=true;G.add(ped);
for(j=0;j<3;j++){var b=new T.Group();for(k=0;k<3;k++){var u=new T.Mesh(new T.BoxGeometry(1.3,.32,1),M(k===2?0x4A6B7A:0x35505E));u.position.y=.16+k*.38;u.castShadow=true;b.add(u);
for(m=0;m<4;m++){var le=new T.Mesh(new T.BoxGeometry(.07,.05,.02),new T.MeshBasicMaterial({color:AMB}));le.position.set(-.45+m*.12,.16+k*.38,.51);b.add(le);LED.push(le)}}
b.rotation.y=-Math.PI/2;b.position.set(6.5,0,-3+j*3);G.add(b);B.push(b)}
var cp=C.position.clone();
function lv(n){return L[n].position.clone().add(new T.Vector3(0,.55,0))}
function bv(n){return B[n].position.clone().add(new T.Vector3(0,.6,0))}
function ln(a,c){var mt=new T.LineBasicMaterial({color:0x5D7985,transparent:true,opacity:.45});G.add(new T.Line(new T.BufferGeometry().setFromPoints([a,c]),mt));return mt}
for(i=0;i<6;i++)LM[i]=ln(lv(i),cp);for(j=0;j<3;j++)ln(bv(j),cp);
var RT=[];function rt(st,a,c,col,o,lap,ty){var ms=[];for(var n=0;n<3;n++){var q=new T.Mesh(new T.SphereGeometry(.16-n*.04,12,12),new T.MeshBasicMaterial({color:col,transparent:true,opacity:1-n*.35}));q.visible=false;G.add(q);ms.push(q)}
var h=spr(col,1.1,.8);ms[0].add(h);RT.push({st:st,a:a,b:c,ms:ms,o:o,lap:lap,ty:ty,vis:false,pk:0,h:h})}
for(i=0;i<6;i++)rt(0,lv(i),cp,TEAL,i*.16,i,"tel");
[1,3,5].forEach(function(n){rt(1,cp,lv(n),AMB,0,n,"job");rt(1,lv(n),cp,WHT,.5,n,"res")});
for(j=0;j<3;j++){rt(2,bv(j),cp,AMB,j*.3,-1,"job");rt(2,cp,bv(j),WHT,.5+j*.3,-1,"ret")}
for(i=0;i<6;i++){rt(2,cp,lv(i),AMB,.15+i*.12,i,"job");rt(2,lv(i),cp,WHT,.55+i*.12,i,"res");rt(2,cp,lv(i),GRN,.85+i*.12,i,"pay")}
function paint(n){var d=L[n].userData,x=d.cx,s=ST[n];x.fillStyle=s===0?"#0d3b38":s===1?"#d9e2e6":"#4a1212";x.fillRect(0,0,160,100);x.textAlign="center";
if(s===0){x.strokeStyle="#46D1BF";x.lineWidth=5;x.beginPath();x.arc(80,42,20,0,6.28);x.stroke();x.fillStyle="#46D1BF";x.font="bold 14px sans-serif";x.fillText("IDLE",80,85)}
else if(s===1){x.fillStyle="#9fb2bb";for(var r=0;r<6;r++)x.fillRect(14,14+r*13,r%3===2?70:130,6);x.fillStyle="#3B82F6";x.fillRect(14,92,40,3)}
else{x.fillStyle="#ff6b5a";x.font="bold 44px sans-serif";x.fillText("!",80,58);x.font="bold 13px sans-serif";x.fillText("PAUSED",80,85)}
d.tex.needsUpdate=true}
var rep=0,jobs=0,earn=0;
var LB=[];function apply(){for(i=0;i<6;i++){idle[i]=ST[i]===0;paint(i);LM[i].color.setHex(ST[i]===2?RED:0x5D7985);LM[i].opacity=ST[i]===2?.95:.45}
RT.forEach(function(r){r.vis=r.st===stage&&(r.ty==="tel"||r.lap<0||idle[r.lap]);r.pk=0;if(r.ty==="tel"){var c=ST[r.lap]===0?TEAL:ST[r.lap]===1?GRY:RED;r.ms.forEach(function(q){q.material.color.setHex(c)});r.h.material.color.setHex(c)}});rep=jobs=0;earn=0;LB.forEach(function(b,n){b.textContent="Laptop "+(n+1)+": "+["idle","in use","flagged"][ST[n]];b.className="s"+ST[n]})}
var CAP=["Measure (pilot now): each laptop reports only its state, such as awake, plugged in and idle. Nothing else leaves the machine.","Test (planned): the coordinator sends the same small job to several idle laptops and compares the answers before trusting any result.","Match (planned): buyers submit jobs, the coordinator splits and routes them to idle laptops, and earnings are credited to contributor wallets."];
function say(){var f=ST.filter(function(x){return x===2}).length;$("cp3").textContent=CAP[stage]+(night?"":" It is daytime, so most laptops are in use and only one is free.")+(f?" "+f+" flagged laptop"+(f>1?"s are":" is")+" paused and cut off until fixed.":"")}
var hd="";function hud(){var t=stage===0?"Status reports received: "+rep:stage===1?"Results cross-checked: "+jobs:"Jobs done: "+jobs+" | Sample earnings: S$"+earn.toFixed(2);if(t!==hd){hd=t;$("hd").textContent=t}}
function sel(id,n){document.querySelectorAll("#"+id+" button").forEach(function(x,q){x.setAttribute("aria-pressed",q===n)})}
var vis=false,auto=!rm,ww=0,hh=0,dt=0,zt=1,zc=1,fx=0,fc=0,hov=-1,hp=null,tipT=0;
document.querySelectorAll("#s3 button").forEach(function(b,n){b.onclick=function(){stage=n;sel("s3",n);apply();say();track("3d_stage",{i:n})}});
document.querySelectorAll("#d3 button").forEach(function(b,n){b.onclick=function(){night=n===1;sel("d3",n);for(i=0;i<6;i++)if(ST[i]!==2)ST[i]=night?0:(i===2?0:1);apply();say();track("3d_time",{night:night})}});
var FO=[[0,1],[-5,.62],[0,.5],[5,.62]];
document.querySelectorAll("#f3 button").forEach(function(b,n){b.onclick=function(){fx=FO[n][0];zt=FO[n][1];sel("f3",n);track("3d_focus",{i:n})}});
$("zi").onclick=function(){zt=Math.max(.45,zt*.8)};$("zo").onclick=function(){zt=Math.min(1.4,zt*1.25)};$("zr").onclick=function(){zt=1;fx=0;G.rotation.y=0;G.rotation.x=.14;auto=!rm;sel("f3",0)};
var RC=new T.Raycaster(),mp=new T.Vector2();
function pick(cx,cy){var r=cv.getBoundingClientRect();mp.set((cx-r.left)/r.width*2-1,-((cy-r.top)/r.height)*2+1);RC.setFromCamera(mp,cam);var h=RC.intersectObjects(L,true);if(!h.length)return -1;var o=h[0].object;while(o&&o.userData.i===undefined)o=o.parent;return o?o.userData.i:-1}
var TX=["Idle and plugged in. Sharing status only.","In use. Nothing is shared.","Risk flagged: firewall is off. Paused until fixed."];
function tip(n,cx,cy){var e=$("tp");if(n<0){e.style.display="none";return}var r=cv.getBoundingClientRect();e.innerHTML="<b>Laptop "+(n+1)+"</b><br>"+TX[ST[n]]+"<br><small>Tap or click to change state</small>";e.style.display="block";e.style.left=Math.max(8,Math.min(cx-r.left,ww-170))+"px";e.style.top=Math.max(8,cy-r.top-80)+"px"}
function size(){var w=cv.clientWidth,h=cv.clientHeight;R.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();ww=w;hh=h}
function lab(id,v){var p=v.clone();G.localToWorld(p);p.project(cam);var e=$(id);e.style.left=((p.x*.5+.5)*ww)+"px";e.style.top=((-p.y*.5+.5)*hh)+"px"}
if("IntersectionObserver"in window)new IntersectionObserver(function(e){vis=e[0].isIntersecting}).observe(cv);else vis=true;
var t0=performance.now();
function fr(){requestAnimationFrame(fr);if(!vis)return;
var w=cv.clientWidth,h=cv.clientHeight;if(!w||!h)return;if(w!==ww||h!==hh)size();
var t=(performance.now()-t0)/1000;if(auto)G.rotation.y=Math.sin(t*.25)*.45;
zc+=(zt-zc)*.1;fc+=(fx-fc)*.1;var d=Math.max(15,22/cam.aspect)*zc;cam.position.set(fc,d*.42,d);cam.lookAt(fc,0,0);
if(hp&&!tipT){var q=pick(hp.x,hp.y);hov=q;tip(q,hp.x,hp.y)}else if(!hp&&!tipT){hov=-1;tip(-1)}
cv.style.cursor=hov>=0?"pointer":"grab";
for(i=0;i<6;i++){var sc2=L[i].scale.x;L[i].scale.setScalar(sc2+((hov===i?1.1:1)-sc2)*.2)}
RT.forEach(function(r){if(!r.vis){r.ms.forEach(function(q){q.visible=false});return}var kk=rm?r.o%1:(t*.42+r.o)%1;
if(kk<r.pk){if(r.ty==="tel")rep++;else if(r.ty==="res")jobs++;else if(r.ty==="pay")earn+=.02}r.pk=kk;
r.ms.forEach(function(q,n){var p=kk-n*.045;q.visible=p>=0;if(p>=0)q.position.lerpVectors(r.a,r.b,p)})});
if(!rm){core.rotation.y=t*.5;core.rotation.x=t*.2;rA.rotation.z=t*.6;rB.rotation.x=t*.35;pl.intensity=1.3+.3*Math.sin(t*3);
LED.forEach(function(l){if(Math.random()<.03)l.material.color.setHex(Math.random()<.5?AMB:TEAL)})}
C.scale.setScalar(stage===1?1+.07*Math.sin(t*5):1);hud();
lab("l0",new T.Vector3(-6.5,2,0));lab("l1",new T.Vector3(0,3.2,0));lab("l2",new T.Vector3(6.5,2,0));R.render(S,cam)}
var ptr={},mv=0,pd=0;
function pdist(){var q=Object.keys(ptr);return Math.hypot(ptr[q[0]].x-ptr[q[1]].x,ptr[q[0]].y-ptr[q[1]].y)}
cv.addEventListener("pointerdown",function(e){ptr[e.pointerId]={x:e.clientX,y:e.clientY};mv=0;auto=false;try{cv.setPointerCapture(e.pointerId)}catch(x){}if(!dt){dt=1;track("3d_drag")}if(Object.keys(ptr).length===2)pd=pdist()});
cv.addEventListener("pointermove",function(e){var p=ptr[e.pointerId];if(e.pointerType==="mouse")hp={x:e.clientX,y:e.clientY};if(!p)return;
if(Object.keys(ptr).length===2){ptr[e.pointerId]={x:e.clientX,y:e.clientY};var dd=pdist();if(pd)zt=Math.max(.45,Math.min(1.4,zt*pd/dd));pd=dd;return}
var dx=e.clientX-p.x,dy=e.clientY-p.y;mv+=Math.abs(dx)+Math.abs(dy);G.rotation.y+=dx*.008;G.rotation.x=Math.max(-.25,Math.min(.7,G.rotation.x+dy*.004));ptr[e.pointerId]={x:e.clientX,y:e.clientY}});
function up(e){var n=Object.keys(ptr).length;delete ptr[e.pointerId];
if(n===1&&e.type==="pointerup"&&mv<8){var q=pick(e.clientX,e.clientY);if(q>=0){ST[q]=(ST[q]+1)%3;apply();say();track("3d_laptop",{i:q,s:ST[q]});tip(q,e.clientX,e.clientY);clearTimeout(tipT);tipT=setTimeout(function(){tipT=0;if(!hp)tip(-1)},2600)}else tip(-1)}pd=0}
["pointerup","pointercancel"].forEach(function(n){cv.addEventListener(n,up)});
cv.addEventListener("pointerleave",function(){hp=null});
var lp=$("lp");for(var n=0;n<6;n++){(function(n){var b=document.createElement("button");b.type="button";b.onclick=function(){ST[n]=(ST[n]+1)%3;apply();say();track("3d_laptop",{i:n,s:ST[n]})};lp.appendChild(b);LB.push(b)})(n)}
apply();say();fr()}
function load(){if(window.THREE){init3d();return}var sc=document.createElement("script");sc.src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";sc.onload=init3d;sc.onerror=init3d;document.head.appendChild(sc)}
if("IntersectionObserver"in window){var lo=new IntersectionObserver(function(e){if(e[0].isIntersecting){lo.disconnect();load()}},{rootMargin:"700px"});lo.observe(c0.parentNode)}else load();
})();
