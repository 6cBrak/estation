interface Props { title: string }

export default function PlaceholderPage({ title }: Props) {
  return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <div className="text-center">
        <p className="text-2xl font-light">{title}</p>
        <p className="text-sm mt-1">Cette section est en cours de développement.</p>
      </div>
    </div>
  )
}
