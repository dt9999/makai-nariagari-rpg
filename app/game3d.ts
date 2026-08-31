import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type RenderRegion={id:string;name:string;x:number;y:number;w:number;h:number;biome:string;color:string;owner:'unknown'|'wild'|'enemy'|'own';landmark:string};
type RenderMob={id:number;x:number;y:number;hp:number;max:number;name:string;tier:number;boss?:boolean;ally?:boolean;home:string};
type RenderNode={id:number;x:number;y:number;kind:'wood'|'ore';n:number};
export type RenderWorld={x:number;y:number;hp:number;maxHp:number;job:string;guarding:boolean;dodgeTime:number;attackAnim:number;facingX:number;facingY:number;conquered:string[];mobs:RenderMob[];nodes:RenderNode[]};

const SCALE=.018,CENTER_X=1200,CENTER_Y=780;
const worldX=(x:number)=>(x-CENTER_X)*SCALE;
const worldZ=(y:number)=>(y-CENTER_Y)*SCALE;
const owner=(world:RenderWorld,region:RenderRegion)=>world.conquered.includes(region.id)?'own':region.owner;

const mats={
 stone:new THREE.MeshStandardMaterial({color:0x625e69,roughness:.98,metalness:.02}),
 stoneDark:new THREE.MeshStandardMaterial({color:0x302e39,roughness:1}),
 stoneLight:new THREE.MeshStandardMaterial({color:0x8a8490,roughness:.93}),
 wood:new THREE.MeshStandardMaterial({color:0x5f331f,roughness:.9,metalness:0}),
 woodCut:new THREE.MeshStandardMaterial({color:0xb47b48,roughness:.78}),
 iron:new THREE.MeshStandardMaterial({color:0x48505c,roughness:.28,metalness:.88}),
 silver:new THREE.MeshStandardMaterial({color:0xa9b4c4,roughness:.2,metalness:.95}),
 gold:new THREE.MeshStandardMaterial({color:0xb77a27,roughness:.24,metalness:.88}),
 leather:new THREE.MeshStandardMaterial({color:0x3e211b,roughness:.84}),
 cloth:new THREE.MeshStandardMaterial({color:0x482f60,roughness:.92}),
 skin:new THREE.MeshStandardMaterial({color:0x8f5aa5,roughness:.72}),
 eye:new THREE.MeshStandardMaterial({color:0xffcf5b,emissive:0xff5a10,emissiveIntensity:2,roughness:.2}),
 enemy:new THREE.MeshStandardMaterial({color:0x9d3143,roughness:.68}),
 ally:new THREE.MeshStandardMaterial({color:0x319c7c,roughness:.66}),
 foliage:new THREE.MeshStandardMaterial({color:0x193f35,roughness:.96}),
 deadFoliage:new THREE.MeshStandardMaterial({color:0x49372e,roughness:1}),
 lava:new THREE.MeshStandardMaterial({color:0xff5b24,emissive:0xff2400,emissiveIntensity:2.8,roughness:.38}),
 crystal:new THREE.MeshStandardMaterial({color:0x9c68e8,emissive:0x421983,emissiveIntensity:1.8,roughness:.2,metalness:.15}),
 shadow:new THREE.MeshBasicMaterial({color:0x05030a,transparent:true,opacity:.38,depthWrite:false}),
};

const geo={
 sphere:new THREE.SphereGeometry(1,12,9),
 lowSphere:new THREE.DodecahedronGeometry(1,0),
 cylinder:new THREE.CylinderGeometry(1,1,1,8),
 cone:new THREE.ConeGeometry(1,1,8),
 box:new THREE.BoxGeometry(1,1,1),
 rock:new THREE.DodecahedronGeometry(1,0),
 octa:new THREE.OctahedronGeometry(1,0),
};

