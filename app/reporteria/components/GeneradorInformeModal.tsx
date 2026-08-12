'use client'

import { useState, useEffect } from 'react'
import {
  MessageSquareWarning, ClipboardList, FileCheck2,
  ShieldAlert, ClipboardCheck, SearchCheck, Loader2,
  ChevronRight, ChevronLeft, Check, Printer, X,
} from 'lucide-react'
import Modal from '@/components/Modal'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'

interface Props {
  open: boolean
  onClose: () => void
  moduloInicial: string | null
}

const modulos = [
  { value: 'quejas', label: 'Quejas', icon: MessageSquareWarning },
  { value: 'sacp', label: 'SACP', icon: ClipboardList },
  { value: 'documentos', label: 'Documentos', icon: FileCheck2 },
  { value: 'riesgos', label: 'Riesgos', icon: ShieldAlert },
  { value: 'auditorias', label: 'Auditorías', icon: ClipboardCheck },
  { value: 'revision_direccion', label: 'Revisión por Dirección', icon: SearchCheck },
]

const tablaPorModulo: Record<string, string> = {
  quejas: 'quejas',
  sacp: 'acciones',
  documentos: 'documentos',
  riesgos: 'riesgos',
  auditorias: 'auditorias',
  revision_direccion: 'reuniones',
}

interface CatalogoItem { valor: string; color: string }

