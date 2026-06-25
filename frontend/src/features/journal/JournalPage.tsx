import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, BookOpen, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { journalApi } from '@/api/journal'
import { useAuthStore } from '@/stores/auth'
import { today } from '@/lib/utils'

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: 'warning' | 'default' | 'success' }> = {
    draft: { label: 'En cours', variant: 'warning' },
    closed: { label: 'Clôturé', variant: 'default' },
    validated: { label: 'Validé', variant: 'success' },
  }
  const cfg = map[status] ?? { label: status, variant: 'default' as const }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

export default function JournalPage() {
  const { currentStation } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['journals', currentStation?.id],
    queryFn: () =>
      journalApi.list(currentStation?.id ? { station: currentStation.id } : {}).then((r) => r.data),
  })

  const openMutation = useMutation({
    mutationFn: () =>
      journalApi.open({
        ...(currentStation?.id ? { station: currentStation.id } : {}),
        journal_date: today(),
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['journals'] })
      navigate(`/journal/${res.data.id}`)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail
      setError(msg ?? "Erreur lors de l'ouverture du journal.")
    },
  })

  const todayJournal = data?.results.find((j) => j.journal_date === today())

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Journal de station</h1>
          <p className="text-sm text-gray-500">Historique des journaux quotidiens</p>
        </div>
        {!todayJournal ? (
          <Button
            onClick={() => openMutation.mutate()}
            disabled={openMutation.isPending}
          >
            <Plus size={16} />
            {openMutation.isPending ? 'Ouverture…' : 'Ouvrir le journal du jour'}
          </Button>
        ) : (
          <Button onClick={() => navigate(`/journal/${todayJournal.id}`)}>
            <BookOpen size={16} />
            Journal du jour
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Journal du jour mis en avant */}
      {todayJournal && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText size={20} className="text-blue-700" />
                <div>
                  <p className="font-semibold text-blue-900">{todayJournal.journal_number}</p>
                  <p className="text-sm text-blue-600">Aujourd'hui</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={todayJournal.status} />
                <Button size="sm" onClick={() => navigate(`/journal/${todayJournal.id}`)}>
                  Ouvrir
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Liste des journaux */}
      <Card>
        <CardHeader>
          <CardTitle>Historique</CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.results.length ? (
            <p className="text-sm text-gray-400 text-center py-8">
              Aucun journal pour cette station.
            </p>
          ) : (
            <div className="divide-y">
              {data.results.map((j) => (
                <button
                  key={j.id}
                  onClick={() => navigate(`/journal/${j.id}`)}
                  className="flex w-full items-center justify-between py-3 px-1 hover:bg-gray-50 rounded-lg transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <BookOpen size={15} className="text-gray-400 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{j.journal_number}</p>
                      <p className="text-xs text-gray-400">{j.manager_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">
                      {new Date(j.journal_date).toLocaleDateString('fr-FR', {
                        weekday: 'short', day: 'numeric', month: 'long',
                      })}
                    </span>
                    <StatusBadge status={j.status} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
