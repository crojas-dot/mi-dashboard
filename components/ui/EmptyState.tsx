interface EmptyStateProps {
  message: string
}

export default function EmptyState({ message }: EmptyStateProps) {
  return (
    <tr>
      <td colSpan={999} className="px-4 py-12 text-center">
        <p className="text-sm text-slate-400">{message}</p>
      </td>
    </tr>
  )
}
