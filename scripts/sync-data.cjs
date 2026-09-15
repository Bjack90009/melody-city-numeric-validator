const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),XLSX=require(path.join(root,'vendor/xlsx.full.min.js'));
const original=JSON.parse(fs.readFileSync(path.join(root,'data.json'),'utf8'));
let data=original;
if(process.argv[2]){
  if(process.argv[2]!=='--from-save'||!process.argv[3])throw Error('用法：node scripts/sync-data.cjs [--from-save 存档.json]');
  data=JSON.parse(fs.readFileSync(process.argv[3],'utf8').replace(/^\uFEFF/,'' )).data;
}
if(!data?.rules||data.items?.length!==31||!Array.isArray(data.sets))throw Error('需要完整的31件数值配置');
const ids=new Set();for(const i of data.items){const old=original.items.find(o=>o.id===i.id);if(!old||ids.has(i.id)||i.width!==old.width||i.height!==old.height)throw Error('ID/形状无效：'+i.id);ids.add(i.id);if(i.base?.length!==6||i.effect?.length!==3||[...i.base,...i.effect].some(v=>!Number.isFinite(v)||v<0))throw Error('基础6档、效果3档须为非负有限数值');i.icon=old.icon;}
if(data.rules.rows!==7||data.rules.cols!==7||data.rules.initialRows!==3||data.rules.initialCols!==3||data.rules.maxLevel!==6)throw Error('结构须保持7×7/初始3×3/六级');
for(const k of ['initialStamina','staminaCap','recoverAmount'])if(!Number.isInteger(data.rules[k])||data.rules[k]<0)throw Error(k+'须为非负整数');
for(const k of ['drawStamina','unlockStamina','unlockCells','advancedEvery','duplicatesPerLevel','woodDivisor','beatMin','beatMax'])if(!Number.isInteger(data.rules[k])||data.rules[k]<=0)throw Error(k+'须为正整数');
for(const k of ['normalWeights','advancedWeights','beatWeights'])if(data.rules[k]?.length!==4||data.rules[k].some(v=>!Number.isFinite(v)||v<0)||data.rules[k].reduce((a,b)=>a+b,0)<=0)throw Error(k+'权重无效');
const wb=XLSX.utils.book_new(),add=(name,rows)=>XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),name);
add('道具',[['ID','名称','1级基础','2级基础','3级基础','4级基础','5级基础','6级基础','1级效果','3级效果','6级效果'],...data.items.map(i=>[i.id,i.name,...i.base,...i.effect])]);
add('规则',[['字段','值(JSON格式)'],...Object.entries(data.rules).map(([k,v])=>[k,JSON.stringify(v)])]);
add('套装',[['名称','档位(JSON格式)'],...data.sets.map(s=>[s.name,JSON.stringify(s.tiers)])]);
add('说明',[['仅本验证器最终结果；不包含原始测算区'],['基础六级；技能1/3/6档；装扮0.003=0.3%；木琴1=1个百分点'],['初始体力999；跳过表演默认值位于index.html'],['修改Excel请先另存、网页加载验证，再导出布局与参数并运行 --from-save'],['修改data.json后运行npm run sync:data；会重新生成本Excel，请先保存人工改值副本']]);
const workbook=XLSX.write(wb,{type:'buffer',bookType:'xlsx'});
fs.writeFileSync(path.join(root,'data.json'),JSON.stringify(data,null,2)+'\n');
fs.writeFileSync(path.join(root,'data.js'),'window.NUMERIC_DATA = '+JSON.stringify(data,null,2)+';\n');
fs.writeFileSync(path.join(root,'爱乐之城-数值验证配置.xlsx'),workbook);
console.log('已同步 data.json、data.js 和数值Excel。请运行 npm test 并进行浏览器验证。');
