import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Check, X, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { journalApi } from '@/api/journal'
import { avoirApi } from '@/api/avoir'
import { formatXOF, cn } from '@/lib/utils'
import type { JournalPaymentSummary } from '@/types'

const ENCAISSEMENT_FIELDS: { key: keyof JournalPaymentSummary; label: string }[] = [
  { key: 'cash_amount_xof', label: 'Espèces' },
  { key: 'tickets_amount_xof', label: 'Tickets' },
  { key: 'tpe_amount_xof', label: 'TPE / Carte' },
  { key: 'mobile_money_amount_xof', label: 'Mobile Money' },
  { key: 'credit_amount_xof', label: 'Crédit' },
]

export default function PaymentSummarySection({
  summary,
  isEditable,
  journalId,
  journalDate,
  stationId,
}: {
  summary: JournalPaymentSummary
  isEditable: boolean
  journalId: string
  journalDate: string
  stationId: string
}) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    cash_amount_xof: summary.cash_amount_xof,
    tickets_amount_xof: summary.tickets_amount_xof,
    tpe_amount_xof: summary.tpe_amount_xof,
    mobile_money_amount_xof: summary.mobile_money_amount_xof,
    credit_amount_xof: summary.credit_amount_xof,
  })

  // Extraire mois/année depuis la date du journal
  const [yearStr, monthStr] = journalDate.split('-')

  // Récupérer les retraits d'avoir pour ce mois depuis AvoirWithdrawal
  const { data: avoirSummary } = useQuery({
    queryKey: ['avoir-summary', stationId, monthStr, yearStr],
    queryFn: () => avoirApi.summary({ station: stationId, month: String(Number(monthStr)), year: yearStr }).then((r) => r.data),
    enabled: !!stationId && !!monthStr && !!yearStr,
  })

  const mutation = useMutation({
    mutationFn: () => journalApi.updatePaymentSummary(summary.id, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journal', journalId] })
      setEditing(false)
    },
  })

  const avoirTotal = Number(summary.tpe_amount_xof) + Number(summary.tickets_amount_xof)
  const wFuel = Number(avoirSummary?.withdrawals_fuel_xof ?? 0)
  const wCash = Number(avoirSummary?.withdrawals_cash_xof ?? 0)
  const wTotal = Number(avoirSummary?.withdrawals_total_xof ?? 0)
  // Solde basé sur le total mensuel avoir vs total retiré
  const avoirTotalMonthly = Number(avoirSummary?.avoir_total_xof ?? avoirTotal)
  const solde = avoirTotalMonthly - wTotal

  return (
    <div className="space-y-4">
      {/* ── Encaissements ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Encaissements</CardTitle>
            {isEditable && !editing && (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil size={13} className="mr-1" /> Modifier
              </Button>
            )}
            {editing && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                  <Check size={13} className="mr-1" />
                  {mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  <X size={13} />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {ENCAISSEMENT_FIELDS.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{label}</span>
                {editing ? (
                  <Input
                    type="number"
                    step="1"
                    value={form[key as keyof typeof form] ?? '0'}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-36 h-7 text-right text-sm"
                  />
                ) : (
                  <span className="text-sm font-medium">
                    {formatXOF(Number(summary[key] || '0'))}
                  </span>
                )}
              </div>
            ))}
            <div className="flex items-center justify-between pt-3 border-t font-bold">
              <span className="text-sm">Total encaissé</span>
              <span className="text-base text-blue-700">
                {formatXOF(Number(summary.total_xof))}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Bloc Avoir (TPE + Tickets) ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Avoir numérique</CardTitle>
              <p className="text-xs text-gray-400 mt-0.5">
                TPE + Tickets — retraits gérés dans{' '}
                <button
                  onClick={() => navigate('/avoir')}
                  className="text-blue-500 hover:underline inline-flex items-center gap-0.5"
                >
                  Avoir numérique <ExternalLink size={10} />
                </button>
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {/* Avoir du jour */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">TPE / Carte (ce journal)</span>
              <span className="text-sm font-medium">{formatXOF(Number(summary.tpe_amount_xof))}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Tickets (ce journal)</span>
              <span className="text-sm font-medium">{formatXOF(Number(summary.tickets_amount_xof))}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t font-semibold">
              <span className="text-sm">Total avoir (ce jour)</span>
              <span className="text-sm text-blue-700">{formatXOF(avoirTotal)}</span>
            </div>

            {/* Retraits du mois (depuis AvoirWithdrawal) */}
            <div className="mt-3 pt-3 border-t space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium flex items-center justify-between">
                Retraits du mois
                <span className="text-blue-500 font-normal normal-case">
                  Avoir mensuel total : {formatXOF(avoirTotalMonthly)}
                </span>
              </p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">En carburant</span>
                <span className="text-sm font-medium text-orange-600">{formatXOF(wFuel)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">En liquidités</span>
                <span className="text-sm font-medium text-orange-600">{formatXOF(wCash)}</span>
              </div>

              {/* Solde mensuel */}
              <div className="flex items-center justify-between pt-2 border-t font-bold">
                <span className="text-sm">Solde mensuel restant</span>
                <span className={cn(
                  'text-sm font-bold',
                  solde < 0 ? 'text-red-600' : solde > 0 ? 'text-amber-600' : 'text-green-600'
                )}>
                  {formatXOF(solde)}
                </span>
              </div>
              {solde < 0 && (
                <p className="text-xs text-red-500 bg-red-50 rounded p-2">
                  Les retraits dépassent l'avoir disponible ce mois.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
