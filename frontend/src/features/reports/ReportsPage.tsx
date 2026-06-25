import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { reportsApi } from '@/api/reports'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { cn, formatXOF, formatDate, today } from '@/lib/utils'
import { BarChart2, Download, AlertTriangle, CheckCircle } from 'lucide-react'

const TABS = [
  { id: 'sales', label: 'Ventes' },
  { id: 'reconciliation', label: 'Rapprochement' },
  { id: 'stocks', label: 'Stocks' },
] as const
type Tab = typeof TABS[number]['id']

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('sales')

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Rapports</h1>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'sales' && <SalesReport />}
      {activeTab === 'reconciliation' && <ReconciliationReport />}
      {activeTab === 'stocks' && <StocksReport />}
    </div>
  )
}

// ─── Rapport de ventes ────────────────────────────────────────────────────────

function SalesReport() {
  const { currentStation } = useAuthStore()
  const todayStr = today()
  const firstOfMonth = todayStr.slice(0, 8) + '01'

  const [dateFrom, setDateFrom] = useState(firstOfMonth)
  const [dateTo, setDateTo] = useState(todayStr)
  const [submitted, setSubmitted] = useState(false)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['sales-report', currentStation?.id, dateFrom, dateTo],
    queryFn: () => reportsApi.salesReport({
      station: currentStation?.id,
      date_from: dateFrom,
      date_to: dateTo,
    }).then((r) => r.data),
    enabled: submitted && !!currentStation,
  })

  const excelUrl = currentStation
    ? reportsApi.salesExcelUrl({ station: currentStation.id, date_from: dateFrom, date_to: dateTo })
    : '#'

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="space-y-1">
              <Label>Du</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setSubmitted(false) }}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <Label>Au</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setSubmitted(false) }}
                className="w-40"
              />
            </div>
            <Button onClick={() => setSubmitted(true)} disabled={isLoading}>
              <BarChart2 size={14} className="mr-1" /> Générer
            </Button>
            {submitted && (
              <a href={excelUrl} download className="inline-flex items-center gap-1 text-sm text-green-700 hover:underline">
                <Download size={14} /> Export Excel
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      {(isLoading || isFetching) && <div className="flex justify-center py-8"><Spinner /></div>}

      {data && !isFetching && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard label="Total carburant" value={formatXOF(data.total_fuel_xof ?? 0)} />
            <KpiCard label="Total ventes" value={formatXOF(data.total_sales_xof ?? 0)} />
            <KpiCard label="Jours de ventes" value={String(data.days?.length ?? 0)} />
          </div>

          {/* Ventes par jour */}
          {data.days && data.days.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Ventes par jour</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 font-medium text-gray-600">Date</th>
                      <th className="py-2 pr-4 text-right font-medium text-gray-600">Carburant</th>
                      <th className="py-2 pr-4 text-right font-medium text-gray-600">Autres</th>
                      <th className="py-2 pr-4 text-right font-medium text-gray-600">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.days.map((day: { date: string; fuel_xof: number; other_xof: number; total_xof: number }) => (
                      <tr key={day.date} className="border-b hover:bg-gray-50">
                        <td className="py-2">{formatDate(day.date)}</td>
                        <td className="py-2 pr-4 text-right">{formatXOF(day.fuel_xof ?? 0)}</td>
                        <td className="py-2 pr-4 text-right">{formatXOF(day.other_xof ?? 0)}</td>
                        <td className="py-2 pr-4 text-right font-semibold">{formatXOF(day.total_xof ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Ventes par catégorie */}
          {data.by_category && Object.keys(data.by_category).length > 0 && (
            <Card>
              <CardHeader><CardTitle>Répartition par catégorie</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 font-medium text-gray-600">Catégorie</th>
                      <th className="py-2 pr-4 text-right font-medium text-gray-600">Montant</th>
                      <th className="py-2 pr-4 text-right font-medium text-gray-600">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.by_category).map(([cat, amount]) => (
                      <tr key={cat} className="border-b hover:bg-gray-50">
                        <td className="py-2 capitalize">{cat}</td>
                        <td className="py-2 pr-4 text-right">{formatXOF(Number(amount))}</td>
                        <td className="py-2 pr-4 text-right text-gray-500">
                          {data.total_sales_xof
                            ? `${((Number(amount) / data.total_sales_xof) * 100).toFixed(1)}%`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

// ─── Rapprochement ────────────────────────────────────────────────────────────

function ReconciliationReport() {
  const { currentStation } = useAuthStore()
  const [date, setDate] = useState(today())
  const [submitted, setSubmitted] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['reconciliation', currentStation?.id, date],
    queryFn: () => reportsApi.reconciliation({
      station: currentStation?.id,
      date,
    }).then((r) => r.data),
    enabled: submitted && !!currentStation,
  })

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-end gap-4">
            <div className="space-y-1">
              <Label>Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => { setDate(e.target.value); setSubmitted(false) }}
                className="w-40"
              />
            </div>
            <Button onClick={() => setSubmitted(true)} disabled={isLoading}>
              <BarChart2 size={14} className="mr-1" /> Analyser
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}

      {data && !isLoading && (
        <div className="space-y-4">
          {/* Alertes */}
          {data.alerts && data.alerts.length > 0 && (
            <Card className="border-orange-300 bg-orange-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-700">
                  <AlertTriangle size={16} /> Alertes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {data.alerts.map((alert: string, i: number) => (
                    <li key={i} className="text-sm text-orange-700 flex items-start gap-2">
                      <span className="shrink-0">•</span> {alert}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {data.alerts && data.alerts.length === 0 && (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg p-4">
              <CheckCircle size={18} /> Aucune anomalie détectée pour cette journée.
            </div>
          )}

          {/* Détail pompes */}
          {data.pumps && (
            <Card>
              <CardHeader><CardTitle>Détail par pompe</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 font-medium text-gray-600">Pompe</th>
                      <th className="py-2 pr-4 text-right font-medium text-gray-600">Volume calculé</th>
                      <th className="py-2 pr-4 text-right font-medium text-gray-600">Volume journal</th>
                      <th className="py-2 pr-4 text-right font-medium text-gray-600">Écart</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pumps.map((pump: { label: string; calc: number; journal: number; diff: number }) => (
                      <tr key={pump.label} className="border-b hover:bg-gray-50">
                        <td className="py-2">{pump.label}</td>
                        <td className="py-2 pr-4 text-right">{pump.calc?.toLocaleString('fr-FR')} L</td>
                        <td className="py-2 pr-4 text-right">{pump.journal?.toLocaleString('fr-FR')} L</td>
                        <td className={cn('py-2 pr-4 text-right font-medium', Math.abs(pump.diff ?? 0) > 0 ? 'text-orange-600' : 'text-green-600')}>
                          {pump.diff >= 0 ? '+' : ''}{pump.diff?.toLocaleString('fr-FR')} L
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Paiements */}
          {data.payments && (
            <Card>
              <CardHeader><CardTitle>Récapitulatif paiements</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  {Object.entries(data.payments).map(([mode, amount]) => (
                    <div key={mode} className="rounded-lg border p-3">
                      <p className="text-gray-500 capitalize">{mode.replace('_', ' ')}</p>
                      <p className="font-bold text-gray-900">{formatXOF(Number(amount))}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Rapport stocks ───────────────────────────────────────────────────────────

function StocksReport() {
  const { currentStation } = useAuthStore()

  const { data, isLoading } = useQuery({
    queryKey: ['stock-report', currentStation?.id],
    queryFn: () => reportsApi.stockReport({ station: currentStation?.id }).then((r) => r.data),
    enabled: !!currentStation,
  })

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>

  if (!data) return (
    <Card>
      <CardContent className="py-12 text-center text-gray-400">
        Aucune donnée disponible.
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-4">
      {/* Niveaux cuves */}
      {data.tanks && data.tanks.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Cuves carburant</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 font-medium text-gray-600">Cuve</th>
                  <th className="py-2 pr-4 text-right font-medium text-gray-600">Niveau</th>
                  <th className="py-2 pr-4 text-right font-medium text-gray-600">Capacité</th>
                  <th className="py-2 font-medium text-gray-600">Taux</th>
                </tr>
              </thead>
              <tbody>
                {data.tanks.map((tank: { label: string; current: number; capacity: number; pct: number; is_low: boolean }) => (
                  <tr key={tank.label} className={cn('border-b', tank.is_low && 'bg-orange-50')}>
                    <td className="py-2 font-medium">
                      {tank.label}
                      {tank.is_low && <span className="ml-2 text-xs text-orange-600">(niveau bas)</span>}
                    </td>
                    <td className="py-2 pr-4 text-right">{tank.current?.toLocaleString('fr-FR')} L</td>
                    <td className="py-2 pr-4 text-right text-gray-500">{tank.capacity?.toLocaleString('fr-FR')} L</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 rounded-full bg-gray-200">
                          <div
                            className={cn('h-full rounded-full', tank.pct < 20 ? 'bg-red-500' : tank.pct < 40 ? 'bg-orange-400' : 'bg-blue-500')}
                            style={{ width: `${Math.min(tank.pct ?? 0, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{Math.round(tank.pct ?? 0)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4 text-center">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </Card>
  )
}
