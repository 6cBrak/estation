import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Fuel, Banknote, LayoutGrid, TrendingUp, AlertTriangle, Droplets,
  ChevronDown, ChevronRight, Receipt,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { reportsApi } from '@/api/reports'
import { formatXOF, today } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TankRow {
  label: string
  fuel_type: string
  current_level: number
  capacity: number
  pct: number
  is_low: boolean
}

interface PumpRow {
  label: string
  fuel_type: string
  sold_volume: number | null
  amount_xof: number | null
}

interface ChargeRow {
  label: string
  category_display: string
  amount_xof: number
  status: 'pending' | 'validated' | 'rejected'
  status_display: string
}

interface StationRow {
  station: string
  station_code: string
  station_id: string
  status: string | null
  status_display: string | null
  journal_number: string | null
  fuel_xof: number
  fuel_liters: number
  encaisse_xof: number
  charges_xof: number
  charge_rows: ChargeRow[]
  has_charges: boolean
  pump_rows: PumpRow[]
  tank_rows: TankRow[]
  has_journal: boolean
}

interface NetworkData {
  date: string
  stations_total: number
  stations_with_journal_today: number
  net_fuel_liters: number
  net_fuel_xof: number
  net_encaisse_xof: number
  net_charges_xof: number
  stations: StationRow[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge variant="default">Pas de journal</Badge>
  const map: Record<string, { label: string; variant: 'warning' | 'default' | 'success' }> = {
    draft:     { label: 'En cours',  variant: 'warning' },
    closed:    { label: 'Clôturé',   variant: 'default' },
    validated: { label: 'Validé',    variant: 'success' },
  }
  const cfg = map[status] ?? { label: status, variant: 'default' as const }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

function TankBar({ tank }: { tank: TankRow }) {
  const pct = Math.min(100, tank.pct)
  const color = pct < 20 ? 'bg-red-500' : pct < 50 ? 'bg-orange-400' : 'bg-green-500'
  return (
    <div className="py-1.5 border-b last:border-0">
      <div className="flex items-center gap-2 mb-1">
        <Droplets size={11} className={tank.is_low ? 'text-red-500' : 'text-blue-400'} />
        <span className="text-xs font-medium flex-1">{tank.label}</span>
        <span className="text-xs text-gray-400">{tank.fuel_type}</span>
        {tank.is_low && <AlertTriangle size={11} className="text-red-500" />}
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-0.5">
        <span>{Number(tank.current_level).toLocaleString('fr-FR')} L</span>
        <span>{pct}%</span>
      </div>
    </div>
  )
}

// ─── Station Card ─────────────────────────────────────────────────────────────

function StationCard({ row }: { row: StationRow }) {
  const [expanded, setExpanded] = useState(false)
  const noJournal = !row.has_journal

  return (
    <Card className={noJournal ? 'opacity-60' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold">{row.station}</CardTitle>
            <span className="text-xs text-gray-400 font-mono">{row.station_code}</span>
            {row.journal_number && (
              <span className="text-xs text-gray-400 font-mono">· {row.journal_number}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={row.status} />
            {row.has_journal && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-gray-400 hover:text-gray-600"
              >
                {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {noJournal ? (
          <p className="text-xs text-gray-400 text-center py-2">Aucun journal aujourd'hui</p>
        ) : (
          <>
            {/* KPI rapides */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              <div className="text-center">
                <p className="text-xs text-gray-500">Carburant</p>
                <p className="text-sm font-bold text-blue-700">{formatXOF(row.fuel_xof)}</p>
                <p className="text-xs text-gray-400">{Number(row.fuel_liters).toLocaleString('fr-FR')} L</p>
              </div>
              <div className="text-center border-x border-gray-100">
                <p className="text-xs text-gray-500">Encaissé</p>
                <p className="text-sm font-bold text-green-700">{formatXOF(row.encaisse_xof)}</p>
              </div>
              <div className="text-center border-r border-gray-100">
                <p className="text-xs text-gray-500">Dépenses</p>
                <p className="text-sm font-bold text-orange-700">{formatXOF(row.charges_xof)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Pompes</p>
                <p className="text-sm font-bold text-gray-700">{row.pump_rows.length}</p>
              </div>
            </div>

            {/* Détail dépliable */}
            {expanded && (
              <div className="space-y-3 border-t border-gray-100 pt-3">
                {/* Pompes */}
                {row.pump_rows.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Pompes</p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400 border-b">
                          <th className="text-left pb-1">Pompe</th>
                          <th className="text-left pb-1">Carburant</th>
                          <th className="text-right pb-1">Litres</th>
                          <th className="text-right pb-1">Montant</th>
                        </tr>
                      </thead>
                      <tbody>
                        {row.pump_rows.map((p, i) => (
                          <tr key={i} className="border-b border-gray-50">
                            <td className="py-1">{p.label}</td>
                            <td className="py-1 text-gray-500">{p.fuel_type}</td>
                            <td className="py-1 text-right">
                              {p.sold_volume != null
                                ? `${Number(p.sold_volume).toLocaleString('fr-FR')} L`
                                : '—'}
                            </td>
                            <td className="py-1 text-right font-semibold text-blue-700">
                              {p.amount_xof != null ? formatXOF(p.amount_xof) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Cuves */}
                {row.tank_rows.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Niveaux des cuves</p>
                    {row.tank_rows.map((t, i) => <TankBar key={i} tank={t} />)}
                  </div>
                )}

                {/* Dépenses */}
                {row.has_charges && (
                  <div>
                    <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-1.5">Dépenses du jour</p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400 border-b">
                          <th className="text-left pb-1">Libellé</th>
                          <th className="text-left pb-1">Catégorie</th>
                          <th className="text-left pb-1">Statut</th>
                          <th className="text-right pb-1">Montant</th>
                        </tr>
                      </thead>
                      <tbody>
                        {row.charge_rows.map((c, i) => (
                          <tr key={i} className="border-b border-gray-50">
                            <td className="py-1">{c.label}</td>
                            <td className="py-1 text-gray-500">{c.category_display}</td>
                            <td className={`py-1 ${c.status === 'validated' ? 'text-green-600' : c.status === 'rejected' ? 'text-red-500' : 'text-amber-500'}`}>
                              {c.status_display}
                            </td>
                            <td className="py-1 text-right font-semibold text-orange-700">
                              {formatXOF(c.amount_xof)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function NetworkDashboardPage() {
  const { data, isLoading } = useQuery<NetworkData>({
    queryKey: ['network-dashboard', today()],
    queryFn: () => reportsApi.networkDashboard().then((r) => r.data as NetworkData),
    refetchInterval: 120_000,
  })

  const todayStr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord réseau</h1>
        <p className="text-sm text-gray-500 capitalize">{todayStr}</p>
      </div>

      {/* KPI réseau */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Carburant réseau</p>
                <p className="text-2xl font-bold text-blue-700">
                  {data ? formatXOF(data.net_fuel_xof) : '—'}
                </p>
                {data && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {Number(data.net_fuel_liters).toLocaleString('fr-FR')} L
                  </p>
                )}
              </div>
              <Fuel size={22} className="text-gray-300 mt-0.5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total encaissé</p>
                <p className="text-2xl font-bold text-green-700">
                  {data ? formatXOF(data.net_encaisse_xof) : '—'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">toutes stations</p>
              </div>
              <Banknote size={22} className="text-gray-300 mt-0.5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Dépenses réseau</p>
                <p className="text-2xl font-bold text-orange-700">
                  {data ? formatXOF(data.net_charges_xof) : '—'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">validées</p>
              </div>
              <Receipt size={22} className="text-gray-300 mt-0.5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Stations actives</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data ? `${data.stations_with_journal_today}/${data.stations_total}` : '—'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">avec journal</p>
              </div>
              <LayoutGrid size={22} className="text-gray-300 mt-0.5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Taux couverture</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data && data.stations_total > 0
                    ? `${Math.round((data.stations_with_journal_today / data.stations_total) * 100)}%`
                    : '—'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">journaux ouverts</p>
              </div>
              <TrendingUp size={22} className="text-gray-300 mt-0.5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grille des stations */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Détail par station
          <span className="ml-2 text-xs font-normal text-gray-400">
            Cliquez sur ▶ pour voir les pompes et cuves
          </span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data?.stations?.map((row) => (
            <StationCard key={row.station_id} row={row} />
          ))}
          {(!data?.stations || data.stations.length === 0) && (
            <p className="text-sm text-gray-400 col-span-2 text-center py-8">
              Aucune station configurée.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
