'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Binoculars,Castle,ChevronUp,Flame,Hammer,Map,Shield,Skull,Sparkles,Swords,Trophy,Users} from 'lucide-react';

type Owner='unknown'|'wild'|'enemy'|'own';
type Region={id:string;name:string;x:number;y:number;w:number;h:number;biome:string;color:string;owner:Owner;landmark:string};
type Mob={id:number;x:number;y:number;hp:number;max:number;name:string;tier:number;boss?:boolean;ally?:boolean;home:string};
type Node={id:number;x:number;y:number;kind:'wood'|'ore';n:number};
type World={x:number;y:number;hp:number;maxHp:number;xp:number;lv:number;rank:number;wood:number;ore:number;minions:number;base:number;lands:number;kills:number;bossKills:number;achievements:number;mobs:Mob[];nodes:Node[];discovered:string[];conquered:string[];message:string;banner:string;bannerTime:number;region:string;cd:number};
const RANKS=['F','E','D','C','B','A','S','魔王'];
const REGIONS:Region[]=[
 {id:'ruins',name:'忘れられた廃墟',x:0,y:0,w:800,h:520,biome:'廃墟',color:'#353347',owner:'own',landmark:'小さな拠点'},
 {id:'forest',name:'囁きの魔樹海',x:800,y:0,w:800,h:520,biome:'森',color:'#163d38',owner:'wild',landmark:'魔族の集落'},
 {id:'mountain',name:'骸骨岩山',x:1600,y:0,w:800,h:520,biome:'岩山',color:'#403945',owner:'enemy',landmark:'白骨砦'},
 {id:'waste',name:'赤錆の荒野',x:0,y:520,w:800,h:520,biome:'荒野',color:'#563328',owner:'wild',landmark:'放棄された監視塔'},
 {id:'village',name:'薄暮の集落',x:800,y:520,w:800,h:520,biome:'魔族集落',color:'#3e2546',owner:'enemy',landmark:'角笛の市場'},
 {id:'fort',name:'黒曜領',x:1600,y:520,w:800,h:520,biome:'砦',color:'#44202b',owner:'enemy',landmark:'黒曜砦'},
 {id:'cave',name:'底無し洞窟',x:0,y:1040,w:800,h:520,biome:'洞窟',color:'#1b2637',owner:'enemy',landmark:'深淵の裂け目'},
 {id:'volcano',name:'業火火山',x:800,y:1040,w:800,h:520,biome:'火山',color:'#54221e',owner:'enemy',landmark:'灼熱祭壇'},
 {id:'castle',name:'魔王城外郭',x:1600,y:1040,w:800,h:520,biome:'城',color:'#281b3f',owner:'enemy',landmark:'封印された魔王城'}
];
const regionAt=(x:number,y:number)=>REGIONS.find(r=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h)||REGIONS[0];
const ownerOf=(w:World,r:Region):Owner=>w.conquered.includes(r.id)?'own':r.owner;
const d=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
const spawn=():Mob[]=>[
 [1,500,290,'はぐれインプ',1,'ruins'],[2,680,430,'灰角インプ',1,'ruins'],
 [3,980,230,'魔樹ゴブリン',1,'forest'],[4,1320,390,'毒牙ウルフ',2,'forest'],
 [5,1810,260,'岩鎧オーガ',3,'mountain'],[6,2160,410,'白骨騎士',3,'mountain'],
 [7,310,770,'砂塵ハウンド',2,'waste'],[8,640,930,'荒野の略奪者',2,'waste'],
 [9,1050,700,'槍持ち魔族',2,'village'],[10,1450,900,'集落の番人',3,'village'],
 [11,1800,720,'黒曜兵',3,'fort'],[12,2150,880,'黒曜守備隊長',4,'fort'],
 [13,350,1260,'洞窟スライム',2,'cave'],[14,680,1450,'深淵グール',3,'cave'],
 [15,1050,1250,'火炎サラマンダー',4,'volcano'],[16,1440,1450,'火口の巨人',5,'volcano'],
 [17,1850,1270,'魔城ガーゴイル',5,'castle'],[18,2200,1440,'封印の騎士',6,'castle']
 ].map(v=>{let t=v[4] as number,m=28+t*18;return{id:v[0] as number,x:v[1] as number,y:v[2] as number,name:v[3] as string,tier:t,hp:m,max:m,home:v[5] as string}});
