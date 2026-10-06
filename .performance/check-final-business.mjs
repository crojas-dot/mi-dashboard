import fs from 'node:fs'
import { businessSignatures } from '../scripts/audit-ui-migration.mjs'
const before=JSON.parse(fs.readFileSync('.performance/tailwind-final-before.json','utf8'))
let checked=0
const baseline={}, differences=[]
for(const [f,old]of Object.entries(before)) {
 if(!fs.existsSync(f)||f.startsWith('components/ui/')||['components/Modal.tsx','components/LegacyViewBoundary.tsx','components/dashboard/Chart.tsx','components/dashboard/cuiColors.ts'].includes(f))continue
 const expected=businessSignatures(f,old),actual=businessSignatures(f,fs.readFileSync(f,'utf8'))
 for(const key of ['hooks','events'])if(expected[key]!==actual[key])differences.push({file:f,contract:key})
 baseline[f]={hooks:expected.hooks,events:expected.events};checked++
}
fs.writeFileSync('.performance/final-business-audit.json',JSON.stringify({checked,differences},null,2))
if(differences.length)throw Error(JSON.stringify(differences))
fs.writeFileSync('tests/fixtures/tailwind-final-business.json',JSON.stringify(baseline,null,2))
console.log({checked,differences})
