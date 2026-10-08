import Button from '@/components/ui/Button'

export default function ErrorState({ title, message = 'No se pudieron cargar los datos.', onRetry, retryLabel = 'Reintentar', className = '' }: {
  title?: string; message?: string; onRetry?: () => void; retryLabel?: string; className?: string
}) {
  return <div role="alert" className={'flex min-h-40 flex-col items-center justify-center gap-3 rounded-card border border-qms-border bg-qms-surface p-6 text-center dark:border-gray-700 dark:bg-gray-800 ' + className}>
    <div>
      {title && <h1 className="mb-2 text-xl font-semibold text-qms-dark dark:text-white">{title}</h1>}
      <p className="text-sm text-qms-muted dark:text-gray-300">{message}</p>
    </div>
    {onRetry && <Button variant="secondary" onClick={onRetry}>{retryLabel}</Button>}
  </div>
}
