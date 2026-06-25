import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { useAuthStore } from '@/stores/auth'
import { suppliersApi } from '@/api/suppliers'
import type { PurchaseOrder } from '@/api/suppliers'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { Plus, Trash2, Send, XCircle, CheckCircle, Eye } from 'lucide-react'
import { cn, formatXOF, formatDate, extractApiError, unwrapList } from '@/lib/utils'
import type { Supplier } from '@/api/suppliers'
import { fuelApi } from '@/api/fuel'
import type { FuelType } from '@/api/fuel'

const TABS = [
  { id: 'suppliers', label: 'Fournisseurs' },
  { id: 'orders', label: 'Bons de commande' },
  { id: 'deliveries', label: 'Livraisons' },
] as const
type Tab = typeof TABS[number]['id']

const SUPPLIER_CATEGORIES = [
  { value: 'fuel', label: 'Carburant' },
  { value: 'lubricant', label: 'Lubrifiants' },
  { value: 'shop', label: 'Boutique' },
  { value: 'gas', label: 'Gaz' },
  { value: 'other', label: 'Autre' },
]

const ITEM_TYPES = [
  { value: 'fuel', label: 'Carburant' },
  { value: 'lubricant', label: 'Lubrifiant' },
  { value: 'shop', label: 'Boutique' },
  { value: 'gas', label: 'Gaz' },
  { value: 'other', label: 'Autre' },
]

const ORDER_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'warning' | 'success' | 'destructive'> = {
  draft: 'secondary',
  sent: 'warning',
  partial: 'warning',
  received: 'success',
  cancelled: 'destructive',
}

const DELIVERY_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'destructive'> = {
  pending: 'secondary',
  confirmed: 'success',
  cancelled: 'destructive',
}

export default function SuppliersPage() {
  const [activeTab, setActiveTab] = useState<Tab>('suppliers')

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Fournisseurs</h1>

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

      {activeTab === 'suppliers' && <SuppliersList />}
      {activeTab === 'orders' && <OrdersList />}
      {activeTab === 'deliveries' && <DeliveriesList />}
    </div>
  )
}

// ─── Fournisseurs ─────────────────────────────────────────────────────────────

