import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen, Droplets, AlertTriangle, TrendingUp, TrendingDown,
  Plus, Fuel, Banknote, Users, CalendarDays, Receipt,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { reportsApi } from '@/api/reports'
import { journalApi } from '@/api/journal'
import { useAuthStore } from '@/stores/auth'
import { formatXOF, today } from '@/lib/utils'
import type { DashboardAlert, StationDashboard } from '@/types'
import NetworkDashboardPage from './NetworkDashboardPage'

// ─── Sous-composants ──────────────────────────────────────────────────────────

function JournalStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: 'warning' | 'default' | 'success' }> = {
    draft:     { label: 'En cours',  variant: 'warning' },
    closed:    { label: 'Clôturé',   variant: 'default' },
    validated: { label: 'Validé',    variant: 'success' },
  }
  const cfg = map[status] ?? { label: status, variant: 'default' as const }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

function KpiCard({
  label, value, sub, icon, highlight = false,
}: {
  label: string
  value: string
  sub?: React.ReactNode
  icon: React.ReactNode
  highlight?: boolean
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
            <p className={`text-2xl font-bold ${highlight ? 'text-blue-700' : 'text-gray-900'}`}>
              {value}
            </p>
            {sub && <div className="mt-1">{sub}</div>}
          </div>
          <div className="text-gray-300 mt-0.5">{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function EvolutionBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-gray-400">— vs mois préc.</span>
  const up = pct >= 0
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${up ? 'text-green-600' : 'text-red-600'}`}>
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {up ? '+' : ''}{pct.toFixed(1)}% vs mois préc.
    </span>
  )
}

function CashVarianceBadge({ variance, alert }: { variance: number | null; alert: boolean }) {
  if (variance === null) return <span className="text-xs text-gray-400">—</span>
  const color = alert ? 'text-red-600' : 'text-green-600'
  return (
    <span className={`text-xs font-semibold ${color}`}>
      {variance >= 0 ? '+' : ''}{formatXOF(variance)}
      {alert && ' ⚠'}
    </span>
  )
}

function AlertBanner({ alerts }: { alerts: DashboardAlert[] }) {
  if (!alerts.length) return null
  return (
    <div className="space-y-2">
      {alerts.map((a, i) => (
        <div
          key={i}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm ${
            a.severity === 'critical'
              ? 'bg-red-50 border border-red-200 text-red-700'
              : 'bg-amber-50 border border-amber-200 text-amber-700'
          }`}
        >
          <AlertTriangle size={15} className="shrink-0" />
          {a.label}
        </div>
      ))}
    </div>
  )
}

