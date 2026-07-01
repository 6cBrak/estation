import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Check, X, AlertTriangle, Droplets } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { journalApi } from '@/api/journal'
import { formatXOF } from '@/lib/utils'
import type { JournalFuelLine } from '@/types'

// ─── Saisie d'une ligne pistolet (index + retours) ───────────────────────────

interface NozzleEditState {
  index_open: string
  index_close: string
  return_volume: string
}

function NozzleRow({
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
  const [form, setForm] = useState<NozzleEditState>({
    index_open: line.index_open,
    index_close: line.index_close ?? '',
    return_volume: line.return_volume,
  })
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      journalApi.updateFuelLine(line.id, {
        index_open: form.index_open,
        index_close: form.index_close || undefined,
        return_volume: form.return_volume,
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

  const f = (v: string | null | undefined) =>
    v !== null && v !== undefined && v !== ''
      ? <span className="font-mono">{v}</span>
      : <span className="text-gray-300">—</span>

  return (
    <>
      <tr className="border-b last:border-0 hover:bg-gray-50/50">
        <td className="py-2 px-3 pl-6 font-medium text-sm text-gray-700 whitespace-nowrap">
          {line.nozzle_label}
        </td>

        {editing ? (
          <>
            <td className="py-1 px-2">
              <Input
                type="number" step="0.01"
                value={form.index_open}
                onChange={(e) => setForm((f) => ({ ...f, index_open: e.target.value }))}
                className="w-28 h-7 text-xs text-right bg-yellow-50"
              />
            </td>
            <td className="py-1 px-2">
              <Input
                type="number" step="0.01"
                value={form.index_close}
                onChange={(e) => setForm((f) => ({ ...f, index_close: e.target.value }))}
                className="w-28 h-7 text-xs text-right"
                placeholder="Idx fermeture"
              />
            </td>
            <td className="py-1 px-2">
              <Input
                type="number" step="0.01"
                value={form.return_volume}
                onChange={(e) => setForm((f) => ({ ...f, return_volume: e.target.value }))}
                className="w-24 h-7 text-xs text-right"
              />
            </td>
            <td className="py-2 px-3 text-right text-gray-300 text-xs">auto</td>
            <td className="py-2 px-3 text-right text-gray-300 text-xs">auto</td>
            <td className="py-1 px-2">
              <div className="flex gap-1 justify-end">
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
            <td className="py-2 px-3 text-right text-sm font-mono text-gray-500">{line.index_open}</td>
            <td className="py-2 px-3 text-right text-sm">{f(line.index_close)}</td>
            <td className="py-2 px-3 text-right text-sm">{line.return_volume}</td>
            <td className="py-2 px-3 text-right text-sm font-semibold">{f(line.sold_volume)}</td>
            <td className="py-2 px-3 text-right text-sm font-semibold text-blue-700">
              {line.amount_xof
                ? formatXOF(parseFloat(line.amount_xof))
                : <span className="text-gray-300">—</span>}
            </td>
            <td className="py-2 px-3 text-right">
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
          <td colSpan={7} className="px-3 pb-2 bg-red-50">
            <p className="text-xs text-red-600 py-1">{error}</p>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── En-tête cuve (jaugeage + appro) ─────────────────────────────────────────

interface TankEditState {
  index_close: string
  return_volume: string
  received_volume: string
  gauged_stock_open: string
  gauged_stock_close: string
  diff_comment: string
}

function TankHeader({
  refLine,
  tankLines,
  isEditable,
  journalId,
}: {
  refLine: JournalFuelLine
  tankLines: JournalFuelLine[]
  isEditable: boolean
  journalId: string
}) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<TankEditState>({
    index_close: refLine.index_close ?? '',
    return_volume: refLine.return_volume,
    received_volume: refLine.received_volume,
    gauged_stock_open: refLine.gauged_stock_open,
    gauged_stock_close: refLine.gauged_stock_close ?? '',
    diff_comment: refLine.diff_comment,
  })
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      journalApi.updateFuelLine(refLine.id, {
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

  const hasAlert = refLine.gauge_diff !== null && parseFloat(refLine.gauge_diff) !== 0
  const gaugeDiff = refLine.gauge_diff !== null ? parseFloat(refLine.gauge_diff) : null
  const tankTotal = tankLines.reduce((s, l) => s + (l.amount_xof ? parseFloat(l.amount_xof) : 0), 0)

  return (
    <div className="bg-blue-50 border-b px-4 py-3">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        {/* Infos stock cuve */}
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Stock ouv.</p>
            {editing ? (
              <Input
                type="number" step="0.01"
                value={form.gauged_stock_open}
                onChange={(e) => setForm((f) => ({ ...f, gauged_stock_open: e.target.value }))}
                className="w-28 h-7 text-xs bg-yellow-50"
              />
            ) : (
              <p className="text-sm font-mono font-semibold">{refLine.gauged_stock_open} L</p>
            )}
          </div>

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Appro</p>
            {editing ? (
              <Input
                type="number" step="0.01"
                value={form.received_volume}
                onChange={(e) => setForm((f) => ({ ...f, received_volume: e.target.value }))}
                className="w-28 h-7 text-xs"
              />
            ) : (
              <p className="text-sm font-mono font-semibold">
                {parseFloat(refLine.received_volume) > 0
                  ? `+${refLine.received_volume} L`
                  : '—'}
              </p>
            )}
          </div>

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Stock théo.</p>
            <p className="text-sm font-mono font-semibold text-gray-600">
              {refLine.theoretical_stock !== null
                ? `${refLine.theoretical_stock} L`
                : <span className="text-gray-400">—</span>}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Stock réel</p>
            {editing ? (
              <Input
                type="number" step="0.01"
                value={form.gauged_stock_close}
                onChange={(e) => setForm((f) => ({ ...f, gauged_stock_close: e.target.value }))}
                className="w-28 h-7 text-xs"
                placeholder="Jaugeage fin"
              />
            ) : (
              <p className="text-sm font-mono font-semibold">
                {refLine.gauged_stock_close !== null
                  ? `${refLine.gauged_stock_close} L`
                  : <span className="text-gray-400">—</span>}
              </p>
            )}
          </div>

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Écart</p>
            {gaugeDiff !== null ? (
              <p className={`text-sm font-mono font-bold flex items-center gap-1 ${
                gaugeDiff < 0 ? 'text-red-600' : gaugeDiff > 0 ? 'text-green-600' : 'text-gray-500'
              }`}>
                {hasAlert && <AlertTriangle size={12} />}
                {gaugeDiff > 0 ? '+' : ''}{gaugeDiff} L
              </p>
            ) : (
              <p className="text-sm text-gray-400">—</p>
            )}
          </div>

          {refLine.monthly_gauge_diff !== null && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Cumul mois</p>
              <p className={`text-xs font-mono ${
                parseFloat(refLine.monthly_gauge_diff) < 0 ? 'text-red-500' : 'text-gray-500'
              }`}>
                {parseFloat(refLine.monthly_gauge_diff) > 0 ? '+' : ''}{refLine.monthly_gauge_diff} L
              </p>
            </div>
          )}

          {editing && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Commentaire écart</p>
              <Input
                value={form.diff_comment}
                onChange={(e) => setForm((f) => ({ ...f, diff_comment: e.target.value }))}
                className="w-48 h-7 text-xs"
                placeholder="Commentaire si écart"
              />
            </div>
          )}
          {!editing && refLine.diff_comment && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Commentaire</p>
              <p className="text-xs text-gray-600 italic">{refLine.diff_comment}</p>
            </div>
          )}
        </div>

        {/* Montant total cuve + bouton édition */}
        <div className="flex items-center gap-3 shrink-0">
          {tankTotal > 0 && (
            <span className="text-sm font-bold text-blue-700">{formatXOF(tankTotal)}</span>
          )}
          {isEditable && !editing && (
            <Button size="sm" variant="outline" className="h-7 text-xs"
              onClick={() => setEditing(true)}>
              <Pencil size={12} className="mr-1" /> Cuve
            </Button>
          )}
          {editing && (
            <div className="flex gap-1">
              <Button size="sm" variant="default" className="h-7"
                onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                <Check size={13} className="mr-1" />
                {mutation.isPending ? 'Enreg…' : 'Enregistrer'}
              </Button>
              <Button size="sm" variant="ghost" className="h-7"
                onClick={() => { setEditing(false); setError(null) }}>
                <X size={13} />
              </Button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600 bg-red-50 rounded px-2 py-1">{error}</p>
      )}
    </div>
  )
}

// ─── Bloc cuve complet ────────────────────────────────────────────────────────

function TankBlock({
  tankLabel,
  fuelType,
  lines,
  isEditable,
  journalId,
}: {
  tankLabel: string
  fuelType: string
  lines: JournalFuelLine[]
  isEditable: boolean
  journalId: string
}) {
  const refLine = lines.find((l) => l.is_tank_reference) ?? lines[0]

  return (
    <div className="border rounded-lg overflow-hidden mb-3 last:mb-0">
      {/* Titre cuve */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 border-b">
        <Droplets size={14} className="text-blue-500 shrink-0" />
        <span className="text-sm font-semibold text-gray-800">{tankLabel}</span>
        <span className="text-xs text-gray-400 ml-1">{fuelType}</span>
        {refLine.unit_price && (
          <span className="ml-auto text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-0.5">
            {formatXOF(parseFloat(refLine.unit_price))} / L
          </span>
        )}
      </div>

      {/* En-tête jaugeage cuve (pistolet de référence) */}
      <TankHeader
        refLine={refLine}
        tankLines={lines}
        isEditable={isEditable}
        journalId={journalId}
      />

      {/* Tableau pistolets */}
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
            <th className="py-2 px-3 pl-6 text-left">Pistolet</th>
            <th className="py-2 px-3 text-right">Idx ouv.</th>
            <th className="py-2 px-3 text-right">Idx fer.</th>
            <th className="py-2 px-3 text-right">Retours</th>
            <th className="py-2 px-3 text-right">Vente (L)</th>
            <th className="py-2 px-3 text-right">Montant</th>
            <th className="py-2 px-3 w-10"></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <NozzleRow
              key={line.id}
              line={line}
              isEditable={isEditable}
              journalId={journalId}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Section principale ───────────────────────────────────────────────────────

export default function FuelLinesSection({
  lines,
  isEditable,
  journalId,
}: {
  lines: JournalFuelLine[]
  isEditable: boolean
  journalId: string
}) {
  // Grouper les lignes par cuve, en préservant l'ordre d'apparition
  const tankOrder: string[] = []
  const byTank: Record<string, JournalFuelLine[]> = {}
  for (const line of lines) {
    if (!byTank[line.tank_id]) {
      byTank[line.tank_id] = []
      tankOrder.push(line.tank_id)
    }
    byTank[line.tank_id].push(line)
  }

  const totalAmount = lines.reduce(
    (s, l) => s + (l.amount_xof ? parseFloat(l.amount_xof) : 0),
    0
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
      <CardContent className="p-4 space-y-0">
        {tankOrder.map((tankId) => {
          const tankLines = byTank[tankId]
          const first = tankLines[0]
          return (
            <TankBlock
              key={tankId}
              tankLabel={first.tank_label}
              fuelType={first.fuel_type}
              lines={tankLines}
              isEditable={isEditable}
              journalId={journalId}
            />
          )
        })}
      </CardContent>
    </Card>
  )
}
