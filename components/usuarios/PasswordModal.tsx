'use client'

import { Key, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import { showError, showSuccess } from '@/lib/services/errorToast'

interface PasswordModalProps {
  open: boolean
  password: string
  title: string
  subtitle?: string
  onClose: () => void
}

export default function PasswordModal({ open, password, title, subtitle, onClose }: PasswordModalProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(password).then(
      () => {
        setCopied(true)
        showSuccess('Contraseña copiada')
        setTimeout(() => setCopied(false), 2000)
      },
      () => showError(null, 'No se pudo copiar la contraseña')
    )
  }

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: '#e7f1ff' }}>
            <Key className="h-5 w-5" style={{ color: '#0d6efd' }} />
          </div>
          <div>
            <p className="m-0 text-sm font-semibold" style={{ color: '#212529' }}>Contraseña generada</p>
            {subtitle && <p className="m-0 text-xs" style={{ color: '#6c757d' }}>{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2.5" style={{ backgroundColor: '#fff', borderColor: '#dee2e6' }}>
          <span className="flex-1 break-all font-mono text-sm" style={{ color: '#212529', letterSpacing: '0.03em' }}>{password}</span>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors"
            style={{ color: copied ? '#15803d' : '#0d6efd', backgroundColor: copied ? '#f0fdf4' : '#e7f1ff', border: 'none', cursor: 'pointer' }}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copiada' : 'Copiar'}
          </button>
        </div>
        <p className="m-0 text-xs" style={{ color: '#6c757d' }}>
          Comparte esta contraseña de forma segura. No volverá a mostrarse.
        </p>
        <div className="flex justify-end">
          <Button type="button" variant="primary" onClick={onClose}>Entendido</Button>
        </div>
      </div>
    </Modal>
  )
}