const resources=():Node[]=>Array.from({length:27},(_,i)=>({id:i,x:150+(i*337)%2150,y:130+(i*211)%1320,kind:i%2?'wood':'ore',n:3+(i%3)}));
const fresh=():World=>({x:330,y:300,hp:100,maxHp:100,xp:0,lv:1,rank:0,wood:0,ore:0,minions:0,base:1,lands:1,kills:0,bossKills:0,achievements:0,mobs:spawn(),nodes:resources(),discovered:['ruins'],conquered:['ruins'],message:'廃墟の小拠点から、広大な魔界へ踏み出せ。',banner:'自分の領土',bannerTime:2,region:'ruins',cd:0});
const requirement=(w:World)=>[
 '開始ランク',
 'Lv.2・敵撃破2・地域発見2',
 'Lv.3・配下1・実績1',
 'Lv.4・拠点Lv.2・敵撃破6',
 'Lv.5・領土2・配下2・強敵撃破1',
 'Lv.7・領土3・配下4・実績4',
 'Lv.9・領土5・強敵撃破3・実績6',
 'Lv.10以上・領土7・配下6・強敵撃破5・拠点Lv.5'
][Math.min(w.rank+1,7)];
const canRank=(w:World)=>{
 if(w.rank===0)return w.lv>=2&&w.kills>=2&&w.discovered.length>=2;
 if(w.rank===1)return w.lv>=3&&w.minions>=1&&w.achievements>=1;
 if(w.rank===2)return w.lv>=4&&w.base>=2&&w.kills>=6;
 if(w.rank===3)return w.lv>=5&&w.lands>=2&&w.minions>=2&&w.bossKills>=1;
 if(w.rank===4)return w.lv>=7&&w.lands>=3&&w.minions>=4&&w.achievements>=4;
 if(w.rank===5)return w.lv>=9&&w.lands>=5&&w.bossKills>=3&&w.achievements>=6;
 if(w.rank===6)return w.lv>=10&&w.lands>=7&&w.minions>=6&&w.bossKills>=5&&w.base>=5;
 return false;
};

