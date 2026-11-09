'use client'

export interface TabItem { id: string; label: string }

/** Solo navegación; el consumidor conserva los borradores y monta sus paneles. */
export default function Tabs({ items, value, onChange, id, label = 'Secciones' }: {
  items: readonly TabItem[]; value: string; onChange: (value: string) => void; id: string; label?: string
}) {
  return <div role="tablist" aria-label={label} className="flex shrink-0 gap-1 overflow-x-auto border-b border-qms-border bg-qms-surface px-3 sm:px-5">
    {items.map((tab, index) => <button key={tab.id} type="button" role="tab" id={`${id}-tab-${tab.id}`} aria-controls={`${id}-panel-${tab.id}`} aria-selected={value === tab.id} tabIndex={value === tab.id ? 0 : -1}
      className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${value === tab.id ? 'border-qms-primary text-qms-primary' : 'border-transparent text-qms-muted hover:text-qms-dark'}`}
      onClick={() => onChange(tab.id)} onKeyDown={event => {
        const next = event.key === 'ArrowRight' ? (index + 1) % items.length : event.key === 'ArrowLeft' ? (index + items.length - 1) % items.length : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : null
        if (next === null) return
        event.preventDefault(); onChange(items[next].id)
        const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
        buttons?.[next]?.focus()
      }}>{tab.label}</button>)}
  </div>
}
