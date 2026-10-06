import fs from 'node:fs'
import path from 'node:path'
const backup='.performance/rejected-etapas'
fs.mkdirSync(backup,{recursive:true})
function edit(file,fn){const old=fs.readFileSync(file,'utf8');const dest=path.join(backup,file);fs.mkdirSync(path.dirname(dest),{recursive:true});if(!fs.existsSync(dest))fs.writeFileSync(dest,old);fs.writeFileSync(file,fn(old.replaceAll('\r\n','\n')))}
edit('lib/types.ts',s=>s.replace(/  revision: number[\s\S]*?(?=  id: string)/,''))
edit('lib/queries/useCatalogos.ts',s=>s.replace('  codigo: string\n  valor_interno: string\n','').replaceAll('; codigo: string; valor_interno: string','').replace(".select('valor, color, codigo, valor_interno')",".select('valor, color')"))
edit('lib/queries/useQuejas.ts',s=>s.replace(".from('qms_quejas')",".from('quejas')").replace("query.eq('estado_codigo', estado)","query.eq('estado', estado)").replace('    refetchInterval: 60000,\n',''))
edit('lib/services/quejaWorkflowService.ts',s=>s
 .replaceAll('  revision: number\n','')
 .replace("return callRpc<Queja>('qms_update_details', {\n    p_id: input.quejaId,\n    p_expected: input.revision,", "return callRpc<Queja>('actualizar_detalles_queja', {\n    p_queja_id: input.quejaId,")
 .replace('p_owner: input.responsableId','p_responsable_id: input.responsableId').replace('p_notes: input.notas','p_notas: input.notas')
 .replace('params: TransicionQuejaParams)', 'params: TransicionQuejaParams = {})')
 .replace("return callRpc<Queja>('qms_transition', {\n    p_id: quejaId,\n    p_expected: params.revision,\n    p_state: nuevoEstado,", "return callRpc<Queja>('transicionar_queja', {\n    p_queja_id: quejaId,\n    p_nuevo_estado: nuevoEstado,")
 .replace('p_resolution: params.', 'p_resolucion: params.').replace('p_justification: params.', 'p_justificacion_procede: params.').replace('p_owner: params.', 'p_responsable_id: params.').replace('p_reopen: params.','p_motivo_reapertura: params.')
 .replace(/export function reabrirQueja[\s\S]*?(?=export async function subirAdjuntoQueja)/,`export function reabrirQueja(quejaId: string, motivo: string) {
  return callRpc<Queja>('reabrir_queja', {
    p_queja_id: quejaId,
    p_motivo: motivo.trim(),
  })
}

`))
const states={'Recibido':'received','En Investigación':'investigation','Pendiente de Revisión GC':'quality_review','Resuelto':'resolved','Finalizado':'finished','No Procede':'rejected'}
for(const file of ['app/quejas/components/QuejaDetalleModal.tsx','app/mis-quejas/components/QuejaColaboradorPanel.tsx'])edit(file,s=>{
 s=s.replace("queja?.estado_codigo ?? ''","queja?.estado ?? ''").replace("queja.estado_codigo ?? ''","queja.estado ?? ''")
 for(const [label,code] of Object.entries(states))s=s.replaceAll(`'${code}'`,`'${label}'`)
 s=s.replaceAll('{ revision: queja.revision,','{').replaceAll(', { revision: queja.revision }','').replace('quejaId: queja.id, revision: queja.revision,','quejaId: queja.id,')
 s=s.replace('Nuevo plazo calculado según la configuración vigente.','Nuevo plazo: 15 días.').replace('Vencimiento calculado según la configuración vigente.','Plazo: 15 días.').replace('inicia el plazo configurado para esta etapa','inicia el plazo de 15 días').replace('con el plazo vigente al iniciar la nueva etapa','con un nuevo plazo de 15 días')
 s=s.replace('{queja.estado_nombre}</span>','{estadoActual}</span>').replace('{queja.estado_nombre}</Badge>','{estado}</Badge>')
 s=s.replace('const updated = await transicionarQueja','await transicionarQueja').replace('onUpdated(updated)',"onUpdated({ id: queja.id, estado: 'Pendiente de Revisión GC', resolucion })")
 if(file.includes('Colaborador'))s=s.replace("import { prioridadVariant }", "import { estadoVariant, prioridadVariant }").replace('variant={queja.estado_color}',"variant={estadoVariant[estado] || 'gray'}")
 else s=s.replace('const ESTADOS_FLUJO',`const colorMap: Record<string, string> = {
  red: '#dc3545', amber: '#e0a800', green: '#198754',
  blue: '#0d6efd', orange: '#fd7e14', purple: '#6f42c1', gray: '#6c757d',
}

const ESTADOS_FLUJO`).replace(/    const semantic =[^\n]+\n    return `var\(--cui-\$\{semantic\}\)`/,"    return found ? colorMap[found.color] || '#6c757d' : '#6c757d'")
 return s
})
edit('app/quejas/page.tsx',s=>s
 .replace("import QuejaDeepLink from '@/components/quejas/QuejaDeepLink'\n",'').replace("import { deadlineText, deadlineLabels } from '@/lib/utils/deadlinePresentation'\n",'')
 .replace('Suspense, useState,','useState,').replace('CBadge, CButton,','CButton,').replace('useQuejas, quejasEstadisticasKey','useQuejas, useSLAConfig, quejasEstadisticasKey').replace('import { prioridadVariant }','import { prioridadVariant, estadoVariant }')
 .replace('  const pageSize = 25', '  const [ahora] = useState(() => Date.now())\n  const pageSize = 25')
 .replace("  const { data: prioridades = [] } = useCatalogoTipo('prioridad')", "  const { data: prioridades = [] } = useCatalogoTipo('prioridad')\n  const { data: slaConfigs = [] } = useSLAConfig('quejas')")
 .replace('  const quejaIds =',`  const slaMap = useMemo(() => {
    const m: Record<string, { dias_alerta: number; dias_vencimiento: number }> = {}
    for (const s of slaConfigs) m[s.prioridad] = s
    return m
  }, [slaConfigs])

  function calcularSLA(fecha: string, prioridad: string, estado: string): { label: string; variant: string } {
    if (estadoVariant[estado] === 'green') return { label: 'Completado', variant: 'green' }
    const dias = Math.floor((ahora - new Date(fecha).getTime()) / 86400000)
    const sla = slaMap[prioridad]
    if (sla) {
      if (dias <= sla.dias_alerta) return { label: \`\${dias}d\`, variant: 'green' }
      if (dias <= sla.dias_vencimiento) return { label: \`\${dias}d\`, variant: 'amber' }
      return { label: \`\${dias}d\`, variant: 'red' }
    }
    if (dias <= 3) return { label: \`\${dias}d\`, variant: 'green' }
    if (dias <= 7) return { label: \`\${dias}d\`, variant: 'amber' }
    return { label: \`\${dias}d\`, variant: 'red' }
  }

  const quejaIds =`)
 .replace('      <Suspense><QuejaDeepLink /></Suspense>\n','')
 .replace('value={e.codigo}>{e.valor}','value={e.valor}>{e.valor}')
 .replace('                      const vista =', '                      const sla = calcularSLA(q.fecha, q.prioridad, q.estado)\n                      const vista =')
 .replace('<CBadge color={q.estado_color}>{q.estado_nombre}</CBadge>',"<Badge variant={estadoVariant[q.estado] || 'gray'}>{q.estado}</Badge>")
 .replace('<CBadge color={deadlineLabels[q.plazo_situacion].color}>{deadlineText(q.plazo_situacion,q.plazo_dias)}</CBadge>','<Badge variant={sla.variant}>{sla.label}</Badge>')
 .replace('onUpdated={() => { setDetalleOpen(null); invalidateQuejas() }}','onUpdated={() => { invalidateQuejas() }}'))
edit('app/mis-quejas/page.tsx',s=>s.replace("import { CBadge } from '@coreui/react'\n",'').replace('import { prioridadVariant }','import { prioridadVariant, estadoVariant }').replace('<CBadge color={q.estado_color}>{q.estado_nombre}</CBadge>',"<Badge variant={estadoVariant[q.estado] || 'gray'}>{q.estado}</Badge>"))
edit('components/ui/Badge.tsx',s=>s.replace("primary:'primary', info:'info', success:'success', warning:'warning', danger:'danger', secondary:'secondary', ",'').replace("['amber','orange','warning']","['amber','orange']"))
edit('tests/data-reliability.test.mjs',s=>s.replace('fakeDatabase({ qms_quejas:', 'fakeDatabase({ quejas:').replace("estado: 'received'","estado: 'Recibido'").replace("get('estado_codigo'), 'eq.received'","get('estado'), 'eq.Recibido'"))
edit('tests/entity-request-guard.test.mjs',s=>s.replace("estado_codigo: 'investigation', estado_nombre: 'Investigación en curso', estado_color: 'primary', revision: 7, ",'').replace("estado_codigo: 'quality_review', revision: 8, ",''))
