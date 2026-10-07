'use client'

import { Bell, Inbox, X } from 'lucide-react'

interface NotificationItem {
  id: string
  leida: boolean
  mensaje: string
  fecha: string
  enlace?: string | null
  origen_id?: string | null
}

interface NotificationDropdownProps {
  open: boolean
  onToggle: () => void
  notifications: NotificationItem[]
  unreadCount: number
  onMarkAll: () => void
  onArchiveAll: () => void
  onMarkRead: (notification: NotificationItem) => void
  onArchive: (notification: NotificationItem) => void
  onNavigate: (notification: NotificationItem) => void
}

export default function NotificationDropdown({
  open,
  onToggle,
  notifications,
  unreadCount,
  onMarkAll,
  onArchiveAll,
  onMarkRead,
  onArchive,
  onNavigate,
}: NotificationDropdownProps) {
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={unreadCount > 0 ? `Notificaciones: ${unreadCount} sin leer` : 'Notificaciones'}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? 'notification-panel' : undefined}
        onClick={onToggle}
        className="relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-button border-0 bg-transparent text-qms-muted transition-colors hover:bg-qms-hover-bg"
      >
        <Bell aria-hidden="true" className="h-5 w-5" />
        {unreadCount > 0 && <span aria-hidden="true" className="absolute -right-1 top-0 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-qms-surface bg-qms-danger px-1 text-[0.625rem] leading-none font-semibold text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>
      {open && <div id="notification-panel" role="dialog" aria-label="Notificaciones" className="fixed inset-x-3 top-16 z-50 flex max-h-[calc(100dvh-5rem)] flex-col rounded-card border border-qms-border bg-qms-surface shadow-md sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[25rem]">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-qms-border px-4 py-2.5">
          <p className="text-sm font-semibold text-qms-dark">Notificaciones</p>
          <div className="flex items-center gap-2">
            {notifications.length > 0 && unreadCount > 0 && <button type="button" onClick={onMarkAll} className="min-h-8 cursor-pointer rounded-button border-0 bg-transparent px-1 text-xs text-qms-primary hover:underline">Leer todas</button>}
            {notifications.length > 0 && <button type="button" onClick={onArchiveAll} className="min-h-8 cursor-pointer rounded-button border-0 bg-transparent px-1 text-xs text-qms-muted hover:text-qms-danger hover:underline">Vaciar</button>}
          </div>
        </div>
        <div className="min-h-0 max-h-[min(26rem,60dvh)] overflow-y-auto overscroll-contain">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-8 text-center"><Inbox aria-hidden="true" className="mb-2 h-6 w-6 text-qms-muted" /><p className="text-xs text-qms-muted">No hay notificaciones</p></div>
          ) : notifications.slice(0, 15).map((notification) => (
            <div key={notification.id} className={`group flex items-start border-b border-qms-border last:border-b-0 ${notification.leida ? '' : 'bg-qms-primary-soft/50'}`}>
              <button type="button" onClick={() => { onMarkRead(notification); onNavigate(notification) }} className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 border-0 bg-transparent py-3 pl-4 pr-2 text-left transition-colors hover:bg-qms-hover-bg">
                <span aria-hidden="true" className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${notification.leida ? 'bg-transparent' : 'bg-qms-primary'}`} />
                <span className="min-w-0 flex-1"><span className={`block wrap-anywhere text-xs leading-5 ${notification.leida ? 'text-qms-muted' : 'font-medium text-qms-dark'}`}>{notification.mensaje}</span><time dateTime={notification.fecha} className="mt-1 block text-[0.75rem] leading-4 text-qms-muted">{new Date(notification.fecha).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</time></span>
              </button>
              <button type="button" onClick={() => onArchive(notification)} title="Archivar notificación" aria-label="Archivar notificación" className="mt-2 mr-2 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-button border-0 bg-transparent text-qms-muted transition-colors hover:bg-qms-hover-bg hover:text-qms-danger"><X aria-hidden="true" className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
        {notifications.length > 15 && <p className="shrink-0 border-t border-qms-border px-4 py-2 text-[0.75rem] text-qms-muted">Mostrando las 15 más recientes de {notifications.length}</p>}
      </div>}
    </div>
  )
}
