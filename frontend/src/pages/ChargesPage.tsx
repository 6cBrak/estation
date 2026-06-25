import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Plus, CheckCircle, XCircle, Clock, Filter } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { useAuthStore } from '@/stores/auth'
import { chargesApi, CHARGE_CATEGORIES, CHARGE_PAYMENT_METHODS } from '@/api/charges'
import type { ChargeCreateInput } from '@/api/charges'
import { formatXOF, extractApiError } from '@/lib/utils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(s: string) {
  if (s === 'validated') return <Badge variant="success">Validée</Badge>
  if (s === 'rejected') return <Badge variant="destructive">Rejetée</Badge>
  return <Badge variant="warning">En attente</Badge>
}

function categoryLabel(c: string) {
  return CHARGE_CATEGORIES.find((x) => x.value === c)?.label ?? c
}

// ─── Formulaire de création ───────────────────────────────────────────────────

function ChargeForm({ onSubmit, onCancel, loading, error }: {
  onSubmit: (d: ChargeCreateInput) => void
  onCancel: () => void
  loading: boolean
  error?: string
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<ChargeCreateInput>({
    defaultValues: {
      charge_date: new Date().toISOString().split('T')[0],
      payment_method: 'cash',
      category: 'operational',
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <DialogBody className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Catégorie *</Label>
            <select
              {...register('category', { required: true })}
              className="w-full border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CHARGE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Date *</Label>
            <Input type="date" {...register('charge_date', { required: true })} />
          </div>
        </div>

        <div className="space-y-1">
          <Label>Libellé *</Label>
          <Input
            placeholder="Ex: Facture électricité SONABEL, salaire gardien…"
            {...register('label', { required: true })}
          />
          {errors.label && <p className="text-xs text-red-500">Obligatoire</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Montant (FCFA) *</Label>
            <Input
              type="number"
              step="1"
              min="1"
              placeholder="0"
              {...register('amount_xof', { required: true })}
            />
            {errors.amount_xof && <p className="text-xs text-red-500">Obligatoire</p>}
          </div>
          <div className="space-y-1">
            <Label>Mode de paiement</Label>
            <select
              {...register('payment_method')}
              className="w-full border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CHARGE_PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <Label>Référence / N° reçu</Label>
          <Input placeholder="Optionnel" {...register('reference')} />
        </div>

        <div className="space-y-1">
          <Label>Notes</Label>
          <Input placeholder="Commentaire libre" {...register('notes')} />
        </div>

        {error && <p className="text-xs text-red-500 bg-red-50 rounded p-2">{error}</p>}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" type="button" onClick={onCancel}>Annuler</Button>
        <Button type="submit" disabled={loading}>
          {loading ? <Spinner size="sm" /> : 'Enregistrer la dépense'}
        </Button>
      </DialogFooter>
    </form>
  )
}

// ─── Dialogue de validation / rejet ──────────────────────────────────────────

function ReviewDialog({ chargeId, onClose }: { chargeId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [action, setAction] = useState<'validate' | 'reject' | null>(null)
  const [reason, setReason] = useState('')
  const [err, setErr] = useState('')

  const reviewMut = useMutation({
    mutationFn: (data: { action: 'validate' | 'reject'; rejection_reason?: string }) =>
      chargesApi.review(chargeId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['charges'] }); onClose() },
    onError: (e) => setErr(extractApiError(e)),
  })

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Traiter la dépense</DialogTitle></DialogHeader>
      <DialogBody className="space-y-4">
        <div className="flex gap-3">
          <Button
            variant={action === 'validate' ? 'default' : 'outline'}
            className="flex-1 gap-2"
            onClick={() => setAction('validate')}
          >
            <CheckCircle size={15} /> Valider
          </Button>
          <Button
            variant={action === 'reject' ? 'destructive' : 'outline'}
            className="flex-1 gap-2"
            onClick={() => setAction('reject')}
          >
            <XCircle size={15} /> Rejeter
          </Button>
        </div>
        {action === 'reject' && (
          <div className="space-y-1">
            <Label>Motif du rejet *</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Expliquer pourquoi cette dépense est rejetée"
            />
          </div>
        )}
        {err && <p className="text-xs text-red-500 bg-red-50 rounded p-2">{err}</p>}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Annuler</Button>
        <Button
          disabled={!action || (action === 'reject' && !reason.trim()) || reviewMut.isPending}
          onClick={() => action && reviewMut.mutate({ action, rejection_reason: reason })}
        >
          {reviewMut.isPending ? <Spinner size="sm" /> : 'Confirmer'}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function ChargesPage() {
  const { user, currentStation } = useAuthStore()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  const isSuperAdmin = user?.role === 'super_admin'
  const isManager = user?.role === 'manager' || isSuperAdmin

  const params: Record<string, string> = {}
  if (filterStatus) params.status = filterStatus
  if (filterCategory) params.category = filterCategory
  if (filterDateFrom) params.date_from = filterDateFrom
  if (filterDateTo) params.date_to = filterDateTo
  if (currentStation?.id && isSuperAdmin) params.station = currentStation.id

  const { data, isLoading } = useQuery({
    queryKey: ['charges', params],
    queryFn: () => chargesApi.list(params).then((r) => r.data),
    enabled: !!user,
  })

  const createMut = useMutation({
    mutationFn: (d: ChargeCreateInput) => chargesApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['charges'] }); setShowCreate(false) },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => chargesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['charges'] }),
  })

  const charges = data?.results ?? []

  // Totaux résumé
  const totalPending = charges.filter((c) => c.status === 'pending').reduce((s, c) => s + parseFloat(c.amount_xof), 0)
  const totalValidated = charges.filter((c) => c.status === 'validated').reduce((s, c) => s + parseFloat(c.amount_xof), 0)

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Charges & Dépenses</h1>
          <p className="text-sm text-gray-500">
            {isSuperAdmin ? 'Toutes les stations' : currentStation?.name}
          </p>
        </div>
        {isManager && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={15} className="mr-1" /> Nouvelle dépense
          </Button>
        )}
      </div>

      {/* KPI rapides */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={14} className="text-orange-500" />
              <p className="text-xs text-gray-500 uppercase tracking-wide">En attente</p>
            </div>
            <p className="text-xl font-bold text-orange-600">{formatXOF(totalPending)}</p>
            <p className="text-xs text-gray-400">{charges.filter((c) => c.status === 'pending').length} dépense(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle size={14} className="text-green-500" />
              <p className="text-xs text-gray-500 uppercase tracking-wide">Validées</p>
            </div>
            <p className="text-xl font-bold text-green-700">{formatXOF(totalValidated)}</p>
            <p className="text-xs text-gray-400">{charges.filter((c) => c.status === 'validated').length} dépense(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total affiché</p>
            <p className="text-xl font-bold text-gray-800">
              {formatXOF(charges.reduce((s, c) => s + parseFloat(c.amount_xof), 0))}
            </p>
            <p className="text-xs text-gray-400">{charges.length} dépense(s)</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-400" />
            <CardTitle className="text-sm">Filtres</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tous les statuts</option>
              <option value="pending">En attente</option>
              <option value="validated">Validées</option>
              <option value="rejected">Rejetées</option>
            </select>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Toutes catégories</option>
              {CHARGE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <Input
              type="date"
              placeholder="Du"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
            />
            <Input
              type="date"
              placeholder="Au"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Liste */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Spinner size="lg" /></div>
          ) : charges.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">
              Aucune dépense enregistrée.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="px-4 py-3 font-medium text-gray-600">Date</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Catégorie</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Libellé</th>
                    {isSuperAdmin && <th className="px-4 py-3 font-medium text-gray-600">Station</th>}
                    <th className="px-4 py-3 font-medium text-gray-600">Paiement</th>
                    <th className="px-4 py-3 font-medium text-gray-600 text-right">Montant</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Statut</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Saisi par</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {charges.map((c) => (
                    <tr key={c.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(c.charge_date).toLocaleDateString('fr-FR', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                          {categoryLabel(c.category)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{c.label}</p>
                        {c.reference && (
                          <p className="text-xs text-gray-400">Réf: {c.reference}</p>
                        )}
                        {c.rejection_reason && (
                          <p className="text-xs text-red-500 mt-0.5">↳ {c.rejection_reason}</p>
                        )}
                      </td>
                      {isSuperAdmin && (
                        <td className="px-4 py-3 text-xs text-gray-500">{c.station_name}</td>
                      )}
                      <td className="px-4 py-3 text-xs text-gray-500">{c.payment_method_display}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">
                        {formatXOF(parseFloat(c.amount_xof))}
                      </td>
                      <td className="px-4 py-3">{statusBadge(c.status)}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{c.created_by_name}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          {isSuperAdmin && c.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => setReviewId(c.id)}
                            >
                              Traiter
                            </Button>
                          )}
                          {isManager && c.status === 'pending' && !isSuperAdmin && (
                            <button
                              onClick={() => deleteMut.mutate(c.id)}
                              className="text-xs text-red-400 hover:text-red-600"
                              disabled={deleteMut.isPending}
                            >
                              Supprimer
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal création */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nouvelle dépense</DialogTitle></DialogHeader>
          <ChargeForm
            onSubmit={(d) => createMut.mutate(d)}
            onCancel={() => setShowCreate(false)}
            loading={createMut.isPending}
            error={createMut.error ? extractApiError(createMut.error) : undefined}
          />
        </DialogContent>
      </Dialog>

      {/* Modal validation / rejet */}
      <Dialog open={!!reviewId} onOpenChange={(v) => !v && setReviewId(null)}>
        {reviewId && <ReviewDialog chargeId={reviewId} onClose={() => setReviewId(null)} />}
      </Dialog>
    </div>
  )
}
