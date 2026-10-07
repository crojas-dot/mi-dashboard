/** Formas decorativas: no representan datos, valores ni controles interactivos. */
export default function Skeleton({ className = '', circle = false }: { className?: string; circle?: boolean }) {
  return <div aria-hidden="true" className={`${circle ? 'rounded-full' : 'rounded-sm'} bg-qms-primary/[0.07] ${className}`} />
}
