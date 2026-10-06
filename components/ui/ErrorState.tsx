import Button from './Button'

export default function ErrorState({ message = 'No se pudieron cargar los datos.', onRetry }: {
  message?: string; onRetry?: () => void
}) {
  return <div role="alert" className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-card border border-qms-border bg-qms-surface p-6 text-center">
    <p className="text-sm text-qms-muted">{message}</p>
    {onRetry && <Button variant="secondary" onClick={onRetry}>Reintentar</Button>}
  </div>
}
