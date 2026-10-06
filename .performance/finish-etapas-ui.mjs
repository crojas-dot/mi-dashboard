import fs from 'node:fs'
const edit=(p,fn)=>fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8').replaceAll('\r\n','\n')))
for(const [file,module] of [['GeneralTab','all'],['QuejasTab','quejas']])fs.writeFileSync(`components/dashboard/${file}.tsx`,`'use client'\nimport DeadlineDashboard from './DeadlineDashboard'\nexport default function ${file}(){return <DeadlineDashboard module="${module}"/>}\n`)
fs.writeFileSync('components/dashboard/cuiColors.ts',`'use client'
import { getStyle } from '@coreui/utils'
export interface CuiColors {primary:string;success:string;info:string;warning:string;danger:string;secondary:string;body:string;muted:string;grid:string}
/** Chart.js needs resolved colors. Cards and canvas share the CoreUI tokens. */
export function cuiColors():CuiColors {
 const root=typeof document==='undefined'?undefined:document.querySelector<HTMLElement>('.coreui-scope')??document.documentElement
 const read=(name:string)=>root?getStyle('--cui-'+name,root):''
 return {primary:read('primary'),success:read('success'),info:read('info'),warning:read('warning'),danger:read('danger'),secondary:read('secondary'),body:read('body-color'),muted:read('secondary-color'),grid:read('border-color-translucent')}
}
`)
edit('app/page.tsx',s=>s.replace("import { useDashboard, useActividadReciente } from '@/lib/queries/useDashboard'","import { useQueryClient, useIsFetching } from '@tanstack/react-query'\nimport { queryKeys } from '@/lib/queries/queryKeys'").replace(/  const \{ data, isPending[\s\S]*?(?=\n  return)/,`  const client = useQueryClient()
  const ocupado = useIsFetching({queryKey:queryKeys.dashboard}) > 0
  const refresh = () => { void client.invalidateQueries({queryKey:queryKeys.dashboard}) }
`).replace(/<GeneralTab data=[^>]+\/>/,'<GeneralTab />'))
edit('lib/services/quejaWorkflowService.ts',s=>s.replace('  quejaId: string\n  categoria?', '  quejaId: string\n  revision: number\n  categoria?').replace('p_queja_id: input.quejaId,\n    p_categoria:', 'p_id: input.quejaId,\n    p_expected: input.revision,\n    p_categoria:').replace("return callRpc<Queja>('transicionar_queja', {\n    p_queja_id: quejaId,\n    p_nuevo_estado: nuevoEstado,", "return callRpc<Queja>('qms_transition', {\n    p_id: quejaId,\n    p_expected: params.revision,\n    p_state: nuevoEstado,"))
edit('app/configuracion/page.tsx',s=>s.replace(") : (\n          <div className=\"space-y-4\">\n            <div className=\"table-responsive\">", ") : (\n          <div className=\"space-y-4\">\n            <CalendarSettings />\n            <div className=\"table-responsive\">"))
edit('app/mis-quejas/page.tsx',s=>s.replace("import ErrorState", "import { CBadge } from '@coreui/react'\nimport ErrorState"))
for(const f of ['StageSettings','CalendarSettings'])edit(`components/configuracion/${f}.tsx`,s=>s.replaceAll('<ErrorState error=', '<ErrorState title="No se pudo completar la operación" error='))
edit('lib/queries/useStageRules.ts',s=>s.replace('.limit(1).single().abortSignal(signal)','.limit(1).abortSignal(signal).single()'))
edit('components/ui/Badge.tsx',s=>s.replace("{ red:","{ primary:'primary', info:'info', success:'success', warning:'warning', danger:'danger', secondary:'secondary', red:").replace("['amber','orange']","['amber','orange','warning']"))
