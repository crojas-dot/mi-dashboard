'use client'
import Link from 'next/link'
import { CRow,CCol,CBadge,CProgress,CProgressBar,CSpinner,CTable,CTableHead,CTableBody,CTableRow,CTableHeaderCell,CTableDataCell,CAlert } from '@coreui/react'
import { useDeadlineDashboard,type CountGroup,type DeadlineStatus } from '@/lib/queries/useDeadlineDashboard'
import { deadlineLabels,deadlineText } from '@/lib/utils/deadlinePresentation'
import ErrorState from '@/components/ui/ErrorState'
import CChart from './Chart'
import { Panel,ChartEmpty,opcionesLinea,opcionesDonut,uiColors } from './chartKit'
import styles from '@/app/dashboard.module.css'

const modules:Record<string,string>={quejas:'Quejas',sacp:'SACP',documentos:'Documentos',riesgos:'Riesgos'}
const moduleColors=['primary','info','warning','secondary'] as const
/** Standard CoreUI progress group. Change presentation here; never compute SLA here. */
function Counts({groups}:{groups:CountGroup[]}) {
 const total=groups.reduce((sum,g)=>sum+g.total,0)
 return groups.length?<>{groups.map(g=><div className="progress-group mb-3" key={g.label}><div className="d-flex justify-content-between w-100 mb-1 gap-3"><span>{g.label}</span><strong>{g.total.toLocaleString('es-CR')}</strong></div><CProgress className="w-100" aria-label={g.label}><CProgressBar color={g.color??'primary'} value={total?g.total/total*100:0}/></CProgress></div>)}</>:<ChartEmpty mensaje="No hay registros para esta distribución."/>
}
function Buckets({buckets}:{buckets:Partial<Record<DeadlineStatus,number>>}){
 const keys:DeadlineStatus[]=['overdue','today','soon','within']
 return <><Counts groups={keys.map(key=>({...deadlineLabels[key],total:buckets[key]??0}))}/>{!!buckets.unconfigured&&<p className="small text-body-secondary">{buckets.unconfigured} sin plazo registrado.</p>}{!!buckets.completed&&<p className="small text-body-secondary">{buckets.completed} sin etapa con plazo activa.</p>}</>
}
export default function DeadlineDashboard({module}:{module:'all'|'quejas'}){
 const query=useDeadlineDashboard(module),data=query.data,colors=uiColors(),complaints=module==='quejas'
 if(query.error)return <ErrorState error={query.error} title="No se pudo cargar el control de plazos" onRetry={()=>void query.refetch()} retrying={query.isFetching}/>
 if(!data)return <CSpinner aria-label="Cargando indicadores de plazos"/>
 const total=data.modules.reduce((sum,m)=>sum+m.total,0)
 const received=data.month.received,resolved=data.month.resolved
 const trend=<Panel title={complaints?'Quejas recibidas vs resueltas':'Expedientes abiertos vs cerrados'}>
  {complaints&&<CRow className="g-3 mb-4">{[['Recibidas este mes',received],['Resueltas este mes',resolved],['Tasa de resolución',received?`${Math.round(resolved/received*100)} %`:'Sin entradas']].map(([label,value])=><CCol sm={4} key={label}><div className="text-body-secondary small">{label}</div><div className="fs-5 fw-semibold">{value}</div></CCol>)}</CRow>}
  {data.trend.length?<div className={styles.chartLarge}><CChart type="line" wrapper={false} customTooltips={false} role="img" aria-label={complaints?'Recibidas y resueltas por mes':'Aperturas y cierres por mes'} data={{labels:data.trend.map(t=>new Date(`${t.month}-15T12:00:00Z`).toLocaleDateString('es-CR',{month:'short',year:'numeric',timeZone:'America/Costa_Rica'})),datasets:[{label:complaints?'Recibidas':'Abiertos',data:data.trend.map(t=>t.opened),borderColor:colors.primary,backgroundColor:colors.primary,pointRadius:3},{label:complaints?'Resueltas':'Cerrados',data:data.trend.map(t=>t.closed),borderColor:colors.success,backgroundColor:colors.success,pointRadius:3}]}} options={opcionesLinea(colors,{buscar:true}) as never}/></div>:<ChartEmpty/>}
  <p className="small text-body-secondary mt-3 mb-0">{data.history_note}</p>
 </Panel>
 return <CRow className="g-4">
  {complaints?<CCol xs={12}>{trend}</CCol>:<><CCol lg={7}><Panel title="Control de plazos"><Buckets buckets={data.buckets}/></Panel></CCol><CCol lg={5}><Panel title="Pendientes por módulo">{total?<><div className={styles.donut}><CChart type="doughnut" wrapper={false} customTooltips={false} role="img" aria-label={`Pendientes por módulo: ${total} en total`} data={{labels:data.modules.map(m=>modules[m.label]??m.label),datasets:[{data:data.modules.map(m=>m.total),backgroundColor:data.modules.map((_,i)=>colors[moduleColors[i%4]]),borderWidth:0}]}} options={opcionesDonut() as never}/><div className={styles.donutTotal}><strong>{total}</strong><span>pendientes</span></div></div><div className={styles.legend}>{data.modules.map((m,i)=>(<span key={m.label}><i style={{background:colors[moduleColors[i%4]]}}/>{modules[m.label]??m.label} <strong>{m.total}</strong></span>))}</div></>:<ChartEmpty mensaje="No hay expedientes pendientes."/>}</Panel></CCol><CCol xs={12}>{trend}</CCol></>}
  {complaints&&<><CCol lg={6}><Panel title="Quejas por estado"><Counts groups={data.states}/></Panel></CCol><CCol lg={6}><Panel title="Quejas por categoría"><Counts groups={data.categories}/></Panel></CCol><CCol xs={12}><Panel title="Cumplimiento de plazos por etapa"><CRow className="g-4">{data.stages.map(stage=><CCol lg={6} key={stage.id}><h3 className="fs-5">{stage.name}</h3><p className="text-body-secondary small">Regla vigente: {stage.duration} días {stage.day_type==='business_days'?'hábiles':'naturales'}. Cada caso conserva el plazo de su propia versión.</p><Buckets buckets={stage.buckets}/></CCol>)}</CRow></Panel></CCol></>}
  <CCol xs={12}><Panel title={complaints?'Quejas que requieren atención':'Expedientes que requieren atención'}>
   <CTable responsive align="middle" hover><CTableHead><CTableRow><CTableHeaderCell scope="col">{complaints?'Folio / Cliente':'Expediente'}</CTableHeaderCell><CTableHeaderCell scope="col">{complaints?'Tipo':'Módulo'}</CTableHeaderCell><CTableHeaderCell scope="col">Estado</CTableHeaderCell><CTableHeaderCell scope="col">Prioridad</CTableHeaderCell><CTableHeaderCell scope="col">Retraso</CTableHeaderCell><CTableHeaderCell scope="col">Acción</CTableHeaderCell></CTableRow></CTableHead><CTableBody>{data.attention.map(item=><CTableRow key={`${item.module}-${item.id}`}><CTableDataCell><div className="fw-semibold">{item.folio}</div><span>{item.title}</span></CTableDataCell><CTableDataCell>{complaints?item.categoria:modules[item.module]}</CTableDataCell><CTableDataCell><CBadge color={item.color}>{item.state}</CBadge></CTableDataCell><CTableDataCell><CBadge color={item.prioridad==='Alta'?'danger':'secondary'}>{item.prioridad||'Sin prioridad'}</CBadge></CTableDataCell><CTableDataCell>{deadlineText(item.situation,item.days)}</CTableDataCell><CTableDataCell><Link className="btn btn-outline-primary btn-sm" href={`/${item.module}?expediente=${encodeURIComponent(item.id)}`}>Revisar</Link></CTableDataCell></CTableRow>)}</CTableBody></CTable>
   {!data.attention.length&&<CAlert color="success" className="mb-0">No hay casos que requieran atención en los registros que puedes consultar.</CAlert>}
   {data.attention.length===25&&<p className="small text-body-secondary">Se muestran los primeros 25 casos por severidad. Los gráficos incluyen todos los registros autorizados.</p>}
  </Panel></CCol><CCol xs={12}><p className="small text-body-secondary mb-0">Datos actualizados: {new Date(data.as_of).toLocaleString('es-CR',{timeZone:'America/Costa_Rica'})}</p></CCol>
 </CRow>
}
