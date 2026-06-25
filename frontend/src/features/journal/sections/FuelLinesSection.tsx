import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Check, X, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { journalApi } from '@/api/journal'
import { formatXOF } from '@/lib/utils'
import type { JournalFuelLine } from '@/types'

interface EditState {
  index_open: string
  index_close: string
  return_volume: string
  received_volume: string
  gauged_stock_open: string
  gauged_stock_close: string
  diff_comment: string
}

function FuelLineRow({
  line,
  isEditable,
  journalId,
}: {
  line: JournalFuelLine
  isEditable: boolean
  journalId: string
}) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<EditState>({
    index_open: line.index_open,
    index_close: line.index_close ?? '',
    return_volume: line.return_volume,
    received_volume: line.received_volume,
    gauged_stock_open: line.gauged_stock_open,
    gauged_stock_close: line.gauged_stock_close ?? '',
    diff_comment: line.diff_comment,
  })
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      journalApi.updateFuelLine(line.id, {
        index_open: form.index_open,
        index_close: form.index_close || undefined,
        return_volume: form.return_volume,
        received_volume: form.received_volume,
        gauged_stock_open: form.gauged_stock_open,
        gauged_stock_close: form.gauged_stock_close || undefined,
        diff_comment: form.diff_comment,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journal', journalId] })
      setEditing(false)
      setError(null)
    },
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data
      if (data && typeof data === 'object') {
        const msgs = Object.entries(data).flatMap(([k, v]) =>
          Array.isArray(v) ? v.map((m) => `${k} : ${m}`) : [`${k} : ${v}`]
        )
        setError(msgs.join(' | '))
      } else {
        setError('Erreur de sauvegarde.')
      }
    },
  })

  const hasAlert = line.gauge_diff !== null && parseFloat(line.gauge_diff) !== 0
  const f = (v: string | null | undefined) =>
    v !== null && v !== undefined ? <span className="font-mono">{v}</span> : <span className="text-gray-300">—</span>

  return (
    <>
      <tr className="border-b last:border-0 hover:bg-gray-50">
        <td className="py-2 px-3 font-medium text-sm whitespace-nowrap">{line.nozzle_label}</td>
        <td className="py-2 px-3 text-xs text-gray-500 whitespace-nowrap">{line.fuel_type}</td>

        {editing ? (
          <>
            <td className="py-1 px-2">
              <Input
                type="number" step="0.01"
                value={form.index_open}
                onChange={(e) => setForm((f) => ({ ...f, index_open: e.target.value }))}
                className="w-28 h-7 text-xs bg-yellow-50"
                placeholder="Idx ouverture"
              />
            </td>
            <td className="py-1 px-2">
              <Input
                type="number" step="0.01"
                value={form.index_close}
                onChange={(e) => setForm((f) => ({ ...f, index_close: e.target.value }))}
                className="w-28 h-7 text-xs"
                placeholder="Idx fermeture"
              />
            </td>
            <td className="py-1 px-2">
              <Input
                type="number" step="0.01"
                value={form.return_volume}
                onChange={(e) => setForm((f) => ({ ...f, return_volume: e.target.value }))}
                className="w-24 h-7 text-xs"
              />
            </td>
            <td className="py-1 px-2">
              <Input
                type="number" step="0.01"
                value={form.received_volume}
                onChange={(e) => setForm((f) => ({ ...f, received_volume: e.target.value }))}
                className="w-24 h-7 text-xs"
              />
            </td>
            <td className="py-2 px-3 text-center text-gray-300 text-xs">auto</td>
            <td className="py-1 px-2">
              <Input
                type="number" step="0.01"
                value={form.gauged_stock_open}
                onChange={(e) => setForm((f) => ({ ...f, gauged_stock_open: e.target.value }))}
                className="w-24 h-7 text-xs bg-yellow-50"
                placeholder="Stock préc."
              />
            </td>
            <td className="py-2 px-3 text-center text-gray-300 text-xs">auto</td>
            <td className="py-1 px-2">
              <Input
                type="number" step="0.01"
                value={form.gauged_stock_close}
                onChange={(e) => setForm((f) => ({ ...f, gauged_stock_close: e.target.value }))}
                className="w-24 h-7 text-xs"
                placeholder="Stock réel"
              />
            </td>
            <td className="py-2 px-3 text-center text-gray-300 text-xs">auto</td>
            <td className="py-1 px-2">
              <Input
                value={form.diff_comment}
                onChange={(e) => setForm((f) => ({ ...f, diff_comment: e.target.value }))}
                className="w-36 h-7 text-xs"
                placeholder="Commentaire écart"
              />
            </td>
            <td className="py-2 px-3 text-center text-gray-300 text-xs">auto</td>
            <td className="py-1 px-2">
              <div className="flex gap-1">
                <Button size="icon" variant="default" className="h-7 w-7"
                  onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                  <Check size={13} />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7"
                  onClick={() => { setEditing(false); setError(null) }}>
                  <X size={13} />
                </Button>
              </div>
            </td>
          </>
        ) : (
          <>
            <td className="py-2 px-3 text-right text-sm font-mono">{line.index_open}</td>
            <td className="py-2 px-3 text-right text-sm">{f(line.index_close)}</td>
            <td className="py-2 px-3 text-right text-sm">{line.return_volume}</td>
            <td className="py-2 px-3 text-right text-sm">{line.received_volume}</td>
            <td className="py-2 px-3 text-right text-sm font-semibold">
              {f(line.sold_volume)}
            </td>
            <td className="py-2 px-3 text-right text-sm">{line.gauged_stock_open}</td>
            <td className="py-2 px-3 text-right text-sm">{f(line.theoretical_stock)}</td>
            <td className="py-2 px-3 text-right text-sm">
              {line.gauged_stock_close ?? <span className="text-gray-300">—</span>}
            </td>
            <td className={`py-2 px-3 text-right text-sm ${hasAlert ? 'text-red-600 font-semibold' : ''}`}>
              {line.gauge_diff !== null ? (
                <span className="flex items-center justify-end gap-1">
                  {hasAlert && <AlertTriangle size={12} />}
                  {line.gauge_diff}
                </span>
              ) : <span className="text-gray-300">—</span>}
            </td>
            <td className="py-2 px-3 text-right text-sm">{f(line.diff_comment || null)}</td>
            <td className="py-2 px-3 text-right text-sm font-semibold text-blue-700">
              {line.amount_xof ? formatXOF(parseFloat(line.amount_xof)) : <span className="text-gray-300">—</span>}
            </td>
            <td className="py-2 px-3">
              {isEditable && (
                <Button size="icon" variant="ghost" className="h-7 w-7"
                  onClick={() => setEditing(true)}>
                  <Pencil size={13} />
                </Button>
              )}
            </td>
          </>
        )}
      </tr>

      {error && (
        <tr>
          <td colSpan={14} className="px-3 pb-2 bg-red-50">
            <p className="text-xs text-red-600 py-1">{error}</p>
          </td>
        </tr>
      )}
    </>
  )
}

