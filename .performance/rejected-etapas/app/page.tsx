'use client'

import { useState } from 'react'
import { CButton, CSpinner } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilReload } from '@coreui/icons'
import { useQueryClient, useIsFetching } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queries/queryKeys'
import ModuleTabs, { type DashboardTab } from '@/components/dashboard/ModuleTabs'
import GeneralTab from '@/components/dashboard/GeneralTab'
import QuejasTab from '@/components/dashboard/QuejasTab'
import SacpTab from '@/components/dashboard/SacpTab'
import DocumentosTab from '@/components/dashboard/DocumentosTab'
import RiesgosTab from '@/components/dashboard/RiesgosTab'
import styles from './dashboard.module.css'

export default function DashboardPage() {
  const [tab, setTab] = useState<DashboardTab>('general')
  const client = useQueryClient()
  const ocupado = useIsFetching({queryKey:queryKeys.dashboard}) > 0
  const refresh = () => { void client.invalidateQueries({queryKey:queryKeys.dashboard}) }

  return (
    <div className={styles.dashboard}>
      <div className={styles.heading}>
        <div>
          <h1>Dashboard</h1>
          <p>Información general y estado de los módulos del Sistema de Gestión de Calidad</p>
        </div>
        <CButton color="primary" onClick={refresh} disabled={ocupado} className="d-inline-flex align-items-center gap-2">
          {ocupado ? <CSpinner size="sm" /> : <CIcon icon={cilReload} />}
          Actualizar
        </CButton>
      </div>

      <ModuleTabs active={tab} onChange={setTab} />

      {tab === 'general' && <GeneralTab />}
      {tab === 'quejas' && <QuejasTab />}
      {tab === 'sacp' && <SacpTab />}
      {tab === 'documentos' && <DocumentosTab />}
      {tab === 'riesgos' && <RiesgosTab />}
    </div>
  )
}