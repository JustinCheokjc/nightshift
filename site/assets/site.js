var BRAND="Nightshift",CONTACT="justincheok@hotmail.com",FORM_URL="";
var SUPABASE_URL="https://ifnlcchbjmynxwjseyqz.supabase.co",SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmbmxjY2hiam15bnh3anNleXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4MzkyNzUsImV4cCI6MjEwNjQxNTI3NX0.DC5T4VEoodqSDp9I_Q2vgtW6gMUnue37JYvCiBfr1Dg";
var PAGE=document.body.dataset.page;
// Old single-page links (/#join, /#faq ...) now live on their own pages
(function(){var h=location.hash.slice(1),R={contributors:"/contributors/",buyers:"/buyers/",pricing:"/buyers/",trust:"/trust/",about:"/about/",faq:"/about/#faq",join:"/join/"};if(PAGE==="home"&&R[h])location.replace(R[h])})();
var EV=[];function track(n,d){var e={n:n,d:d||{},t:Date.now()};EV.push(e);window.dataLayer=window.dataLayer||[];window.dataLayer.push(e);if(window.posthog)try{window.posthog.capture(n,d||{})}catch(x){}if(window.NS_TRACK)try{window.NS_TRACK(e)}catch(x){}}
var V=[["home","Home","/"],["contributors","Contributors","/contributors/"],["buyers","Buyers","/buyers/"],["trust","Trust","/trust/"],["about","About","/about/"],["join","Join","/join/"]];
var nv=document.getElementById("nv"),$=function(i){return document.getElementById(i)},mb=$("mb2");
mb.onclick=function(){var o=nv.classList.toggle("open");mb.setAttribute("aria-expanded",o)};
document.addEventListener("keydown",function(e){if(e.key==="Escape"){nv.classList.remove("open");mb.setAttribute("aria-expanded","false")}});
V.forEach(function(v){var a=document.createElement("a");a.href=v[2];a.textContent=v[1];if(v[0]==="join")a.className="j";if(v[0]===PAGE)a.setAttribute("aria-current","page");nv.appendChild(a)});
var reduceMotion=matchMedia("(prefers-reduced-motion: reduce)").matches;
var hasGSAP=!!(window.gsap&&window.ScrollTrigger);
if(hasGSAP)gsap.registerPlugin(ScrollTrigger);
if(!hasGSAP)document.documentElement.classList.add("nojs");
if(!hasGSAP||reduceMotion)document.documentElement.classList.add("nopin");
function heroIntro(){var els=document.querySelectorAll(".hero .rv:not(.in)");if(!els.length)return;
els.forEach(function(el){el.classList.add("in")});
if(reduceMotion||!hasGSAP)return;
gsap.fromTo(els,{opacity:0,y:24},{opacity:1,y:0,duration:.8,ease:"power3.out",stagger:.1,delay:.1})}
function watch(){heroIntro();if(hasGSAP)ScrollTrigger.refresh();
document.querySelectorAll(".view.on .rv:not(.in)").forEach(function(el){
if(el.closest(".hero"))return;
if(reduceMotion||!hasGSAP){el.classList.add("in");return}
var kids=el.querySelectorAll(":scope > .card, :scope > .tile, :scope > .st, :scope > div > .card");
var targets=kids.length>1?kids:el;
gsap.fromTo(targets,{opacity:0,y:28},{opacity:1,y:0,duration:.7,ease:"power3.out",stagger:kids.length>1?.08:0,
scrollTrigger:{trigger:el,start:"top 88%",once:true,onEnter:function(){el.classList.add("in")}}})})}
if(hasGSAP&&!reduceMotion){
document.addEventListener("mouseenter",function(e){var b=e.target.closest&&e.target.closest(".btn");if(b)gsap.to(b,{y:-2,boxShadow:"0 8px 20px rgba(10,30,40,.18)",duration:.2,ease:"power2.out"})},true);
document.addEventListener("mouseleave",function(e){var b=e.target.closest&&e.target.closest(".btn");if(b)gsap.to(b,{y:0,boxShadow:"0 1px 2px rgba(0,0,0,.14)",duration:.2,ease:"power2.out"})},true)}
if(hasGSAP&&!reduceMotion&&matchMedia("(pointer: fine)").matches){
document.querySelectorAll(".btn").forEach(function(b){
var bx=gsap.quickTo(b,"x",{duration:.3,ease:"power3"}),by=gsap.quickTo(b,"y",{duration:.3,ease:"power3"});
b.addEventListener("mousemove",function(e){var r=b.getBoundingClientRect();bx((e.clientX-r.left-r.width/2)*.25);by((e.clientY-r.top-r.height/2)*.25)});
b.addEventListener("mouseleave",function(){bx(0);by(0)})})}
function initPinSequence(trackSel,panelSel,dotsSel){
var track=document.querySelector(trackSel);if(!track)return;
var panels=document.querySelectorAll(panelSel),dots=document.querySelectorAll(dotsSel);
if(reduceMotion||!hasGSAP)return;
ScrollTrigger.create({trigger:track,start:"top top",end:"bottom bottom",scrub:true,
onUpdate:function(self){var idx=Math.min(panels.length-1,Math.floor(self.progress*panels.length));
panels.forEach(function(p,i){p.classList.toggle("on",i===idx)});
dots.forEach(function(d,i){d.classList.toggle("on",i===idx)})}})}
function initHeroParallax(){
if(!hasGSAP||reduceMotion)return;
var hero=document.querySelector(".hero");if(!hero)return;
var loop=document.querySelector(".hero-loop"),hv=document.querySelector(".hero .hv");
if(loop)gsap.to(loop,{y:120,ease:"none",scrollTrigger:{trigger:hero,start:"top top",end:"bottom top",scrub:true}});
if(hv)gsap.to(hv,{y:-60,ease:"none",scrollTrigger:{trigger:hero,start:"top top",end:"bottom top",scrub:true}})}
function parseCountable(text){
var m=text.match(/^([^\d]*)(\d+(?:\.\d+)?)([^\d]*)$/);
if(!m)return null;
return{prefix:m[1],value:parseFloat(m[2]),decimals:(m[2].split(".")[1]||"").length,suffix:m[3]}}
function animateCountUp(el){
if(el.dataset.counted)return;
var parsed=parseCountable(el.textContent.trim());
if(!parsed)return;
el.dataset.counted="1";
if(!hasGSAP||reduceMotion)return;
var obj={v:0};
gsap.to(obj,{v:parsed.value,duration:1,ease:"power2.out",onUpdate:function(){
el.textContent=parsed.prefix+obj.v.toFixed(parsed.decimals)+parsed.suffix}})}
function initCountUps(){
if(!hasGSAP||reduceMotion)return;
document.querySelectorAll(".kpis b, .scr.on .kp b").forEach(function(el){
ScrollTrigger.create({trigger:el,start:"top 90%",once:true,onEnter:function(){animateCountUp(el)}})})}
document.addEventListener("click",function(e){var bt=e.target.closest(".btn");if(bt)track("cta_click",{label:bt.textContent.trim(),page:PAGE});
var s=e.target.closest("[data-scroll]");if(s){e.preventDefault();$(s.dataset.scroll).scrollIntoView({behavior:"smooth"})}});
var sd={};function pbar(){var m=document.documentElement.scrollHeight-innerHeight,pc=m>0?scrollY/m*100:0;$("pb").style.width=pc+"%";[25,50,75,100].forEach(function(k){if(pc>=k-1&&!sd[k]){sd[k]=1;track("scroll_depth",{pct:k,page:PAGE})}})}
$("th").onclick=function(){var r=document.documentElement,d=r.dataset.theme?r.dataset.theme==="dark":matchMedia("(prefers-color-scheme: dark)").matches;r.dataset.theme=d?"light":"dark";try{localStorage.setItem("ns-theme",r.dataset.theme)}catch(e){}};
document.querySelectorAll(".bn").forEach(function(n){n.textContent=BRAND});