export default function Home(){
 const canvas=useRef<HTMLCanvasElement>(null),game=useRef(fresh()),keys=useRef<Record<string,boolean>>({}),stick=useRef({x:0,y:0,on:false}),[hud,setHud]=useState<World>(fresh),[mapOpen,setMapOpen]=useState(false),[rankOpen,setRankOpen]=useState(false);
 const sync=useCallback(()=>setHud({...game.current,mobs:[...game.current.mobs],nodes:[...game.current.nodes],discovered:[...game.current.discovered],conquered:[...game.current.conquered]}),[]);
 const say=(s:string)=>{game.current.message=s;sync()};
 const gain=(n:number)=>{let w=game.current;w.xp+=n;let need=w.lv*34;if(w.xp>=need){w.xp-=need;w.lv++;w.maxHp+=14;w.hp=w.maxHp;w.achievements++;w.message='レベルアップ！ Lv.'+w.lv+'。ただし魔族ランクには実績が必要だ。'}};
 const attack=()=>{let w=game.current;if(w.cd>0)return;let t=w.mobs.filter(m=>!m.ally&&d(w,m)<100).sort((a,b)=>d(w,a)-d(w,b))[0];if(!t)return say('周囲に敵はいない。さらに探索しよう。');let hit=15+w.lv*6+w.minions*2;t.hp-=hit;w.cd=.3;if(t.hp<=0){w.mobs=w.mobs.filter(m=>m!==t);w.kills++;if(t.boss){w.bossKills++;if(!w.conquered.includes(t.home)){w.conquered.push(t.home);w.lands++}w.achievements++;w.message=t.name+'を撃破！ '+regionAt(t.x,t.y).name+'を領土にした。'}else{w.ore++;gain(12+t.tier*5);w.message=t.name+'を撃破。瘴気鉱を獲得。'}}else w.message=t.name+'に '+hit+'ダメージ。HP半分以下なら配下にできる。';sync()};
 const recruit=()=>{let w=game.current,t=w.mobs.find(m=>!m.ally&&!m.boss&&m.hp/m.max<=.5&&d(w,m)<110);if(!t)return say('HP半分以下の魔物へ近づこう。');t.ally=true;t.hp=t.max;w.minions++;if(w.minions===1)w.achievements++;w.message=t.name+'が配下になった。軍勢が拡大した！';sync()};
 const gather=()=>{let w=game.current,n=w.nodes.find(n=>n.n&&d(w,n)<75);if(!n)return say('光る魔木・瘴気鉱の近くで採集できる。');n.n--;if(n.kind==='wood')w.wood++;else w.ore++;w.message=n.kind==='wood'?'魔木を採集した。':'瘴気鉱を採集した。';sync()};
 const build=()=>{let w=game.current,c=w.base+2;if(w.wood<c||w.ore<c)return say('拠点強化には魔木・瘴気鉱 各'+c+'が必要。');w.wood-=c;w.ore-=c;w.base++;w.maxHp+=12;w.hp=w.maxHp;w.achievements++;w.message='拠点Lv.'+w.base+'完成。新しい旗が掲げられた！';sync()};
 const raid=()=>{let w=game.current,r=regionAt(w.x,w.y);if(ownerOf(w,r)!=='enemy')return say('敵領土のランドマーク付近で領土ボスを呼び出せる。');if(w.mobs.some(m=>m.boss&&m.home===r.id))return say('この領土の支配者はすでに出現している。');let required=Math.max(2,REGIONS.indexOf(r)-1);if(w.lv<required)return say('この領土の瘴気は強すぎる。推奨Lv.'+required+'。');w.mobs.push({id:100+w.bossKills,x:r.x+r.w*.68,y:r.y+r.h*.5,hp:150+required*35,max:150+required*35,name:r.name+'の支配者',tier:required,boss:true,home:r.id});w.message='領土ボスが出現！ 倒せばこの地を奪える。';sync()};
 const rankUp=()=>{let w=game.current;if(w.rank>=7)return say('すでに魔王として君臨している。');if(!canRank(w))return say('昇格条件が不足している：'+requirement(w));w.rank++;w.maxHp+=25;w.hp=w.maxHp;w.achievements++;w.message=w.rank===7?'魔王戴冠！ レベルだけでは届かない覇道を成し遂げた。':'魔族ランク '+RANKS[w.rank]+' に昇格！';sync()};
 useEffect(()=>{let down=(e:KeyboardEvent)=>{keys.current[e.key.toLowerCase()]=true;if(e.key===' '){e.preventDefault();attack()}if(e.key.toLowerCase()==='e')recruit();if(e.key.toLowerCase()==='f')gather();if(e.key.toLowerCase()==='m')setMapOpen(v=>!v)},up=(e:KeyboardEvent)=>keys.current[e.key.toLowerCase()]=false;addEventListener('keydown',down);addEventListener('keyup',up);return()=>{removeEventListener('keydown',down);removeEventListener('keyup',up)}},[]);
 useEffect(()=>{let c=canvas.current;if(!c)return;let g=c.getContext('2d')!,last=performance.now(),frame=0,id=0,fit=()=>{let r=c.getBoundingClientRect(),q=Math.min(devicePixelRatio,2);c.width=r.width*q;c.height=r.height*q;g.setTransform(q,0,0,q,0,0)};fit();let ob=new ResizeObserver(fit);ob.observe(c);
  const label=(text:string,x:number,y:number,size=12,col='#ffe4c8')=>{g.font='700 '+size+'px system-ui';g.textAlign='center';g.fillStyle=col;g.fillText(text,x,y)};
  const bar=(x:number,y:number,p:number,col:string,z=42)=>{g.fillStyle='#100717dd';g.fillRect(x-z/2,y,z,5);g.fillStyle=col;g.fillRect(x-z/2+1,y+1,(z-2)*Math.max(0,p),3)};
  const landmark=(r:Region,owner:Owner,cx:number,cy:number)=>{g.fillStyle='#0b0711aa';g.beginPath();g.ellipse(cx,cy+25,54,15,0,0,7);g.fill();g.fillStyle=r.biome==='城'?'#1b122f':r.biome==='森'?'#183326':'#3a2737';g.fillRect(cx-32,cy-20,64,46);g.fillStyle=owner==='enemy'?'#d94d57':owner==='own'?'#39b58b':'#e58b4f';g.beginPath();g.moveTo(cx-45,cy-20);g.lineTo(cx,cy-64);g.lineTo(cx+45,cy-20);g.fill();label(r.landmark,cx,cy+47,11)};
  const loop=(now:number)=>{let dt=Math.min(.04,(now-last)/1000);last=now;frame++;let w=game.current,ax=(keys.current.d||keys.current.arrowright?1:0)-(keys.current.a||keys.current.arrowleft?1:0)+(stick.current.on?stick.current.x:0),ay=(keys.current.s||keys.current.arrowdown?1:0)-(keys.current.w||keys.current.arrowup?1:0)+(stick.current.on?stick.current.y:0),z=Math.hypot(ax,ay)||1;w.x=Math.max(30,Math.min(2370,w.x+ax/z*190*dt));w.y=Math.max(30,Math.min(1530,w.y+ay/z*190*dt));w.cd=Math.max(0,w.cd-dt);w.bannerTime=Math.max(0,w.bannerTime-dt);let r=regionAt(w.x,w.y);if(r.id!==w.region){w.region=r.id;if(!w.discovered.includes(r.id)){w.discovered.push(r.id);w.achievements++;w.message='新地域発見：'+r.name}let territory=ownerOf(w,r);w.banner=territory==='enemy'?'敵領土':territory==='own'?'自分の領土':'未支配地域';w.bannerTime=2.4}
  w.mobs.forEach(m=>{let q=d(w,m);if(m.ally){if(q>80){m.x+=(w.x-m.x)/q*80*dt;m.y+=(w.y-m.y)/q*80*dt}}else if(q<180&&q>45){m.x+=(w.x-m.x)/q*35*dt;m.y+=(w.y-m.y)/q*35*dt}else if(q<45&&frame%50===0)w.hp-=m.boss?13:3+m.tier});if(w.hp<=0){w.x=330;w.y=300;w.hp=w.maxHp;w.message='敗北。忘れられた廃墟へ撤退した。'}
  let cw=c.clientWidth,ch=c.clientHeight,camX=Math.max(0,Math.min(2400-cw,w.x-cw/2)),camY=Math.max(0,Math.min(1560-ch,w.y-ch/2));g.clearRect(0,0,cw,ch);g.save();g.translate(-camX,-camY);
  REGIONS.forEach((q,i)=>{let territory=ownerOf(w,q);g.fillStyle=q.color;g.fillRect(q.x,q.y,q.w,q.h);if(territory==='own'){g.fillStyle='#2abf8730';g.fillRect(q.x,q.y,q.w,q.h)}for(let k=0;k<18;k++){let px=q.x+(k*137+i*41)%q.w,py=q.y+(k*83+i*59)%q.h;g.fillStyle=k%3?'#ffffff08':'#ff7f4d0d';g.beginPath();g.ellipse(px,py,35+k%4*9,12+k%3*7,.2,0,7);g.fill()}g.strokeStyle=territory==='own'?'#69e5b866':'#f6bd8d22';g.lineWidth=2;g.strokeRect(q.x+2,q.y+2,q.w-4,q.h-4);label(q.name,q.x+q.w/2,q.y+42,17,'#ffe5c7aa');label(q.biome,q.x+q.w/2,q.y+62,10,'#cfadbaaa');landmark(q,territory,q.x+q.w/2,q.y+q.h/2)});
  w.nodes.forEach(n=>{if(!n.n)return;g.save();g.translate(n.x,n.y);g.fillStyle=n.kind==='wood'?'#db873e':'#b77cff';g.beginPath();g.moveTo(0,-24);g.lineTo(14,8);g.lineTo(-14,8);g.fill();g.restore();label((n.kind==='wood'?'魔木':'瘴気鉱')+' ×'+n.n,n.x,n.y+25,9)});
  w.mobs.forEach(m=>{let bob=Math.sin(frame/14+m.id)*2;g.save();g.translate(m.x,m.y+bob);g.fillStyle='#0008';g.beginPath();g.ellipse(0,15,m.boss?35:18,7,0,0,7);g.fill();g.fillStyle=m.ally?'#4fe6ba':m.boss?'#f33364':m.tier>3?'#ec6545':'#a45de0';g.beginPath();g.arc(0,m.boss?-10:-2,m.boss?22:15,0,7);g.fill();g.fillStyle='#281035';g.beginPath();g.moveTo(-10,-10);g.lineTo(-15,-28);g.lineTo(-2,-15);g.moveTo(10,-10);g.lineTo(15,-28);g.lineTo(2,-15);g.fill();g.restore();bar(m.x,m.y-(m.boss?60:30),m.hp/m.max,m.ally?'#54e9c3':'#ff5879',m.boss?86:40);label(m.ally?'配下':m.name,m.x,m.y+29,9)});
  g.save();g.translate(w.x,w.y+Math.sin(frame/8)*2);g.fillStyle='#0009';g.beginPath();g.ellipse(0,17,20,7,0,0,7);g.fill();g.fillStyle='#6eecad';g.beginPath();g.arc(0,-2,16,0,7);g.fill();g.fillStyle='#35204f';g.beginPath();g.moveTo(-12,-9);g.lineTo(-16,-29);g.lineTo(-2,-16);g.moveTo(12,-9);g.lineTo(16,-29);g.lineTo(2,-16);g.fill();g.restore();bar(w.x,w.y-39,w.hp/w.maxHp,'#65ebb4',50);label('あなた',w.x,w.y+34,10,'#eaffd8');g.restore();if(frame%10===0)sync();id=requestAnimationFrame(loop)};id=requestAnimationFrame(loop);return()=>{cancelAnimationFrame(id);ob.disconnect()}},[sync]);
 const current=regionAt(hud.x,hud.y),currentOwner=ownerOf(hud,current),need=hud.lv*34,ready=canRank(hud);
 return <main className="game-shell"><section className="game-frame open-world">
  <div className="world-art"/><header className="topbar"><div className="brand"><Flame size={20} fill="currentColor"/><span>魔界成り上がり譚</span><small>OPEN WORLD</small></div><div className={'zone-chip '+currentOwner}><Map size={14}/><span>{current.name}</span><b>{currentOwner==='enemy'?'敵領土':currentOwner==='own'?'自分の領土':'未支配地域'}</b></div><button className="reset" onClick={()=>{game.current=fresh();sync()}}>最初から</button></header>
  <div className="hud-left"><button className={'rank-badge rank-button '+(ready?'ready':'')} onClick={()=>setRankOpen(v=>!v)}><span>RANK</span><b>{RANKS[hud.rank]}</b>{ready&&<ChevronUp size={12}/>}</button><div className="vitals"><div className="lv">LV <b>{hud.lv}</b></div><div className="meter hp"><i style={{width:(hud.hp/hud.maxHp*100)+'%'}}/></div><div className="meter xp"><i style={{width:(hud.xp/need*100)+'%'}}/></div><small>HP {Math.ceil(hud.hp)}/{hud.maxHp}　EXP {hud.xp}/{need}</small></div></div>
  <div className="hud-right"><div><Users size={15}/>配下 <b>{hud.minions}</b></div><div><Castle size={15}/>領土 <b>{hud.lands}</b></div><div><Trophy size={15}/>実績 <b>{hud.achievements}</b></div></div>
  <canvas ref={canvas} className="game-canvas"/>
  {hud.bannerTime>0&&<div className={'territory-banner '+currentOwner}><span>{hud.banner}</span><b>{current.name}</b></div>}
  <button className="map-toggle" onClick={()=>setMapOpen(v=>!v)}><Map size={16}/>世界地図 <kbd>M</kbd></button>
  {mapOpen&&<div className="world-map"><div className="panel-head"><div><Map size={18}/><b>魔界広域図</b></div><button onClick={()=>setMapOpen(false)}>×</button></div><div className="map-grid">{REGIONS.map(r=>{let seen=hud.discovered.includes(r.id),here=r.id===current.id,territory=ownerOf(hud,r);return <div key={r.id} className={'map-cell '+(seen?territory:'unknown')+(here?' here':'')}><span>{seen?r.biome:'未探索'}</span><b>{seen?r.name:'？？？'}</b>{here&&<i>現在地</i>}</div>})}</div><div className="map-legend"><span><i className="own"/>自領</span><span><i className="enemy"/>敵領</span><span><i className="wild"/>未支配</span><span><i className="unknown"/>未探索</span></div></div>}
  {rankOpen&&<div className="rank-panel"><div className="panel-head"><div><Shield size={18}/><b>魔族ランク</b></div><button onClick={()=>setRankOpen(false)}>×</button></div><div className="rank-track">{RANKS.map((r,i)=><span key={r} className={i===hud.rank?'current':i<hud.rank?'done':''}>{r}</span>)}</div><small>次の昇格条件</small><p>{hud.rank===7?'すべての条件を達成し、魔王に君臨している。':requirement(hud)}</p><div className="rank-stats"><span>敵撃破 {hud.kills}</span><span>強敵 {hud.bossKills}</span><span>領土 {hud.lands}</span><span>配下 {hud.minions}</span><span>拠点 Lv.{hud.base}</span><span>地域 {hud.discovered.length}/9</span></div><button className={'rank-up '+(ready?'ready':'')} onClick={rankUp}>{ready?'ランクアップ':'条件未達成'}</button><em>Lv.99だけでは魔王になれません</em></div>}
  <div className="quest-card"><span>現在地</span><b>{current.landmark}</b><small>{current.biome} / {currentOwner==='enemy'?'敵勢力が支配中':currentOwner==='own'?'あなたの支配地':'まだ誰の領土でもない'}</small></div>
  <div className="notice">{hud.message}</div><div className="controls"><button className="action attack" onClick={attack}><Swords/><span>攻撃</span><kbd>SPACE</kbd></button><button className="action recruit" onClick={recruit}><Users/><span>配下</span><kbd>E</kbd></button><button className="action gather" onClick={gather}><Sparkles/><span>採集</span><kbd>F</kbd></button><button className="action build" onClick={build}><Hammer/><span>建築</span></button><button className="action raid" onClick={raid}><Skull/><span>領土戦</span></button></div>
  <div className="resources"><span>魔木 <b>{hud.wood}</b></span><span>瘴気鉱 <b>{hud.ore}</b></span></div><div className="joystick" onPointerDown={e=>{(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);stick.current.on=true}} onPointerMove={e=>{if(!stick.current.on)return;let r=e.currentTarget.getBoundingClientRect();stick.current.x=Math.max(-1,Math.min(1,(e.clientX-r.left-r.width/2)/(r.width/2)));stick.current.y=Math.max(-1,Math.min(1,(e.clientY-r.top-r.height/2)/(r.height/2)))}} onPointerUp={()=>stick.current={x:0,y:0,on:false}}><i/></div>
  <div className="hint"><Binoculars size={14}/>移動：WASD / 矢印 / スティック　地図：M</div>
 </section><section className="legend"><div><b>自由探索</b><span>9地域を境界なしで移動</span></div><div><b>領土侵入</b><span>敵領土へ自由に入り、支配者を呼び出す</span></div><div><b>条件制ランク</b><span>レベル・領土・配下・実績を揃えて昇格</span></div></section></main>
}
