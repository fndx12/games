const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict"),path=require("node:path");
const root=path.resolve(__dirname,".."),Matter=require(path.join(root,"vendor/matter-0.20.0.min.js"));
const html=fs.readFileSync(path.join(root,"宝石冒险.html"),"utf8");
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
new Function(script);
function boot(seed,storageEnabled=true){
  const nodes=new Map(),storage=new Map(),listeners=new Map();
  if(seed)storage.set("gemAdventureV1:爸爸",JSON.stringify(seed));
  const drawing=new Proxy({}, {get:(o,k)=>k==="createLinearGradient"?()=>({addColorStop(){}}):()=>{}});
  function node(key){if(!nodes.has(key))nodes.set(key,{textContent:"",innerHTML:"",hidden:true,dataset:{},style:{},events:new Map(),classList:{add(){},remove(){}},setAttribute(){},setPointerCapture(){},focus(){},replaceChildren(){},append(){},getContext:()=>drawing,addEventListener(k,f){this.events.set(k,f)},matches:()=>false});return nodes.get(key)}
  const controls=["left","right","jump","attack","orb","release"].map(a=>{const n=node('[data-control="'+a+'"]');n.dataset.control=a;return n});
  const context={console,Matter,window:{Matter,addEventListener(){}},document:{querySelector:node,querySelectorAll:s=>s==="[data-control]"?controls:[],createElement:()=>node(Symbol()),addEventListener:(k,f)=>listeners.set(k,f)},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>{if(!storageEnabled)throw Error("blocked");storage.set(k,v)}},requestAnimationFrame(){},setTimeout(){},clearTimeout(){},Math,Set,Map};
  vm.runInNewContext(script.replace(/\}\)\(\);\s*$/,"globalThis.test={Adventure,WORLDS,TYPES,FORMS,fresh,readSave,draw,get game(){return game},set game(v){game=v},Body};})();"),context);
  return {...context.test,storage,nodes,listeners,context};
}
const copy=x=>JSON.parse(JSON.stringify(x));
let passed=0;
function test(name,fn){fn();passed++;console.log("PASS",name)}
function ready(world=0){const b=boot(),a=b.game;a.setWorld(world);a.enemies.forEach(e=>e.active=false);for(let i=0;i<20;i++)a.step();return {b,a}}
function ticks(a,n){for(let i=0;i<n;i++)a.step()}
test("boot, three full worlds, 27 gems split 3 visible / 6 hidden per world",()=>{
  const b=boot();assert.equal(b.game.hp,6);assert.equal(b.WORLDS.length,4);
  for(const m of b.WORLDS.slice(0,3)){assert(m.width>=5000);assert.equal(m.gems.length,9);assert.equal(m.gems.filter(g=>g[2]).length,6)}
  b.draw(b.game);
});
test("physical floor, left/right motion and exactly two jumps",()=>{
  const {a}=ready();assert(a.grounded);assert(Math.abs(a.p.y-(565-22))<1);
  const x=a.p.x;a.inputs.right=true;ticks(a,40);assert(a.p.x>x+180);a.inputs.right=false;
  assert(a.jump());ticks(a,8);assert(a.jump());assert(!a.jump());ticks(a,130);assert(a.grounded);assert.equal(a.jumps,0);
});
test("each gem has a real physics route with walking / double jump, no transformation",()=>{
  const b=boot();
  for(let world=0;world<3;world++){
    const map=b.WORLDS[world],surfaces=[{x:0,y:565,w:map.width},...map.platforms.map(([x,y,w])=>({x,y,w}))];
    const reached=new Set([0]),witnesses=new Map();
    // Try a short sequence of horizontal runs and one/two jumps between platform tops.
    for(let pass=0;pass<surfaces.length;pass++){
      let changed=false;
      for(let to=1;to<surfaces.length;to++)if(!reached.has(to)){
        const target=surfaces[to];
        outer:for(const from of reached){
          const source=surfaces[from];if(source.y-target.y>270)continue;
          for(const dir of [1,-1]){
            const start=dir===1?clamp(target.x-90,source.x+24,source.x+source.w-24):clamp(target.x+target.w+90,source.x+24,source.x+source.w-24);
            if(Math.abs(start-(target.x+target.w/2))>520)continue;
            for(const second of [0,14,22,30]){
              const s=b.fresh();s.world=world;s.x=start;s.y=source.y-23;const a=new b.Adventure(s);a.enemies=[];ticks(a,5);a.inputs[dir===1?"right":"left"]=true;a.jump();
              for(let t=0;t<110;t++){
                if(t===second&&second)a.jump();
                if((dir===1&&a.p.x>target.x+target.w*.55)||(dir===-1&&a.p.x<target.x+target.w*.45))a.inputs.left=a.inputs.right=false;
                a.step();
                if(a.grounded&&Math.abs(a.p.y+22-target.y)<2&&a.p.x>target.x+20&&a.p.x<target.x+target.w-20){
                  reached.add(to);witnesses.set(to,{from,start,second});changed=true;break outer;
                }
              }
            }
          }
        }
      }
      if(!changed)break;
    }
    for(const [x,y]of map.gems){const surface=surfaces.findIndex(p=>Math.abs(p.y-y-34)<5&&x>=p.x&&x<=p.x+p.w);assert(surface>=0,`gem surface ${world} ${x}`);assert(reached.has(surface),`unreachable ${world} ${x} via ${surface}`)}
    console.log("  World",world,"reachable surfaces",reached.size,"/",surfaces.length);
  }
});
function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
test("all three portal links work both ways; camera stays bounded",()=>{
  const {a,b}=ready();
  for(let i=0;i<3;i++){a.setWorld(i);b.Body.setPosition(a.body,{x:a.map.width-100,y:543});a.transition=0;a.enter();assert.equal(a.world,i+1);assert.equal(a.p.x,180)}
  for(let i=3;i>0;i--){b.Body.setPosition(a.body,{x:100,y:543});a.transition=0;a.enter();assert.equal(a.world,i-1);assert.equal(a.p.x,a.map.width-180)}
  ticks(a,1);assert(a.camera>=0&&a.camera<=a.map.width-1280);
});
test("collection once, death, map return and reload preserve gems",()=>{
  const {a,b}=ready();b.Body.setPosition(a.body,{x:420,y:530});a.step();assert.equal(a.total,1);ticks(a,5);assert.equal(a.total,1);
  a.form="fire";a.hp=1;a.hurt({x:a.p.x+30});assert.equal(a.hp,6);assert.equal(a.form,"fire");assert.equal(a.total,1);
  a.setWorld(1);a.setWorld(0);assert.equal(a.total,1);const c=boot(JSON.parse(b.storage.get("gemAdventureV1:爸爸")));assert.equal(c.game.total,1);assert.equal(c.game.form,"fire");
});
test("six stationary specials, rolling pursuer, nearest-only absorption and release gate",()=>{
  const b=boot(),a=b.game;a.transition=0;const fixed=a.enemies.filter(e=>e.type!=="roll").map(e=>e.x),r=a.enemies.find(e=>e.type==="roll");
  b.Body.setPosition(a.body,{x:r.x-100,y:543});const x=r.x;ticks(a,15);assert(r.x<x);assert.deepEqual(a.enemies.filter(e=>e.type!=="roll").map(e=>e.x),fixed);
  const nearest=a.enemies.filter(e=>e.type!=="roll").sort((x,y)=>Math.abs(x.x-a.p.x)-Math.abs(y.x-a.p.x))[0];
  assert(a.absorb());assert.equal(a.orb.target,nearest);ticks(a,90);assert.equal(a.form,nearest.type);assert(!nearest.active);assert(!a.absorb());a.release();assert.equal(a.form,"normal");
  a.setWorld(1);a.setWorld(0);assert(a.enemies.every(e=>e.active));
});
test("all six abilities damage specials and boss; sword/whip stay melee",()=>{
  for(const type of boot().TYPES){
    const {a,b}=ready();a.form=type;const e={id:"test",x:270,y:543,w:46,h:48,type:"fire",hp:2,active:true,cd:999,frozen:0,anim:0};
    a.enemies=[e];b.Body.setPosition(a.body,{x:180,y:543});assert(a.attack());for(let i=0;i<25;i++)a.updateShots(1/60);assert(e.hp<2,type);
    if(type==="sword"||type==="lightning")assert(a.shots.every(s=>s.melee));
    a.enemies=[];a.boss={x:360,y:543,hp:20,dir:-1,shield:0};a.fire(type,270,543,1,"player");for(let i=0;i<30;i++)a.updateShots(1/60);assert(a.boss.hp<20,type+" boss");
  }
});
test("returning blade hits once per leg; ice freezes before normal enemy dies",()=>{
  const {a}=ready();a.form="blade";const e={id:"e",x:330,y:543,w:46,h:48,type:"fire",hp:2,active:true,cd:999};a.enemies=[e];a.fire("blade",180,543,1,"player");
  for(let i=0;i<90;i++)a.updateShots(1/60);assert.equal(e.hp,0);assert(!e.active);
  const r={id:"r",x:240,y:543,w:42,h:42,type:"roll",hp:1,active:true};a.damageEnemy(r,{type:"ice"});assert(r.frozen>0);assert(r.active);a.enemies=[r];a.updateEnemies(2);assert(!r.active);
});
test("shield actually blocks a returning blade instead of letting it pass through",()=>{
  const {a}=ready();a.boss={x:520,y:543,hp:20,dir:-1,shield:4,shieldHits:0,shieldCd:9,shotCd:99,hurt:0};
  a.fire("blade",300,543,1,"player");for(let i=0;i<90;i++)a.updateShots(1/60);assert.equal(a.boss.hp,20);assert.equal(a.boss.shieldHits,1);
});
test("two touch pointers support moving plus two jumps; releasing one does not cancel the other",()=>{
  const {a,b}=ready(),right=b.nodes.get('[data-control="right"]'),jump=b.nodes.get('[data-control="jump"]');
  const ev=id=>({pointerId:id,preventDefault(){}});
  right.events.get("pointerdown")(ev(1));assert(a.inputs.right);
  jump.events.get("pointerdown")(ev(2));assert.equal(a.jumps,1);ticks(a,10);jump.events.get("pointerup")(ev(2));assert(a.inputs.right);
  jump.events.get("pointerdown")(ev(3));assert.equal(a.jumps,2);
  right.events.get("pointercancel")(ev(1));assert(!a.inputs.right);jump.events.get("pointerup")(ev(3));ticks(a,150);assert(a.grounded);
});
test("no timed invulnerability; independent attacks hurt, overlapping contact only once",()=>{
  const {a,b}=ready();a.form="water";a.hurt({x:250});a.hurt({x:250});assert.equal(a.hp,4);assert.equal(a.form,"water");
  const e={id:"touch",x:600,y:543,w:46,h:48,type:"fire",hp:2,active:true,cd:999,frozen:0};
  a.enemies=[e];b.Body.setPosition(a.body,{x:600,y:543});a.updateEnemies(0);const hp=a.hp;
  b.Body.setPosition(a.body,{x:600,y:543});a.updateEnemies(0);assert.equal(a.hp,hp);
});
test("empty boss room stays silent; 27 gems summon boss after animation",()=>{
  const {a,b}=ready();a.setWorld(3);ticks(a,220);assert.equal(a.boss,null);assert.equal(a.mode,"play");assert.equal(b.nodes.get("#notice")?.textContent||"","");
  a.saveData.gems=[0,1,2].map(()=>Array.from({length:9},(_,i)=>i));a.setWorld(3);assert.equal(a.mode,"summon");ticks(a,100);assert.equal(a.boss,null);ticks(a,100);assert.equal(a.boss.hp,20);
});
test("all abilities break shield after three independent hits; shield expires at four seconds",()=>{
  for(const type of boot().TYPES){
    const {a}=ready();a.boss={x:500,y:500,hp:20,dir:-1,shield:4,shieldHits:0,shieldCd:9,shotCd:99,hurt:0};
    const box={x:388,y:475,w:20,h:30};
    for(let i=0;i<3;i++)a.hitBoss({type,hits:new Set()},box);assert.equal(a.boss.shield,0,type);assert.equal(a.boss.hp,20);
  }
  const {a}=ready();a.boss={x:500,y:500,hp:20,dir:-1,shield:4,shieldHits:0,shieldCd:9,shotCd:99,hurt:0};a.updateBoss(4.1);assert(a.boss.shield<=0);assert.equal(a.shots.length,0);
});
test("boss uses only slow crystals and shield; failure returns to universe entrance",()=>{
  const {a}=ready();a.saveData.gems=[0,1,2].map(()=>Array.from({length:9},(_,i)=>i));a.setWorld(3);ticks(a,195);
  a.updateBoss(3);assert(a.shots.every(s=>s.type==="crystal"&&Math.hypot(s.vx,s.vy)<156));a.hp=1;a.hurt({x:1400});assert.equal(a.world,2);assert.equal(a.p.x,180);assert.equal(a.hp,6);assert.equal(a.total,27);
});
test("victory is saved immediately and never resummons on reload",()=>{
  const {a,b}=ready();a.saveData.gems=[0,1,2].map(()=>Array.from({length:9},(_,i)=>i));a.setWorld(3);ticks(a,195);
  a.boss.hp=1;a.hitBoss({type:"water",hits:new Set()},{x:a.boss.x,y:a.boss.y,w:30,h:30});assert(a.saveData.won);assert.equal(a.mode,"victory");
  const c=boot(JSON.parse(b.storage.get("gemAdventureV1:爸爸")));assert(c.game.saveData.won);assert.equal(c.game.boss,null);
});
test("malformed saves and unavailable localStorage do not stop gameplay",()=>{
  const b=boot({version:1,world:999,x:Infinity,form:"bad",gems:[[0,0,9,-1,"x"],null,[]]});assert.equal(b.game.world,0);assert.equal(b.game.total,1);
  const c=boot(null,false);ticks(c.game,10);assert(c.nodes.get("#storageWarning").textContent.includes("无法保存"));
});
test("hall lists every original game plus new game; links exist",()=>{
  const hall=fs.readFileSync(path.join(root,"index.html"),"utf8"),list=hall.match(/file: "([^"]+)"/g).map(x=>x.slice(7,-1));assert.equal(list.length,10);
  for(const file of list)assert(fs.existsSync(path.join(root,file)),file);
});
console.log(`${passed} groups passed`);
module.exports={boot,ready,ticks};
