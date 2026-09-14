(function (root) {
  'use strict';
  const clone = x => JSON.parse(JSON.stringify(x));
  const qualities = ['绿','蓝','紫','金'];
  function tierIndex(level) { return level >= 6 ? 2 : level >= 3 ? 1 : 0; }
  function cells(p,item,cols=7) { return Array.from({length:item.width*item.height},(_,i)=>(p.y+Math.floor(i/item.width))*cols+p.x+i%item.width); }
  function adjacent(a,b) {return ((a.x+a.width===b.x||b.x+b.width===a.x)&&a.y<b.y+b.height&&b.y<a.y+a.height)||((a.y+a.height===b.y||b.y+b.height===a.y)&&a.x<b.x+b.width&&b.x<a.x+a.width);}
  // Direction uses the full orthogonal strip, without a distance limit or diagonal targets.
  function direction(a,b,side) {const overlapX=a.x<b.x+b.width&&b.x<a.x+a.width, overlapY=a.y<b.y+b.height&&b.y<a.y+a.height;
    return side==='up'?overlapX&&b.y+b.height<=a.y:side==='down'?overlapX&&b.y>=a.y+a.height:side==='left'?overlapY&&b.x+b.width<=a.x:overlapY&&b.x>=a.x+a.width;}
  function initialCells(rules) {let a=[];let x=Math.floor((rules.cols-rules.initialCols)/2),y=Math.floor((rules.rows-rules.initialRows)/2);for(let j=0;j<rules.initialRows;j++)for(let i=0;i<rules.initialCols;i++)a.push((y+j)*rules.cols+x+i);return a;}
  function validPlacement(state,data,id,x,y) {const item=data.items.find(i=>i.id===id);if(!item||!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x+item.width>data.rules.cols||y+item.height>data.rules.rows)return false;
    const wanted=cells({x,y},item,data.rules.cols);if(wanted.some(c=>!state.unlocked.includes(c)))return false;
    const busy=new Set(state.placed.filter(p=>p.id!==id).flatMap(p=>cells(p,data.items.find(i=>i.id===p.id),data.rules.cols)));return wanted.every(c=>!busy.has(c));}
  function placement(state,data,id,x,y,allowSwap=true){const i=data.items.find(i=>i.id===id);if(!i)return {valid:false};const overlaps=state.placed.filter(p=>p.id!==id&&cells(p,data.items.find(j=>j.id===p.id),data.rules.cols).some(c=>cells({x,y},i,data.rules.cols).includes(c)));if(overlaps.length>1||(!allowSwap&&overlaps.length))return {valid:false};const swapId=overlaps[0]?.id;return {valid:validPlacement({...state,placed:state.placed.filter(p=>p.id!==swapId)},data,id,x,y),swapId};}
  function manualUnlock(state,data,count){if(!Number.isInteger(count)||count<9||count>49)throw Error('格数须为9～49的整数');const origin=initialCells(data.rules),pool=new Set(origin);while(pool.size<count){let next=-1;for(let c=0;c<49;c++){if(pool.has(c))continue;const x=c%7,y=Math.floor(c/7);if([...pool].some(o=>Math.abs(o%7-x)+Math.abs(Math.floor(o/7)-y)===1)){next=c;break;}}pool.add(next);}state.unlocked=[...pool];const removed=state.placed.filter(p=>!cells(p,data.items.find(i=>i.id===p.id)).every(c=>pool.has(c)));state.placed=state.placed.filter(p=>!removed.includes(p));state.unlockCredits=0;state.unlockRemainder=0;return removed.map(p=>p.id);}
  function judgeTiming(progress){if(progress===null||!Number.isFinite(progress)||progress<0||progress>1)return 'Miss';const d=Math.abs(progress-.5);return d<=.08?'Perfect':d<=.18?'Great':d<=.32?'Good':'Miss';}
  function random(seed) {let h=2166136261;for(const c of String(seed))h=Math.imul(h^c.charCodeAt(0),16777619);return ()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
  function weighted(weights,rng) {let v=rng()*weights.reduce((a,b)=>a+b,0);for(let i=0;i<weights.length;i++){v-=weights[i];if(v<0)return i;}return weights.length-1;}
  function getSetMembers(placed,name) {return placed.filter(p=>p.category===name||p.song===name);}
  function score(state,data) {
    const placed=state.placed.map(p=>({...data.items.find(i=>i.id===p.id),...p,level:state.owned[p.id]?.level||1}));
    const info=Object.fromEntries(placed.map(p=>[p.id,{id:p.id,name:p.name,base:p.base[p.level-1],member:0,ability:0,total:0,active:false,sources:[],matches:[],targets:[],count:0}]));
    let globalFixed=0,globalPercent=0,extraBeats=0;const globalSources=[];
    const sets=data.sets.map(set=>{const members=getSetMembers(placed,set.name);let tier=null,index=-1;set.tiers.forEach((t,i)=>{if(set.exact?members.length===t[0]:members.length>=t[0]){tier=t;index=i;}});return {...set,members,tier,index,count:members.length};});
    const addGlobal=(name,fixed=0,percent=0,sourceId=null)=>{globalFixed+=fixed;globalPercent+=percent;globalSources.push({name,fixed,percent,sourceId});};
    for(const set of sets){if(!set.tier)continue;const value=set.tier[1];
      if(set.type==='member')for(const m of set.members){info[m.id].member+=value;info[m.id].sources.push({name:set.name,value,type:'套装'});}
      else if(set.type==='percent')addGlobal(set.name,0,value);
      else if(set.type==='perMember')addGlobal(set.name,value*set.count);
      else if(set.type==='rock')addGlobal(set.name,value+(set.index===1?placed.filter(p=>p.category==='打击乐').length*5:0));
      else if(set.type==='folk')addGlobal(set.name,value+(set.index===1?set.members.reduce((a,p)=>a+p.level,0)*3:0));
      else addGlobal(set.name,value);
    }
    const adornSets={'P27':['交响序曲','拉弦乐'],'P28':['摇滚时代','打击乐'],'P29':['爵士之夜','管乐'],'P30':['民族巡礼','拨弦'],'P31':['优雅晚宴','键盘']};
    for(const p of placed){const entry=info[p.id],a=Number(p.effect[tierIndex(p.level)]||0),others=placed.filter(q=>q.id!==p.id&&q.category!=='装扮');let matches=[],targets=[],count=0;
      const near=others.filter(q=>adjacent(p,q));const cat=(ls,c)=>ls.filter(q=>q.category===c);
      const own=(ms,n=ms.length)=>{matches=ms;targets=n>0?[p]:[];count=n;};
      switch(p.id){
        case 'P03': own(cat(near,'管乐'),cat(near,'管乐').length?1:0);break;
        case 'P04': {const seen=new Set([p.id]),queue=[p];while(queue.length){const src=queue.shift();for(const q of cat(others,'管乐'))if(!seen.has(q.id)&&adjacent(src,q)){seen.add(q.id);queue.push(q);matches.push(q);}}own(matches);break;}
        case 'P08': {const below=others.filter(q=>direction(p,q,'down'));own(below,below.length===0?1:0);break;}
        case 'P09': own(cat(others,'拉弦乐').filter(q=>direction(p,q,'left')||direction(p,q,'right')));break;
        case 'P10': matches=cat(near,'拉弦乐');targets=[p,...matches];count=1;break;
        case 'P12': own(cat(near,'拨弦'),cat(near,'拨弦').length?1:0);break;
        case 'P14': own(near);break;
        case 'P16': matches=cat(others,'拨弦');targets=matches.length?[p,...cat(near,'拨弦')]:[];count=matches.length;break;
        case 'P17': {const ms=others.filter(q=>q.category!=='键盘'&&direction(p,q,'down'));own(ms,new Set(ms.map(q=>q.category)).size);break;}
        case 'P18': {const below=others.filter(q=>direction(p,q,'down'));own(below,below.length===0?1:0);break;}
        case 'P19': matches=others.filter(q=>q.category!=='键盘'&&direction(p,q,'up'));count=new Set(matches.map(q=>q.category)).size;addGlobal(p.name,count*a,0,p.id);break;
        case 'P20': matches=near.filter(q=>q.category!=='键盘'&&(direction(p,q,'left')||direction(p,q,'right')));count=new Set(matches.map(q=>q.category)).size;addGlobal(p.name,count*a,0,p.id);break;
        case 'P21': matches=near;count=Math.min(new Set(matches.map(q=>q.category)).size,a);extraBeats+=count;break;
        case 'P23': break; // Resource conversion is evaluated once per performance, not while moving props.
        default: if(adornSets[p.id]){count=sets.some(s=>s.tier&&adornSets[p.id].includes(s.name))?1:0;if(count)addGlobal(p.name,0,a,p.id);}
      }
      for(const t of targets){info[t.id].ability+=count*a;info[t.id].sources.push({name:p.name,value:count*a,type:'能力'});}
      entry.active=count>0;entry.matches=matches.map(q=>q.id);entry.targets=targets.map(q=>q.id);entry.count=count;entry.value=a;
    }
    let base=0,member=0,ability=0;for(const v of Object.values(info)){v.total=v.base+v.member+v.ability;base+=v.base;member+=v.member;ability+=v.ability;}
    const subtotal=base+member+ability+globalFixed,total=Math.floor((subtotal*(1+globalPercent))+1e-9);
    return {base,member,ability,globalFixed,globalPercent,subtotal,total,extraBeats,info,sets,globalSources};
  }
  function performance(state,data,{seed='demo',judgment='Great',beats=null,charmRatio=0,woodHits=null,judgments=null}={}) {
    const r=data.rules,rng=random(seed),preview=score(state,data),baseBeats=beats===null?r.beatMin+Math.floor(rng()*(r.beatMax-r.beatMin+1)):beats,totalBeats=baseBeats+preview.extraBeats;
    const beatResults=Array.from({length:totalBeats},(_,index)=>{const quality=weighted(r.beatWeights,rng);const sampled=judgment==='随机'?['Miss','Good','Great','Perfect'][weighted([.05,.2,.5,.25],rng)]:judgment;const j=judgments?.[index]??sampled;if(!['Miss','Good','Great','Perfect'].includes(j))throw Error('节拍判定无效');return {quality:quality+1,judgment:j,rate:j==='Miss'?0:r.beatRates[quality][['Good','Great','Perfect'].indexOf(j)]};});
    const beatRate=beatResults.reduce((a,b)=>a+b.rate,0),hits=beatResults.filter(b=>b.judgment!=='Miss').length;
    const wood=state.placed.find(p=>p.id==='P23'),woodValue=wood?data.items.find(i=>i.id==='P23').effect[tierIndex(state.owned.P23.level)]:0;
    const resourceCount=r.woodCount==='hits'?(woodHits===null?hits:woodHits):totalBeats,groups=Math.floor(resourceCount/r.woodDivisor),woodAmount=groups*woodValue;
    const woodPercent=r.woodMode==='percent'?woodAmount/100:0,woodFixed=r.woodMode==='fixed'?woodAmount:0;
    const charm=Math.min(r.charmCap,Math.pow(Math.max(0,charmRatio)/r.targetRatio,r.charmExponent)*r.charmScale);
    const total=Math.floor(preview.total*(1+beatRate+woodPercent+charm)+woodFixed+1e-9);
    return {seed,preview:preview.total,baseBeats,extraBeats:preview.extraBeats,totalBeats,beatResults,beatRate,hits,woodGroups:wood?groups:0,woodAmount,woodPercent,woodFixed,charm,total,formula:`floor(${preview.total} × (1 + ${(beatRate*100).toFixed(2)}% + ${(woodPercent*100).toFixed(2)}% + ${(charm*100).toFixed(2)}%) + ${woodFixed})`};
  }
  function newState(data,mode='trial') {const state={mode,owned:{},placed:[],unlocked:initialCells(data.rules),unlockCredits:0,stamina:data.rules.initialStamina,spent:0,drawRemainder:0,unlockRemainder:0,drawCount:0,drawQueue:[],logs:[],scoreSum:0,shows:0,seed:'music-0914',selected:null,version:data.version};
    if(mode==='test')for(const i of data.items)state.owned[i.id]={level:1,progress:0};
    else { // Fixed initial pair: purple electric guitar + blue bass, shared plucked/rock sets; both fit 3x3.
      state.owned.P12={level:1,progress:0};state.owned.P13={level:1,progress:0};
      const x=Math.floor((data.rules.cols-data.rules.initialCols)/2),y=Math.floor((data.rules.rows-data.rules.initialRows)/2);state.placed=[{id:'P12',x,y},{id:'P13',x,y:y+1}];
    }return state;
  }
  function makeDraw(data,index,seed) {const advanced=index%data.rules.advancedEvery===0,rng=random(seed),weights=advanced?data.rules.advancedWeights:data.rules.normalWeights;
    // Each slot samples its quality independently. Deduplicate names only within that quality.
    const chosen=[];for(let k=0;k<3;k++){const quality=qualities[weighted(weights,rng)],pool=data.items.filter(i=>i.quality===quality&&!chosen.includes(i.id));chosen.push(pool[Math.floor(rng()*pool.length)].id);}return {index,advanced,choices:chosen};}
  function spend(state,data,amount) {if(!Number.isInteger(amount)||amount<=0||state.stamina<amount)throw Error('消耗体力须为正整数，且不能超过当前体力');if(state.drawQueue.length)throw Error('请先完成当前三选一');
    state.stamina-=amount;state.spent+=amount;
    const r=data.rules,room=r.rows*r.cols-state.unlocked.length-state.unlockCredits;
    let grants=0;if(room>0){state.unlockRemainder+=amount;grants=Math.min(room,Math.floor(state.unlockRemainder/r.unlockStamina)*r.unlockCells);state.unlockRemainder%=r.unlockStamina;state.unlockCredits+=grants;}if(state.unlocked.length+state.unlockCredits>=r.rows*r.cols)state.unlockRemainder=0;
    state.drawRemainder+=amount;while(state.drawRemainder>=r.drawStamina){state.drawRemainder-=r.drawStamina;state.drawCount++;state.drawQueue.push(makeDraw(data,state.drawCount,`${state.seed}:draw:${state.drawCount}`));}return grants;}
  function choose(state,data,id) {if(!state.drawQueue[0]?.choices.includes(id))throw Error('无效奖励');let message='新道具';if(state.owned[id]){const o=state.owned[id];if(o.level>=data.rules.maxLevel)message='已满级';else{o.progress++;if(o.progress>=data.rules.duplicatesPerLevel){o.progress-=data.rules.duplicatesPerLevel;o.level++;message=`升级至${o.level}级`;}else message=`升级进度${o.progress}/${data.rules.duplicatesPerLevel}`;}}else state.owned[id]={level:1,progress:0};state.drawQueue.shift();return message;}
  function unlock(state,data,cell) {if(!state.unlockCredits||state.unlocked.includes(cell)||cell<0||cell>=data.rules.rows*data.rules.cols)return false;const col=cell%data.rules.cols,row=Math.floor(cell/data.rules.cols);if(!state.unlocked.some(c=>Math.abs(c%data.rules.cols-col)+Math.abs(Math.floor(c/data.rules.cols)-row)===1))return false;state.unlocked.push(cell);state.unlockCredits--;return true;}
  const api={clone,qualities,tierIndex,cells,adjacent,direction,initialCells,validPlacement,placement,manualUnlock,judgeTiming,random,weighted,score,performance,newState,makeDraw,spend,choose,unlock};
  if(typeof module!=='undefined')module.exports=api;else root.NumericEngine=api;
})(typeof window!=='undefined'?window:globalThis);
