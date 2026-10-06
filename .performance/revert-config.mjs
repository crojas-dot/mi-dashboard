import fs from 'node:fs'
const file='app/configuracion/page.tsx'
fs.copyFileSync(file,'.performance/rejected-etapas/configuracion-before-revert.tsx')
let s=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n')
s=s.replace("import StageSettings from '@/components/configuracion/StageSettings'\n",'').replace("import CalendarSettings from '@/components/configuracion/CalendarSettings'\n",'')
 .replace("import { useFormulariosPublicos", "import { useSLAConfig, slaConfigKey, type SLAConfig } from '@/lib/queries/useQuejas'\nimport { useFormulariosPublicos")
 .replace('const descripciones:', "const procesosSLA = ['quejas', 'sacp', 'documentos', 'auditorias', 'riesgos', 'revision_direccion']\n\nconst descripciones:")
 .replace("['primary', 'info', 'success', 'warning', 'danger', 'secondary']","['red', 'amber', 'green', 'blue', 'orange', 'purple', 'gray']")
 .replace('  const queryClient =', '  const { data: slas = [], isLoading: slasLoading, error: slasError, refetch: retrySlas } = useSLAConfig()\n  const queryClient =')
 .replace("  const [tab, setTab]", "  const invalidateSLA = () => queryClient.invalidateQueries({ queryKey: slaConfigKey })\n  const [tab, setTab]")
 .replace("c.clave !== 'org.zona_horaria' && ",'')
 .replace('  const [editConfig,', '  const [editSLA, setEditSLA] = useState<Partial<SLAConfig>>({})\n  const [editConfig,')
 .replaceAll("color: 'secondary'","color: 'gray'").replaceAll("color || 'secondary'","color || 'gray'")
 .replace("supabase.from('catalogos').update({ activo: false })","supabase.from('catalogos').delete()")
 .replaceAll('No se pudo desactivar el valor','No se pudo eliminar el valor').replaceAll('Valor desactivado','Valor eliminado')
 .replace(/  const activarCatalogo = async[\s\S]*?(?=  const guardarConfig)/,'')
 .replace('  const guardarConfig =',`  const guardarSLA = async () => {
    if (!editSLA.proceso?.trim() || !editSLA.prioridad?.trim()) return
    const payload = { proceso: editSLA.proceso, prioridad: editSLA.prioridad, dias_alerta: editSLA.dias_alerta ?? 0, dias_vencimiento: editSLA.dias_vencimiento ?? 0 }
    const { error } = editSLA.id
      ? await supabase.from('sla_config').update(payload).eq('id', editSLA.id)
      : await supabase.from('sla_config').insert([payload])
    if (error) { showError(error, 'No se pudo guardar la configuración SLA'); return }
    showSuccess('Configuración SLA guardada')
    setEditSLA({})
    invalidateSLA()
  }

  const eliminarSLA = async (id: string) => {
    const { error } = await supabase.from('sla_config').delete().eq('id', id)
    if (error) { showError(error, 'No se pudo eliminar la configuración SLA'); return }
    showSuccess('Configuración SLA eliminada')
    invalidateSLA()
  }

  const guardarConfig =`)
 .replace("label: 'Plazos y alertas'","label: 'SLA y Plazos'")
 .replace("        : tab === 'general' && configsError", "        : tab === 'sla' && slasError ? <ErrorState error={slasError} title=\"No se pudieron cargar los plazos\" onRetry={() => void retrySlas()} />\n        : tab === 'general' && configsError")
 .replace("(tab === 'catalogos' && loading) ||", "(tab === 'catalogos' && loading) || (tab === 'sla' && slasLoading) ||")
 .replaceAll(" disabled={filtroTipo.startsWith('estado_')}",'')
 .replace(" title={filtroTipo.startsWith('estado_') ? 'Los estados del flujo se definen por migración' : 'Nuevo valor'}",'')
 .replace(/            \{filtroTipo.startsWith\('estado_'\) && \([\s\S]*?            \)\}\n/,'')
 .replace('<CTableHeaderCell>ID interno</CTableHeaderCell><CTableHeaderCell className="px-3 py-2 text-left font-semibold">Nombre visible</CTableHeaderCell>', '<CTableHeaderCell className="px-3 py-2 text-left font-semibold">Valor</CTableHeaderCell>')
 .replace('<CTableDataCell className="font-monospace small">{c.codigo}</CTableDataCell>','')
 .replace('colSpan={6} className="px-3 py-8 text-center">No hay valores', 'colSpan={5} className="px-3 py-8 text-center">No hay valores')
 .replace(/                          \{c.tipo.startsWith\('estado_'\) \? \([\s\S]*?                          \)\}/, '<CButton color="danger" onClick={() => eliminarCatalogo(c.id)} className="px-2 py-1 font-medium">Eliminar</CButton>')
 .replace('            <CalendarSettings />\n','')
 .replace('<StageSettings />',`          <div className="space-y-4">
            <div className={styles.toolbar}>
              <p className="text-sm text-gray-600">Configura los días de alerta y vencimiento por proceso y prioridad.</p>
              <CButton color="primary" onClick={() => setEditSLA({ proceso: '', prioridad: '', dias_alerta: 0, dias_vencimiento: 0 })} className="inline-flex items-center gap-1 px-3 py-1.5 font-medium"><Plus className="h-3.5 w-3.5" /> Agregar</CButton>
            </div>
            {editSLA.proceso !== undefined && (
              <div className={styles.editor}>
                <div><CFormLabel htmlFor="sla-proceso">Proceso</CFormLabel><Select id="sla-proceso" value={editSLA.proceso || ''} onChange={(e) => setEditSLA({ ...editSLA, proceso: e.target.value })}>
                  <option value="" disabled>Seleccionar proceso</option>
                  {procesosSLA.map((p) => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}
                </Select></div>
                <div><CFormLabel htmlFor="sla-prioridad">Prioridad</CFormLabel><CFormInput id="sla-prioridad" placeholder="Ej. Alta" value={editSLA.prioridad || ''} onChange={(e) => setEditSLA({ ...editSLA, prioridad: e.target.value })} /></div>
                <div><CFormLabel htmlFor="sla-alerta">Alerta (días)</CFormLabel><CFormInput id="sla-alerta" type="number" value={editSLA.dias_alerta ?? 0} onChange={(e) => setEditSLA({ ...editSLA, dias_alerta: parseInt(e.target.value) || 0 })} /></div>
                <div><CFormLabel htmlFor="sla-vencimiento">Vencimiento (días)</CFormLabel><CFormInput id="sla-vencimiento" type="number" value={editSLA.dias_vencimiento ?? 0} onChange={(e) => setEditSLA({ ...editSLA, dias_vencimiento: parseInt(e.target.value) || 0 })} /></div>
                <div className={styles.editorActions}>
                <CButton color="primary" onClick={guardarSLA} className="px-3 py-1.5 font-medium"><Save className="inline h-3.5 w-3.5" /> Guardar</CButton>
                <CButton color="secondary" variant="outline" onClick={() => setEditSLA({})} className="px-3 py-1.5">Cancelar</CButton>
                </div>
              </div>
            )}
            <div className="table-responsive">
              <CTable align="middle" hover className="w-full select-text">
                <CTableHead><CTableRow className="">
                  <CTableHeaderCell className="px-3 py-2 text-left font-semibold">Proceso</CTableHeaderCell>
                  <CTableHeaderCell className="px-3 py-2 text-left font-semibold">Prioridad</CTableHeaderCell>
                  <CTableHeaderCell className="px-3 py-2 text-left font-semibold">Alerta (días)</CTableHeaderCell>
                  <CTableHeaderCell className="px-3 py-2 text-left font-semibold">Vencimiento (días)</CTableHeaderCell>
                  <CTableHeaderCell className="px-3 py-2 text-center font-semibold w-24">Acciones</CTableHeaderCell>
                </CTableRow></CTableHead>
                <CTableBody>{slas.length === 0 ? (
                  <CTableRow><CTableDataCell colSpan={5} className="px-3 py-8 text-center">No hay configuraciones SLA</CTableDataCell></CTableRow>
                ) : slas.map((s) => (
                  <CTableRow key={s.id} className="">
                    <CTableDataCell className="px-3 py-2 font-medium">{s.proceso}</CTableDataCell>
                    <CTableDataCell className="px-3 py-2"><Badge variant={(s.prioridad || '').toLowerCase() === 'alta' ? 'red' : (s.prioridad || '').toLowerCase() === 'media' ? 'amber' : 'green'}>{s.prioridad}</Badge></CTableDataCell>
                    <CTableDataCell className="px-3 py-2">{s.dias_alerta}d</CTableDataCell>
                    <CTableDataCell className="px-3 py-2 font-semibold">{s.dias_vencimiento}d</CTableDataCell>
                    <CTableDataCell className="px-3 py-2 text-center"><CButton color="danger" onClick={() => eliminarSLA(s.id)} className="px-2 py-1 font-medium">Eliminar</CButton></CTableDataCell>
                  </CTableRow>
                ))}</CTableBody>
              </CTable>
            </div>
          </div>`)
fs.writeFileSync(file,s)
