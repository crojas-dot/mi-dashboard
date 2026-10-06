import fs from 'node:fs'
function edit(file,fn){const old=fs.readFileSync(file,'utf8');fs.writeFileSync(file,fn(old))}
edit('app/configuracion/page.tsx',s=>s
 .replace(/import \{ useSLAConfig[^\n]+\n/,'')
 .replace("import ErrorState", "import StageSettings from '@/components/configuracion/StageSettings'\nimport CalendarSettings from '@/components/configuracion/CalendarSettings'\nimport ErrorState")
 .replace(/const procesosSLA[^\n]+\n/,'')
 .replace("['red', 'amber', 'green', 'blue', 'orange', 'purple', 'gray']","['primary', 'info', 'success', 'warning', 'danger', 'secondary']")
 .replace(/  const \{ data: slas[^\n]+\n/,'').replace(/  const invalidateSLA[^\n]+\n/,'').replace(/  const \[editSLA[^\n]+\n/,'')
 .replace(/  const guardarSLA = async[\s\S]*?(?=  const guardarConfig)/,'')
 .replace(/        : tab === 'sla' && slasError[^\n]+\n/,'')
 .replace(" || (tab === 'sla' && slasLoading)",'')
 .replace(/\) : tab === 'sla' \? \([\s\S]*?(?=\) : tab === 'formularios')/, ") : tab === 'sla' ? (\n<StageSettings />\n        ")
 .replace("label: 'SLA y Plazos'", "label: 'Plazos y alertas'")
 .replaceAll("color: 'gray'", "color: 'secondary'").replaceAll("color || 'gray'", "color || 'secondary'")
 .replace("supabase.from('catalogos').delete()", "supabase.from('catalogos').update({ activo: false })")
 .replaceAll('Valor eliminado','Valor desactivado').replaceAll('No se pudo eliminar el valor','No se pudo desactivar el valor')
 .replace('<CButton color="danger" onClick={() => eliminarCatalogo(c.id)}', '<CButton disabled={c.tipo.startsWith(\'estado_\') || c.activo === false} color="danger" onClick={() => eliminarCatalogo(c.id)}')
 .replace('onClick={() => eliminarCatalogo(c.id)} className="px-2 py-1 font-medium">Eliminar', 'onClick={() => eliminarCatalogo(c.id)} className="px-2 py-1 font-medium">Desactivar')
 .replace('<CButton color="primary" onClick={() => setEditCatalogo({', '<CButton disabled={filtroTipo.startsWith(\'estado_\')} color="primary" onClick={() => setEditCatalogo({')
 .replace('<CFormCheck id="catalogo-activo"', '<CFormCheck disabled={filtroTipo.startsWith(\'estado_\')} id="catalogo-activo"')
 .replace('<CTableHeaderCell className="px-3 py-2 text-left font-semibold">Valor</CTableHeaderCell>', '<CTableHeaderCell>ID interno</CTableHeaderCell><CTableHeaderCell className="px-3 py-2 text-left font-semibold">Nombre visible</CTableHeaderCell>')
 .replace('<CTableDataCell className="px-3 py-2">{c.valor}</CTableDataCell>', '<CTableDataCell className="font-monospace small">{c.codigo}</CTableDataCell><CTableDataCell className="px-3 py-2">{c.valor}</CTableDataCell>')
 .replace('colSpan={5} className="px-3 py-8 text-center">No hay valores', 'colSpan={6} className="px-3 py-8 text-center">No hay valores')
 .replace("const configsGenerales = configs.filter((c) =>", "const configsGenerales = configs.filter((c) => c.clave !== 'org.zona_horaria' &&")
 .replace(") : (\n          <div className=\"space-y-4\">\n            <div className=\"table-responsive\">", ") : (\n          <div className=\"space-y-4\">\n            <CalendarSettings />\n            <div className=\"table-responsive\">")
)
edit('lib/queries/useCatalogos.ts',s=>s.replace('  id: string','  codigo: string\n  valor_interno: string\n  id: string').replaceAll('{ valor: string; color: string }','{ valor: string; color: string; codigo: string; valor_interno: string }').replace(".select('valor, color')",".select('valor, color, codigo, valor_interno')"))
edit('lib/types.ts',s=>s.replace('  id: string',`  revision: number
  estado_codigo: string
  estado_nombre: string
  estado_color: import('@/lib/queries/useStageRules').SemanticColor
  plazo_situacion: import('@/lib/queries/useDeadlineDashboard').DeadlineStatus
  plazo_dias: number | null
  plazo_vence: string | null
  plazo_etapa: string | null
  id: string`))
edit('lib/errors/userError.ts',s=>s.replace("  if (status === 401",`  if (rawCode === '40001')
    return result('Otra persona modificó este registro.', 'Cierra y vuelve a abrir el expediente, o recarga la configuración antes de guardar.')
  if (['PGRST202','42P01'].includes(rawCode) && /qms_/i.test(raw))
    return result('Falta instalar la actualización de etapas en la base de datos.', 'El administrador debe aplicar la migración de etapas y actualizar el esquema de la API.')
  if (rawCode === '22023')
    return result('La configuración contiene valores inválidos.', 'Usa una duración positiva y alertas únicas entre uno y la duración; revisa días laborables y feriados.')
  if (status === 401`))
edit('lib/queries/useQuejas.ts',s=>s.replace(".from('quejas')",".from('qms_quejas')").replace("query.eq('estado', estado)","query.eq('estado_codigo', estado)").replace('    placeholderData: keepPreviousData,','    refetchInterval: 60000,\n    placeholderData: keepPreviousData,'))
edit('lib/services/quejaWorkflowService.ts',s=>s
 .replace('  quejaId: string\n  categoria?', '  quejaId: string\n  revision: number\n  categoria?')
 .replace("return callRpc<Queja>('actualizar_detalles_queja', {", "return callRpc<Queja>('qms_update_details', {")
 .replace('p_queja_id: input.quejaId,\n    p_categoria:', 'p_id: input.quejaId,\n    p_expected: input.revision,\n    p_categoria:')
 .replace('p_responsable_id: input.responsableId', 'p_owner: input.responsableId').replace('p_notas: input.notas','p_notes: input.notas')
 .replace('export interface TransicionQuejaParams {','export interface TransicionQuejaParams {\n  revision: number')
 .replace('params: TransicionQuejaParams = {}','params: TransicionQuejaParams')
 .replace("return callRpc<Queja>('transicionar_queja', {\n    p_queja_id: quejaId,\n    p_nuevo_estado: nuevoEstado,", "return callRpc<Queja>('qms_transition', {\n    p_id: quejaId,\n    p_expected: params.revision,\n    p_state: nuevoEstado,")
 .replace('p_resolucion: params.', 'p_resolution: params.').replace('p_justificacion_procede: params.','p_justification: params.').replace('p_responsable_id: params.', 'p_owner: params.').replace('p_motivo_reapertura: params.','p_reopen: params.')
 .replace(/export function reabrirQueja[\s\S]*?(?=export async function subirAdjuntoQueja)/,`export function reabrirQueja(quejaId: string, motivo: string, revision: number) {
  return transicionarQueja(quejaId, 'investigation', { revision, motivoReapertura: motivo })
}

`))
const states={'Recibido':'received','En Investigación':'investigation','Pendiente de Revisión GC':'quality_review','Resuelto':'resolved','Finalizado':'finished','No Procede':'rejected'}
for(const file of ['app/quejas/components/QuejaDetalleModal.tsx','app/mis-quejas/components/QuejaColaboradorPanel.tsx'])edit(file,s=>{
 s=s.replace("queja?.estado ?? ''","queja?.estado_codigo ?? ''").replace("queja.estado ?? ''","queja.estado_codigo ?? ''")
 for(const [label,code] of Object.entries(states))s=s.replaceAll(`'${label}'`,`'${code}'`)
 s=s.replace(/transicionarQueja\(queja.id, ('[^']+'), \{/g, 'transicionarQueja(queja.id, $1, { revision: queja.revision,')
 s=s.replace(/transicionarQueja\(queja.id, ('[^']+')\)/g, 'transicionarQueja(queja.id, $1, { revision: queja.revision })')
 s=s.replace('actualizarDetallesQueja({ quejaId: queja.id,','actualizarDetallesQueja({ quejaId: queja.id, revision: queja.revision,')
 s=s.replaceAll('Plazo: 15 días.', 'Vencimiento calculado según la configuración vigente.').replaceAll('Nuevo plazo: 15 días.', 'Nuevo plazo calculado según la configuración vigente.').replaceAll('inicia el plazo de 15 días','inicia el plazo configurado para esta etapa').replaceAll('con un nuevo plazo de 15 días','con el plazo vigente al iniciar la nueva etapa')
 s=s.replace('{estadoActual}</span>','{queja.estado_nombre}</span>').replace('{estado}</Badge>', '{queja.estado_nombre}</Badge>')
 s=s.replace("await transicionarQueja(queja.id, 'quality_review'", "const updated = await transicionarQueja(queja.id, 'quality_review'")
 s=s.replace("onUpdated({ id: queja.id, estado: 'quality_review', resolucion })","onUpdated({ ...updated, estado_codigo: 'quality_review' })")
 // Keep mutation snapshot until explicit refresh; never silently rebase a dirty form.
 return s
})
edit('app/quejas/page.tsx',s=>s
 .replace('useQuejas, useSLAConfig,','useQuejas,').replace('prioridadVariant, estadoVariant','prioridadVariant')
 .replace("import ErrorState", "import { deadlineText, deadlineLabels } from '@/lib/utils/deadlinePresentation'\nimport ErrorState")
 .replace('CButton, CCard,','CBadge, CButton, CCard,')
 .replace(/  const \[ahora\][^\n]+\n/,'').replace(/  const \{ data: slaConfigs[^\n]+\n/,'')
 .replace(/  const slaMap = useMemo\([\s\S]*?(?=  const quejaIds)/,'')
 .replace(/                      const sla = calcularSLA[^\n]+\n/,'')
 .replace('value={e.valor}>{e.valor}', 'value={e.codigo}>{e.valor}')
 .replace("<Badge variant={estadoVariant[q.estado] || 'gray'}>{q.estado}</Badge>", '<CBadge color={q.estado_color}>{q.estado_nombre}</CBadge>')
 .replace('<Badge variant={sla.variant}>{sla.label}</Badge>', '<CBadge color={deadlineLabels[q.plazo_situacion].color}>{deadlineText(q.plazo_situacion,q.plazo_dias)}</CBadge>')
 .replace('onUpdated={() => { invalidateQuejas() }}', 'onUpdated={() => { setDetalleOpen(null); invalidateQuejas() }}')
)
edit('app/mis-quejas/page.tsx',s=>s.replace('CButton,','CBadge, CButton,').replace('prioridadVariant, estadoVariant','prioridadVariant').replace('estadoVariant, prioridadVariant','prioridadVariant').replace("<Badge variant={estadoVariant[q.estado] || 'gray'}>{q.estado}</Badge>",'<CBadge color={q.estado_color}>{q.estado_nombre}</CBadge>'))
