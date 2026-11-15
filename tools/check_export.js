#!/usr/bin/env node
/* Check a TeamLinkt schedule export before it replaces data/schedule.csv.
     node tools/check_export.js path/to/schedule_export_YYYYMMDD_HHMMSS.csv
   Prints what would change. Exit code 0 = safe to publish, 1 = do not publish. */
const fs=require('fs'), path=require('path');
const TL=require(path.join(__dirname,'..','js','teamlinkt.js'));
const file=process.argv[2];
if(!file){ console.error('usage: node tools/check_export.js <export.csv>'); process.exit(1); }
const fail=m=>{ console.log('DO NOT PUBLISH: '+m); process.exit(1); };
let text; try{ text=fs.readFileSync(file,'utf8'); }catch(e){ fail('cannot read '+file); }
const head=(TL.csvRows(text)[0]||[]).map(h=>h.trim());
const want=['Date','Start Time','End Time','Location','Group','Event Type','Notes','Home Team','Away Team'];
const missing=want.filter(h=>!head.includes(h));
if(missing.length) fail('missing columns: '+missing.join(', ')+'. This is not a full TeamLinkt schedule export.');
const neu=TL.parse(text);
if(!neu.games.length) fail('no games in the file.');
const curFile=path.join(__dirname,'..','data','schedule.csv');
const old=fs.existsSync(curFile)?TL.parse(fs.readFileSync(curFile,'utf8')).games:[];
const d=TL.diff(old,neu.games);
const regions=new Set(neu.games.map(g=>TL.splitGroup(g.group).region||TL.splitGroup(g.group).sport));
console.log(`games: ${neu.games.length} (was ${old.length})`);
console.log(`unchanged ${d.same.length}, changed ${d.changed.length}, added ${d.added.length}, removed ${d.removed.length}`);
console.log('groups covered: '+[...regions].sort().join(' | '));
if(neu.problems.length) console.log('rows skipped: '+neu.problems.length+'\n  '+neu.problems.slice(0,10).join('\n  '));
const sameSeason=old.length&&neu.games.some(g=>old.some(o=>o.date===g.date));
if(sameSeason&&d.removed.length>Math.max(20,old.length*0.25))
  fail(`${d.removed.length} of ${old.length} games would disappear. The export is probably filtered to one division or date range. Re-export everything.`);
if(neu.problems.length>neu.games.length*0.05) fail('too many unreadable rows.');
console.log(d.changed.length+d.added.length+d.removed.length?'OK TO PUBLISH':'NO CHANGE - nothing to publish');
