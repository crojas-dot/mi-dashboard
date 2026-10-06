'use client'
import { useState } from 'react'
import { CCard,CCardHeader,CCardBody,CRow,CCol,CFormCheck,CFormInput,CButton,CAlert,CSpinner,CModal,CModalHeader,CModalTitle,CModalBody,CModalFooter } from '@coreui/react'
import ErrorState from '@/components/ui/ErrorState'
import { useWorkCalendar,usePublishConfiguration,type Calendar } from '@/lib/queries/useStageRules'
import { showSuccess } from '@/lib/services/errorToast'
export default function CalendarSettings(){
 const query=useWorkCalendar();const publish=usePublishConfiguration('calendar')
 const [draft,setDraft]=useState<Calendar|null>(null);const [confirm,setConfirm]=useState(false);const [reason,setReason]=useState('')
 const calendar=draft??query.data
 if(query.error)return <ErrorState title="No se pudo completar la operación" error={query.error} onRetry={()=>void query.refetch()}/>
 if(!calendar)return <CSpinner aria-label="Cargando calendario"/>
 const save=async()=>{try{await publish.mutateAsync({p_expected:calendar.id,p_weekdays:calendar.weekdays,p_holidays:calendar.holidays,p_reason:reason.trim()||null});setDraft(null);setConfirm(false);setReason('');showSuccess('Nueva versión del calendario publicada')}catch{/* Preserve the draft and show server validation. */}}
 return <CCard className="mb-4"><CCardHeader><h3 className="fs-5 mb-0">Calendario laboral</h3></CCardHeader><CCardBody>
 <p className="text-body-secondary">Zona horaria: America/Costa_Rica. El cómputo comienza al día siguiente; vence al terminar el día. Si no es laborable, se traslada al siguiente día laborable.</p>
 <CRow className="g-2 mb-3">{['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'].map((label,i)=><CCol xs="auto" key={label}><CFormCheck id={`workday-${i}`} label={label} checked={calendar.weekdays.includes(i+1)} onChange={e=>setDraft({...calendar,weekdays:e.target.checked?[...calendar.weekdays,i+1]:calendar.weekdays.filter(d=>d!==i+1)})}/></CCol>)}</CRow>
 <h4 className="fs-6">Feriados</h4>{calendar.holidays.length===0&&<p className="text-body-secondary">No hay feriados registrados.</p>}
 {calendar.holidays.map((holiday,i)=><CRow key={i} className="g-2 mb-2"><CCol sm={4}><CFormInput type="date" aria-label={`Fecha del feriado ${i+1}`} value={holiday.date} onChange={e=>setDraft({...calendar,holidays:calendar.holidays.map((h,j)=>i===j?{...h,date:e.target.value}:h)})}/></CCol><CCol sm={6}><CFormInput aria-label={`Descripción del feriado ${i+1}`} value={holiday.description} onChange={e=>setDraft({...calendar,holidays:calendar.holidays.map((h,j)=>i===j?{...h,description:e.target.value}:h)})}/></CCol><CCol sm={2}><CButton color="danger" variant="outline" onClick={()=>setDraft({...calendar,holidays:calendar.holidays.filter((_,j)=>j!==i)})}>Quitar</CButton></CCol></CRow>)}
 <CButton color="secondary" variant="outline" onClick={()=>setDraft({...calendar,holidays:[...calendar.holidays,{date:'',description:''}]})}>Agregar feriado</CButton>
 <CFormInput className="my-3" aria-label="Motivo del cambio de calendario" placeholder="Motivo del cambio (opcional)" value={reason} onChange={e=>setReason(e.target.value)}/>
 <CButton color="primary" disabled={!draft} onClick={()=>{publish.reset();setConfirm(true)}}>Revisar cambio</CButton>
 <CModal visible={confirm} backdrop="static" onClose={()=>{if(!publish.isPending)setConfirm(false)}} aria-labelledby="calendar-title"><CModalHeader closeButton={!publish.isPending}><CModalTitle id="calendar-title">Publicar calendario</CModalTitle></CModalHeader><CModalBody><CAlert color="warning">Solo las etapas que comiencen después del cambio usarán este calendario. Los vencimientos ya registrados se conservan.</CAlert>{publish.error&&<ErrorState title="No se pudo completar la operación" error={publish.error}/>}</CModalBody><CModalFooter><CButton color="secondary" variant="outline" disabled={publish.isPending} onClick={()=>setConfirm(false)}>Volver</CButton><CButton color="primary" disabled={publish.isPending} onClick={()=>void save()}>{publish.isPending?'Guardando…':'Publicar versión'}</CButton></CModalFooter></CModal>
 </CCardBody></CCard>
}
