import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Check, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { journalApi } from '@/api/journal'
import { formatXOF } from '@/lib/utils'
import type { JournalSalesRecap } from '@/types'

// Catégories dont la valeur est calculée auto depuis les lignes carburant
const AUTO_CATEGORIES = new Set(['super', 'petrole', 'gasoil'])

function RecapRow({
  recap,
  isEditable,
  journalId,
}: {
  recap: JournalSalesRecap
  isEditable: boolean
  journalId: string
}) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    qty: recap.qty,
    unit_price_xof: recap.unit_price_xof,
    daily_value_xof: recap.daily_value_xof,
  })

  const isAuto = AUTO_CATEGORIES.has(recap.category)

  const mutation = useMutation({
    mutationFn: () => journalApi.updateSalesRecap(recap.id, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journal', journalId] })
      setEditing(false)
    },
  })

  return (
    <tr className="border-b last:border-0 hover:bg-gray-50">
      <td className="py-2 px-3 text-sm font-medium">
        {recap.category_display}
        {isAuto && <span className="ml-1 text-xs text-gray-400">(auto)</span>}
      </td>

      {editing ? (
        <>
          <td className="py-1 px-2">
            <Input type="number" step="0.001" value={form.qty}
              onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
              className="w-24 h-7 text-xs" />
          </td>
          <td className="py-1 px-2">
            <Input type="number" step="0.01" value={form.unit_price_xof}
              onChange={(e) => setForm((f) => ({ ...f, unit_price_xof: e.target.value }))}
              className="w-24 h-7 text-xs" />
          </td>
          <td className="py-1 px-2">
            <Input type="number" step="0.01" value={form.daily_value_xof}
              onChange={(e) => setForm((f) => ({ ...f, daily_value_xof: e.target.value }))}
              className="w-28 h-7 text-xs" />
          </td>
          <td className="py-2 px-3 text-right text-xs text-gray-400">
            {formatXOF(parseFloat(recap.previous_day_cumul_xof))}
          </td>
          <td className="py-2 px-3 text-right text-xs text-gray-400">
            {formatXOF(parseFloat(recap.monthly_cumul_xof))}
          </td>
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
          <td className="py-2 px-3 text-right text-sm">{recap.qty}</td>
          <td className="py-2 px-3 text-right text-sm">
            {parseFloat(recap.unit_price_xof) > 0
              ? formatXOF(parseFloat(recap.unit_price_xof))
              : '—'}
          </td>
          <td className="py-2 px-3 text-right text-sm font-semibold text-blue-700">
            {formatXOF(parseFloat(recap.daily_value_xof))}
          </td>
          <td className="py-2 px-3 text-right text-sm text-gray-500">
            {formatXOF(parseFloat(recap.previous_day_cumul_xof))}
          </td>
          <td className="py-2 px-3 text-right text-sm text-gray-500">
            {formatXOF(parseFloat(recap.monthly_cumul_xof))}
          </td>
          <td className="py-2 px-3">
            {isEditable && !isAuto && (
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

export default function SalesRecapSection({
  recaps,
  isEditable,
  journalId,
}: {
  recaps: JournalSalesRecap[]
  isEditable: boolean
  journalId: string
}) {
  const totalDaily = recaps.reduce((s, r) => s + parseFloat(r.daily_value_xof || '0'), 0)
  const totalMonthly = recaps.reduce((s, r) => s + parseFloat(r.monthly_cumul_xof || '0'), 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Section 3 — Récap ventes</CardTitle>
          <span className="text-sm font-semibold text-blue-700">{formatXOF(totalDaily)}</span>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
              <th className="py-2 px-3 text-left">Catégorie</th>
              <th className="py-2 px-3 text-right">Qté</th>
              <th className="py-2 px-3 text-right">P.U.</th>
              <th className="py-2 px-3 text-right">Vente jour</th>
              <th className="py-2 px-3 text-right">Cumul veille</th>
              <th className="py-2 px-3 text-right">Cumul mois</th>
              <th className="py-2 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {recaps.map((r) => (
              <RecapRow key={r.id} recap={r} isEditable={isEditable} journalId={journalId} />
            ))}
            <tr className="bg-gray-50 font-semibold text-sm">
              <td className="py-2 px-3">TOTAL</td>
              <td></td><td></td>
              <td className="py-2 px-3 text-right text-blue-700">{formatXOF(totalDaily)}</td>
              <td></td>
              <td className="py-2 px-3 text-right">{formatXOF(totalMonthly)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
