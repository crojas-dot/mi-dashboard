const sizes = { sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-6 w-6' }

/** Solo operaciones activas; caja estable y círculo centrado en ambos ejes. */
export default function Spinner({ size = 'md', className = '' }: { size?: keyof typeof sizes; className?: string }) {
  return <span aria-hidden="true" className={`inline-flex shrink-0 self-center items-center justify-center align-middle leading-none ${sizes[size]} ${className}`}>
    <svg className="block h-full w-full motion-safe:animate-spin" fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".2" strokeWidth="2.5" />
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="14 43" />
    </svg>
  </span>
}
