// Renders the site's 3D scenes in headless Chromium. Env: SITE, WORK, THREE_JS.
const {chromium}=require('playwright');const fs=require('fs');
const THREE_LOCAL=process.env.THREE_JS;const OUT=process.env.WORK;
const EXE=fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined;
(async()=>{
 const b=await chromium.launch({executablePath:EXE,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const p=await b.newPage({viewport:{width:1400,height:900}});
 p.on('pageerror',e=>console.log('PAGEERR',e.message));p.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text())});
 await p.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/three/,r=>r.fulfill({path:THREE_LOCAL,contentType:'application/javascript'}));
 await p.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
 await p.goto('file://'+process.env.SITE+'/index.html');await p.evaluate(()=>localStorage.clear());await p.reload();
 await p.evaluate(()=>window.RP.loadThree());
 const DUSK={sky:[[0,"#0a1522"],[0.22,"#1d3349"],[0.36,"#7a5a55"],[0.44,"#d08a55"],[0.52,"#efb57a"],[1,"#efb57a"]],fog:[6045520,110,360],sunPos:[-45,9,35],sunCol:16757606,hemi:0.26,exp:0.96,lit:0.5};
 const DAY={sky:[[0,"#4f7aa3"],[0.35,"#9db8d0"],[0.5,"#dde6ee"],[1,"#e6ecf1"]],fog:[14478062,120,420],sunPos:[35,40,28],hemi:0.42,exp:0.97,lit:0.06};
 const shots=[{file:OUT+'/hero.png',w:2000,h:1000,preset:'twin',th:-0.45,ph:1.4,rk:0.95,dx:-3,dy:2,...DUSK},
  {file:OUT+'/cutaway.png',w:1600,h:900,cut:true,th:-0.85,ph:0.95,rk:0.9,...DAY},
  {file:OUT+'/type-tower.png',w:1200,h:800,preset:'tower',th:-0.62,ph:1.33,rk:1.25,dy:-2,...DUSK},
  {file:OUT+'/type-shuttle.png',w:1200,h:800,preset:'shuttle',th:-0.55,ph:1.3,rk:1.0,...DAY},
  {file:OUT+'/type-twin.png',w:1200,h:800,preset:'twin',th:-0.3,ph:1.32,rk:0.95,...DUSK},
  {file:OUT+'/type-under.png',w:1200,h:800,preset:'under',under:true,th:-0.8,ph:0.78,rk:1.05,...DAY},
  {file:OUT+'/cabinet.png',w:1200,h:900,kind:'cab',cab:'LFC-1',bg:12305077,sky:[[0,"#cfd3d0"],[0.6,"#b9bdba"],[1,"#8f9491"]],sunPos:[3,7,5],th:-0.42,ph:1.42,rk:1.45,dx:0.12,shadow:3,exp:0.82,hemi:0.35}];
 for(const sh of shots){
  const data=await p.evaluate(async(sh)=>{
    const RP=window.RP;const el=document.createElement('div');el.style.cssText=`position:fixed;left:0;top:0;width:${sh.w}px;height:${sh.h}px;z-index:9999`;document.body.appendChild(el);
    Object.defineProperty(window,'devicePixelRatio',{value:1,configurable:true});
    let out;const SS=sh.ss||2;el.style.width=(sh.w*SS)+'px';el.style.height=(sh.h*SS)+'px';
    const run=()=>{const V=RP.View3D(el,{keep:true,still:true,bg:sh.bg??0x15202a,shadowBox:sh.shadow||70,exposure:sh.exp||1.05,sun:sh.sun||1.3});
      const T3=V.T3;
      V.sun.shadow.mapSize.set(4096,4096);
      if(sh.sky)RP.skyEnv(V,sh.sky,new T3.Vector3(...(sh.sunPos||[30,45,25])));
      if(sh.fog)V.scene.fog=new T3.Fog(sh.fog[0],sh.fog[1],sh.fog[2]);
      if(sh.sunPos)V.sun.position.set(...sh.sunPos);if(sh.sunCol)V.sun.color.setHex(sh.sunCol);if(sh.hemi)V.hemi.intensity=sh.hemi;
      let ctr,R;
      if(sh.kind==='cab'){const S=RP.getS();const M=RP.getM();const c=M.cabs.find(x=>x.id===sh.cab);const B=RP.cabinetBuild(c);const C=RP.buildCabinet3D(V,B);C.door.rotation.y=sh.door??-1.95;C.parts.forEach(a=>a.forEach(o=>o.visible=true));ctr=C.center;R=Math.max(C.W,C.H)*(sh.rk||2)}
      else{const G=RP.buildGarage(V,{underground:sh.under,lights:true,fill:sh.fill,cut:sh.cut,lit:sh.lit});ctr=G.center;R=Math.max(G.len,G.top*1.8)*(sh.rk||1.1)}
      V.ticks.forEach(f=>f(sh.t||3));
      V.focus(ctr.x+(sh.dx||0),ctr.y+(sh.dy||0),ctr.z+(sh.dz||0),R,sh.th,sh.ph);
      out=V.shot('image/png');V.dispose();el.remove()};
    if(sh.preset)RP.withPreset(RP.PRESETS.find(x=>x.id===sh.preset).p,run);else run();
    return out},sh);
  fs.writeFileSync(sh.file,Buffer.from(data.split(',')[1],'base64'));console.log('wrote',sh.file);
 }
 await b.close();})();
