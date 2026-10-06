export function IndicadorSkeleton({ label = 'Cargando indicadores…' }: { label?: string }) {
  return <div role="status" aria-label={label} className="mb-5 rounded-card border border-qms-border bg-qms-surface p-5">
    <span className="sr-only">{label}</span>
    <div aria-hidden="true" className="space-y-4 motion-safe:animate-pulse">
      {[0, 1, 2].map((row) => <div key={row} className="h-5 rounded-sm bg-gray-100" />)}
    </div>
  </div>
}

export function TablaSkeleton() {
  return <div role="status" aria-label="Cargando expedientes pendientes…" className="rounded-card border border-qms-border p-3">
    <span className="sr-only">Cargando expedientes pendientes…</span>
    <div aria-hidden="true" className="space-y-4 motion-safe:animate-pulse">
      {[0, 1, 2, 3].map((row) => <div key={row} className="h-8 rounded-sm bg-gray-100" />)}
    </div>
  </div>
}