function mesh(geometry:THREE.BufferGeometry,material:THREE.Material,scale:[number,number,number],position:[number,number,number],parent:THREE.Object3D,cast=true){
 const m=new THREE.Mesh(geometry,material);m.scale.set(...scale);m.position.set(...position);m.castShadow=cast;m.receiveShadow=true;parent.add(m);return m;
}

function addShadow(parent:THREE.Object3D,r=.52){
 const s=mesh(new THREE.CircleGeometry(r,20),mats.shadow,[1,.46,1],[0,.025,0],parent,false);s.rotation.x=-Math.PI/2;s.receiveShadow=false;return s;
}

function addEyes(parent:THREE.Object3D,y:number,z:number,space=.1,size=.04){
 mesh(geo.sphere,mats.eye,[size,size*.65,size*.45],[-space,y,z],parent,false);
 mesh(geo.sphere,mats.eye,[size,size*.65,size*.45],[space,y,z],parent,false);
}

function buildWeapon(job:string,color:number){
 const root=new THREE.Group(),magic=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.75,roughness:.25,metalness:.55});
 const handle=()=>{const h=mesh(geo.cylinder,mats.leather,[.045,.38,.045],[0,.18,0],root);return h};
 if(job==='mage'||job==='nightseer'){
  mesh(geo.cylinder,mats.wood,[.045,.83,.045],[0,.1,0],root);mesh(geo.sphere,magic,[.17,.17,.17],[0,1,0],root);mesh(new THREE.TorusGeometry(.22,.025,6,14),mats.gold,[1,1,1],[0,1,0],root).rotation.x=Math.PI/2;
 }else if(job==='lancer'||job==='dragoon'){
  mesh(geo.cylinder,mats.wood,[.035,1.05,.035],[0,.15,0],root);mesh(geo.cone,magic,[.11,.45,.11],[0,1.4,0],root);mesh(geo.cylinder,mats.gold,[.08,.035,.08],[0,.94,0],root);
 }else if(job==='shadow'){
  for(const side of [-1,1]){const dagger=new THREE.Group();dagger.position.x=side*.12;mesh(geo.cylinder,mats.leather,[.035,.16,.035],[0,.02,0],dagger);mesh(geo.box,magic,[.07,.42,.025],[0,.34,0],dagger);mesh(geo.box,mats.gold,[.17,.035,.05],[0,.16,0],dagger);dagger.rotation.z=side*.12;root.add(dagger)}
 }else if(job==='berserker'||job==='warlock'){
  handle();mesh(geo.box,magic,[.14,.92,.065],[0,.96,0],root);mesh(geo.box,mats.iron,[.54,.22,.1],[0,1.55,0],root);mesh(geo.box,mats.gold,[.32,.055,.11],[0,.57,0],root);
 }else if(job==='ruler'){
  mesh(geo.cylinder,mats.iron,[.045,.68,.045],[0,.25,0],root);mesh(new THREE.TorusGeometry(.2,.045,6,16),magic,[1,1,1],[0,1,0],root);mesh(geo.sphere,mats.eye,[.08,.08,.08],[0,1,0],root);
 }else{
  handle();mesh(geo.box,magic,[.1,.75,.035],[0,.86,0],root);mesh(geo.box,mats.gold,[.34,.055,.08],[0,.42,0],root);
 }
 root.userData.magicMaterial=magic;return root;
}

