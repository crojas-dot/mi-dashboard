/** Cabecera institucional compartida entre el formulario y el seguimiento públicos. */
export default function PublicQmsHeader({ title, subtitle, logo, Title = 'p' }: {
  title: string
  subtitle: string
  logo?: string
  Title?: 'h1' | 'p'
}) {
  return <header className="flex flex-col items-center gap-2 border-b border-qms-border pb-3 text-center sm:flex-row sm:justify-between sm:gap-6 sm:text-left">
    <div className="order-last min-w-0 break-words sm:order-none">
      <Title className="text-xl font-semibold text-qms-dark">{title}</Title>
      <p className="mt-1 text-sm text-qms-muted">{subtitle}</p>
    </div>
    {logo && <div className="flex h-[72px] w-[260px] max-w-full items-center justify-center sm:max-w-[45%] sm:shrink-0 sm:justify-end">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} alt="Logo institucional" className="block max-h-full max-w-full object-contain sm:object-right" />
    </div>}
  </header>
}
