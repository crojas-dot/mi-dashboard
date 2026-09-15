'use client'

import { Key, Copy, Check } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }, [])

  const handleCopy = () => {
    navigator.clipboard.writeText(password).then(
      () => {
        setCopied(true)
        showSuccess('Contraseña copiada')
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => setCopied(false), 2000)
      },
      () => showError(null, 'No se pudo copiar la contraseña')
    )
  }

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-soft-blue-bg">
            <Key className="h-5 w-5 text-qms-primary" />
          </div>
          <div>
            <p className="m-0 text-sm font-semibold text-qms-dark">Contraseña generada</p>
            {subtitle && <p className="m-0 text-xs text-qms-muted">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-card border border-qms-border bg-qms-surface px-3 py-2.5">
          <span className="flex-1 break-all font-mono text-sm text-qms-dark tracking-wide">{password}</span>
          <button
            type="button"
            onClick={handleCopy}
            className={`flex cursor-pointer items-center gap-1 rounded-button border-0 px-2 py-1 text-xs font-medium transition-colors ${copied ? 'bg-green-50 text-green-700' : 'bg-soft-blue-bg text-qms-primary'}`}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copiada' : 'Copiar'}
          </button>
        </div>
        <p className="m-0 text-xs text-qms-muted">
          Comparte esta contraseña de forma segura. No volverá a mostrarse.
        </p>
        <div className="flex justify-end">
          <Button type="button" variant="primary" onClick={onClose}>Entendido</Button>
        </div>
      </div>
    </Modal>
  )
}
