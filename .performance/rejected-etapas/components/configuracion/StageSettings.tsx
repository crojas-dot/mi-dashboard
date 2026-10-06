'use client'
import { useState } from 'react'
import { CRow,CCol,CCard,CCardHeader,CCardBody,CButton,CFormInput,CFormSelect,CFormLabel,CModal,CModalHeader,CModalTitle,CModalBody,CModalFooter,CAlert,CSpinner } from '@coreui/react'
import { useStageRules,usePublishConfiguration,type Stage } from '@/lib/queries/useStageRules'
import ErrorState from '@/components/ui/ErrorState'
import { showSuccess } from '@/lib/services/errorToast'

export default function StageSettings() {
  const query=useStageRules()
  const [editing,setEditing]=useState<Stage|null>(null)
  const [alerts,setAlerts]=useState('')
  const [reason,setReason]=useState('')
  const [confirm,setConfirm]=useState(false)
  const publish=usePublishConfiguration('stage')
  if(query.error) return <ErrorState title="No se pudo completar la operación" error={query.error} onRetry={()=>void query.refetch()} />
  if(!query.data) return <CSpinner aria-label="Cargando etapas" />
  const save=async()=>{
    if(!editing) return
    try {
      await publish.mutateAsync({p_stage:editing.id,p_expected:editing.rule.id,p_duration:editing.rule.duration,p_type:editing.rule.day_type,p_alerts:alerts.trim()?alerts.split(',').map(v=>Number(v.trim())):[],p_action:editing.rule.expiration_action,p_reason:reason.trim()||null})
      showSuccess('Nueva versión publicada. Los expedientes en curso conservan sus fechas.');setEditing(null);setConfirm(false)
    } catch { /* Mutation error remains visible in the dialog; retain all edits. */ }
  }
  return <>
    <CAlert color="info">Los plazos se fijan al iniciar cada etapa. Una nueva versión solo se aplica a las etapas que comiencen después de guardarla. El flujo y los permisos se mantienen definidos en el sistema.</CAlert>
    <CRow className="g-3">{query.data.map(stage=><CCol lg={6} key={stage.id}><CCard className="h-100"><CCardHeader><span className="small text-body-secondary">Proceso: {stage.process_id}</span><h3 className="fs-5 mb-0">{stage.name}</h3></CCardHeader><CCardBody>
      <dl><dt>Duración</dt><dd>{stage.rule.duration} días {stage.rule.day_type==='business_days'?'hábiles':'naturales'}</dd><dt>Inicia cuando</dt><dd>{stage.start_event}</dd><dt>Finaliza cuando</dt><dd>{stage.end_event}</dd><dt>Alertas</dt><dd>{stage.rule.alerts.length?`${stage.rule.alerts.join(', ')} días naturales antes`:'Sin alertas previas'}</dd><dt>Al vencer</dt><dd>{stage.rule.expiration_action==='notify_quality'?'Marcar vencida y notificar a Calidad':'Marcar vencida'}</dd></dl>
      <CButton color="primary" onClick={()=>{setEditing(structuredClone(stage));setAlerts(stage.rule.alerts.join(', '));setReason('');setConfirm(false);publish.reset()}}>Editar</CButton>
    </CCardBody></CCard></CCol>)}</CRow>
    <CModal visible={!!editing} onClose={()=>{if(!publish.isPending)setEditing(null)}} backdrop="static" aria-labelledby="stage-title"><CModalHeader closeButton={!publish.isPending}><CModalTitle id="stage-title">{confirm?'Confirmar nueva versión':editing?.name}</CModalTitle></CModalHeader><CModalBody>
      {publish.error&&<ErrorState title="No se pudo completar la operación" error={publish.error} />}
      {confirm?<CAlert color="warning">La nueva regla se aplicará a etapas que comiencen después del cambio. Los expedientes cerrados y en curso conservarán su versión y vencimiento originales.</CAlert>:editing&&<CRow className="g-3">
        <CCol sm={6}><CFormLabel htmlFor="stage-duration">Duración</CFormLabel><CFormInput id="stage-duration" type="number" min={1} max={3660} value={editing.rule.duration} onChange={e=>setEditing({...editing,rule:{...editing.rule,duration:Number(e.target.value)}})} /></CCol>
        <CCol sm={6}><CFormLabel htmlFor="stage-days">Tipo de días</CFormLabel><CFormSelect id="stage-days" value={editing.rule.day_type} onChange={e=>setEditing({...editing,rule:{...editing.rule,day_type:e.target.value as 'business_days'|'calendar_days'}})}><option value="business_days">Hábiles</option><option value="calendar_days">Naturales</option></CFormSelect></CCol>
        <CCol xs={12}><CFormLabel htmlFor="stage-alerts">Días previos de alerta, separados por comas</CFormLabel><CFormInput id="stage-alerts" value={alerts} onChange={e=>setAlerts(e.target.value)} /><p className="small text-body-secondary mb-0">Días naturales, a las 06:00 de Costa Rica. Vacío para omitir alertas previas.</p></CCol>
        <CCol xs={12}><CFormLabel htmlFor="stage-action">Acción al vencer</CFormLabel><CFormSelect id="stage-action" value={editing.rule.expiration_action} onChange={e=>setEditing({...editing,rule:{...editing.rule,expiration_action:e.target.value as 'notify_quality'|'mark_only'}})}><option value="notify_quality">Marcar vencida y notificar a Calidad</option><option value="mark_only">Marcar vencida</option></CFormSelect></CCol>
        <CCol xs={12}><CFormLabel htmlFor="stage-reason">Motivo del cambio (opcional)</CFormLabel><CFormInput id="stage-reason" value={reason} onChange={e=>setReason(e.target.value)} /></CCol>
      </CRow>}
    </CModalBody><CModalFooter><CButton color="secondary" variant="outline" disabled={publish.isPending} onClick={()=>confirm?setConfirm(false):setEditing(null)}>{confirm?'Volver':'Cancelar'}</CButton><CButton color="primary" disabled={publish.isPending} onClick={()=>confirm?void save():setConfirm(true)}>{publish.isPending?'Guardando…':confirm?'Publicar versión':'Revisar cambio'}</CButton></CModalFooter></CModal>
  </>
}
