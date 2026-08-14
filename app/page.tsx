'use client'

import { useDashboard } from '@/lib/queries/useDashboard'
import { Table, TableHead, TableHeaderCell, TableRow, TableCell } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import PageHeader from '@/components/ui/PageHeader'
import { ArrowUpRight, ClipboardList, FileText, MessageSquareWarning, ShieldAlert } from 'lucide-react'

const estadoBadge: Record<string, string> = { Abierta: 'red', Alta: 'red', 'En Proceso': 'amber', Planificada: 'blue', Abierto: 'red', Pendiente: 'amber', Cerrada: 'green', Cerrado: 'green', Publicado: 'green', Borrador: 'gray', Activo: 'green', Inactivo: 'gray' }
const icons = [MessageSquareWarning, ClipboardList, FileText, ShieldAlert]

export default function DashboardPage() {
  const { data } = useDashboard()
  const indicadores = data?.indicadores ?? []
  const tareas = data?.tareas ?? []
  const activity = [
    ['Queja registrada', 'Folio Q-2024-001', 'Ana Díaz'],
    ['SACP actualizada', 'AC-2024-015 en validación', 'Carlos Mora'],
    ['Documento publicado', 'PR-001 v3.2', 'Ana Díaz'],
  ]

  return <div>
    <PageHeader title="Vista general" description="Seguimiento operativo del sistema de gestión de calidad" />
    <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {indicadores.map((ind, index) => { const Icon = icons[index % icons.length]; return <a key={ind.label} href={ind.url} className="group rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-muted-foreground">{ind.label}</p><p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{ind.valor}</p></div><div className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground"><Icon className="size-5" /></div></div><div className="mt-4 flex items-center gap-1 text-xs font-semibold text-primary">Ver detalle <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></div></a> })}
    </div>
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.65fr]">
      <section><div className="mb-3 flex items-center justify-between"><div><h2 className="text-base font-semibold text-foreground">Expedientes pendientes</h2><p className="text-sm text-muted-foreground">Ordenados por fecha de vencimiento</p></div></div><Table><TableHead><tr><TableHeaderCell>Expediente</TableHeaderCell><TableHeaderCell>Tipo</TableHeaderCell><TableHeaderCell>Estado</TableHeaderCell><TableHeaderCell>Vence</TableHeaderCell></tr></TableHead><tbody>{tareas.length === 0 ? <tr><td colSpan={4} className="px-4 py-12 text-center text-sm text-muted-foreground">No hay expedientes pendientes</td></tr> : tareas.map((t) => <TableRow key={t.id}><TableCell className="font-medium">{t.titulo}</TableCell><TableCell><span className="text-muted-foreground">{t.tipo}</span></TableCell><TableCell><Badge variant={estadoBadge[t.estado] || 'gray'}>{t.estado}</Badge></TableCell><TableCell><span className="font-mono text-xs text-muted-foreground">{t.vence ? new Date(t.vence).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '-'}</span></TableCell></TableRow>)}</tbody></Table></section>
      <section><div className="mb-3"><h2 className="text-base font-semibold text-foreground">Actividad reciente</h2><p className="text-sm text-muted-foreground">Últimos movimientos del sistema</p></div><div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">{activity.map(([title, detail, user], index) => <div key={title} className="flex items-start gap-3 border-b border-border px-4 py-4 last:border-0"><div className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" /><div className="min-w-0 flex-1"><p className="text-sm font-medium text-foreground">{title}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p></div><div className="shrink-0 text-right text-xs text-muted-foreground"><p>{new Date(Date.now() - index * 3600000).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</p><p className="mt-0.5">{user}</p></div></div>)}</div></section>
    </div>
  </div>
}