function buildPlayer(job:string){
 const root=new THREE.Group();addShadow(root,.57);
 const body=new THREE.Group();root.add(body);
 const jobColors:Record<string,number>={blade:0x8454c4,berserker:0xc34738,mage:0x4d66cc,shadow:0x278f82,lancer:0xb18235,ruler:0xb85282,warlock:0xd55236,nightseer:0x5376cd,dragoon:0xad8c35};
 const color=jobColors[job]||0x5d3b79,cloth=new THREE.MeshStandardMaterial({color,roughness:.88}),armor=job==='mage'||job==='ruler'||job==='shadow'?mats.leather:mats.iron;
 const legs:THREE.Mesh[]=[];
 for(const side of [-1,1]){
  const leg=mesh(new RoundedBoxGeometry(.23,.56,.27,2,.05),cloth,[1,1,1],[side*.18,.43,0],body);legs.push(leg);
  mesh(new RoundedBoxGeometry(.27,.22,.38,2,.05),mats.leather,[1,1,1],[side*.18,.16,.07],body);
 }
 mesh(new RoundedBoxGeometry(.72,.88,.44,3,.08),cloth,[1,1,1],[0,1.08,0],body);
 mesh(new RoundedBoxGeometry(.65,.5,.12,2,.04),armor,[1,1,1],[0,1.2,.25],body);
 mesh(geo.box,mats.leather,[.4,.07,.27],[0,.76,0],body);
 mesh(geo.cylinder,mats.gold,[.055,.035,.055],[0,.76,.28],body).rotation.x=Math.PI/2;
 const arms:THREE.Mesh[]=[];
 for(const side of [-1,1]){
  mesh(geo.sphere,armor,[.2,.16,.23],[side*.49,1.38,0],body);
  const arm=mesh(geo.cylinder,cloth,[.105,.37,.105],[side*.52,1.02,.02],body);arm.rotation.z=side*.08;arms.push(arm);
  mesh(geo.sphere,mats.skin,[.11,.11,.11],[side*.54,.67,.04],body);
 }
 mesh(geo.sphere,mats.skin,[.3,.34,.29],[0,1.9,.02],body);
 mesh(new THREE.SphereGeometry(1,12,8,0,Math.PI*2,0,Math.PI*.58),cloth,[.34,.28,.32],[0,2.03,-.01],body);
 addEyes(body,1.92,.285,.105,.045);
 for(const side of [-1,1]){const horn=mesh(geo.cone,mats.iron,[.09,.36,.09],[side*.23,2.29,0],body);horn.rotation.z=side*-.34}
 const cape=mesh(new RoundedBoxGeometry(.61,.82,.045,2,.02),cloth,[1,1,1],[0,1.06,-.26],body);cape.rotation.x=-.08;
 const weapon=buildWeapon(job,color);weapon.position.set(.63,.67,.03);weapon.rotation.z=-.32;body.add(weapon);
 const shield=new THREE.Group();shield.position.set(-.62,1.03,.24);const plate=mesh(new THREE.CylinderGeometry(.34,.27,.12,10),mats.iron,[1,1,1],[0,0,0],shield);plate.rotation.x=Math.PI/2;mesh(geo.sphere,mats.gold,[.1,.1,.07],[0,0,.1],shield);shield.visible=false;body.add(shield);
 const aura=mesh(new THREE.RingGeometry(.55,.66,28),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false}),[1,1,1],[0,.07,0],root,false);aura.rotation.x=-Math.PI/2;aura.visible=false;
 root.userData={body,legs,arms,weapon,shield,aura,cloth};return root;
}

function buildHealthBar(boss=false){
 const root=new THREE.Group(),bg=mesh(geo.box,new THREE.MeshBasicMaterial({color:0x130914,transparent:true,opacity:.88}),[boss?1.25:.7,.075,.025],[0,0,0],root,false),fill=mesh(geo.box,new THREE.MeshBasicMaterial({color:boss?0xff375f:0xe95872}),[boss?1.18:.64,.048,.03],[0,0,.01],root,false);bg.receiveShadow=false;fill.receiveShadow=false;root.userData.fill=fill;root.userData.full=boss?1.18:.64;return root;
}

