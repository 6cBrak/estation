import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { journalApi } from '@/api/journal'
import { formatXOF, formatDate, cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'

export default function CreditStatePage() {
  const { currentStation } = useAuthStore()
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['credit-state', currentStation?.id, fromDate, toDate],
    queryFn: () =>
      journalApi.creditState({
        station: currentStation?.id,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      }).then((r) => r.data),
    enabled: !!currentStation?.id,
  })

  const solde = Number(data?.solde_restant_xof ?? 0)

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">État des crédits</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Historique des crédits accordés et remboursements reçus
        </p>
      </div>

      {/* Cartes résumé */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <TrendingDown size={18} className="text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total crédit accordé</p>
                <p className="text-lg font-bold text-orange-600">
                  {formatXOF(Number(data?.total_credit_xof ?? 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp size={18} className="text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total remboursé</p>
                <p className="text-lg font-bold text-green-600">
                  {formatXOF(Number(data?.total_reimbursements_xof ?? 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          'border-2',
          solde > 0 ? 'border-red-400 bg-red-50' : 'border-green-400 bg-green-50'
        )}>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', solde > 0 ? 'bg-red-100' : 'bg-green-100')}>
                <Wallet size={18} className={solde > 0 ? 'text-red-600' : 'text-green-600'} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Solde restant à percevoir</p>
                <p className={cn(
                  'text-lg font-bold',
                  solde > 0 ? 'text-red-700' : 'text-green-700'
                )}>
                  {formatXOF(solde)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres de date */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-600">Filtrer par période</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 whitespace-nowrap">Du</label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-40 h-8 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 whitespace-nowrap">Au</label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-40 h-8 text-sm"
              />
            </div>
            {(fromDate || toDate) && (
              <button
                onClick={() => { setFromDate(''); setToDate('') }}
                className="text-xs text-blue-600 hover:underline"
              >
                Effacer les filtres
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tableau */}
      <Card>
        <CardHeader>
          <CardTitle>Détail des opérations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-gray-400">Chargement…</div>
          ) : !data?.entries.length ? (
            <div className="py-12 text-center text-sm text-gray-400">
              Aucun crédit ou remboursement sur la période.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">N° Journal</th>
                    <th className="px-4 py-3 text-right">Crédit accordé</th>
                    <th className="px-4 py-3 text-right">Remboursement reçu</th>
                    <th className="px-4 py-3 text-right">Solde cumulé</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((entry, i) => {
                    const credit = Number(entry.credit_xof)
                    const reimb = Number(entry.reimbursement_xof)
                    const soldeEntry = Number(entry.solde_cumul_xof)
                    return (
                      <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {formatDate(entry.date)}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                          {entry.journal_number}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {credit > 0 ? (
                            <span className="font-medium text-orange-600">
                              +{formatXOF(credit)}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {reimb > 0 ? (
                            <span className="font-medium text-green-600">
                              -{formatXOF(reimb)}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn(
                            'font-bold px-2 py-0.5 rounded text-xs',
                            soldeEntry > 0
                              ? 'bg-red-100 text-red-700'
                              : soldeEntry < 0
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                          )}>
                            {formatXOF(soldeEntry)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
