/* Boardgamegeek: 3D-Comic-Sprecher fuer die Stunden-News (three.js, Toon-Shading + Konturen) */
(function(){
const MEEPLE="M100 18C122 18 132 34 132 50C132 64 124 72 120 76C144 80 184 90 184 110C184 122 168 122 152 118C144 116 140 122 144 134L164 206C168 216 160 218 152 218L116 218C110 218 106 214 104 206L100 190L96 206C94 214 90 218 84 218L48 218C40 218 32 216 36 206L56 134C60 122 56 116 48 118C32 122 16 122 16 110C16 90 56 80 80 76C76 72 68 64 68 50C68 34 78 18 100 18";
const INK=0x111111, BLUE=0x00a6ed, RED=0xff3d3d, WHITE=0xffffff, GREY=0x3a3a3a;
let R=null,scene,cam,root,eyes=[],pupils=[],mouth,prop,micArm,shadow,raf=0,t0=0,last=0,talkUntil=0,hopAt=-9,nextBlink=2,reduce=false,host=null;

function shape(){
  const s=new THREE.Shape(),tk=MEEPLE.match(/[MCL]|-?[\d.]+/g);let i=0,c;
  const n=()=>+tk[i++],p=()=>{const x=n(),y=n();return[(x-100)/100,(130-y)/100];};
  while(i<tk.length){if(/[MCL]/.test(tk[i]))c=tk[i++];
    if(c==="M")s.moveTo(...p());else if(c==="L")s.lineTo(...p());
    else{const a=p(),b=p(),d=p();s.bezierCurveTo(...a,...b,...d);}}
  return s;
}
function toon(color){
  const g=new THREE.DataTexture(new Uint8Array([90,90,90,255,175,175,175,255,255,255,255,255]),3,1,THREE.RGBAFormat);
  g.minFilter=g.magFilter=THREE.NearestFilter;g.needsUpdate=true;
  return new THREE.MeshToonMaterial({color,gradientMap:g});
}
const inkMat=()=>new THREE.MeshBasicMaterial({color:INK,side:THREE.BackSide});
function part(geo,color,line=.12){            // Mesh + schwarze Comic-Kontur (inverted hull)
  const m=new THREE.Mesh(geo,toon(color));
  if(line){const o=new THREE.Mesh(geo,inkMat());o.scale.setScalar(1+line);m.add(o);}
  return m;
}

function build(){
  scene=new THREE.Scene();
  cam=new THREE.PerspectiveCamera(30,.8,.1,50);cam.position.set(0,.4,5.1);cam.lookAt(0,.28,0);
  scene.add(new THREE.AmbientLight(0xffffff,.35));
  const sun=new THREE.DirectionalLight(0xffffff,.75);sun.position.set(-2.5,3,4);scene.add(sun);

  root=new THREE.Group();scene.add(root);
  const D=.34,ex={depth:D,bevelEnabled:true,bevelThickness:.07,bevelSize:.06,bevelSegments:4,curveSegments:18};
  const body=new THREE.Mesh(new THREE.ExtrudeGeometry(shape(),ex).translate(0,0,-D/2),toon(BLUE));
  const hull=new THREE.Mesh(new THREE.ExtrudeGeometry(shape(),{...ex,bevelThickness:.11,bevelSize:.11}).translate(0,0,-D/2),inkMat());
  root.add(body,hull);
  const F=D/2+.07;                              // Vorderseite

  // Augen + dicke Nerdbrille
  [-.125,.125].forEach(x=>{
    const e=new THREE.Mesh(new THREE.SphereGeometry(.075,20,14),toon(WHITE));e.scale.z=.35;e.position.set(x,.83,F+.005);root.add(e);eyes.push(e);
    const p=new THREE.Mesh(new THREE.SphereGeometry(.034,14,10),new THREE.MeshBasicMaterial({color:INK}));p.position.set(x,.82,F+.03);root.add(p);pupils.push({m:p,x,y:.82});
    const rim=new THREE.Mesh(new THREE.TorusGeometry(.1,.024,10,32),toon(INK));rim.position.set(x,.83,F+.03);root.add(rim);
  });
  const bridge=new THREE.Mesh(new THREE.CylinderGeometry(.016,.016,.06,8),toon(INK));bridge.rotation.z=Math.PI/2;bridge.position.set(0,.85,F+.03);root.add(bridge);
  // Mund
  mouth=part(new THREE.SphereGeometry(.07,20,12),0x8a0016,.18);mouth.scale.set(1.9,.3,.3);mouth.position.set(0,.645,F+.01);root.add(mouth);
  // Wangen
  [-.2,.2].forEach(x=>{const c=new THREE.Mesh(new THREE.CircleGeometry(.04,16),new THREE.MeshBasicMaterial({color:0xff8fa0}));c.position.set(x,.7,F+.002);root.add(c);});
  // Fliege
  const bow=new THREE.Group();bow.position.set(0,.5,F+.04);root.add(bow);
  [-1,1].forEach(s=>{const w=part(new THREE.ConeGeometry(.075,.15,3),RED,.16);w.rotation.z=s*Math.PI/2;w.position.x=s*.07;bow.add(w);});
  bow.add(part(new THREE.SphereGeometry(.035,12,10),RED,.25));
  // Propellermuetze
  const cap=new THREE.Group();cap.position.set(0,1.03,0);root.add(cap);
  const dome=part(new THREE.SphereGeometry(.32,28,14,0,Math.PI*2,0,Math.PI/2),RED,.06);dome.scale.set(1.08,.78,1.05);cap.add(dome);
  const band=part(new THREE.TorusGeometry(.32,.035,10,36),0xffcc00,.15);band.rotation.x=Math.PI/2;band.scale.set(1.08,1.05,1);cap.add(band);
  const stick=part(new THREE.CylinderGeometry(.018,.018,.16,8),GREY,.3);stick.position.y=.3;cap.add(stick);
  prop=new THREE.Group();prop.position.y=.39;cap.add(prop);
  [0,Math.PI].forEach((a,i)=>{const b=part(new THREE.BoxGeometry(.26,.02,.08),i?WHITE:BLUE,.12);b.position.x=Math.cos(a)*.14;b.rotation.x=.35*(i?-1:1);prop.add(b);});
  prop.add(part(new THREE.SphereGeometry(.03,10,8),0xffcc00,.3));
  // Mikrofon in der rechten Hand
  micArm=new THREE.Group();micArm.position.set(.72,.22,.3);root.add(micArm);
  const handle=part(new THREE.CylinderGeometry(.035,.028,.34,12),GREY,.15);handle.position.y=.05;micArm.add(handle);
  const head=part(new THREE.SphereGeometry(.085,16,12),0x555555,.12);head.position.y=.25;micArm.add(head);
  const ring=part(new THREE.TorusGeometry(.07,.016,8,20),RED,.2);ring.rotation.x=Math.PI/2;ring.position.y=.17;micArm.add(ring);
  micArm.rotation.z=.55;
  // harter Comic-Schatten
  shadow=new THREE.Mesh(new THREE.CircleGeometry(.75,32),new THREE.MeshBasicMaterial({color:INK,transparent:true,opacity:.28}));
  shadow.rotation.x=-Math.PI/2;shadow.scale.set(1,.35,1);shadow.position.y=-.95;scene.add(shadow);
}

const easeBack=x=>{const c=1.9;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2);};
function frame(now){
  raf=requestAnimationFrame(frame);
  const t=(now-t0)/1000,dt=Math.min(.05,(now-last)/1000);last=now;
  // Auftritt: von oben reinwirbeln
  const k=reduce?1:Math.min(1,t/1.1),e=easeBack(k);
  root.scale.setScalar(Math.max(.01,e));
  root.position.y=(1-e)*2.2+(reduce?0:Math.sin(t*2.6)*.045);
  root.rotation.y=(1-e)*-Math.PI*2+(reduce?0:Math.sin(t*.7)*.32);
  root.rotation.z=reduce?0:Math.sin(t*1.3)*.045;
  // kleiner Hopser bei jeder neuen Meldung
  const h=t-hopAt;if(h>0&&h<.45&&!reduce)root.position.y+=Math.sin(h/.45*Math.PI)*.18;
  shadow.scale.set(1-(root.position.y*.25),.35,1);
  // Propeller
  prop.rotation.y+=dt*(reduce?0:14);
  // Blinzeln
  if(t>nextBlink){const b=t-nextBlink;const s=b<.14?1-Math.sin(b/.14*Math.PI)*.92:1;eyes.forEach(m=>m.scale.y=s);if(b>.14)nextBlink=t+2+Math.random()*3;}
  // Pupillen wandern
  pupils.forEach(p=>{p.m.position.x=p.x+Math.sin(t*.9)*.02;p.m.position.y=p.y+Math.cos(t*.6)*.012;});
  // Reden
  const talking=now<talkUntil&&!reduce;
  const target=talking?.3+.75*Math.abs(Math.sin(t*16)*Math.sin(t*6.7+1)):.3;
  mouth.scale.y+=(target-mouth.scale.y)*Math.min(1,dt*25);
  micArm.rotation.z=.55+(talking?Math.sin(t*9)*.06:0);
  R.render(scene,cam);
}

window.Geek3D={
  ok(){
    if(R)return true;
    try{
      if(!window.THREE)return false;
      R=new THREE.WebGLRenderer({antialias:true,alpha:true});
      R.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
      build();return true;
    }catch(err){R=null;return false;}
  },
  mount(el){
    if(!this.ok()||!el)return;host=el;
    reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.appendChild(R.domElement);R.domElement.style.cssText="width:100%;height:100%;display:block";
    const w=el.clientWidth||300,h=el.clientHeight||375;R.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();
    cancelAnimationFrame(raf);t0=last=performance.now();nextBlink=2;hopAt=-9;talkUntil=0;raf=requestAnimationFrame(frame);
  },
  say(ms){const now=performance.now();talkUntil=Math.max(talkUntil,now)+ms;hopAt=(now-t0)/1000;},
  stop(){cancelAnimationFrame(raf);raf=0;}
};
})();
