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
        aria-label="Notificaciones"
        onClick={onToggle}
        className="relative flex cursor-pointer items-center justify-center rounded-button border-0 bg-transparent p-2.5 text-qms-muted transition-colors hover:bg-qms-hover-bg"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && <span className="absolute -right-1 -top-1 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-qms-danger px-1 text-[11px] font-bold text-white">{unreadCount}</span>}
      </button>
      {open && <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-card border border-qms-border bg-qms-surface shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
          <p className="text-sm font-medium text-gray-900">Notificaciones</p>
          <div className="flex items-center gap-1.5">
            {notifications.length > 0 && unreadCount > 0 && <button type="button" onClick={onMarkAll} className="cursor-pointer border-0 bg-transparent text-xs text-blue-600 hover:underline">Leer todas</button>}
            {notifications.length > 0 && <button type="button" onClick={onArchiveAll} className="cursor-pointer border-0 bg-transparent text-xs text-gray-500 hover:text-red-600 hover:underline">Vaciar</button>}
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-3 py-8 text-center"><Inbox className="mb-1 h-6 w-6 text-gray-300" /><p className="text-sm text-gray-400">No hay notificaciones</p></div>
          ) : notifications.slice(0, 15).map((notification) => (
            <div key={notification.id} className={`group relative flex cursor-pointer items-start gap-2 border-b border-gray-50 px-3 py-2.5 transition-colors hover:bg-qms-hover-bg ${notification.leida ? '' : 'bg-blue-50/60'}`} onClick={() => { onMarkRead(notification); onNavigate(notification) }}>
              <div className="min-w-0 flex-1"><p className={`text-sm ${notification.leida ? 'text-gray-600' : 'font-medium text-gray-900'}`}>{notification.mensaje}</p><p className="mt-0.5 text-xs text-gray-400">{new Date(notification.fecha).toLocaleString('es-ES')}</p></div>
              <button type="button" onClick={(event) => { event.stopPropagation(); onArchive(notification) }} title="Eliminar" className="flex cursor-pointer items-center justify-center rounded-button border-0 bg-transparent p-1 text-gray-400 opacity-0 transition-colors group-hover:opacity-100 hover:text-qms-danger"><X className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      </div>}
    </div>
  )
}
