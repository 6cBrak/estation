import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { avoirApi } from '@/api/avoir'
import type { AvoirWithdrawal } from '@/api/avoir'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { Plus, Trash2, Fuel, Banknote, ArrowDownCircle } from 'lucide-react'
import { formatXOF, cn, extractApiError } from '@/lib/utils'

const MONTHS = [
  { value: '1', label: 'Janvier' }, { value: '2', label: 'Février' },
  { value: '3', label: 'Mars' }, { value: '4', label: 'Avril' },
  { value: '5', label: 'Mai' }, { value: '6', label: 'Juin' },
  { value: '7', label: 'Juillet' }, { value: '8', label: 'Août' },
  { value: '9', label: 'Septembre' }, { value: '10', label: 'Octobre' },
  { value: '11', label: 'Novembre' }, { value: '12', label: 'Décembre' },
]

const now = new Date()

export default function AvoirPage() {
  const { currentStation } = useAuthStore()
  const qc = useQueryClient()
  const [month, setMonth] = useState(String(now.getMonth() + 1))
  const [year, setYear] = useState(String(now.getFullYear()))
  const [showForm, setShowForm] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [form, setForm] = useState({
    withdrawal_date: now.toISOString().split('T')[0],
    withdrawal_type: 'fuel',
    amount_xof: '',
    notes: '',
  })

  const stationId = currentStation?.id ?? ''

  const summaryQuery = useQuery({
    queryKey: ['avoir-summary', stationId, month, year],
    queryFn: () => avoirApi.summary({ station: stationId, month, year }).then((r) => r.data),
    enabled: !!stationId,
  })

  const listQuery = useQuery({
    queryKey: ['avoir-withdrawals', stationId, month, year],
    queryFn: () => avoirApi.list({ station: stationId, month, year }).then((r) =>
      Array.isArray(r.data) ? r.data : (r.data as { results?: AvoirWithdrawal[] }).results ?? []
    ),
    enabled: !!stationId,
  })

  const createMut = useMutation({
    mutationFn: () => avoirApi.create({ station: stationId, ...form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['avoir-summary', stationId] })
      qc.invalidateQueries({ queryKey: ['avoir-withdrawals', stationId] })
      setShowForm(false)
      setForm({ withdrawal_date: now.toISOString().split('T')[0], withdrawal_type: 'fuel', amount_xof: '', notes: '' })
      setFormError(null)
    },
    onError: (err: unknown) => setFormError(extractApiError(err as Error)),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => avoirApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['avoir-summary', stationId] })
      qc.invalidateQueries({ queryKey: ['avoir-withdrawals', stationId] })
    },
  })

  const summary = summaryQuery.data
  const withdrawals = listQuery.data ?? []
  const monthLabel = MONTHS.find((m) => m.value === month)?.label ?? ''

  const balance = Number(summary?.balance_xof ?? 0)
  const avoirTotal = Number(summary?.avoir_total_xof ?? 0)

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Gestion de l'avoir numérique</h1>
        <Button size="sm" onClick={() => setShowForm(true)} disabled={!stationId}>
          <Plus size={14} className="mr-1" /> Nouveau retrait
        </Button>
      </div>

      {/* Filtre période */}
      <div className="flex items-center gap-3 bg-white border rounded-lg px-4 py-3">
        <span className="text-sm text-gray-500 font-medium">Période :</span>
        <Select value={month} onChange={(e) => setMonth(e.target.value)} className="w-36 h-8 text-sm">
          {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </Select>
        <Select value={year} onChange={(e) => setYear(e.target.value)} className="w-24 h-8 text-sm">
          {[2024, 2025, 2026, 2027].map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </Select>
        <span className="text-sm text-gray-400 ml-2">{monthLabel} {year}</span>
      </div>

      {/* KPI cards */}
      {summaryQuery.isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <ArrowDownCircle size={16} className="text-blue-500" />
                <p className="text-xs text-gray-500 uppercase tracking-wide">Avoir total</p>
              </div>
              <p className="text-2xl font-bold text-blue-700">{formatXOF(avoirTotal)}</p>
              <p className="text-xs text-gray-400 mt-1">TPE + Tickets encaissés</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Fuel size={16} className="text-orange-500" />
                <p className="text-xs text-gray-500 uppercase tracking-wide">Retiré carburant</p>
              </div>
              <p className="text-2xl font-bold text-orange-600">
                {formatXOF(Number(summary?.withdrawals_fuel_xof ?? 0))}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Banknote size={12} className="text-gray-400" />
                <p className="text-xs text-gray-400">
                  Liquidités : {formatXOF(Number(summary?.withdrawals_cash_xof ?? 0))}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className={cn(balance < 0 && 'border-red-300 bg-red-50')}>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Solde disponible</p>
              <p className={cn(
                'text-2xl font-bold',
                balance < 0 ? 'text-red-600' : balance === 0 ? 'text-green-600' : 'text-amber-600'
              )}>
                {formatXOF(balance)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {balance === 0 ? 'Tout soldé' : balance > 0 ? 'À retirer' : 'Dépassement'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Liste des retraits */}
      <Card>
        <CardHeader>
          <CardTitle>Retraits — {monthLabel} {year}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {listQuery.isLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Notes</th>
                  <th className="px-4 py-2 text-right">Montant</th>
                  <th className="px-4 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(w.withdrawal_date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={w.withdrawal_type === 'fuel' ? 'warning' : 'secondary'}>
                        {w.withdrawal_type === 'fuel'
                          ? <><Fuel size={11} className="inline mr-1" />Carburant</>
                          : <><Banknote size={11} className="inline mr-1" />Liquidités</>
                        }
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{w.notes || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-orange-600">
                      {formatXOF(Number(w.amount_xof))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => { if (confirm('Supprimer ce retrait ?')) deleteMut.mutate(w.id) }}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {withdrawals.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                      Aucun retrait enregistré pour {monthLabel} {year}.
                    </td>
                  </tr>
                )}
                {withdrawals.length > 0 && (
                  <tr className="bg-gray-50 font-semibold border-t-2">
                    <td className="px-4 py-2 text-sm" colSpan={3}>Total retiré</td>
                    <td className="px-4 py-2 text-right text-orange-700">
                      {formatXOF(Number(summary?.withdrawals_total_xof ?? 0))}
                    </td>
                    <td></td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Dialog nouveau retrait */}
      <Dialog open={showForm} onOpenChange={(v) => { if (!v) { setShowForm(false); setFormError(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enregistrer un retrait d'avoir</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-1">
              <Label>Type de retrait *</Label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'fuel', label: 'Carburant', icon: <Fuel size={16} /> },
                  { value: 'cash', label: 'Liquidités', icon: <Banknote size={16} /> },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, withdrawal_type: opt.value }))}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all',
                      form.withdrawal_type === opt.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    )}
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={form.withdrawal_date}
                  onChange={(e) => setForm((f) => ({ ...f, withdrawal_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Montant (FCFA) *</Label>
                <Input
                  type="number"
                  step="500"
                  value={form.amount_xof}
                  onChange={(e) => setForm((f) => ({ ...f, amount_xof: e.target.value }))}
                  placeholder="Ex: 50000"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes / Référence</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Ex: Retrait carburant du 05/06"
              />
            </div>
            {formError && (
              <p className="text-xs text-red-500 bg-red-50 rounded p-2">{formError}</p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); setFormError(null) }}>
              Annuler
            </Button>
            <Button
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending || !form.amount_xof || !form.withdrawal_date}
            >
              {createMut.isPending ? <Spinner size="sm" /> : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
