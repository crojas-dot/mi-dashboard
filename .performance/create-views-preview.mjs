import fs from 'node:fs'
let server = fs.readFileSync('.performance/shell-preview-server.mjs', 'utf8')
server = server.replace("path:'/quejas'", "path:'/procesos'")
server = server.replace("'@/lib/supabase': `export const supabase={rpc:async()=>({error:null})};`,", "'@/lib/supabase': `export {supabase} from './.performance/views-preview-db';`,\n  '@/lib/services/folioService': `export const generarFolio=async tipo=>tipo.toUpperCase()+'-TEST-002';`,")
server = server.replace('const queries = `', `const queries = \`\nimport {useMemory} from './.performance/views-preview-db';
const useList=(table,estado='')=>{const data=useMemory(state=>state[table]);const filtered=estado?data.filter(row=>row.estado===estado):data;return {data:{data:filtered,count:filtered.length},isLoading:false,isFetching:false,error:null,refetch:()=>{}}};
export const useProcesos=()=>useList('procesos'),useAuditorias=()=>useList('auditorias'),useRiesgos=()=>useList('riesgos'),useReuniones=()=>useList('reuniones'),useDocumentos=(_page,estado)=>useList('documentos',estado);
export const useHallazgos=()=>({data:[{id:'h1',descripcion:'Hallazgo de prueba',tipo:'Observacion'}]}),useMatrizRiesgos=()=>({data:[{p:2,i:2,count:1}],isPending:false,isFetching:false,error:null,refetch:()=>{}});
`)
server = server.replace("'.performance/shell-preview-app.tsx'", "'.performance/views-preview-app.tsx'").replaceAll('shell-fixture', 'views-fixture').replaceAll('shell-preview.html','views-preview.html')
fs.writeFileSync('.performance/views-preview-server.mjs', server)
