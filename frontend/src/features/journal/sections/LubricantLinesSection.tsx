import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Check, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { journalApi } from '@/api/journal'
import type { JournalLubricantLine } from '@/types'

function LubricantRow({
  line,
  isEditable,
  journalId,
}: {
  line: JournalLubricantLine
  isEditable: boolean
  journalId: string
}) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    purchased_qty: line.purchased_qty,
    sold_qty: line.sold_qty,
    gauged_qty: line.gauged_qty ?? '',
  })

  const mutation = useMutation({
    mutationFn: () => journalApi.updateLubricantLine(line.id, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journal', journalId] })
      setEditing(false)
    },
  })

  const hasDiff = line.diff !== null && parseFloat(line.diff) !== 0

  return (
    <tr className="border-b last:border-0 hover:bg-gray-50">
      <td className="py-2 px-3 text-sm font-medium">{line.lubricant_name}</td>
      <td className="py-2 px-3 text-right text-sm">{line.stock_open}</td>

      {editing ? (
        <>
          <td className="py-1 px-2">
            <Input type="number" step="0.001" value={form.purchased_qty}
              onChange={(e) => setForm((f) => ({ ...f, purchased_qty: e.target.value }))}
              className="w-24 h-7 text-xs" />
          </td>
          <td className="py-2 px-3 text-right text-xs text-gray-400">{line.stock_cumul}</td>
          <td className="py-1 px-2">
            <Input type="number" step="0.001" value={form.sold_qty}
              onChange={(e) => setForm((f) => ({ ...f, sold_qty: e.target.value }))}
              className="w-24 h-7 text-xs" />
          </td>
          <td className="py-2 px-3 text-right text-xs text-gray-400">{line.stock_close_theoretical}</td>
          <td className="py-1 px-2">
            <Input type="number" step="0.001" value={form.gauged_qty}
              onChange={(e) => setForm((f) => ({ ...f, gauged_qty: e.target.value }))}
              className="w-24 h-7 text-xs" placeholder="Stock réel" />
          </td>
          <td className="py-2 px-3 text-right text-gray-400">—</td>
          <td className="py-1 px-2">
            <div className="flex gap-1">
              <Button size="icon" variant="default" className="h-7 w-7"
                onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                <Check size={13} />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7"
                onClick={() => setEditing(false)}>
                <X size={13} />
              </Button>
            </div>
          </td>
        </>
      ) : (
        <>
          <td className="py-2 px-3 text-right text-sm">{line.purchased_qty}</td>
          <td className="py-2 px-3 text-right text-sm">{line.stock_cumul}</td>
          <td className="py-2 px-3 text-right text-sm font-semibold">{line.sold_qty}</td>
          <td className="py-2 px-3 text-right text-sm">{line.stock_close_theoretical}</td>
          <td className="py-2 px-3 text-right text-sm">
            {line.gauged_qty ?? <span className="text-gray-300">—</span>}
          </td>
          <td className={`py-2 px-3 text-right text-sm ${hasDiff ? 'text-red-600 font-semibold' : ''}`}>
            {line.diff ?? '—'}
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
  )
}

export default function LubricantLinesSection({
  lines,
  isEditable,
  journalId,
}: {
  lines: JournalLubricantLine[]
  isEditable: boolean
  journalId: string
}) {
  if (lines.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Section 2 — Suivi lubrifiants</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
              <th className="py-2 px-3 text-left">Produit</th>
              <th className="py-2 px-3 text-right">Stock ouv.</th>
              <th className="py-2 px-3 text-right">Reçu</th>
              <th className="py-2 px-3 text-right">Cumul</th>
              <th className="py-2 px-3 text-right">Vendu</th>
              <th className="py-2 px-3 text-right">Stock théo.</th>
              <th className="py-2 px-3 text-right">Stock réel</th>
              <th className="py-2 px-3 text-right">Écart</th>
              <th className="py-2 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <LubricantRow
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
