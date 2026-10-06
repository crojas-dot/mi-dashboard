import fs from 'node:fs'
import path from 'node:path'
const read=n=>JSON.parse(fs.readFileSync(`.performance/recovery/command-${n}.json`,'utf8')).aggregatedOutput
const save=(file,body)=>{
 if(!body || body.includes('tokens truncated'))throw new Error('Snapshot incompleto: '+file)
 const backup=path.join('.performance/rejected-etapas',file)
 fs.mkdirSync(path.dirname(backup),{recursive:true})
 if(!fs.existsSync(backup))fs.copyFileSync(file,backup)
 fs.writeFileSync(file,body.trimEnd()+'\n')
 console.log('Restaurado:',file)
}
let output=read(3018)
const configStart=output.lastIndexOf("'use client'")
save('app/configuracion/page.tsx',output.slice(configStart))
const serviceStart=output.indexOf("import { createHttpError }")
save('lib/services/quejaWorkflowService.ts',output.slice(serviceStart,configStart))
const queryStart=output.indexOf("'use client'",output.indexOf('Recordatorio final:'))
save('lib/queries/useQuejas.ts',output.slice(queryStart,serviceStart))
output=read(3029)
const catalogStart=output.indexOf("'use client'",output.indexOf('export async function subirAdjuntoQueja'))
const generalStart=output.indexOf("'use client'",catalogStart+1)
save('lib/queries/useCatalogos.ts',output.slice(catalogStart,generalStart))
save('app/page.tsx',output.slice(output.lastIndexOf("'use client'")))
for(const [file,snapshot] of [['GeneralTab.tsx','GeneralTab.tsx.753e656cc4'],['QuejasTab.tsx','QuejasTab.tsx.b6d9e0a5a6'],['cuiColors.ts','dashboard-part-3.txt']])save('components/dashboard/'+file,fs.readFileSync('.performance/recovery/'+snapshot,'utf8'))
const kit='components/dashboard/chartKit.tsx'
save(kit,fs.readFileSync(kit,'utf8').replaceAll('animation: false as const','animation: false'))
const errors='lib/errors/userError.ts'
save(errors,fs.readFileSync(errors,'utf8').replace(/  if \(rawCode === '40001'\)[\s\S]*?(?=  if \(status === 401)/,''))
