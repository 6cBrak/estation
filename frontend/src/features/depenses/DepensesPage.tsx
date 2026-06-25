import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { journalApi } from '@/api/journal'
import type { JournalExpense } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { Plus, Trash2, Receipt } from 'lucide-react'
import { formatXOF, cn, extractApiError } from '@/lib/utils'

const MONTHS = [
  { value: '1', label: 'Janvier' }, { value: '2', label: 'Février' },
  { value: '3', label: 'Mars' }, { value: '4', label: 'Avril' },
  { value: '5', label: 'Mai' }, { value: '6', label: 'Juin' },
  { value: '7', label: 'Juillet' }, { value: '8', label: 'Août' },
  { value: '9', label: 'Septembre' }, { value: '10', label: 'Octobre' },
  { value: '11', label: 'Novembre' }, { value: '12', label: 'Décembre' },
]

const CATEGORIES = [
  { value: 'salaire', label: 'Salaires', color: 'bg-blue-100 text-blue-700' },
  { value: 'entretien', label: 'Entretien', color: 'bg-orange-100 text-orange-700' },
  { value: 'fourniture', label: 'Fournitures', color: 'bg-purple-100 text-purple-700' },
  { value: 'autre', label: 'Autre', color: 'bg-gray-100 text-gray-700' },
]

const now = new Date()

export default function DepensesPage() {
  const { currentStation } = useAuthStore()
  const qc = useQueryClient()
  const [month, setMonth] = useState(String(now.getMonth() + 1))
  const [year, setYear] = useState(String(now.getFullYear()))
  const [showForm, setShowForm] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [form, setForm] = useState({
    expense_date: now.toISOString().split('T')[0],
    label: '',
    amount_xof: '',
    category: 'autre',
  })

  const stationId = currentStation?.id ?? ''
  const params = { station: stationId, month, year }

  const listQuery = useQuery({
    queryKey: ['expenses', stationId, month, year],
    queryFn: () => journalApi.listExpenses(params).then((r) =>
      Array.isArray(r.data) ? r.data : (r.data as { results?: JournalExpense[] }).results ?? []
    ),
    enabled: !!stationId,
  })

  const summaryQuery = useQuery({
    queryKey: ['expenses-summary', stationId, month, year],
    queryFn: () => journalApi.expensesSummary({ month, year }).then((r) => r.data),
    enabled: !!stationId,
  })

  const createMut = useMutation({
    mutationFn: () => journalApi.createExpense({ ...form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses', stationId] })
      qc.invalidateQueries({ queryKey: ['expenses-summary', stationId] })
      setShowForm(false)
      setForm({ expense_date: now.toISOString().split('T')[0], label: '', amount_xof: '', category: 'autre' })
      setFormError(null)
    },
    onError: (err: unknown) => setFormError(extractApiError(err as Error)),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => journalApi.deleteExpense(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses', stationId] })
      qc.invalidateQueries({ queryKey: ['expenses-summary', stationId] })
    },
  })

  const expenses = listQuery.data ?? []
  const summary = summaryQuery.data
  const monthLabel = MONTHS.find((m) => m.value === month)?.label ?? ''
  const totalXof = Number(summary?.total_xof ?? 0)

  const getCatColor = (cat: string) =>
    CATEGORIES.find((c) => c.value === cat)?.color ?? 'bg-gray-100 text-gray-700'
  const getCatLabel = (cat: string) =>
    CATEGORIES.find((c) => c.value === cat)?.label ?? cat

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Dépenses</h1>
        <Button size="sm" onClick={() => setShowForm(true)} disabled={!stationId}>
          <Plus size={14} className="mr-1" /> Nouvelle dépense
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

      {/* KPI par catégorie */}
      {summaryQuery.isLoading ? (
        <div className="flex justify-center py-4"><Spinner /></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CATEGORIES.map((cat) => {
            const data = summary?.by_category?.[cat.value]
            const total = Number(data?.total ?? 0)
            return (
              <Card key={cat.value} className={cn(total > 0 ? '' : 'opacity-60')}>
                <CardContent className="pt-3 pb-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">{cat.label}</p>
                  <p className={cn('text-lg font-bold mt-1', total > 0 ? 'text-red-600' : 'text-gray-400')}>
                    {formatXOF(total)}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Tableau des dépenses */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Dépenses — {monthLabel} {year}</CardTitle>
            <span className="text-sm font-bold text-red-600">{formatXOF(totalXof)}</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {listQuery.isLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Libellé</th>
                  <th className="px-4 py-2 text-left">Catégorie</th>
                  <th className="px-4 py-2 text-right">Montant</th>
                  <th className="px-4 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => (
                  <tr key={exp.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(exp.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 font-medium">{exp.label}</td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', getCatColor(exp.category))}>
                        {getCatLabel(exp.category)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">
                      {formatXOF(Number(exp.amount_xof))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => { if (confirm('Supprimer cette dépense ?')) deleteMut.mutate(exp.id) }}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {expenses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                      <Receipt size={32} className="mx-auto mb-2 opacity-30" />
                      Aucune dépense enregistrée pour {monthLabel} {year}.
                    </td>
                  </tr>
                )}
                {expenses.length > 0 && (
                  <tr className="bg-gray-50 border-t-2 font-bold">
                    <td className="px-4 py-2 text-sm" colSpan={3}>Total</td>
                    <td className="px-4 py-2 text-right text-red-700">{formatXOF(totalXof)}</td>
                    <td></td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Dialog nouvelle dépense */}
      <Dialog open={showForm} onOpenChange={(v) => { if (!v) { setShowForm(false); setFormError(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle dépense</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <p className="text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded p-2">
              La dépense sera enregistrée dans le journal ouvert à la date choisie.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={form.expense_date}
                  onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Catégorie</Label>
                <Select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="h-9"
                >
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Libellé *</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Ex: Salaire gardien juin"
              />
            </div>
            <div className="space-y-1">
              <Label>Montant (FCFA) *</Label>
              <Input
                type="number"
                step="500"
                value={form.amount_xof}
                onChange={(e) => setForm((f) => ({ ...f, amount_xof: e.target.value }))}
                placeholder="Ex: 25000"
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
              disabled={createMut.isPending || !form.label || !form.amount_xof}
            >
              {createMut.isPending ? <Spinner size="sm" /> : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
