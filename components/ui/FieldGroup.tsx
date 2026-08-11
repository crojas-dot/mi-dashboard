interface FieldGroupProps {
  title: string
  description?: string
  children: React.ReactNode
}

export default function FieldGroup({ title, description, children }: FieldGroupProps) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>
      <div className="space-y-3">
        {children}
      </div>
      <hr className="border-slate-200" />
    </div>
  )
}