function buildMob(mob:RenderMob){
 const root=new THREE.Group();addShadow(root,mob.boss?.78:.44);const body=new THREE.Group();root.add(body);
 const baseMat=mob.ally?mats.ally:mats.enemy,scale=mob.boss?1.38:1+Math.min(mob.tier,6)*.045;
 if(/ウルフ|ハウンド|サラマンダー/.test(mob.name)){
  mesh(geo.lowSphere,baseMat,[.58,.34,.88],[0,.55,0],body);mesh(geo.lowSphere,baseMat,[.4,.38,.44],[0,.66,.69],body);addEyes(body,.72,1.05,.13,.04);
  for(const side of [-1,1])for(const z of [-.42,.48])mesh(geo.cylinder,mats.leather,[.09,.34,.09],[side*.36,.27,z],body);
  const tail=mesh(geo.cone,baseMat,[.12,.65,.12],[0,.72,-.75],body);tail.rotation.x=-1.08;
  for(const side of [-1,1]){const ear=mesh(geo.cone,mats.iron,[.1,.28,.1],[side*.23,1,.72],body);ear.rotation.z=side*.18}
 }else if(/スライム/.test(mob.name)){
  mesh(new THREE.SphereGeometry(1,16,10,0,Math.PI*2,0,Math.PI*.78),baseMat,[.62,.52,.62],[0,.12,0],body);addEyes(body,.48,.54,.16,.055);
 }else{
  const large=mob.tier>=3||mob.boss;
  for(const side of [-1,1]){mesh(geo.cylinder,baseMat,[large?.16:.12,large?.48:.35,large?.16:.12],[side*(large?.26:.2),large?.46:.34,0],body);mesh(geo.sphere,mats.leather,[large?.17:.13,large?.11:.09,large?.25:.19],[side*(large?.26:.2),.1,.08],body)}
  mesh(new RoundedBoxGeometry(large?.82:.58,large?.85:.66,large?.48:.38,2,.07),baseMat,[1,1,1],[0,large?1.05:.84,0],body);
  if(large){mesh(new RoundedBoxGeometry(.74,.42,.1,2,.04),mats.iron,[1,1,1],[0,1.16,.29],body);for(const side of [-1,1])mesh(geo.sphere,mats.iron,[.24,.18,.26],[side*.48,1.29,0],body)}
  mesh(geo.sphere,baseMat,[large?.34:.27,large?.36:.29,large?.32:.26],[0,large?1.72:1.38,.03],body);addEyes(body,large?1.73:1.4,large?.32:.27,large?.12:.09,large?.05:.04);
  for(const side of [-1,1]){const horn=mesh(geo.cone,mats.iron,[large?.11:.08,large?.38:.28,large?.11:.08],[side*(large?.27:.21),large?2.05:1.68,0],body);horn.rotation.z=side*-.42;mesh(geo.cylinder,baseMat,[large?.13:.1,large?.4:.3,large?.13:.1],[side*(large?.54:.4),large?1.05:.85,.02],body)}
  if(mob.boss){mesh(new THREE.TorusGeometry(.35,.055,6,10),mats.gold,[1,1,1],[0,2.06,0],body).rotation.x=Math.PI/2;const blade=mesh(geo.box,mats.silver,[.12,.92,.045],[.66,1.05,.04],body);blade.rotation.z=-.22}
 }
 body.scale.setScalar(scale);const bar=buildHealthBar(!!mob.boss);bar.position.y=(mob.boss?3.15:2.5)*scale;root.add(bar);root.userData={body,bar};return root;
}

function buildResource(node:RenderNode){
 const root=new THREE.Group();addShadow(root,.32);
 if(node.kind==='wood'){
  for(let i=-1;i<=1;i++){const log=mesh(geo.cylinder,mats.wood,[.13,.5,.13],[i*.18,.22,0],root);log.rotation.z=Math.PI/2;log.rotation.y=i*.18;mesh(geo.cylinder,mats.woodCut,[.132,.012,.132],[i*.18+.5,.22,0],root).rotation.z=Math.PI/2}
 }else{
  for(let i=0;i<3;i++){const crystal=mesh(geo.octa,mats.crystal,[.18+i*.035,.48-i*.07,.18+i*.035],[(i-1)*.22,.38,0],root);crystal.rotation.z=(i-1)*.18}
 }
 return root;
}

