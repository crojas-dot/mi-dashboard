import Spinner from '@/components/ui/Spinner'

/** Una operación larga ocupa el centro de su área; no sustituye la carga inicial. */
export default function OperationLoading({ label, className = '' }: { label: string; className?: string }) {
  return <div role="status" className={`flex min-h-48 w-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-qms-muted ${className}`}>
    <Spinner size="lg" className="text-qms-primary" />
    <span>{label}</span>
  </div>
}
