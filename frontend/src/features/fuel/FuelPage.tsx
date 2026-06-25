import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { fuelApi } from '@/api/fuel'
import type { FuelType, Tank, Nozzle } from '@/api/fuel'
import { reportsApi } from '@/api/reports'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Fuel, AlertTriangle } from 'lucide-react'
import { cn, formatXOF, unwrapList } from '@/lib/utils'

export default function FuelPage() {
  const { currentStation } = useAuthStore()
  const stationId = currentStation?.id

  const { data: tanks = [], isLoading: tanksLoading } = useQuery({
    queryKey: ['tanks', stationId],
    queryFn: () => fuelApi.listTanks(stationId ? { station: stationId } : undefined).then((r) => unwrapList<Tank>(r.data)),
    enabled: !!stationId,
  })

  const { data: nozzles = [], isLoading: nozzlesLoading } = useQuery({
    queryKey: ['nozzles', stationId],
    queryFn: () => fuelApi.listNozzles(stationId ? { station: stationId } : undefined).then((r) => unwrapList<Nozzle>(r.data)),
    enabled: !!stationId,
  })

  const { data: fuelTypes = [] } = useQuery({
    queryKey: ['fuel-types'],
    queryFn: () => fuelApi.listTypes().then((r) => unwrapList<FuelType>(r.data)),
  })

  const { data: dashboard } = useQuery({
    queryKey: ['dashboard', stationId],
    queryFn: () => reportsApi.stationDashboard({ station: stationId }).then((r) => r.data),
    enabled: !!stationId,
  })

  const activeTanks = tanks.filter((t) => t.is_active)
  const activeNozzles = nozzles.filter((n) => n.is_active)

  if (tanksLoading || nozzlesLoading) {
    return <div className="flex justify-center py-20"><Spinner /></div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Carburant</h1>

      {/* Niveaux cuves */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Niveaux des cuves
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {activeTanks.map((tank) => {
            const dashTank = dashboard?.tank_stocks?.find((t) => t.label === tank.label)
            const pct = dashTank?.pct ?? (Number(tank.current_level_liters) / Number(tank.capacity_liters)) * 100
            const isLow = dashTank?.is_low ?? Number(tank.current_level_liters) <= Number(tank.low_threshold_liters)
            const fuelType = fuelTypes.find((ft) => ft.id === tank.fuel_type)

            return (
              <Card key={tank.id} className={cn('p-4', isLow && 'border-orange-300 bg-orange-50')}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Fuel size={16} className={isLow ? 'text-orange-500' : 'text-blue-600'} />
                      <p className="font-semibold text-gray-900">{tank.label}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{fuelType?.name ?? tank.fuel_type_name}</p>
                  </div>
                  {isLow && (
                    <div className="flex items-center gap-1 text-orange-600 text-xs font-medium">
                      <AlertTriangle size={14} />
                      Niveau bas
                    </div>
                  )}
                </div>

                {/* Barre de niveau */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{Math.round(pct)}%</span>
                    <span>{Number(tank.capacity_liters).toLocaleString('fr-FR')} L max</span>
                  </div>
                  <div className="h-4 rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        pct < 20 ? 'bg-red-500' : pct < 40 ? 'bg-orange-400' : 'bg-blue-500'
                      )}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white rounded p-2 text-center border">
                    <p className="text-gray-500">Niveau actuel</p>
                    <p className="font-bold text-gray-900">
                      {Number(tank.current_level_liters).toLocaleString('fr-FR')} L
                    </p>
                  </div>
                  <div className="bg-white rounded p-2 text-center border">
                    <p className="text-gray-500">Seuil alerte</p>
                    <p className="font-bold text-orange-600">
                      {Number(tank.low_threshold_liters).toLocaleString('fr-FR')} L
                    </p>
                  </div>
                </div>

                {fuelType && (
                  <p className="text-xs text-gray-500 mt-2 text-right">
                    Prix: {formatXOF(Number(fuelType.unit_price))}/L
                  </p>
                )}
              </Card>
            )
          })}
          {activeTanks.length === 0 && (
            <div className="col-span-3 text-center py-12 text-gray-400">
              Aucune cuve configurée. Allez dans Paramétrage &gt; Cuves.
            </div>
          )}
        </div>
      </div>

      {/* Pistolets */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Pistolets
        </h2>
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="px-4 py-3 font-medium text-gray-600">N°</th>
                <th className="px-4 py-3 font-medium text-gray-600">Pistolet</th>
                <th className="px-4 py-3 font-medium text-gray-600">Cuve associée</th>
                <th className="px-4 py-3 font-medium text-gray-600">Statut</th>
              </tr>
            </thead>
            <tbody>
              {activeNozzles
                .sort((a, b) => a.display_order - b.display_order)
                .map((nozzle) => {
                  const tank = tanks.find((t) => t.id === nozzle.tank)
                  const fuelType = fuelTypes.find((ft) => ft.id === tank?.fuel_type)
                  return (
                    <tr key={nozzle.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500">{nozzle.display_order}</td>
                      <td className="px-4 py-3 font-medium">{nozzle.label}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {nozzle.tank_label ?? tank?.label ?? '—'}
                        {fuelType && (
                          <span className="ml-2 text-xs text-gray-400">({fuelType.name})</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="success">Actif</Badge>
                      </td>
                    </tr>
                  )
                })}
              {activeNozzles.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                    Aucun pistolet configuré. Allez dans Paramétrage &gt; Pistolets.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}
