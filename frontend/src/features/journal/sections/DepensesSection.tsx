import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { journalApi } from '@/api/journal'
import type { JournalExpense } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Trash2, Plus } from 'lucide-react'
import { formatXOF } from '@/lib/utils'
import { extractApiError } from '@/lib/utils'

const CATEGORIES = [
  { value: 'salaire', label: 'Salaires' },
  { value: 'entretien', label: 'Entretien' },
  { value: 'fourniture', label: 'Fournitures' },
  { value: 'autre', label: 'Autre' },
]

interface DepensesSectionProps {
  journalId: string
  isEditable: boolean
  expenses: JournalExpense[]
  monthlyTotal: number
}

export default function DepensesSection({ journalId, isEditable, expenses, monthlyTotal }: DepensesSectionProps) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ label: '', amount_xof: '', category: 'autre' })
  const [error, setError] = useState<string | null>(null)

  const dailyTotal = expenses.reduce((s, e) => s + Number(e.amount_xof), 0)

  const createMut = useMutation({
    mutationFn: () => journalApi.createExpense({ journal: journalId, ...form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journal', journalId] })
      setForm({ label: '', amount_xof: '', category: 'autre' })
      setShowForm(false)
      setError(null)
    },
    onError: (err: unknown) => setError(extractApiError(err as Error)),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => journalApi.deleteExpense(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['journal', journalId] }),
  })

  return (
    <div className="bg-white rounded-lg border">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Dépenses du jour</h2>
          <p className="text-xs text-gray-400 mt-0.5">Cumul mois : {formatXOF(monthlyTotal)}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-red-600">{formatXOF(dailyTotal)}</span>
          {isEditable && (
            <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
              <Plus size={13} className="mr-1" /> Ajouter
            </Button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="px-4 py-3 bg-blue-50 border-b flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-40 space-y-1">
            <label className="text-xs text-gray-600">Libellé *</label>
            <Input
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="Ex: Salaire gardien"
              className="h-8 text-sm"
            />
          </div>
          <div className="w-36 space-y-1">
            <label className="text-xs text-gray-600">Montant (FCFA) *</label>
            <Input
              type="number"
              value={form.amount_xof}
              onChange={(e) => setForm((f) => ({ ...f, amount_xof: e.target.value }))}
              className="h-8 text-sm"
            />
          </div>
          <div className="w-36 space-y-1">
            <label className="text-xs text-gray-600">Catégorie</label>
            <Select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="h-8 text-sm"
            >
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending || !form.label || !form.amount_xof}
            >
              {createMut.isPending ? <Spinner size="sm" /> : 'Enregistrer'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowForm(false); setError(null) }}>
              Annuler
            </Button>
          </div>
          {error && <p className="w-full text-xs text-red-500 bg-red-50 rounded p-2">{error}</p>}
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
            <th className="px-4 py-2 text-left">Libellé</th>
            <th className="px-4 py-2 text-left">Catégorie</th>
            <th className="px-4 py-2 text-right">Montant</th>
            {isEditable && <th className="px-4 py-2 w-8"></th>}
          </tr>
        </thead>
        <tbody>
          {expenses.map((expense) => (
            <tr key={expense.id} className="border-b hover:bg-gray-50">
              <td className="px-4 py-3">{expense.label}</td>
              <td className="px-4 py-3 text-gray-500 text-xs">{expense.category_display}</td>
              <td className="px-4 py-3 text-right font-medium text-red-600">
                {formatXOF(Number(expense.amount_xof))}
              </td>
              {isEditable && (
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => { if (confirm('Supprimer cette dépense ?')) deleteMut.mutate(expense.id) }}
                    className="text-red-400 hover:text-red-600"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              )}
            </tr>
          ))}
          {expenses.length === 0 && (
            <tr>
              <td colSpan={isEditable ? 4 : 3} className="px-4 py-6 text-center text-gray-400 text-sm">
                Aucune dépense enregistrée pour aujourd'hui.
              </td>
            </tr>
          )}
          {expenses.length > 0 && (
            <tr className="bg-gray-50 font-semibold">
              <td className="px-4 py-2 text-sm" colSpan={2}>Total jour</td>
              <td className="px-4 py-2 text-right text-red-700">{formatXOF(dailyTotal)}</td>
              {isEditable && <td></td>}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