function seeded(n:number){const x=Math.sin(n*9283.17+17.3)*43758.5453;return x-Math.floor(x)}

function addScatter(scene:THREE.Scene,region:RenderRegion,index:number){
 const forest=region.biome==='森',count=forest?34:region.biome==='魔族集落'?16:24;
 if(forest){
  const trunks=new THREE.InstancedMesh(geo.cylinder,mats.wood,count),tops=new THREE.InstancedMesh(geo.lowSphere,mats.foliage,count),o=new THREE.Object3D();
  for(let i=0;i<count;i++){const x=region.x+50+seeded(index*91+i)*Math.max(1,region.w-100),y=region.y+50+seeded(index*137+i+30)*Math.max(1,region.h-100),s=.7+seeded(i+index*7)*.65;o.position.set(worldX(x),.55*s,worldZ(y));o.scale.set(.14*s,1.1*s,.14*s);o.updateMatrix();trunks.setMatrixAt(i,o.matrix);o.position.y=1.45*s;o.scale.set(.55*s,.72*s,.55*s);o.rotation.y=seeded(i+77)*Math.PI;o.updateMatrix();tops.setMatrixAt(i,o.matrix)}
  trunks.receiveShadow=tops.receiveShadow=true;scene.add(trunks,tops);return;
 }
 const material=region.biome==='火山'?mats.stoneDark:region.biome==='荒野'?mats.deadFoliage:mats.stone,rocks=new THREE.InstancedMesh(geo.rock,material,count),o=new THREE.Object3D();
 for(let i=0;i<count;i++){const x=region.x+35+seeded(index*117+i)*Math.max(1,region.w-70),y=region.y+35+seeded(index*151+i+20)*Math.max(1,region.h-70),s=.18+seeded(i+index*17)*.42;o.position.set(worldX(x),s*.45,worldZ(y));o.scale.set(s,s*(.55+seeded(i+9)),s);o.rotation.set(seeded(i)*.4,seeded(i+4)*Math.PI,seeded(i+8)*.3);o.updateMatrix();rocks.setMatrixAt(i,o.matrix)}
 rocks.receiveShadow=true;scene.add(rocks);
}

function tower(parent:THREE.Object3D,x:number,z:number,h=1.8){
 mesh(geo.cylinder,mats.stone,[.55,h,.55],[x,h/2,z],parent);mesh(geo.cylinder,mats.stoneDark,[.68,.18,.68],[x,h+.08,z],parent);
 for(let i=0;i<6;i++){const a=i/6*Math.PI*2;mesh(geo.box,mats.stone,[.2,.28,.2],[x+Math.sin(a)*.55,h+.28,z+Math.cos(a)*.55],parent)}
}

function hut(parent:THREE.Object3D,x:number,z:number,cloth=mats.cloth){
 mesh(new RoundedBoxGeometry(1.05,.7,.85,2,.06),mats.wood,[1,1,1],[x,.38,z],parent);const roof=mesh(new THREE.ConeGeometry(.85,.65,4),cloth,[1,1,1],[x,1.03,z],parent);roof.rotation.y=Math.PI/4;mesh(geo.box,mats.stoneDark,[.18,.4,.05],[x,.38,z+.44],parent);
}