// Home: the "day" story
var manual=matchMedia("(prefers-reduced-motion: reduce), (max-width: 640px)").matches;if(manual)document.documentElement.classList.add("man");
function seq(h){h=h%24;return h>=23||h<8?"d":h>=12&&h<13?"d":"u"}
var CAP={u:["In use","You are working. Nightshift stays out of the way."],d:["Idle and plugged in","No input for a while. This is the capacity we measure."]};
var cells=null;
function tick(){var st=$("story");if(!st)return;
var r=st.getBoundingClientRect(),p=manual?$("sc").value/1000:Math.max(0,Math.min(1,-r.top/(r.height-window.innerHeight)));
var t=8+p*24,hh=Math.floor(t)%24,mm=Math.floor((t%1)*60),k=seq(t);
$("ck").textContent=(hh<10?"0":"")+hh+":"+(mm<10?"0":"")+mm;
var s=$("stt");s.textContent=CAP[k][0];s.className="state"+(k==="d"?" idle":"");$("cap").textContent=k==="d"&&t%24>=12&&t%24<13?"Lunch break. A short idle window.":CAP[k][1];
var n=Math.floor(p*48),idle=0;for(var i=0;i<48;i++){cells[i].classList.toggle("on",i<=n);if(i<n&&cells[i].className.indexOf("d")>-1)idle+=.5}
$("ih").textContent=idle.toFixed(1)}
if($("story")){
var sp=$("sp"),bl="";for(var i=0;i<48;i++)bl+='<i class="'+seq(8+i/2)+'"></i>';sp.innerHTML=bl;cells=sp.children;
$("sc").oninput=tick;
$("jp").onclick=function(e){var b=e.target.closest("button");if(!b)return;if(manual){$("sc").value=parseFloat(b.dataset.p)*1000;tick();return}var st=$("story");window.scrollTo({top:st.offsetTop+parseFloat(b.dataset.p)*(st.offsetHeight-innerHeight),behavior:"smooth"})}}
var tk=false;window.addEventListener("scroll",function(){if(!tk){tk=true;requestAnimationFrame(function(){tk=false;tick();pbar()})}},{passive:true});