function SuppliersList() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => suppliersApi.listSuppliers().then((r) => r.data),
  })

  const createMut = useMutation({
    mutationFn: (d: Omit<Supplier, 'id' | 'is_active' | 'category_display'>) =>
      suppliersApi.createSupplier(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); setShowCreate(false) },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Supplier> }) =>
      suppliersApi.updateSupplier(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); setEditSupplier(null) },
  })

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>

  const suppliers = data?.results ?? []

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{suppliers.length} fournisseur(s)</p>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={14} className="mr-1" /> Nouveau fournisseur
        </Button>
      </div>
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left">
              <th className="px-4 py-3 font-medium text-gray-600">Code</th>
              <th className="px-4 py-3 font-medium text-gray-600">Nom</th>
              <th className="px-4 py-3 font-medium text-gray-600">Catégorie</th>
              <th className="px-4 py-3 font-medium text-gray-600">Contact</th>
              <th className="px-4 py-3 font-medium text-gray-600">Téléphone</th>
              <th className="px-4 py-3 font-medium text-gray-600">Statut</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">{s.code}</td>
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-gray-500">{s.category_display ?? s.category}</td>
                <td className="px-4 py-3 text-gray-600">{s.contact_name || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{s.phone || '—'}</td>
                <td className="px-4 py-3">
                  <Badge variant={s.is_active ? 'success' : 'secondary'}>
                    {s.is_active ? 'Actif' : 'Inactif'}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => setEditSupplier(s)} className="text-gray-400 hover:text-blue-600">
                    <Eye size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {suppliers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Aucun fournisseur enregistré.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau fournisseur</DialogTitle></DialogHeader>
          <SupplierForm
            onSubmit={(d) => createMut.mutate(d)}
            onCancel={() => setShowCreate(false)}
            loading={createMut.isPending}
            error={createMut.error ? extractApiError(createMut.error) : undefined}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editSupplier} onOpenChange={(v) => !v && setEditSupplier(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier fournisseur</DialogTitle></DialogHeader>
          {editSupplier && (
            <SupplierForm
              initial={editSupplier}
              onSubmit={(d) => updateMut.mutate({ id: editSupplier.id, data: d })}
              onCancel={() => setEditSupplier(null)}
              loading={updateMut.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SupplierForm({ initial, onSubmit, onCancel, loading, error }: {
  initial?: Supplier
  onSubmit: (d: Omit<Supplier, 'id' | 'is_active' | 'category_display'>) => void
  onCancel: () => void
  loading: boolean
  error?: string
}) {
  const { register, handleSubmit } = useForm({
    defaultValues: initial ?? { code: '', name: '', category: 'fuel', contact_name: '', phone: '', email: '', address: '' },
  })
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <DialogBody className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Code</Label>
            <Input {...register('code', { required: true })} placeholder="TOTAL-BF" />
          </div>
          <div className="space-y-1">
            <Label>Catégorie</Label>
            <Select {...register('category', { required: true })}>
              {SUPPLIER_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label>Nom</Label>
          <Input {...register('name', { required: true })} placeholder="Total Burkina" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Nom du contact</Label>
            <Input {...register('contact_name')} />
          </div>
          <div className="space-y-1">
            <Label>Téléphone</Label>
            <Input {...register('phone')} />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Email</Label>
          <Input {...register('email')} type="email" />
        </div>
        <div className="space-y-1">
          <Label>Adresse</Label>
          <Input {...register('address')} />
        </div>
        {error && <p className="text-xs text-red-500 bg-red-50 rounded p-2">{error}</p>}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" type="button" onClick={onCancel}>Annuler</Button>
        <Button type="submit" disabled={loading}>{loading ? <Spinner size="sm" /> : initial ? 'Enregistrer' : 'Créer'}</Button>
      </DialogFooter>
    </form>
  )
}

// ─── Bons de commande ─────────────────────────────────────────────────────────

interface OrderFormData {
  supplier: string
  ordered_at: string
  expected_delivery_date: string
  notes: string
  items: { item_type: string; description: string; quantity: string; unit: string; unit_price_xof: string }[]
}

function OrdersList() {
  const qc = useQueryClient()
  const { currentStation } = useAuthStore()
  const [showCreate, setShowCreate] = useState(false)

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => suppliersApi.listSuppliers().then((r) => r.data),
  })
  const suppliers = suppliersData?.results ?? []

  const { data, isLoading } = useQuery({
    queryKey: ['orders', currentStation?.id],
    queryFn: () => suppliersApi.listOrders(
      currentStation?.id ? { station: currentStation.id } : undefined
    ).then((r) => r.data),
  })

  const createMut = useMutation({
    mutationFn: (d: Omit<PurchaseOrder, 'id' | 'order_number' | 'status' | 'total_xof' | 'sent_at' | 'station_name' | 'supplier_name' | 'status_display'>) =>
      suppliersApi.createOrder(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); setShowCreate(false) },
  })

  const sendMut = useMutation({
    mutationFn: (id: string) => suppliersApi.sendOrder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  })

  const cancelMut = useMutation({
    mutationFn: (id: string) => suppliersApi.cancelOrder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  })

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>

  const orders = data?.results ?? []

  const handleCreateSubmit = (d: OrderFormData) => {
    if (!currentStation) return
    createMut.mutate({
      station: currentStation.id,
      supplier: d.supplier,
      ordered_at: d.ordered_at,
      expected_delivery_date: d.expected_delivery_date || null,
      notes: d.notes,
      items: d.items.map((item) => ({
        item_type: item.item_type,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit || 'unité',
        unit_price_xof: item.unit_price_xof,
      })),
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{orders.length} commande(s)</p>
        <Button size="sm" onClick={() => setShowCreate(true)} disabled={!currentStation}>
          <Plus size={14} className="mr-1" /> Nouveau BC
        </Button>
      </div>
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left">
              <th className="px-4 py-3 font-medium text-gray-600">N° Bon</th>
              <th className="px-4 py-3 font-medium text-gray-600">Fournisseur</th>
              <th className="px-4 py-3 font-medium text-gray-600">Date</th>
              <th className="px-4 py-3 font-medium text-gray-600">Livraison prévue</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Montant</th>
              <th className="px-4 py-3 font-medium text-gray-600">Statut</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">{order.order_number}</td>
                <td className="px-4 py-3">{order.supplier_name}</td>
                <td className="px-4 py-3 text-gray-600">{formatDate(order.ordered_at)}</td>
                <td className="px-4 py-3 text-gray-600">
                  {order.expected_delivery_date ? formatDate(order.expected_delivery_date) : '—'}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {order.total_xof ? formatXOF(Number(order.total_xof)) : '—'}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={ORDER_STATUS_VARIANT[order.status] ?? 'secondary'}>
                    {order.status_display ?? order.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {order.status === 'draft' && (
                      <>
                        <button
                          onClick={() => sendMut.mutate(order.id)}
                          className="text-blue-500 hover:text-blue-700"
                          title="Envoyer la commande"
                        >
                          <Send size={14} />
                        </button>
                        <button
                          onClick={() => { if (confirm('Annuler cette commande ?')) cancelMut.mutate(order.id) }}
                          className="text-red-400 hover:text-red-600"
                          title="Annuler"
                        >
                          <XCircle size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Aucun bon de commande trouvé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Nouveau bon de commande</DialogTitle></DialogHeader>
          <OrderForm
            suppliers={suppliers}
            onSubmit={handleCreateSubmit}
            onCancel={() => setShowCreate(false)}
            loading={createMut.isPending}
            error={createMut.error ? extractApiError(createMut.error) : undefined}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function OrderForm({ suppliers, onSubmit, onCancel, loading, error }: {
  suppliers: Supplier[]
  onSubmit: (d: OrderFormData) => void
  onCancel: () => void
  loading: boolean
  error?: string
}) {
  const today = new Date().toISOString().split('T')[0]
  const { register, handleSubmit, control } = useForm<OrderFormData>({
    defaultValues: {
      supplier: '',
      ordered_at: today,
      expected_delivery_date: '',
      notes: '',
      items: [{ item_type: 'fuel', description: '', quantity: '', unit: 'L', unit_price_xof: '' }],
    },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <DialogBody className="space-y-4 max-h-[60vh] overflow-y-auto">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1 col-span-2">
            <Label>Fournisseur *</Label>
            <Select {...register('supplier', { required: true })}>
              <option value="">— Sélectionner —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Date de commande *</Label>
            <Input type="date" {...register('ordered_at', { required: true })} />
          </div>
          <div className="space-y-1">
            <Label>Date de livraison prévue</Label>
            <Input type="date" {...register('expected_delivery_date')} />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Notes</Label>
          <Input {...register('notes')} placeholder="Remarques éventuelles" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Lignes de commande</Label>
            <Button
              type="button" size="sm" variant="outline"
              onClick={() => append({ item_type: 'fuel', description: '', quantity: '', unit: 'L', unit_price_xof: '' })}
            >
              <Plus size={12} className="mr-1" /> Ajouter une ligne
            </Button>
          </div>
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-2 text-left font-medium text-gray-600">Type</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-600">Description</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-600">Qté</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-600">Unité</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-600">P.U. (FCFA)</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, i) => (
                  <tr key={field.id} className="border-t">
                    <td className="px-2 py-1">
                      <Select {...register(`items.${i}.item_type`)} className="h-7 text-xs">
                        {ITEM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </Select>
                    </td>
                    <td className="px-2 py-1">
                      <Input {...register(`items.${i}.description`, { required: true })} className="h-7 text-xs" placeholder="Description" />
                    </td>
                    <td className="px-2 py-1">
                      <Input type="number" step="0.001" {...register(`items.${i}.quantity`, { required: true })} className="h-7 w-20 text-xs" />
                    </td>
                    <td className="px-2 py-1">
                      <Input {...register(`items.${i}.unit`)} className="h-7 w-16 text-xs" placeholder="L" />
                    </td>
                    <td className="px-2 py-1">
                      <Input type="number" step="1" {...register(`items.${i}.unit_price_xof`)} className="h-7 w-24 text-xs" />
                    </td>
                    <td className="px-2 py-1">
                      {fields.length > 1 && (
                        <button type="button" onClick={() => remove(i)} className="text-red-400 hover:text-red-600">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {error && <p className="text-xs text-red-500 bg-red-50 rounded p-2">{error}</p>}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" type="button" onClick={onCancel}>Annuler</Button>
        <Button type="submit" disabled={loading}>
          {loading ? <Spinner size="sm" /> : 'Créer le BC'}
        </Button>
      </DialogFooter>
    </form>
  )
}

// ─── Livraisons ───────────────────────────────────────────────────────────────

interface DeliveryFormData {
  supplier: string
  purchase_order: string
  delivered_at: string
  tank_level_before: string
  tank_level_after: string
  notes: string
  items: { item_type: string; description: string; ordered_quantity: string; received_quantity: string; unit_price_xof: string; fuel_type?: string }[]
}

function DeliveriesList() {
  const qc = useQueryClient()
  const { currentStation } = useAuthStore()
  const [showCreate, setShowCreate] = useState(false)

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => suppliersApi.listSuppliers().then((r) => r.data),
  })
  const suppliers = suppliersData?.results ?? []

  const { data: ordersData } = useQuery({
    queryKey: ['orders', currentStation?.id],
    queryFn: () => suppliersApi.listOrders(
      currentStation?.id ? { station: currentStation.id } : undefined
    ).then((r) => r.data),
  })
  const sentOrders = (ordersData?.results ?? []).filter((o) => o.status === 'sent' || o.status === 'partial')

  const { data: fuelTypesRaw } = useQuery({
    queryKey: ['fuel-types'],
    queryFn: () => fuelApi.listTypes().then((r) => unwrapList<FuelType>(r.data)),
  })
  const fuelTypes = fuelTypesRaw ?? []

  const { data, isLoading } = useQuery({
    queryKey: ['deliveries', currentStation?.id],
    queryFn: () => suppliersApi.listDeliveries(
      currentStation?.id ? { station: currentStation.id } : undefined
    ).then((r) => r.data),
  })

  const createMut = useMutation({
    mutationFn: (d: Parameters<typeof suppliersApi.createDelivery>[0]) =>
      suppliersApi.createDelivery(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deliveries'] }); setShowCreate(false) },
  })

  const confirmMut = useMutation({
    mutationFn: (id: string) => suppliersApi.confirmDelivery(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deliveries'] }),
  })

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>

  const deliveries = data?.results ?? []

  const handleCreateSubmit = (d: DeliveryFormData) => {
    if (!currentStation) return
    createMut.mutate({
      station: currentStation.id,
      supplier: d.supplier,
      purchase_order: d.purchase_order || undefined,
      delivered_at: d.delivered_at,
      tank_level_before: d.tank_level_before || null,
      tank_level_after: d.tank_level_after || null,
      notes: d.notes,
      items: d.items.map((item) => ({
        item_type: item.item_type,
        description: item.description,
        ordered_quantity: item.ordered_quantity || '0',
        received_quantity: item.received_quantity,
        unit_price_xof: item.unit_price_xof || '0',
        fuel_type: item.item_type === 'fuel' ? (item.fuel_type || null) : null,
      })),
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{deliveries.length} livraison(s)</p>
        <Button size="sm" onClick={() => setShowCreate(true)} disabled={!currentStation}>
          <Plus size={14} className="mr-1" /> Nouvelle livraison
        </Button>
      </div>
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left">
              <th className="px-4 py-3 font-medium text-gray-600">N° Livraison</th>
              <th className="px-4 py-3 font-medium text-gray-600">Fournisseur</th>
              <th className="px-4 py-3 font-medium text-gray-600">Date livraison</th>
              <th className="px-4 py-3 font-medium text-gray-600">BC associé</th>
              <th className="px-4 py-3 font-medium text-gray-600">Statut</th>
              <th className="px-4 py-3 font-medium text-gray-600">Confirmé par</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {deliveries.map((delivery) => (
              <tr key={delivery.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">{delivery.delivery_number}</td>
                <td className="px-4 py-3">{delivery.supplier_name}</td>
                <td className="px-4 py-3 text-gray-600">{formatDate(delivery.delivered_at)}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">
                  {(delivery as unknown as { purchase_order_number?: string }).purchase_order_number ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={DELIVERY_STATUS_VARIANT[delivery.status] ?? 'secondary'}>
                    {delivery.status_display ?? delivery.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">
                  {(delivery as unknown as { confirmed_by_name?: string }).confirmed_by_name ?? '—'}
                  {(delivery as unknown as { confirmed_at?: string }).confirmed_at && (
                    <span className="text-gray-400 ml-1">
                      ({formatDate((delivery as unknown as { confirmed_at: string }).confirmed_at)})
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {delivery.status === 'pending' && (
                    <Button
                      size="sm"
                      onClick={() => { if (confirm('Confirmer la livraison et mettre à jour les stocks ?')) confirmMut.mutate(delivery.id) }}
                      disabled={confirmMut.isPending}
                      className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1"
                    >
                      <CheckCircle size={13} className="mr-1" />
                      {confirmMut.isPending ? 'En cours…' : 'Confirmer'}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {deliveries.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Aucune livraison enregistrée.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Enregistrer une livraison</DialogTitle></DialogHeader>
          <DeliveryForm
            suppliers={suppliers}
            sentOrders={sentOrders}
            fuelTypes={fuelTypes}
            onSubmit={handleCreateSubmit}
            onCancel={() => setShowCreate(false)}
            loading={createMut.isPending}
            error={createMut.error ? extractApiError(createMut.error) : undefined}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DeliveryForm({ suppliers, sentOrders, fuelTypes, onSubmit, onCancel, loading, error }: {
  suppliers: Supplier[]
  sentOrders: PurchaseOrder[]
  fuelTypes: FuelType[]
  onSubmit: (d: DeliveryFormData) => void
  onCancel: () => void
  loading: boolean
  error?: string
}) {
  const today = new Date().toISOString().split('T')[0]
  const { register, handleSubmit, control, watch } = useForm<DeliveryFormData>({
    defaultValues: {
      supplier: '',
      purchase_order: '',
      delivered_at: today,
      tank_level_before: '',
      tank_level_after: '',
      notes: '',
      items: [{ item_type: 'fuel', description: '', ordered_quantity: '', received_quantity: '', unit_price_xof: '', fuel_type: '' }],
    },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchedItems = watch('items')

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <DialogBody className="space-y-4 max-h-[60vh] overflow-y-auto">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1 col-span-2">
            <Label>Fournisseur *</Label>
            <Select {...register('supplier', { required: true })}>
              <option value="">— Sélectionner —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Date de livraison *</Label>
            <Input type="date" {...register('delivered_at', { required: true })} />
          </div>
          <div className="space-y-1">
            <Label>BC associé (optionnel)</Label>
            <Select {...register('purchase_order')}>
              <option value="">— Aucun —</option>
              {sentOrders.map((o) => <option key={o.id} value={o.id}>{o.order_number}</option>)}
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Niveau cuve avant (L)</Label>
            <Input type="number" step="0.01" {...register('tank_level_before')} placeholder="Optionnel" />
          </div>
          <div className="space-y-1">
            <Label>Niveau cuve après (L)</Label>
            <Input type="number" step="0.01" {...register('tank_level_after')} placeholder="Optionnel" />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Notes</Label>
          <Input {...register('notes')} placeholder="Remarques éventuelles" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Produits livrés</Label>
            <Button
              type="button" size="sm" variant="outline"
              onClick={() => append({ item_type: 'fuel', description: '', ordered_quantity: '', received_quantity: '', unit_price_xof: '', fuel_type: '' })}
            >
              <Plus size={12} className="mr-1" /> Ajouter
            </Button>
          </div>
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-2 text-left font-medium text-gray-600">Type</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-600">Carburant</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-600">Description</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-600">Qté cmdée</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-600">Qté reçue *</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-600">P.U. (FCFA)</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, i) => (
                  <tr key={field.id} className="border-t">
                    <td className="px-2 py-1">
                      <Select {...register(`items.${i}.item_type`)} className="h-7 text-xs">
                        {ITEM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </Select>
                    </td>
                    <td className="px-2 py-1">
                      {watchedItems[i]?.item_type === 'fuel' ? (
                        <Select {...register(`items.${i}.fuel_type`, { required: watchedItems[i]?.item_type === 'fuel' })} className="h-7 text-xs w-24">
                          <option value="">— Type —</option>
                          {fuelTypes.map((ft) => <option key={ft.id} value={ft.id}>{ft.name}</option>)}
                        </Select>
                      ) : (
                        <span className="text-gray-300 px-1">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1">
                      <Input {...register(`items.${i}.description`, { required: true })} className="h-7 text-xs" placeholder="Description" />
                    </td>
                    <td className="px-2 py-1">
                      <Input type="number" step="0.001" {...register(`items.${i}.ordered_quantity`)} className="h-7 w-20 text-xs" placeholder="0" />
                    </td>
                    <td className="px-2 py-1">
                      <Input type="number" step="0.001" {...register(`items.${i}.received_quantity`, { required: true })} className="h-7 w-20 text-xs" />
                    </td>
                    <td className="px-2 py-1">
                      <Input type="number" step="1" {...register(`items.${i}.unit_price_xof`)} className="h-7 w-24 text-xs" placeholder="0" />
                    </td>
                    <td className="px-2 py-1">
                      {fields.length > 1 && (
                        <button type="button" onClick={() => remove(i)} className="text-red-400 hover:text-red-600">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {error && <p className="text-xs text-red-500 bg-red-50 rounded p-2">{error}</p>}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" type="button" onClick={onCancel}>Annuler</Button>
        <Button type="submit" disabled={loading}>
          {loading ? <Spinner size="sm" /> : 'Enregistrer la livraison'}
        </Button>
      </DialogFooter>
    </form>
  )
}