function addLandmark(scene:THREE.Scene,region:RenderRegion,index:number){
 const root=new THREE.Group();root.position.set(worldX(region.x+region.w/2),.03,worldZ(region.y+region.h/2));scene.add(root);
 if(region.biome==='森'){hut(root,-1.1,.2);hut(root,.9,-.5,mats.enemy);tower(root,0,1.1,1.25);}
 else if(region.biome==='魔族集落'){hut(root,-1.25,.25,mats.enemy);hut(root,0,-.55,mats.cloth);hut(root,1.25,.2,mats.enemy);mesh(geo.cylinder,mats.wood,[.05,.75,.05],[0,.75,.8],root);}
 else if(region.biome==='火山'){const mountain=mesh(new THREE.ConeGeometry(2.4,2.7,10,2,true),mats.stoneDark,[1,1,1],[0,1.32,0],root);mountain.receiveShadow=true;const crater=mesh(new THREE.TorusGeometry(.72,.18,8,18),mats.lava,[1,1,1],[0,2.66,0],root);crater.rotation.x=Math.PI/2;mesh(new THREE.CircleGeometry(.68,20),mats.lava,[1,1,1],[0,2.65,0],root).rotation.x=-Math.PI/2;}
 else if(region.biome==='洞窟'){for(let i=0;i<9;i++){const a=Math.PI*i/8;mesh(geo.rock,mats.stoneDark,[.38,.5,.35],[Math.cos(a)*1.4,Math.sin(a)*1.35+.25,.15],root)}mesh(geo.box,new THREE.MeshBasicMaterial({color:0x05030a}),[2.1,1.5,.12],[0,.7,.25],root,false);}
 else if(region.biome==='荒野'){tower(root,0,0,2.15);mesh(geo.cylinder,mats.wood,[.06,1.1,.06],[-1,.9,.25],root);}
 else if(region.biome==='城'||region.biome==='砦'||region.biome==='岩山'){
  tower(root,-1.35,0,region.biome==='城'?2.45:1.85);tower(root,1.35,0,region.biome==='城'?2.45:1.85);mesh(new RoundedBoxGeometry(2.1,1.45,.75,2,.06),mats.stoneDark,[1,1,1],[0,.78,0],root);mesh(geo.box,mats.iron,[.62,1.05,.08],[0,.56,.42],root);
 }else{
  for(let i=-2;i<=2;i++)mesh(geo.box,i%2?mats.stone:mats.stoneLight,[.46,.65+Math.abs(i)*.15,.38],[i*.62,.35,Math.abs(i)%2*.4],root);hut(root,0,-1.1);
 }
 const pole=mesh(geo.cylinder,mats.iron,[.035,1.05,.035],[0,1.05,-1.2],root),flagMat=new THREE.MeshStandardMaterial({color:0xd94d57,roughness:.86,side:THREE.DoubleSide}),flag=mesh(geo.box,flagMat,[.62,.34,.025],[.62,1.72,-1.2],root);pole.castShadow=flag.castShadow=true;root.userData={regionId:region.id,flagMat,index};return root;
}