function TankCard({ tank }: { tank: StationDashboard['tank_stocks'][0] }) {
  const pct = Math.min(100, tank.pct)
  const color = pct < 20 ? 'bg-red-500' : pct < 50 ? 'bg-orange-400' : 'bg-green-500'
  return (
    <div className="py-2.5 border-b last:border-0">
      <div className="flex items-center gap-2 mb-1.5">
        <Droplets size={13} className={tank.is_low ? 'text-red-500' : 'text-blue-400'} />
        <span className="text-sm font-medium flex-1">{tank.label}</span>
        <span className="text-xs text-gray-500">{tank.fuel_type}</span>
        {tank.is_low && <AlertTriangle size={12} className="text-red-500" />}
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-0.5">
        <span>{Number(tank.current_level).toLocaleString('fr-FR')} L</span>
        <span>{pct}% / {Number(tank.capacity).toLocaleString('fr-FR')} L</span>
      </div>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { currentStation, user } = useAuthStore()
  const navigate = useNavigate()

  if (user?.role === 'super_admin') return <NetworkDashboardPage />

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', currentStation?.id, today()],
    queryFn: () =>
      reportsApi.stationDashboard({ station: currentStation?.id }).then((r) => r.data),
    enabled: !!user,
    refetchInterval: 60_000,
  })

  const { data: journals } = useQuery({
    queryKey: ['journals-recent', currentStation?.id],
    queryFn: () =>
      journalApi.list({ ...(currentStation?.id ? { station: currentStation.id } : {}) })
        .then((r) => r.data),
    enabled: !!user,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  const journal = data?.journal
  const todayStr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div className="space-y-5">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {data?.station ?? currentStation?.name ?? 'Tableau de bord'}
          </h1>
          <p className="text-sm text-gray-500 capitalize">{todayStr}</p>
        </div>
        <Button onClick={() => navigate('/journal')}>
          {journal ? <BookOpen size={16} /> : <Plus size={16} />}
          {journal ? 'Journal du jour' : 'Ouvrir le journal'}
        </Button>
      </div>

      {/* Alertes */}
      {data?.alerts && <AlertBanner alerts={data.alerts} />}

      {/* KPI row 1 — chiffres du jour */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <KpiCard
          label="Ventes carburant"
          value={journal ? formatXOF(journal.total_fuel_xof) : '—'}
          sub={journal?.total_liters
            ? <span className="text-xs text-gray-400">{Number(journal.total_liters).toLocaleString('fr-FR')} L</span>
            : undefined}
          icon={<Fuel size={22} />}
        />
        <KpiCard
          label="Total encaissé"
          value={journal?.payment_summary ? formatXOF(journal.payment_summary.total) : '—'}
          sub={<CashVarianceBadge
            variance={journal?.cash_variance_xof ?? null}
            alert={journal?.cash_alert ?? false}
          />}
          icon={<Banknote size={22} />}
          highlight
        />
        <KpiCard
          label="Dépenses du jour"
          value={data?.charges ? formatXOF(data.charges.total_xof) : '—'}
          sub={data?.charges?.total_pending_xof > 0
            ? <span className="text-xs text-amber-500">{formatXOF(data.charges.total_pending_xof)} en attente</span>
            : <span className="text-xs text-gray-400">aucune en attente</span>}
          icon={<Receipt size={22} />}
        />
        <KpiCard
          label="Cumul du mois"
          value={data ? formatXOF(data.monthly_xof) : '—'}
          sub={<EvolutionBadge pct={data?.evolution_pct ?? null} />}
          icon={<CalendarDays size={22} />}
        />
        <KpiCard
          label="Sessions actives"
          value={data?.open_sessions !== undefined ? String(data.open_sessions) : '—'}
          sub={<span className="text-xs text-gray-400">caisses ouvertes</span>}
          icon={<Users size={22} />}
        />
      </div>

      {/* Ligne 2 — Journal statut + encaissements + cuves + dépenses */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">

        {/* Statut journal */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Journal du jour</CardTitle>
          </CardHeader>
          <CardContent>
            {journal ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <JournalStatusBadge status={journal.status} />
                  <span className="text-xs text-gray-500 font-mono">{journal.journal_number}</span>
                </div>
                <div className="space-y-1.5">
                  {journal.fuel_summary.map((f) => (
                    <div key={f.pump} className="flex justify-between text-sm">
                      <span className="text-gray-600">{f.pump} <span className="text-xs text-gray-400">({f.fuel_type})</span></span>
                      <span className="font-medium">{f.sold_volume ? `${Number(f.sold_volume).toLocaleString('fr-FR')} L` : '—'}</span>
                    </div>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate('/journal')}
                >
                  Ouvrir le journal
                </Button>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-gray-400 mb-3">Aucun journal aujourd'hui</p>
                <Button size="sm" onClick={() => navigate('/journal')}>
                  <Plus size={14} />
                  Ouvrir
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Encaissements du jour */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Encaissements du jour</CardTitle>
              <TrendingUp size={15} className="text-gray-400" />
            </div>
          </CardHeader>
          <CardContent>
            {journal?.payment_summary ? (
              <div className="space-y-0">
                {[
                  { label: 'Espèces',       value: journal.payment_summary.cash },
                  { label: 'Tickets',       value: journal.payment_summary.tickets },
                  { label: 'TPE / Carte',   value: journal.payment_summary.tpe },
                  { label: 'Mobile Money',  value: journal.payment_summary.mobile_money },
                  { label: 'Crédit',        value: journal.payment_summary.credit },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between py-1.5 border-b last:border-0 text-sm">
                    <span className="text-gray-500">{label}</span>
                    <span className={value > 0 ? 'font-medium' : 'text-gray-300'}>
                      {formatXOF(value)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between pt-2 font-bold text-sm">
                  <span>Total encaissé</span>
                  <span className="text-blue-700">{formatXOF(journal.payment_summary.total)}</span>
                </div>
                {journal.cash_variance_xof !== null && (
                  <div className={`flex justify-between pt-1 text-xs ${journal.cash_alert ? 'text-red-600' : 'text-green-600'}`}>
                    <span>Écart de caisse</span>
                    <span className="font-semibold">
                      {journal.cash_variance_xof >= 0 ? '+' : ''}{formatXOF(journal.cash_variance_xof)}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 py-4 text-center">Aucune donnée d'encaissement.</p>
            )}
          </CardContent>
        </Card>

        {/* Niveaux des cuves */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Niveaux des cuves</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.tank_stocks && data.tank_stocks.length > 0
              ? data.tank_stocks.map((t, i) => <TankCard key={i} tank={t} />)
              : <p className="text-sm text-gray-400 py-4 text-center">Aucune cuve configurée.</p>
            }
          </CardContent>
        </Card>

        {/* Dépenses du jour */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Dépenses du jour</CardTitle>
              <Receipt size={15} className="text-gray-400" />
            </div>
          </CardHeader>
          <CardContent>
            {data?.charges && data.charges.rows.length > 0 ? (
              <div className="space-y-0">
                {data.charges.rows.map((c, i) => (
                  <div key={i} className="flex justify-between items-start py-1.5 border-b last:border-0 text-sm gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-700 truncate">{c.label}</p>
                      <p className="text-xs text-gray-400">{c.category_display}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-medium">{formatXOF(c.amount_xof)}</p>
                      <p className={`text-xs ${c.status === 'validated' ? 'text-green-600' : c.status === 'rejected' ? 'text-red-500' : 'text-amber-500'}`}>
                        {c.status_display}
                      </p>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between pt-2 font-bold text-sm">
                  <span>Total validé</span>
                  <span className="text-orange-700">{formatXOF(data.charges.total_validated_xof)}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 py-4 text-center">Aucune dépense aujourd'hui.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Journaux récents */}
      {journals && journals.results.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Journaux récents</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div>
              {journals.results.slice(0, 7).map((j) => (
                <button
                  key={j.id}
                  onClick={() => navigate(`/journal/${j.id}`)}
                  className="flex w-full items-center justify-between px-4 py-2.5 hover:bg-gray-50 border-b last:border-0 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <BookOpen size={13} className="text-gray-400 shrink-0" />
                    <span className="text-sm font-medium font-mono">{j.journal_number}</span>
                    <span className="text-xs text-gray-400 hidden sm:inline">{j.manager_name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">
                      {new Date(j.journal_date).toLocaleDateString('fr-FR', {
                        day: 'numeric', month: 'short',
                      })}
                    </span>
                    <JournalStatusBadge status={j.status} />
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
