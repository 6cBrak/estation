import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Lock, CheckCircle, FileDown, AlertTriangle, RotateCcw, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { journalApi } from '@/api/journal'
import { useAuthStore } from '@/stores/auth'
import { formatXOF } from '@/lib/utils'
import FuelLinesSection from './sections/FuelLinesSection'
import LubricantLinesSection from './sections/LubricantLinesSection'
import SalesRecapSection from './sections/SalesRecapSection'
import PaymentSummarySection from './sections/PaymentSummarySection'
import EcartsSection from './sections/EcartsSection'
import DepensesSection from './sections/DepensesSection'

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: 'warning' | 'default' | 'success' }> = {
    draft: { label: 'En cours', variant: 'warning' },
    closed: { label: 'Clôturé', variant: 'default' },
    validated: { label: 'Validé', variant: 'success' },
  }
  const cfg = map[status] ?? { label: status, variant: 'default' as const }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

export default function JournalDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const [actionError, setActionError] = useState<string | null>(null)

  const { data: journal, isLoading } = useQuery({
    queryKey: ['journal', id],
    queryFn: () => journalApi.get(id!).then((r) => r.data),
    enabled: !!id,
    refetchOnWindowFocus: false,
  })

  const closeMutation = useMutation({
    mutationFn: () => journalApi.close(id!),
    onSuccess: () => {
      setActionError(null)
      qc.invalidateQueries({ queryKey: ['journal', id] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setActionError(msg ?? 'Erreur lors de la clôture.')
    },
  })

  const validateMutation = useMutation({
    mutationFn: () => journalApi.validate(id!),
    onSuccess: () => {
      setActionError(null)
      qc.invalidateQueries({ queryKey: ['journal', id] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setActionError(msg ?? 'Erreur lors de la validation.')
    },
  })

  const reopenMutation = useMutation({
    mutationFn: () => journalApi.reopen(id!),
    onSuccess: () => {
      setActionError(null)
      qc.invalidateQueries({ queryKey: ['journal', id] })
      qc.invalidateQueries({ queryKey: ['journals'] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setActionError(msg ?? 'Erreur lors de la réactivation.')
    },
  })

  const syncPumpsMutation = useMutation({
    mutationFn: () => journalApi.syncPumps(id!),
    onSuccess: (res) => {
      setActionError(null)
      qc.invalidateQueries({ queryKey: ['journal', id] })
      const added = res.data.added
      if (added === 0) setActionError('Aucune pompe manquante — le journal est déjà à jour.')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setActionError(msg ?? 'Erreur lors de la synchronisation.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => journalApi.deleteJournal(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journals'] })
      navigate('/journal')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setActionError(msg ?? 'Erreur lors de la suppression.')
    },
  })

  if (isLoading || !journal) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  const isManager = user?.role === 'manager' || user?.role === 'super_admin'
  const totalSales = journal.sales_recaps.reduce(
    (sum, r) => sum + parseFloat(r.daily_value_xof || '0'), 0
  )

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/journal')}
            className="rounded-full p-1.5 hover:bg-gray-100"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{journal.journal_number}</h1>
              <StatusBadge status={journal.status} />
            </div>
            <p className="text-sm text-gray-500">
              {new Date(journal.journal_date).toLocaleDateString('fr-FR', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              })}
              {' — '}{journal.station_name}
              {' — '}{journal.manager_name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {journal.status !== 'draft' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(journalApi.pdfUrl(id!), '_blank')}
            >
              <FileDown size={15} />
              PDF
            </Button>
          )}
          {journal.status === 'draft' && isManager && (
            <Button
              size="sm"
              onClick={() => closeMutation.mutate()}
              disabled={closeMutation.isPending}
            >
              <Lock size={15} />
              {closeMutation.isPending ? 'Clôture…' : 'Clôturer'}
            </Button>
          )}
          {journal.status === 'closed' && isManager && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => validateMutation.mutate()}
              disabled={validateMutation.isPending}
            >
              <CheckCircle size={15} />
              {validateMutation.isPending ? 'Validation…' : 'Valider'}
            </Button>
          )}
          {journal.status === 'draft' && isManager && (
            <Button
              size="sm"
              variant="outline"
              className="text-blue-600 border-blue-300 hover:bg-blue-50"
              onClick={() => {
                if (confirm(`Synchroniser les pompes du journal ${journal.journal_number} ?\n\nCela ajoute les pompes créées après l'ouverture du journal. Les données existantes ne sont pas modifiées.`))
                  syncPumpsMutation.mutate()
              }}
              disabled={syncPumpsMutation.isPending}
            >
              <RefreshCw size={15} />
              {syncPumpsMutation.isPending ? 'Sync…' : 'Sync. pompes'}
            </Button>
          )}
          {journal.status === 'draft' && user?.role === 'super_admin' && (
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 border-red-300 hover:bg-red-50"
              onClick={() => {
                if (confirm(`Supprimer définitivement le journal ${journal.journal_number} ?\n\nToutes les données saisies seront perdues. Cette action est irréversible.`))
                  deleteMutation.mutate()
              }}
              disabled={deleteMutation.isPending}
            >
              <Trash2 size={15} />
              {deleteMutation.isPending ? 'Suppression…' : 'Supprimer'}
            </Button>
          )}
          {(journal.status === 'validated' || journal.status === 'closed') && user?.role === 'super_admin' && (
            <Button
              size="sm"
              variant="outline"
              className="text-orange-600 border-orange-300 hover:bg-orange-50"
              onClick={() => {
                if (confirm(`Réactiver le journal ${journal.journal_number} ?\n\nCela efface la validation et remet le journal en brouillon pour correction.`))
                  reopenMutation.mutate()
              }}
              disabled={reopenMutation.isPending}
            >
              <RotateCcw size={15} />
              {reopenMutation.isPending ? 'Réactivation…' : 'Réactiver'}
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          {actionError}
        </div>
      )}

      {/* Résumé KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Pompes', value: journal.fuel_lines.length.toString(), unit: 'lignes' },
          { label: 'Lubrifiants', value: journal.lubricant_lines.length.toString(), unit: 'produits' },
          { label: 'Total ventes', value: formatXOF(totalSales), unit: '' },
          { label: 'Encaissé', value: journal.payment_summary ? formatXOF(journal.payment_summary.total_xof) : '—', unit: '' },
        ].map(({ label, value, unit }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
              <p className="text-xl font-bold mt-1">{value}</p>
              {unit && <p className="text-xs text-gray-400">{unit}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Section 1 — Carburant */}
      <FuelLinesSection
        lines={journal.fuel_lines}
        isEditable={journal.is_editable}
        journalId={id!}
      />

      {/* Section 2 — Lubrifiants */}
      <LubricantLinesSection
        lines={journal.lubricant_lines}
        isEditable={journal.is_editable}
        journalId={id!}
      />

      {/* Section Écarts jaugeage */}
      <EcartsSection
        fuelLines={journal.fuel_lines}
        totalAmount={journal.fuel_lines.reduce((s, l) => s + Number(l.amount_xof ?? 0), 0)}
      />

      {/* Section 3 — Récap ventes + encaissements + avoir + dépenses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SalesRecapSection
          recaps={journal.sales_recaps}
          isEditable={journal.is_editable}
          journalId={id!}
        />
        <PaymentSummarySection
          summary={journal.payment_summary}
          isEditable={journal.is_editable}
          journalId={id!}
          journalDate={journal.journal_date}
          stationId={journal.station}
        />
      </div>

      {/* Section Dépenses */}
      <DepensesSection
        journalId={id!}
        isEditable={journal.is_editable}
        expenses={journal.expenses ?? []}
        monthlyTotal={Number(journal.monthly_expenses_xof ?? 0)}
      />

      {/* Notes */}
      {journal.notes && (
        <Card>
          <CardHeader><CardTitle>Observations</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{journal.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Hash d'intégrité */}
      {journal.pdf_hash && (
        <p className="text-xs text-gray-400 font-mono break-all">
          Intégrité : {journal.pdf_hash}
        </p>
      )}
    </div>
  )
}
