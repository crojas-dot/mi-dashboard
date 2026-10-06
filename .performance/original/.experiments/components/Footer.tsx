import { CFooter } from '@coreui/react'

export default function Footer() {
  return (
    <CFooter className="px-4">
      <div>
        <span>ECA-QMS</span>
        <span className="ms-1">&copy; 2026 Ente Costarricense de Acreditación.</span>
      </div>
      <div className="ms-auto">
        <span className="me-1">Sistema de Gestión de Calidad</span>
      </div>
    </CFooter>
  )
}