// Home: capacity estimator
var cores=8,shown=0,raf;function calc(){var h=+$("ch").value;$("chv").textContent=h;$("bf").style.width=h/24*100+"%";$("dp").textContent="That is "+Math.round(h/24*100)+"% of your day.";var to=Math.round(h*cores*30*.75),from=shown,t0=performance.now();cancelAnimationFrame(raf);(function st(n){var k=Math.min(1,(n-t0)/450),e=1-Math.pow(1-k,3);shown=Math.round(from+(to-from)*e);$("cr").textContent=shown.toLocaleString();if(k<1)raf=requestAnimationFrame(st)})(t0)}
if($("ch")){
var cu=0;$("ch").oninput=function(){if(!cu){cu=1;track("calc_used")}calc()};document.querySelectorAll("#lt button").forEach(function(b){b.onclick=function(){cores=+b.dataset.c;document.querySelectorAll("#lt button").forEach(function(x){x.setAttribute("aria-pressed",x===b)});calc()}});
calc()}
if($("h1")&&/[?&]h=b/.test(location.search))$("h1").innerHTML="Your laptop sleeps.<br><span class='g'>Your hours do not have to.</span>";

// Home: product preview tabs
if($("mn")){var mn="";for(var i=0;i<24;i++)mn+='<i class="'+seq(8+i)+'"></i>';$("mn").innerHTML=mn}
var pt=document.querySelectorAll("#ps [role=tab]"),sc=document.querySelectorAll(".scr");
function pickTab(i,focus){pt.forEach(function(x,j){x.setAttribute("aria-selected",j===i);x.tabIndex=j===i?0:-1;sc[j].classList.toggle("on",j===i)});if(focus)pt[i].focus();sc[i].querySelectorAll(".kp b").forEach(animateCountUp);track("screen_view",{s:i})}
pt.forEach(function(b,i){b.onclick=function(){pickTab(i)};b.onkeydown=function(e){var n=pt.length,k={ArrowRight:(i+1)%n,ArrowLeft:(i+n-1)%n,Home:0,End:n-1}[e.key];if(k!==undefined){e.preventDefault();pickTab(k,true)}}});

// Contributors: eligibility check
var ed=0,ecs=document.querySelectorAll("#elg input");function ev(){var n=0,miss=null;ecs.forEach(function(c){if(c.checked)n++;else if(!miss)miss=c.dataset.m});
$("eb").style.width=n/ecs.length*100+"%";$("en").textContent=n+" of "+ecs.length;var r=$("er");
if(n===ecs.length){if(!ed){ed=1;track("eligibility_complete")}r.textContent="You look eligible. Join the pilot to get the consent form.";r.style.color="var(--acc)";$("ej").style.display="inline-block"}else{r.textContent="Still needed: "+miss;r.style.color="var(--mut)";$("ej").style.display="none"}}
if(ecs.length){ecs.forEach(function(c){c.onchange=ev});ev()}

// Join: sign-up form
if($("jf"))$("jf").onsubmit=function(e){e.preventDefault();var em=$("e").value,ty=$("t").value,os=$("o").value,isBuyer=ty.indexOf("buyer")>-1;track("form_submit",{type:ty});
var body="Email: "+em+"\nJoining as: "+ty+"\nOS: "+os;$("mb").href="mailto:"+CONTACT+"?subject="+encodeURIComponent(BRAND+" pilot request")+"&body="+encodeURIComponent(body);
var submitBtn=$("jf").querySelector('button[type="submit"]');submitBtn.disabled=true;submitBtn.textContent="Sending...";$("jerr").style.display="none";
fetch(SUPABASE_URL+"/rest/v1/signups",{method:"POST",headers:{"Content-Type":"application/json",apikey:SUPABASE_ANON_KEY,Authorization:"Bearer "+SUPABASE_ANON_KEY,Prefer:"return=minimal"},
body:JSON.stringify({email:em,role:isBuyer?"buyer":"contributor",os:os,consent_version:"v1"})})
.then(function(r){if(!r.ok&&r.status!==409)throw new Error("signup failed");
if(FORM_URL){try{fetch(FORM_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:em,type:ty,os:os})})}catch(x){}}
$("dh").textContent=isBuyer?"We will be in touch about your workload":"You are on the list";$("jf").style.display="none";$("done").style.display="block"})
.catch(function(){submitBtn.disabled=false;submitBtn.textContent="Request access";$("jerr").style.display="block"})};
if($("jf")&&/[?&]as=buyer/.test(location.search))$("t").selectedIndex=1;

if(reduceMotion)document.querySelectorAll("animateMotion").forEach(function(a){a.remove()});
track("page_view",{id:PAGE});
watch();tick();pbar();initPinSequence(".steps-pin-track",".step-panel",".steps-pin-dots i");initHeroParallax();initCountUps();