export function createGame3D(canvas:HTMLCanvasElement,regions:RenderRegion[]){
 const mobile=matchMedia('(pointer: coarse)').matches||innerWidth<760;
 const renderer=new THREE.WebGLRenderer({canvas,antialias:!mobile,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.15:1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.shadowMap.enabled=true;renderer.shadowMap.type=mobile?THREE.PCFShadowMap:THREE.PCFSoftShadowMap;
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x100d19);scene.fog=new THREE.FogExp2(0x171321,.027);
 const camera=new THREE.PerspectiveCamera(mobile?58:51,1,.08,110),cameraTarget=new THREE.Vector3();camera.position.set(-12,9,13);
 scene.add(new THREE.HemisphereLight(0x8194c7,0x241222,1.65));const sun=new THREE.DirectionalLight(0xffd4a3,3.1);sun.position.set(-8,14,7);sun.castShadow=true;sun.shadow.mapSize.set(mobile?512:1024,mobile?512:1024);sun.shadow.camera.left=-8;sun.shadow.camera.right=8;sun.shadow.camera.top=8;sun.shadow.camera.bottom=-8;sun.shadow.camera.near=.5;sun.shadow.camera.far=35;sun.shadow.bias=-.0005;scene.add(sun,sun.target);
 const rim=new THREE.DirectionalLight(0x7054b8,.85);rim.position.set(10,5,-10);scene.add(rim);
 const grounds:{region:RenderRegion;mat:THREE.MeshStandardMaterial;line:THREE.LineBasicMaterial}[]=[],landmarks:THREE.Group[]=[];
 regions.forEach((region,i)=>{
  const base=new THREE.Color(region.color).multiplyScalar(1.18),groundMat=new THREE.MeshStandardMaterial({color:base,roughness:region.biome==='火山'?.82:.97,metalness:0});const groundGeo=new THREE.PlaneGeometry(region.w*SCALE,region.h*SCALE,8,6),positions=groundGeo.attributes.position;
  for(let p=0;p<positions.count;p++){const x=positions.getX(p),y=positions.getY(p),edge=Math.min(Math.abs(x),Math.abs(y));positions.setZ(p,(seeded(p+i*31)-.5)*.13+(edge<.1?0:0))}groundGeo.computeVertexNormals();const ground=new THREE.Mesh(groundGeo,groundMat);ground.rotation.x=-Math.PI/2;ground.position.set(worldX(region.x+region.w/2),-.03,worldZ(region.y+region.h/2));ground.receiveShadow=true;scene.add(ground);
  const hw=region.w*SCALE/2,hh=region.h*SCALE/2,pts=[new THREE.Vector3(-hw,.035,-hh),new THREE.Vector3(hw,.035,-hh),new THREE.Vector3(hw,.035,hh),new THREE.Vector3(-hw,.035,hh)],lineMat=new THREE.LineBasicMaterial({color:0xa84655,transparent:true,opacity:.52});const line=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),lineMat);line.position.copy(ground.position);scene.add(line);grounds.push({region,mat:groundMat,line:lineMat});addScatter(scene,region,i);const before=scene.children.length;addLandmark(scene,region,i);landmarks.push(scene.children[before] as THREE.Group);
 });
 const starGeo=new THREE.BufferGeometry(),starPos=new Float32Array(150*3);for(let i=0;i<150;i++){starPos[i*3]=(seeded(i)-.5)*46;starPos[i*3+1]=1+seeded(i+300)*6;starPos[i*3+2]=(seeded(i+600)-.5)*30}starGeo.setAttribute('position',new THREE.BufferAttribute(starPos,3));const embers=new THREE.Points(starGeo,new THREE.PointsMaterial({color:0xd78b70,size:.045,transparent:true,opacity:.42,depthWrite:false}));scene.add(embers);
 let player=buildPlayer(''),playerJob='';scene.add(player);const mobs=new Map<number,THREE.Group>(),nodes=new Map<number,THREE.Group>();let elapsed=0,lastX=0,lastY=0;
 const ensureSize=()=>{const width=Math.max(1,canvas.clientWidth),height=Math.max(1,canvas.clientHeight);if(canvas.width!==Math.floor(width*renderer.getPixelRatio())||canvas.height!==Math.floor(height*renderer.getPixelRatio())){renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix()}};
 const render=(world:RenderWorld,dt:number)=>{
  elapsed+=dt;ensureSize();
  if(world.job!==playerJob){scene.remove(player);player=buildPlayer(world.job);scene.add(player);playerJob=world.job}
  const px=worldX(world.x),pz=worldZ(world.y),moving=Math.hypot(world.x-lastX,world.y-lastY)>1;lastX=world.x;lastY=world.y;player.position.set(px,0,pz);player.rotation.y=Math.atan2(world.facingX,world.facingY);const data=player.userData,phase=elapsed*9;
  data.body.position.y=moving?Math.abs(Math.sin(phase))*.045:Math.sin(elapsed*2.2)*.018;data.legs.forEach((leg:THREE.Mesh,i:number)=>leg.rotation.x=moving?Math.sin(phase+i*Math.PI)*.48:0);data.arms.forEach((arm:THREE.Mesh,i:number)=>arm.rotation.x=moving?Math.sin(phase+i*Math.PI)*-.3:0);data.weapon.rotation.z=-.32+(world.attackAnim>0?Math.sin((1-world.attackAnim)*Math.PI)*1.75:0);data.weapon.rotation.x=world.attackAnim>0?-.5:0;data.shield.visible=world.guarding;data.body.rotation.x=world.dodgeTime>0?-.5:0;data.aura.visible=world.attackAnim>.25;data.aura.scale.setScalar(1+(1-world.attackAnim)*1.4);if(data.aura.material)data.aura.material.opacity=Math.max(0,world.attackAnim);
  const activeIds=new Set(world.mobs.map(m=>m.id));for(const [id,obj] of mobs)if(!activeIds.has(id)){scene.remove(obj);mobs.delete(id)}
  world.mobs.forEach(mob=>{let obj=mobs.get(mob.id);if(!obj){obj=buildMob(mob);mobs.set(mob.id,obj);scene.add(obj)}const dx=mob.x-world.x,dy=mob.y-world.y,dist=Math.hypot(dx,dy);obj.visible=dist<(mobile?720:980);if(!obj.visible)return;obj.position.set(worldX(mob.x),Math.sin(elapsed*2.4+mob.id)*.035,worldZ(mob.y));if(dist>1)obj.rotation.y=Math.atan2(-dx,-dy);const body=obj.userData.body as THREE.Group;body.rotation.z=Math.sin(elapsed*3+mob.id)*.025;const bar=obj.userData.bar as THREE.Group;bar.quaternion.copy(camera.quaternion);const fill=bar.userData.fill as THREE.Mesh,full=bar.userData.full as number,pct=Math.max(0,mob.hp/mob.max);fill.scale.x=pct;fill.position.x=-(full*(1-pct))/2;(fill.material as THREE.MeshBasicMaterial).color.set(mob.ally?0x4de0b2:mob.boss?0xff375f:0xe95872)});
  const activeNodes=new Set(world.nodes.filter(n=>n.n>0).map(n=>n.id));for(const [id,obj] of nodes)if(!activeNodes.has(id)){scene.remove(obj);nodes.delete(id)}
  world.nodes.forEach(node=>{if(node.n<=0)return;let obj=nodes.get(node.id);if(!obj){obj=buildResource(node);nodes.set(node.id,obj);scene.add(obj)}obj.visible=Math.hypot(node.x-world.x,node.y-world.y)<(mobile?620:820);obj.position.set(worldX(node.x),0,worldZ(node.y));obj.rotation.y=elapsed*.18+node.id;obj.scale.setScalar(.82+node.n*.05)});
  grounds.forEach(item=>{const territory=owner(world,item.region),own=territory==='own';item.mat.emissive.set(own?0x0d4a37:territory==='enemy'?0x3b0710:0x000000);item.mat.emissiveIntensity=own?.25:territory==='enemy'?.12:0;item.line.color.set(own?0x43d5a3:territory==='enemy'?0xd44959:0xd39357)});landmarks.forEach(mark=>{const region=regions.find(r=>r.id===mark.userData.regionId)!;const territory=owner(world,region);(mark.userData.flagMat as THREE.MeshStandardMaterial).color.set(territory==='own'?0x2eb68a:territory==='enemy'?0xb83248:0xc7773a)});
  const desired=new THREE.Vector3(px+6.8,mobile?7.3:6.4,pz+8.2),blend=1-Math.pow(.002,dt);camera.position.lerp(desired,blend);cameraTarget.lerp(new THREE.Vector3(px,1.08,pz),blend);camera.lookAt(cameraTarget);sun.position.set(px-8,14,pz+7);sun.target.position.set(px,0,pz);sun.target.updateMatrixWorld();embers.rotation.y=elapsed*.015;renderer.render(scene,camera);
 };
 const dispose=()=>{const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points||o instanceof THREE.Line){if(o.geometry)geometries.add(o.geometry);const material=o.material as THREE.Material|THREE.Material[];(Array.isArray(material)?material:[material]).forEach(m=>materials.add(m))}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose()};
 return{render,dispose};
}
