'use client'

import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: React.ReactNode
  confirmLabel: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({ open, title, message, confirmLabel, danger, loading, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={() => { if (!loading) onCancel() }} title={title} size="sm">
      <div className="space-y-4">
        <p className="m-0 text-sm text-gray-600">{message}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" className="max-w-full whitespace-normal" variant="secondary" disabled={loading} onClick={onCancel}>Cancelar</Button>
          <Button type="button" className="max-w-full whitespace-normal" variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
