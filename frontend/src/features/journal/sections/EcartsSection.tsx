import type { JournalFuelLine } from '@/types'
import { formatXOF, cn } from '@/lib/utils'

interface EcartsSectionProps {
  fuelLines: JournalFuelLine[]
  totalAmount: number
}

export default function EcartsSection({ fuelLines, totalAmount }: EcartsSectionProps) {
  const refLines = fuelLines.filter((l) => l.is_tank_reference)
  const linesWithDiff = refLines.filter((l) => l.gauge_diff !== null)

  return (
    <div className="bg-white rounded-lg border">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-sm font-semibold text-gray-800">Écarts de jaugeage</h2>
        <span className="text-sm font-semibold text-blue-600">
          {formatXOF(totalAmount)}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-2 text-left">Cuve</th>
              <th className="px-4 py-2 text-left">Carburant</th>
              <th className="px-4 py-2 text-right">Stock théo. (L)</th>
              <th className="px-4 py-2 text-right">Stock réel (L)</th>
              <th className="px-4 py-2 text-right font-semibold">Écart jour (L)</th>
              <th className="px-4 py-2 text-right">Cumul mois (L)</th>
            </tr>
          </thead>
          <tbody>
            {fuelLines.filter((l) => l.is_tank_reference).map((line) => {
              const diff = line.gauge_diff !== null ? Number(line.gauge_diff) : null
              const monthly = line.monthly_gauge_diff !== null ? Number(line.monthly_gauge_diff) : null
              const isNeg = diff !== null && diff < 0
              const isPos = diff !== null && diff > 0

              return (
                <tr key={line.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{line.tank_label}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{line.fuel_type}</td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {line.theoretical_stock !== null ? Number(line.theoretical_stock).toLocaleString('fr-FR') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {line.gauged_stock_close !== null ? Number(line.gauged_stock_close).toLocaleString('fr-FR') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {diff !== null ? (
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs font-bold',
                        isNeg ? 'bg-red-100 text-red-700' :
                        isPos ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-600'
                      )}>
                        {diff > 0 ? '+' : ''}{diff.toLocaleString('fr-FR')}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 text-xs">
                    {monthly !== null ? (
                      <span className={cn(
                        monthly < 0 ? 'text-red-600' : monthly > 0 ? 'text-green-600' : 'text-gray-400'
                      )}>
                        {monthly > 0 ? '+' : ''}{monthly.toLocaleString('fr-FR')}
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              )
            })}
            {linesWithDiff.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400 text-sm">
                  Les écarts seront disponibles après la saisie du stock réel (jaugeage).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