export default function GeneradorInformeModal({ open, onClose, moduloInicial }: Props) {
  const [paso, setPaso] = useState(1)
  const [modulo, setModulo] = useState('')
  const [incluir, setIncluir] = useState({ tabla: true, resumen: true, vencidos: false, distribucion: false })
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [filterEstado, setFilterEstado] = useState('')
  const [filterPrioridad, setFilterPrioridad] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [catalogoEstados, setCatalogoEstados] = useState<CatalogoItem[]>([])
  const [catalogoPrioridades, setCatalogoPrioridades] = useState<CatalogoItem[]>([])
  const [catalogoTipos, setCatalogoTipos] = useState<CatalogoItem[]>([])
  const [resultados, setResultados] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && moduloInicial) {
      setModulo(moduloInicial)
      setPaso(2)
      setIncluir({ tabla: true, resumen: true, vencidos: false, distribucion: false })
      setFechaDesde('')
      setFechaHasta('')
      setFilterEstado('')
      setFilterPrioridad('')
      setFilterTipo('')
      setResultados([])
    }
  }, [open, moduloInicial])

  useEffect(() => {
    if (paso !== 2) return
    const cargarCatalogos = async () => {
      setCatalogoEstados([])
      setCatalogoPrioridades([])
      setCatalogoTipos([])
      const tipoEstadoMap: Record<string, string> = {
        quejas: 'estado_queja', sacp: 'estado_sacp', documentos: 'estado_documento',
        auditorias: 'estado_auditoria', riesgos: '', revision_direccion: '',
      }
      const tipoPrioridadMap: Record<string, string> = { quejas: 'prioridad' }
      const tipoCatMap: Record<string, string> = { sacp: 'tipo_sacp' }

      const promises: any[] = []
      if (tipoEstadoMap[modulo]) promises.push(
        supabase.from('catalogos').select('valor,color').eq('tipo', tipoEstadoMap[modulo]).eq('modulo', modulo).or('activo.is.null,activo.eq.true').order('orden').then(r => r.data || [])
      )
      if (tipoPrioridadMap[modulo]) promises.push(
        supabase.from('catalogos').select('valor,color').eq('tipo', tipoPrioridadMap[modulo]).eq('modulo', modulo).or('activo.is.null,activo.eq.true').order('orden').then(r => r.data || [])
      )
      if (tipoCatMap[modulo]) promises.push(
        supabase.from('catalogos').select('valor,color').eq('tipo', tipoCatMap[modulo]).eq('modulo', modulo).or('activo.is.null,activo.eq.true').order('orden').then(r => r.data || [])
      )
      const results = await Promise.all(promises)
      let idx = 0
      if (tipoEstadoMap[modulo]) { setCatalogoEstados(results[idx]); idx++ }
      if (tipoPrioridadMap[modulo]) { setCatalogoPrioridades(results[idx]); idx++ }
      if (tipoCatMap[modulo]) { setCatalogoTipos(results[idx]); idx++ }
    }
    cargarCatalogos()
  }, [paso, modulo])

  const generarInforme = async () => {
    setLoading(true)
    const tabla = tablaPorModulo[modulo]
    if (!tabla) return
    let query = supabase.from(tabla).select('*')
    if (fechaDesde) {
      const campoFecha = modulo === 'revision_direccion' ? 'fecha_programada' : modulo === 'riesgos' ? 'fecha_identificacion' : 'fecha'
      query = query.gte(campoFecha, fechaDesde)
    }
    if (fechaHasta) {
      const campoFecha = modulo === 'revision_direccion' ? 'fecha_programada' : modulo === 'riesgos' ? 'fecha_identificacion' : 'fecha'
      query = query.lte(campoFecha, fechaHasta)
    }
    if (filterEstado) query = query.eq('estado', filterEstado)
    if (filterPrioridad && modulo === 'quejas') query = query.eq('prioridad', filterPrioridad)
    if (filterTipo) query = query.eq('tipo', filterTipo)
    const { data } = await query
    setResultados(data || [])
    setLoading(false)
    setPaso(3)
  }

  const columnsPorModulo: Record<string, { key: string; label: string }[]> = {
    quejas: [
      { key: 'folio', label: 'Folio' },
      { key: 'cliente_nombre', label: 'Cliente' },
      { key: 'categoria', label: 'Categoría' },
      { key: 'prioridad', label: 'Prioridad' },
      { key: 'estado', label: 'Estado' },
      { key: 'fecha', label: 'Fecha' },
    ],
    sacp: [
      { key: 'folio', label: 'Folio' },
      { key: 'tipo', label: 'Tipo' },
      { key: 'descripcion', label: 'Descripción' },
      { key: 'estado', label: 'Estado' },
      { key: 'fecha_limite', label: 'Fecha Límite' },
    ],
    documentos: [
      { key: 'codigo_doc', label: 'Código' },
      { key: 'titulo', label: 'Título' },
      { key: 'version_actual', label: 'Versión' },
      { key: 'estado', label: 'Estado' },
      { key: 'fecha_publicacion', label: 'Fecha Publicación' },
    ],
    riesgos: [
      { key: 'folio', label: 'Folio' },
      { key: 'descripcion', label: 'Descripción' },
      { key: 'impacto', label: 'Impacto' },
      { key: 'probabilidad', label: 'Probabilidad' },
      { key: 'estado', label: 'Estado' },
    ],
    auditorias: [
      { key: 'folio', label: 'Folio' },
      { key: 'tipo', label: 'Tipo' },
      { key: 'proceso_area', label: 'Proceso/Área' },
      { key: 'estado', label: 'Estado' },
      { key: 'fecha_inicio', label: 'Fecha Inicio' },
    ],
    revision_direccion: [
      { key: 'titulo', label: 'Título' },
      { key: 'tipo', label: 'Tipo' },
      { key: 'estado', label: 'Estado' },
      { key: 'fecha_programada', label: 'Fecha' },
    ],
  }

  const campoDistribucion: Record<string, string> = {
    quejas: 'categoria',
    documentos: 'categoria',
    riesgos: 'tipo',
    auditorias: 'tipo',
    sacp: 'tipo',
    revision_direccion: 'tipo',
  }

  const campoVencido: Record<string, string> = {
    quejas: 'fecha',
    sacp: 'fecha_limite',
    documentos: 'fecha_publicacion',
    auditorias: 'fecha_inicio',
    riesgos: 'fecha_identificacion',
    revision_direccion: 'fecha_programada',
  }

  const badgeColor = (valor?: string): string => {
    if (!valor) return 'gray'
    return ['red', 'amber', 'green', 'blue', 'orange', 'purple', 'gray'].includes(valor) ? valor : 'gray'
  }

  const cellValue = (row: any, key: string) => {
    const v = row[key]
    if (!v) return '—'
    if (key === 'descripcion' && typeof v === 'string' && v.length > 60) return v.slice(0, 60) + '…'
    if (key === 'impacto' || key === 'probabilidad') return String(v)
    if (typeof v === 'string' && v.includes('T')) return new Date(v).toLocaleDateString('es-ES')
    return v
  }

  return (
    <Modal open={open} onClose={onClose} title="Generar Informe" size="lg">
      <div className="informe-content">
        {paso < 3 && (
          <div className="flex items-center gap-2 mb-4">
            {[1, 2].map((p) => (
              <div key={p} className="flex items-center gap-1.5">
                <div
                  className="flex items-center justify-center text-xs font-semibold text-white"
                  style={{
                    width: '22px', height: '22px', borderRadius: '4px',
                    backgroundColor: paso >= p ? '#0d6efd' : '#ced4da',
                  }}
                >
                  {p}
                </div>
                <span className="text-sm" style={{ color: paso >= p ? '#212529' : '#adb5bd' }}>
                  {p === 1 ? 'Selección' : 'Filtros'}
                </span>
                {p < 2 && <span className="mx-1" style={{ color: '#ced4da' }}><ChevronRight className="h-3 w-3 inline" /></span>}
              </div>
            ))}
          </div>
        )}

        {paso === 1 && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium" style={{ color: '#212529' }}>Módulo</p>
              <div className="grid grid-cols-2 gap-2">
                {modulos.map((m) => {
                  const Icon = m.icon
                  const selected = modulo === m.value
                  return (
                    <button
                      key={m.value}
                      onClick={() => setModulo(m.value)}
                      className={`flex items-center gap-2.5 rounded-lg border p-3 text-left text-sm transition-all ${
                        selected ? 'border-2' : 'hover:bg-gray-50'
                      }`}
                      style={{
                        backgroundColor: selected ? '#0d6efd' : '#fff',
                        borderColor: selected ? '#0d6efd' : '#dee2e6',
                        cursor: 'pointer',
                      }}
                    >
                      <div
                        className="flex items-center justify-center rounded-lg shrink-0"
                        style={{ width: '34px', height: '34px', backgroundColor: selected ? 'rgba(255,255,255,0.2)' : '#e7f1ff' }}
                      >
                        <Icon style={{ width: '16px', height: '16px', color: selected ? '#fff' : '#0d6efd' }} />
                      </div>
                      <span className="font-medium" style={{ color: selected ? '#fff' : '#212529' }}>{m.label}</span>
                      {selected && <span className="ml-auto text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}><Check className="h-3 w-3 inline" /></span>}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: '#212529' }}>¿Qué incluir en el informe?</label>
              <div className="space-y-2">
                {[
                  { key: 'tabla', label: 'Tabla de registros' },
                  { key: 'resumen', label: 'Resumen por estado' },
                  { key: 'vencidos', label: 'Registros vencidos / por vencer' },
                  { key: 'distribucion', label: 'Distribución por categoría/tipo' },
                ].map((item) => (
                  <label key={item.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(incluir as any)[item.key]}
                      onChange={(e) => setIncluir({ ...incluir, [item.key]: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end pt-2">
                <Button onClick={() => { if (modulo) { setPaso(2); setFilterEstado(''); setFilterPrioridad(''); setFilterTipo('') } }}>
                  Siguiente <ChevronRight className="h-4 w-4 inline" />
                </Button>
            </div>
          </div>
        )}

        {paso === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: '#212529' }}>Desde</label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: '#212529' }}>Hasta</label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                />
              </div>
            </div>
            {modulo === 'quejas' && catalogoEstados.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: '#212529' }}>Estado</label>
                <Select className="w-full" value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)}>
                  <option value="">Todos</option>
                  {catalogoEstados.map((e) => <option key={e.valor} value={e.valor}>{e.valor}</option>)}
                </Select>
              </div>
            )}
            {modulo === 'quejas' && catalogoPrioridades.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: '#212529' }}>Prioridad</label>
                <Select className="w-full" value={filterPrioridad} onChange={(e) => setFilterPrioridad(e.target.value)}>
                  <option value="">Todas</option>
                  {catalogoPrioridades.map((p) => <option key={p.valor} value={p.valor}>{p.valor}</option>)}
                </Select>
              </div>
            )}
            {modulo === 'sacp' && catalogoEstados.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: '#212529' }}>Estado</label>
                <Select className="w-full" value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)}>
                  <option value="">Todos</option>
                  {catalogoEstados.map((e) => <option key={e.valor} value={e.valor}>{e.valor}</option>)}
                </Select>
              </div>
            )}
            {modulo === 'sacp' && catalogoTipos.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: '#212529' }}>Tipo</label>
                <Select className="w-full" value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}>
                  <option value="">Todos</option>
                  {catalogoTipos.map((t) => <option key={t.valor} value={t.valor}>{t.valor}</option>)}
                </Select>
              </div>
            )}
            {modulo === 'auditorias' && catalogoEstados.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: '#212529' }}>Estado</label>
                <Select className="w-full" value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)}>
                  <option value="">Todos</option>
                  {catalogoEstados.map((e) => <option key={e.valor} value={e.valor}>{e.valor}</option>)}
                </Select>
              </div>
            )}
            {modulo === 'documentos' && catalogoEstados.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: '#212529' }}>Estado</label>
                <Select className="w-full" value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)}>
                  <option value="">Todos</option>
                  {catalogoEstados.map((e) => <option key={e.valor} value={e.valor}>{e.valor}</option>)}
                </Select>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button variant="secondary" onClick={() => setPaso(1)}><ChevronLeft className="h-4 w-4 inline" /> Atrás</Button>
              <Button onClick={generarInforme}>Generar informe <ChevronRight className="h-4 w-4 inline" /></Button>
            </div>
          </div>
        )}

        {paso === 3 && (
          <div>
            {loading ? (
              <div className="flex items-center justify-center" style={{ minHeight: '200px' }}>
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#0d6efd' }} />
              </div>
            ) : (
              <div className="space-y-5">
                <div className="text-center pb-3 border-b border-gray-200">
                  <h2 className="text-xl font-bold m-0" style={{ color: '#212529' }}>Informe de {modulos.find(m => m.value === modulo)?.label}</h2>
                  <p className="m-0 mt-1 text-sm" style={{ color: '#6c757d' }}>Ente Costarricense de Acreditación</p>
                  <p className="m-0 text-xs" style={{ color: '#adb5bd' }}>
                    Generado: {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {fechaDesde && ` · Período: ${new Date(fechaDesde).toLocaleDateString('es-ES')} - ${new Date(fechaHasta).toLocaleDateString('es-ES')}`}
                  </p>
                </div>

                {incluir.resumen && resultados.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2" style={{ color: '#212529' }}>Resumen por Estado</h3>
                    <div className="flex gap-3 flex-wrap">
                      <div className="rounded-lg border px-4 py-2 text-center bg-white" style={{ borderColor: '#dee2e6', minWidth: '80px' }}>
                        <p className="text-2xl font-bold m-0" style={{ color: '#0d6efd' }}>{resultados.length}</p>
                        <p className="text-xs m-0" style={{ color: '#6c757d' }}>Total</p>
                      </div>
                      {Object.entries(
                        resultados.reduce((acc: Record<string, number>, r) => {
                          acc[r.estado] = (acc[r.estado] || 0) + 1
                          return acc
                        }, {})
                      ).map(([estado, count]) => (
                        <div key={estado} className="rounded-lg border px-4 py-2 text-center bg-white" style={{ borderColor: '#dee2e6', minWidth: '80px' }}>
                          <p className="text-2xl font-bold m-0" style={{ color: '#212529' }}>{count}</p>
                          <p className="text-xs m-0" style={{ color: '#6c757d' }}>{estado}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {incluir.distribucion && resultados.length > 0 && campoDistribucion[modulo] && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2" style={{ color: '#212529' }}>
                      Distribución por {modulo === 'quejas' ? 'Categoría' : 'Tipo'}
                    </h3>
                    <div className="rounded-lg border overflow-hidden bg-white" style={{ borderColor: '#dee2e6' }}>
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ backgroundColor: '#343a40' }}>
                            <th className="px-3 py-2 text-left font-semibold text-white">
                              {modulo === 'quejas' ? 'Categoría' : 'Tipo'}
                            </th>
                            <th className="px-3 py-2 text-right font-semibold text-white">Cantidad</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(
                            resultados.reduce((acc: Record<string, number>, r) => {
                              const val = r[campoDistribucion[modulo]] || 'Sin asignar'
                              acc[val] = (acc[val] || 0) + 1
                              return acc
                            }, {})
                          ).map(([cat, count]) => (
                            <tr key={cat} className="border-b border-gray-200">
                              <td className="px-3 py-1.5">{cat}</td>
                              <td className="px-3 py-1.5 text-right font-semibold">{count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {incluir.tabla && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2" style={{ color: '#212529' }}>Registros</h3>
                    <div className="rounded-lg border overflow-hidden bg-white" style={{ borderColor: '#dee2e6' }}>
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ backgroundColor: '#343a40' }}>
                            {columnsPorModulo[modulo]?.map((col) => (
                              <th key={col.key} className="px-3 py-2 text-left font-semibold text-white whitespace-nowrap">
                                {col.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {resultados.length === 0 ? (
                            <tr><td colSpan={columnsPorModulo[modulo]?.length || 1} className="px-3 py-8 text-center text-gray-500">Sin registros</td></tr>
                          ) : (
                            resultados.map((row: any) => (
                              <tr key={row.id} className="border-b border-gray-200">
                                {columnsPorModulo[modulo]?.map((col) => (
                                  <td key={col.key} className="px-3 py-1.5 align-middle">
                                    {col.key === 'prioridad' || col.key === 'estado' ? (
                                      <Badge variant="gray">{cellValue(row, col.key)}</Badge>
                                    ) : (
                                      <span>{cellValue(row, col.key)}</span>
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {incluir.vencidos && resultados.length > 0 && campoVencido[modulo] && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2" style={{ color: '#dc3545' }}>Registros Vencidos / Por Vencer</h3>
                    <div className="rounded-lg border overflow-hidden bg-white" style={{ borderColor: '#dc3545' }}>
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ backgroundColor: '#343a40' }}>
                            {columnsPorModulo[modulo]?.map((col) => (
                              <th key={col.key} className="px-3 py-2 text-left font-semibold text-white whitespace-nowrap">
                                {col.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const hoy = new Date()
                            const vencidos = resultados.filter((r: any) => {
                              const fechaCampo = campoVencido[modulo]
                              const val = r[fechaCampo]
                              if (!val) return false
                              return new Date(val) < hoy
                            })
                            return vencidos.length === 0 ? (
                              <tr><td colSpan={columnsPorModulo[modulo]?.length || 1} className="px-3 py-8 text-center text-gray-500">Sin registros vencidos</td></tr>
                            ) : (
                              vencidos.map((row: any) => (
                                <tr key={row.id} className="border-b border-gray-200" style={{ backgroundColor: '#fef2f2' }}>
                                  {columnsPorModulo[modulo]?.map((col) => (
                                    <td key={col.key} className="px-3 py-1.5 align-middle" style={{ color: '#dc3545' }}>
                                      {cellValue(row, col.key)}
                                    </td>
                                  ))}
                                </tr>
                              ))
                            )
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-gray-200 no-print">
                  <Button variant="secondary" onClick={() => setPaso(2)}><ChevronLeft className="h-4 w-4 inline" /> Atrás</Button>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4 inline" /> Imprimir</Button>
                    <Button variant="secondary" onClick={onClose}><X className="h-4 w-4 inline" /> Cerrar</Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
