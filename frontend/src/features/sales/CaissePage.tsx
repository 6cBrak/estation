import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useAuthStore } from '@/stores/auth'
import { salesApi } from '@/api/sales'
import type { CashSession, SaleItemInput, SalePaymentInput } from '@/api/sales'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { ShoppingCart, Lock, CheckCircle, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import { formatXOF, extractApiError } from '@/lib/utils'
import POSTerminal from './POSTerminal'

interface CloseFormData {
  counted_cash_xof: string
  notes: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusVariant(s: string) {
  if (s === 'open') return 'success'
  if (s === 'closed') return 'warning'
  return 'default'
}

function statusLabel(s: string) {
  if (s === 'open') return 'Ouverte'
  if (s === 'closed') return 'Clôturée'
  return 'Validée'
}

// ─── Session row (vue manager) ────────────────────────────────────────────────

function SessionRow({ session, onValidate, validating }: {
  session: CashSession
  onValidate: (id: string) => void
  validating: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [sessionId] = useState(session.id)

  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ['sales', sessionId],
    queryFn: () => salesApi.listSales({ session: sessionId }).then((r) => r.data),
    enabled: expanded,
  })

  const sales = salesData?.results ?? []
  const completed = sales.filter((s) => s.status === 'completed')

  return (
    <div className="border-b last:border-0">
      <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-gray-400">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <span className="text-sm font-medium flex-1">{session.cashier_name}</span>
        <span className="text-xs text-gray-400">
          {new Date(session.opened_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className="text-sm font-semibold text-blue-700 w-28 text-right">
          {formatXOF(parseFloat(session.total_sales_xof))}
        </span>
        <Badge variant={statusVariant(session.status) as 'success' | 'warning' | 'default'}>
          {statusLabel(session.status)}
        </Badge>
        {session.status === 'closed' && (
          <Button
            size="sm"
            onClick={(e) => { e.stopPropagation(); onValidate(session.id) }}
            disabled={validating}
            className="h-7 text-xs"
          >
            {validating ? <Spinner size="sm" /> : <><CheckCircle size={12} className="mr-1" /> Valider</>}
          </Button>
        )}
        {session.status === 'open' && (
          <span className="w-20 text-right text-xs text-gray-400">—</span>
        )}
        {session.status === 'validated' && (
          <span className="w-20 text-right text-xs text-green-600">✓ Validée</span>
        )}
      </div>

      {expanded && (
        <div className="bg-gray-50 px-8 pb-3">
          {/* Infos clôture */}
          {session.status !== 'open' && (
            <div className="flex gap-6 text-xs text-gray-500 mb-2 pt-2">
              <span>Espèces attendues : <strong>{formatXOF(parseFloat(session.cash_expected_xof))}</strong></span>
              {session.counted_cash_xof && (
                <span>Comptées : <strong>{formatXOF(parseFloat(session.counted_cash_xof))}</strong></span>
              )}
              {session.variance_xof !== null && (
                <span className={parseFloat(session.variance_xof) !== 0 ? 'text-red-600' : 'text-green-600'}>
                  Écart : <strong>{parseFloat(session.variance_xof) >= 0 ? '+' : ''}{formatXOF(parseFloat(session.variance_xof))}</strong>
                </span>
              )}
            </div>
          )}

          {/* Liste des ventes */}
          {salesLoading ? (
            <div className="flex justify-center py-4"><Spinner /></div>
          ) : sales.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">Aucune vente dans cette session.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b">
                  <th className="pb-1 text-left">N° Vente</th>
                  <th className="pb-1 text-left">Heure</th>
                  <th className="pb-1 text-left">Articles</th>
                  <th className="pb-1 text-right">Total</th>
                  <th className="pb-1">Statut</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale.id} className="border-b border-gray-100">
                    <td className="py-1 font-mono">{sale.sale_number}</td>
                    <td className="py-1 text-gray-400">
                      {new Date(sale.sold_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-1 text-gray-500">
                      {sale.items.map((it) => `${it.label} ×${it.quantity}`).join(', ')}
                    </td>
                    <td className="py-1 text-right font-semibold">{formatXOF(parseFloat(sale.total_xof))}</td>
                    <td className="py-1 text-center">
                      <Badge variant={sale.status === 'completed' ? 'success' : 'destructive'}>
                        {sale.status === 'completed' ? 'OK' : 'Ann.'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="pt-2 text-gray-500 text-xs">{completed.length} vente(s) complétée(s)</td>
                  <td className="pt-2 text-right font-bold text-blue-700">
                    {formatXOF(completed.reduce((s, v) => s + parseFloat(v.total_xof), 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function CaissePage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [showNewSale, setShowNewSale] = useState(false)
  const [showClose, setShowClose] = useState(false)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  const today = new Date().toISOString().split('T')[0]
  const isManager = user?.role === 'super_admin' || user?.role === 'manager'

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ['cash-sessions'],
    queryFn: () => salesApi.listSessions().then((r) => r.data),
  })

  const sessions = sessionsData?.results ?? []
  const myOpenSession = sessions.find((s) => s.cashier === user?.id && s.status === 'open')
  const myClosedSession = sessions.find((s) => s.cashier === user?.id && s.status === 'closed')
  const activeSession = myOpenSession ?? myClosedSession ?? null

  // Synchroniser l'ID de session pour la requête des ventes du caissier
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  useEffect(() => {
    if (activeSession?.id && activeSession.id !== activeSessionId) {
      setActiveSessionId(activeSession.id)
    }
  }, [activeSession?.id])

  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ['sales', activeSessionId],
    queryFn: () => salesApi.listSales({ session: activeSessionId! }).then((r) => r.data),
    enabled: !!activeSessionId && !isManager,
  })

  const openMut = useMutation({
    mutationFn: (data: { opening_amount_xof: string }) => salesApi.openSession(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cash-sessions'] }),
  })

  const closeMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CloseFormData }) =>
      salesApi.closeSession(id, { counted_cash_xof: data.counted_cash_xof, notes: data.notes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cash-sessions'] }); setShowClose(false) },
  })

  const validateMut = useMutation({
    mutationFn: (id: string) => salesApi.validateSession(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cash-sessions'] }),
  })

  const saleMut = useMutation({
    mutationFn: (data: { items: SaleItemInput[]; payments: SalePaymentInput[] }) =>
      salesApi.createSale(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales', activeSessionId] })
      qc.invalidateQueries({ queryKey: ['cash-sessions'] })
      setShowNewSale(false)
    },
  })

  const cancelMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      salesApi.cancelSale(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales', activeSessionId] })
      qc.invalidateQueries({ queryKey: ['cash-sessions'] })
      setCancelId(null)
      setCancelReason('')
    },
  })

  if (sessionsLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  if (!user?.station && !isManager) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">Caisse</h1>
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            <AlertTriangle size={32} className="mx-auto mb-3 text-yellow-500" />
            <p className="font-medium">Aucune station assignée à votre compte.</p>
            <p className="text-sm mt-1">Contactez votre administrateur.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const sales = salesData?.results ?? []
  const completedSales = sales.filter((s) => s.status === 'completed')

  // Statistiques résumées pour managers
  const openSessions = sessions.filter((s) => s.status === 'open')
  const closedSessions = sessions.filter((s) => s.status === 'closed')
  const totalRevenu = sessions
    .filter((s) => s.status !== 'open')
    .reduce((acc, s) => acc + parseFloat(s.total_sales_xof), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Caisse</h1>
        <span className="text-sm text-gray-400">
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
      </div>

      {/* ── VUE MANAGER : résumé + toutes les sessions ── */}
      {isManager && (
        <>
          {/* KPI rapides */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Sessions ouvertes</p>
                <p className="text-2xl font-bold text-orange-500 mt-1">{openSessions.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide">À valider</p>
                <p className="text-2xl font-bold text-blue-700 mt-1">{closedSessions.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Total encaissé (clôturées)</p>
                <p className="text-2xl font-bold text-green-700 mt-1">{formatXOF(totalRevenu)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Liste de toutes les sessions */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Sessions du jour</CardTitle>
                <span className="text-xs text-gray-400">{sessions.length} session(s)</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {sessions.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Aucune session ouverte aujourd'hui.</p>
              ) : (
                <>
                  {/* Entête tableau */}
                  <div className="flex items-center gap-3 px-4 py-2 border-b bg-gray-50 text-xs font-medium text-gray-500">
                    <span className="w-4" />
                    <span className="flex-1">Caissier</span>
                    <span className="text-right w-16">Heure</span>
                    <span className="text-right w-28">Total ventes</span>
                    <span className="w-20 text-center">Statut</span>
                    <span className="w-20" />
                  </div>
                  {sessions.map((s) => (
                    <SessionRow
                      key={s.id}
                      session={s}
                      onValidate={(id) => validateMut.mutate(id)}
                      validating={validateMut.isPending && validateMut.variables === s.id}
                    />
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ── VUE CAISSIER : sa propre session ── */}
      {!isManager && (
        <>
          <SessionCard
            session={activeSession}
            onOpen={(amount) => openMut.mutate({ opening_amount_xof: amount })}
            onOpenLoading={openMut.isPending}
            onOpenError={openMut.error ? extractApiError(openMut.error) : undefined}
            onClose={() => setShowClose(true)}
          />

          {activeSession && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-medium text-gray-800">
                  Ventes de la session
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({completedSales.length} vente{completedSales.length > 1 ? 's' : ''} — {formatXOF(completedSales.reduce((s, v) => s + parseFloat(v.total_xof), 0))})
                  </span>
                </h2>
                {activeSession.status === 'open' && (
                  <Button size="sm" onClick={() => setShowNewSale(true)}>
                    <ShoppingCart size={14} className="mr-1" /> Nouvelle vente
                  </Button>
                )}
              </div>

              <Card>
                {salesLoading ? (
                  <div className="flex justify-center py-8"><Spinner /></div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-left">
                        <th className="px-4 py-3 font-medium text-gray-600">N° Vente</th>
                        <th className="px-4 py-3 font-medium text-gray-600">Heure</th>
                        <th className="px-4 py-3 font-medium text-gray-600">Articles</th>
                        <th className="px-4 py-3 font-medium text-gray-600 text-right">Total</th>
                        <th className="px-4 py-3 font-medium text-gray-600">Statut</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {sales.map((sale) => (
                        <tr key={sale.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-xs">{sale.sale_number}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {new Date(sale.sold_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">
                            {sale.items.map((it) => `${it.label} ×${it.quantity}`).join(', ')}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">
                            {formatXOF(parseFloat(sale.total_xof))}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={sale.status === 'completed' ? 'success' : 'destructive'}>
                              {sale.status === 'completed' ? 'Complétée' : 'Annulée'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {sale.status === 'completed' && activeSession.status === 'open' && (
                              <button
                                onClick={() => setCancelId(sale.id)}
                                className="text-red-400 hover:text-red-600 text-xs"
                              >
                                Annuler
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {sales.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                            Aucune vente dans cette session.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </Card>
            </div>
          )}
        </>
      )}

      {/* ── Modals ── */}
      <Dialog open={showNewSale} onOpenChange={setShowNewSale}>
        <DialogContent className="max-w-5xl">
          <DialogHeader><DialogTitle>Nouvelle vente</DialogTitle></DialogHeader>
          <POSTerminal
            onSubmit={(d) => saleMut.mutate(d)}
            onCancel={() => setShowNewSale(false)}
            loading={saleMut.isPending}
            error={saleMut.error ? extractApiError(saleMut.error) : undefined}
          />
        </DialogContent>
      </Dialog>

      {activeSession && !isManager && (
        <Dialog open={showClose} onOpenChange={setShowClose}>
          <DialogContent>
            <DialogHeader><DialogTitle>Clôturer la session</DialogTitle></DialogHeader>
            <CloseSessionForm
              session={activeSession}
              onSubmit={(d) => closeMut.mutate({ id: activeSession.id, data: d })}
              onCancel={() => setShowClose(false)}
              loading={closeMut.isPending}
              error={closeMut.error ? extractApiError(closeMut.error) : undefined}
            />
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={!!cancelId} onOpenChange={(v) => !v && setCancelId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Annuler la vente</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <p className="text-sm text-gray-600">Motif d'annulation (obligatoire) :</p>
            <Input
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Motif d'annulation"
            />
            {cancelMut.error && <p className="text-xs text-red-500">{extractApiError(cancelMut.error)}</p>}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCancelId(null); setCancelReason('') }}>Annuler</Button>
            <Button
              variant="destructive"
              disabled={!cancelReason.trim() || cancelMut.isPending}
              onClick={() => cancelId && cancelMut.mutate({ id: cancelId, reason: cancelReason })}
            >
              {cancelMut.isPending ? <Spinner size="sm" /> : "Confirmer l'annulation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Session Card (vue caissier) ──────────────────────────────────────────────

function SessionCard({ session, onOpen, onOpenLoading, onOpenError, onClose }: {
  session: CashSession | null
  onOpen: (amount: string) => void
  onOpenLoading: boolean
  onOpenError?: string
  onClose: () => void
}) {
  const [openAmount, setOpenAmount] = useState('0')

  if (!session) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-800">Aucune session ouverte</p>
              <p className="text-sm text-gray-500 mt-1">Ouvrez une session pour commencer à enregistrer des ventes.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Fonds de caisse (FCFA)</Label>
                <Input
                  type="number"
                  step="500"
                  value={openAmount}
                  onChange={(e) => setOpenAmount(e.target.value)}
                  className="w-36 h-8 text-sm"
                />
              </div>
              <Button onClick={() => onOpen(openAmount)} disabled={onOpenLoading} className="mt-5">
                {onOpenLoading ? <Spinner size="sm" /> : 'Ouvrir la session'}
              </Button>
            </div>
          </div>
          {onOpenError && <p className="text-xs text-red-500 mt-2">{onOpenError}</p>}
        </CardContent>
      </Card>
    )
  }

  const sv = statusVariant(session.status) as 'success' | 'warning' | 'default'
  const sl = statusLabel(session.status)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Ma session de caisse</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={sv}>{sl}</Badge>
            {session.status === 'open' && (
              <Button size="sm" variant="outline" onClick={onClose}>
                <Lock size={13} className="mr-1" /> Clôturer
              </Button>
            )}
            {session.status === 'closed' && (
              <span className="text-xs text-gray-500 italic">En attente de validation par le gérant</span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500">Caissier</p>
            <p className="font-medium text-sm">{session.cashier_name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Ouverture</p>
            <p className="font-medium text-sm">
              {new Date(session.opened_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Fonds ouverture</p>
            <p className="font-medium text-sm">{formatXOF(parseFloat(session.opening_amount_xof))}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Total ventes</p>
            <p className="font-semibold text-sm text-blue-700">{formatXOF(parseFloat(session.total_sales_xof))}</p>
          </div>
          {session.status !== 'open' && (
            <>
              <div>
                <p className="text-xs text-gray-500">Espèces attendues</p>
                <p className="font-medium text-sm">{formatXOF(parseFloat(session.cash_expected_xof))}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Espèces comptées</p>
                <p className="font-medium text-sm">
                  {session.counted_cash_xof ? formatXOF(parseFloat(session.counted_cash_xof)) : '—'}
                </p>
              </div>
              {session.variance_xof !== null && (
                <div>
                  <p className="text-xs text-gray-500">Écart</p>
                  <p className={`font-semibold text-sm flex items-center gap-1 ${parseFloat(session.variance_xof) !== 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {parseFloat(session.variance_xof) !== 0 && <AlertTriangle size={12} />}
                    {formatXOF(parseFloat(session.variance_xof))}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Close Session Form ───────────────────────────────────────────────────────

function CloseSessionForm({ session, onSubmit, onCancel, loading, error }: {
  session: CashSession
  onSubmit: (d: CloseFormData) => void
  onCancel: () => void
  loading: boolean
  error?: string
}) {
  const { register, handleSubmit } = useForm<CloseFormData>({
    defaultValues: { counted_cash_xof: session.cash_expected_xof, notes: '' },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <DialogBody className="space-y-4">
        <div className="bg-gray-50 rounded p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-600">Total ventes</span>
            <span className="font-medium">{formatXOF(parseFloat(session.total_sales_xof))}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Espèces attendues</span>
            <span className="font-medium">{formatXOF(parseFloat(session.cash_expected_xof))}</span>
          </div>
        </div>
        <div className="space-y-1">
          <Label>Espèces comptées (FCFA) *</Label>
          <Input type="number" step="any" {...register('counted_cash_xof', { required: true })} />
        </div>
        <div className="space-y-1">
          <Label>Notes / commentaire</Label>
          <Input {...register('notes')} placeholder="Écart constaté, explication…" />
        </div>
        {error && <p className="text-xs text-red-500 bg-red-50 rounded p-2">{error}</p>}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" type="button" onClick={onCancel}>Annuler</Button>
        <Button type="submit" disabled={loading}>
          {loading ? <Spinner size="sm" /> : 'Clôturer la session'}
        </Button>
      </DialogFooter>
    </form>
  )
}
