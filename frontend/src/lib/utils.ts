import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatXOF(amount: number | string): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function today(): string {
  return new Date().toISOString().split('T')[0]
}

export function yesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export function formatDateLong(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

/** Extrait le message d'erreur lisible depuis une erreur Axios/DRF. */
export function extractApiError(err: unknown): string {
  const data = (err as { response?: { data?: unknown } })?.response?.data
  if (!data) return (err as Error)?.message ?? 'Erreur inconnue.'
  if (typeof data === 'string') return data
  if (typeof data === 'object') {
    const d = data as Record<string, unknown>
    if (typeof d.detail === 'string') return d.detail
    // Erreurs de validation champ par champ
    const msgs = Object.entries(d)
      .flatMap(([k, v]) => {
        if (Array.isArray(v)) return v.map((m) => `${k} : ${m}`)
        if (typeof v === 'string') return [`${k} : ${v}`]
        return []
      })
    if (msgs.length) return msgs.join(' | ')
  }
  return 'Erreur inconnue.'
}

export function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object' && 'results' in data) {
    return ((data as { results: T[] }).results) ?? []
  }
  return []
}