export default function FuelLinesSection({
  lines,
  isEditable,
  journalId,
}: {
  lines: JournalFuelLine[]
  isEditable: boolean
  journalId: string
}) {
  const totalAmount = lines.reduce(
    (s, l) => s + (l.amount_xof ? parseFloat(l.amount_xof) : 0), 0
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Section 1 — Mouvements carburant</CardTitle>
          {totalAmount > 0 && (
            <span className="text-sm font-semibold text-blue-700">{formatXOF(totalAmount)}</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
              <th className="py-2 px-3 text-left">Pistolet</th>
              <th className="py-2 px-3 text-left">Carburant</th>
              <th className="py-2 px-3 text-right">Idx ouv.</th>
              <th className="py-2 px-3 text-right">Idx fer.</th>
              <th className="py-2 px-3 text-right">Retours</th>
              <th className="py-2 px-3 text-right">Appro</th>
              <th className="py-2 px-3 text-right">Vente (L)</th>
              <th className="py-2 px-3 text-right">Stock préc.</th>
              <th className="py-2 px-3 text-right">Stock théo.</th>
              <th className="py-2 px-3 text-right">Stock réel</th>
              <th className="py-2 px-3 text-right">Écart</th>
              <th className="py-2 px-3 text-right">Commentaire</th>
              <th className="py-2 px-3 text-right">Montant</th>
              <th className="py-2 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <FuelLineRow
                key={line.id}
                line={line}
                isEditable={isEditable}
                journalId={journalId}
              />
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
