interface FieldGroupProps { title: string; description?: string; children: React.ReactNode }
export default function FieldGroup({ title, description, children }: FieldGroupProps) {
  return <section className="flex flex-col gap-4 border-b border-border pb-5 last:border-0 last:pb-0"><div><h3 className="text-sm font-semibold text-foreground">{title}</h3>{description && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>}</div><div className="flex flex-col gap-4">{children}</div></section>
}
