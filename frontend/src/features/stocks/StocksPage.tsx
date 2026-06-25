import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useAuthStore } from '@/stores/auth'
import { catalogApi } from '@/api/catalog'
import type { LubricantBrand, LubricantProduct, LubricantStockEntry, GasBottleFormat, GasStockEntry } from '@/api/catalog'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { Plus, Pencil, PackagePlus } from 'lucide-react'
import { cn, formatXOF, unwrapList, extractApiError } from '@/lib/utils'

const TABS = [
  { id: 'lubrifiants', label: 'Lubrifiants' },
  { id: 'gaz', label: 'Gaz' },
] as const
type Tab = typeof TABS[number]['id']

export default function StocksPage() {
  const [activeTab, setActiveTab] = useState<Tab>('lubrifiants')

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Stocks & Catalogue</h1>
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn('px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            )}>
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'lubrifiants' && <LubricantsTab />}
      {activeTab === 'gaz' && <GasTab />}
    </div>
  )
}

// ─── LUBRIFIANTS TAB ──────────────────────────────────────────────────────────

function LubricantsTab() {
  const { currentStation } = useAuthStore()
  const qc = useQueryClient()

  const { data: brands = [], isLoading: brandsLoading } = useQuery({
    queryKey: ['lub-brands'],
    queryFn: () => catalogApi.listLubBrands().then((r) => unwrapList<LubricantBrand>(r.data)),
  })
  const { data: products = [], isLoading: prodLoading } = useQuery({
    queryKey: ['lub-products'],
    queryFn: () => catalogApi.listLubProducts().then((r) => unwrapList<LubricantProduct>(r.data)),
  })
  const { data: stocks = [], isLoading: stockLoading } = useQuery({
    queryKey: ['lub-stocks', currentStation?.id],
    queryFn: () => catalogApi.listLubStocks(currentStation?.id ? { station: currentStation.id } : {})
      .then((r) => r.data.results ?? []),
    enabled: !!currentStation,
  })

  // ── Marques ──
  const [showAddBrand, setShowAddBrand] = useState(false)
  const addBrandMut = useMutation({
    mutationFn: (data: { name: string }) => catalogApi.createLubBrand(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lub-brands'] }); setShowAddBrand(false) },
  })

  // ── Produits ──
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [editProduct, setEditProduct] = useState<LubricantProduct | null>(null)
  const addProductMut = useMutation({
    mutationFn: (data: Omit<LubricantProduct, 'id' | 'is_active' | 'brand_name'>) =>
      catalogApi.createLubProduct(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lub-products'] }); setShowAddProduct(false) },
  })
  const editProductMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<LubricantProduct> }) =>
      catalogApi.updateLubProduct(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lub-products'] }); setEditProduct(null) },
  })

  // ── Stocks station ──
  const [showAddStock, setShowAddStock] = useState(false)
  const [approStock, setApproStock] = useState<LubricantStockEntry | null>(null)
  const addStockMut = useMutation({
    mutationFn: (data: { product: string; station: string; quantity: string }) =>
      catalogApi.createLubStock(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lub-stocks'] }); setShowAddStock(false) },
  })
  const approMut = useMutation({
    mutationFn: ({ id, qty }: { id: string; qty: string }) =>
      catalogApi.updateLubStock(id, { quantity: qty }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lub-stocks'] }); setApproStock(null) },
  })

  const activeProducts = products.filter((p) => p.is_active)
  const linkedProductIds = new Set(stocks.map((s) => s.product))
  const unlinkedProducts = activeProducts.filter((p) => !linkedProductIds.has(p.id))

  return (
    <div className="space-y-6">
      {/* ── Marques ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Marques</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowAddBrand(true)}>
              <Plus size={14} className="mr-1" /> Nouvelle marque
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {brandsLoading ? <Spinner /> : (
            <div className="flex flex-wrap gap-2">
              {brands.map((b) => <Badge key={b.id} variant="default">{b.name}</Badge>)}
              {brands.length === 0 && <p className="text-sm text-gray-400">Aucune marque.</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Catalogue produits ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Catalogue produits</CardTitle>
            <Button size="sm" onClick={() => setShowAddProduct(true)} disabled={brands.length === 0}>
              <Plus size={14} className="mr-1" /> Nouveau produit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {prodLoading ? <div className="p-4"><Spinner /></div> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase">
                  <th className="py-2 px-4 text-left">Marque</th>
                  <th className="py-2 px-4 text-left">Produit</th>
                  <th className="py-2 px-4 text-left">Grade</th>
                  <th className="py-2 px-4 text-left">Cdt</th>
                  <th className="py-2 px-4 text-right">Prix boutique</th>
                  <th className="py-2 px-4 text-right">Prix piste</th>
                  <th className="py-2 px-4 text-center">Statut</th>
                  <th className="py-2 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const brand = brands.find((b) => b.id === p.brand)
                  return (
                    <tr key={p.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-4 text-gray-500">{brand?.name ?? '—'}</td>
                      <td className="py-2 px-4 font-medium">{p.name}</td>
                      <td className="py-2 px-4 text-gray-500">{p.grade || '—'}</td>
                      <td className="py-2 px-4 text-gray-500">{p.packaging || '—'}</td>
                      <td className="py-2 px-4 text-right">{formatXOF(Number(p.sale_price_boutique_xof))}</td>
                      <td className="py-2 px-4 text-right">{formatXOF(Number(p.sale_price_piste_xof))}</td>
                      <td className="py-2 px-4 text-center">
                        <Badge variant={p.is_active ? 'success' : 'default'}>
                          {p.is_active ? 'Actif' : 'Inactif'}
                        </Badge>
                      </td>
                      <td className="py-2 px-4">
                        <Button size="icon" variant="ghost" className="h-7 w-7"
                          onClick={() => setEditProduct(p)}>
                          <Pencil size={13} />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
                {products.length === 0 && (
                  <tr><td colSpan={8} className="py-8 text-center text-gray-400">Aucun produit.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* ── Stocks de la station ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Stocks de la station</CardTitle>
            <Button size="sm" onClick={() => setShowAddStock(true)}
              disabled={!currentStation || unlinkedProducts.length === 0}>
              <Plus size={14} className="mr-1" /> Ajouter un produit au stock
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {stockLoading ? <div className="p-4"><Spinner /></div> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase">
                  <th className="py-2 px-4 text-left">Produit</th>
                  <th className="py-2 px-4 text-left">Marque</th>
                  <th className="py-2 px-4 text-left">Grade</th>
                  <th className="py-2 px-4 text-right">Qté en stock</th>
                  <th className="py-2 px-4 text-right">Prix boutique</th>
                  <th className="py-2 px-4 text-right">Prix piste</th>
                  <th className="py-2 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {stocks.map((s) => (
                  <tr key={s.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4 font-medium">{s.product_name}</td>
                    <td className="py-2 px-4 text-gray-500">{s.brand_name}</td>
                    <td className="py-2 px-4 text-gray-500">{s.grade || '—'}</td>
                    <td className="py-2 px-4 text-right font-mono font-semibold">
                      <span className={cn(Number(s.quantity) === 0 && 'text-red-500')}>
                        {s.quantity}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-right">{formatXOF(Number(s.sale_price_boutique_xof))}</td>
                    <td className="py-2 px-4 text-right">{formatXOF(Number(s.sale_price_piste_xof))}</td>
                    <td className="py-2 px-4">
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => setApproStock(s)}>
                        <PackagePlus size={12} className="mr-1" /> Appro
                      </Button>
                    </td>
                  </tr>
                ))}
                {stocks.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-gray-400">
                    Aucun produit en stock pour cette station.
                  </td></tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* ── Modals ── */}
      <BrandModal open={showAddBrand} onClose={() => setShowAddBrand(false)}
        onSubmit={(d) => addBrandMut.mutate(d)} loading={addBrandMut.isPending}
        error={addBrandMut.error ? extractApiError(addBrandMut.error) : undefined} />

      <ProductModal open={showAddProduct || !!editProduct}
        product={editProduct}
        brands={brands}
        onClose={() => { setShowAddProduct(false); setEditProduct(null) }}
        onSubmit={(d) => editProduct
          ? editProductMut.mutate({ id: editProduct.id, data: d })
          : addProductMut.mutate(d as Omit<LubricantProduct, 'id' | 'is_active' | 'brand_name'>)
        }
        loading={addProductMut.isPending || editProductMut.isPending}
        error={addProductMut.error ? extractApiError(addProductMut.error) :
               editProductMut.error ? extractApiError(editProductMut.error) : undefined} />

      <AddLubStockModal open={showAddStock} products={unlinkedProducts} brands={brands}
        stationId={currentStation?.id ?? ''}
        onClose={() => setShowAddStock(false)}
        onSubmit={(d) => addStockMut.mutate(d)}
        loading={addStockMut.isPending}
        error={addStockMut.error ? extractApiError(addStockMut.error) : undefined} />

      <ApproModal open={!!approStock}
        label={approStock ? `${approStock.brand_name} ${approStock.product_name} ${approStock.grade}`.trim() : ''}
        currentQty={approStock?.quantity ?? '0'}
        onClose={() => setApproStock(null)}
        onSubmit={(qty) => approStock && approMut.mutate({ id: approStock.id, qty })}
        loading={approMut.isPending}
        error={approMut.error ? extractApiError(approMut.error) : undefined} />
    </div>
  )
}

// ─── GAZ TAB ──────────────────────────────────────────────────────────────────

function GasTab() {
  const { currentStation } = useAuthStore()
  const qc = useQueryClient()

  const { data: formats = [] } = useQuery({
    queryKey: ['gas-formats'],
    queryFn: () => catalogApi.listGasFormats().then((r) => unwrapList<GasBottleFormat>(r.data)),
  })
  const { data: stocks = [], isLoading } = useQuery({
    queryKey: ['gas-stocks', currentStation?.id],
    queryFn: () => catalogApi.listGasStocks(currentStation?.id ? { station: currentStation.id } : {})
      .then((r) => r.data.results ?? []),
    enabled: !!currentStation,
  })

  const [showAddStock, setShowAddStock] = useState(false)
  const [approStock, setApproStock] = useState<GasStockEntry | null>(null)

  const addStockMut = useMutation({
    mutationFn: (data: { format: string; station: string; quantity: number }) =>
      catalogApi.createGasStock(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gas-stocks'] }); setShowAddStock(false) },
  })
  const approMut = useMutation({
    mutationFn: ({ id, qty }: { id: string; qty: number }) =>
      catalogApi.updateGasStock(id, { quantity: qty }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gas-stocks'] }); setApproStock(null) },
  })

  const linkedFormatIds = new Set(stocks.map((s) => s.format))
  const unlinkedFormats = formats.filter((f) => f.is_active && !linkedFormatIds.has(f.id))

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Stocks gaz de la station</CardTitle>
            <Button size="sm" onClick={() => setShowAddStock(true)}
              disabled={!currentStation || unlinkedFormats.length === 0}>
              <Plus size={14} className="mr-1" /> Ajouter un format au stock
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? <div className="p-4"><Spinner /></div> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase">
                  <th className="py-2 px-4 text-left">Format</th>
                  <th className="py-2 px-4 text-right">Poids (kg)</th>
                  <th className="py-2 px-4 text-right">Prix vente</th>
                  <th className="py-2 px-4 text-right">Qté en stock</th>
                  <th className="py-2 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {stocks.map((s) => (
                  <tr key={s.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{s.format_label}</td>
                    <td className="py-3 px-4 text-right text-gray-500">{s.weight_kg} kg</td>
                    <td className="py-3 px-4 text-right">{formatXOF(Number(s.sale_price_xof))}</td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-2xl text-blue-700">
                      <span className={cn(Number(s.quantity) === 0 && 'text-red-500')}>
                        {s.quantity}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => setApproStock(s)}>
                        <PackagePlus size={12} className="mr-1" /> Appro
                      </Button>
                    </td>
                  </tr>
                ))}
                {stocks.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-gray-400">
                    Aucun format gaz configuré pour cette station.
                  </td></tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Formats disponibles (lecture) */}
      {formats.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base text-gray-500">Formats disponibles</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {formats.filter((f) => f.is_active).map((f) => (
                <div key={f.id} className="rounded-lg border px-3 py-2 text-sm">
                  <span className="font-medium">{f.label}</span>
                  <span className="text-gray-400 ml-2">{formatXOF(Number(f.sale_price_xof))}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <AddGasStockModal open={showAddStock} formats={unlinkedFormats}
        stationId={currentStation?.id ?? ''}
        onClose={() => setShowAddStock(false)}
        onSubmit={(d) => addStockMut.mutate(d)}
        loading={addStockMut.isPending}
        error={addStockMut.error ? extractApiError(addStockMut.error) : undefined} />

      <ApproModal open={!!approStock}
        label={approStock?.format_label ?? ''}
        currentQty={String(approStock?.quantity ?? 0)}
        onClose={() => setApproStock(null)}
        onSubmit={(qty) => approStock && approMut.mutate({ id: approStock.id, qty: Number(qty) })}
        loading={approMut.isPending}
        error={approMut.error ? extractApiError(approMut.error) : undefined} />
    </div>
  )
}

// ─── MODALS ───────────────────────────────────────────────────────────────────

function BrandModal({ open, onClose, onSubmit, loading, error }: {
  open: boolean; onClose: () => void
  onSubmit: (d: { name: string }) => void
  loading: boolean; error?: string
}) {
  const { register, handleSubmit, reset } = useForm<{ name: string }>()
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); reset() } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouvelle marque</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((d) => onSubmit(d))}>
          <DialogBody className="space-y-3">
            <div className="space-y-1">
              <Label>Nom de la marque *</Label>
              <Input {...register('name', { required: true })} placeholder="Ex : TOTAL, SHELL, MOBIL…" />
            </div>
            {error && <p className="text-xs text-red-500 bg-red-50 p-2 rounded">{error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => { onClose(); reset() }}>Annuler</Button>
            <Button type="submit" disabled={loading}>{loading ? <Spinner size="sm" /> : 'Créer'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ProductModal({ open, product, brands, onClose, onSubmit, loading, error }: {
  open: boolean; product: LubricantProduct | null; brands: LubricantBrand[]
  onClose: () => void
  onSubmit: (d: Partial<LubricantProduct>) => void
  loading: boolean; error?: string
}) {
  const { register, handleSubmit, reset } = useForm<Partial<LubricantProduct>>({
    values: product ?? undefined,
  })
  const isEdit = !!product
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); reset() } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEdit ? 'Modifier le produit' : 'Nouveau produit lubrifiant'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((d) => onSubmit(d))}>
          <DialogBody className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Marque *</Label>
                <Select {...register('brand', { required: true })} className="h-9 text-sm">
                  <option value="">-- Choisir --</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Code *</Label>
                <Input {...register('code', { required: true })} placeholder="Ex : TOT-QUARTZ-5W40" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Nom du produit *</Label>
                <Input {...register('name', { required: true })} placeholder="Ex : Quartz 9000" />
              </div>
              <div className="space-y-1">
                <Label>Grade</Label>
                <Input {...register('grade')} placeholder="Ex : 5W-40" />
              </div>
              <div className="space-y-1">
                <Label>Conditionnement</Label>
                <Input {...register('packaging')} placeholder="Ex : 1L, 4L, 5L" />
              </div>
              <div className="space-y-1">
                <Label>Prix boutique (FCFA)</Label>
                <Input type="number" step="1" {...register('sale_price_boutique_xof')} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label>Prix piste (FCFA)</Label>
                <Input type="number" step="1" {...register('sale_price_piste_xof')} placeholder="0" />
              </div>
              {isEdit && (
                <div className="col-span-2 space-y-1">
                  <Label>Statut</Label>
                  <Select {...register('is_active')} className="h-9 text-sm">
                    <option value="true">Actif</option>
                    <option value="false">Inactif</option>
                  </Select>
                </div>
              )}
            </div>
            {error && <p className="text-xs text-red-500 bg-red-50 p-2 rounded">{error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => { onClose(); reset() }}>Annuler</Button>
            <Button type="submit" disabled={loading}>{loading ? <Spinner size="sm" /> : isEdit ? 'Enregistrer' : 'Créer'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AddLubStockModal({ open, products, brands, stationId, onClose, onSubmit, loading, error }: {
  open: boolean; products: LubricantProduct[]; brands: LubricantBrand[]
  stationId: string; onClose: () => void
  onSubmit: (d: { product: string; station: string; quantity: string }) => void
  loading: boolean; error?: string
}) {
  const { register, handleSubmit, reset } = useForm<{ product: string; quantity: string }>({
    defaultValues: { quantity: '0' },
  })
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); reset() } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Ajouter un produit au stock</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((d) => onSubmit({ product: d.product, station: stationId, quantity: d.quantity }))}>
          <DialogBody className="space-y-3">
            <div className="space-y-1">
              <Label>Produit *</Label>
              <Select {...register('product', { required: true })} className="h-9 text-sm">
                <option value="">-- Choisir un produit --</option>
                {products.map((p) => {
                  const brand = brands.find((b) => b.id === p.brand)
                  return <option key={p.id} value={p.id}>{brand?.name} {p.name} {p.grade}</option>
                })}
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Quantité initiale</Label>
              <Input type="number" step="0.01" min="0" {...register('quantity')} />
            </div>
            {error && <p className="text-xs text-red-500 bg-red-50 p-2 rounded">{error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => { onClose(); reset() }}>Annuler</Button>
            <Button type="submit" disabled={loading}>{loading ? <Spinner size="sm" /> : 'Ajouter'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AddGasStockModal({ open, formats, stationId, onClose, onSubmit, loading, error }: {
  open: boolean; formats: GasBottleFormat[]; stationId: string; onClose: () => void
  onSubmit: (d: { format: string; station: string; quantity: number }) => void
  loading: boolean; error?: string
}) {
  const { register, handleSubmit, reset } = useForm<{ format: string; quantity: string }>({
    defaultValues: { quantity: '0' },
  })
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); reset() } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Ajouter un format au stock gaz</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((d) => onSubmit({ format: d.format, station: stationId, quantity: Number(d.quantity) }))}>
          <DialogBody className="space-y-3">
            <div className="space-y-1">
              <Label>Format de bouteille *</Label>
              <Select {...register('format', { required: true })} className="h-9 text-sm">
                <option value="">-- Choisir --</option>
                {formats.map((f) => <option key={f.id} value={f.id}>{f.label} ({f.weight_kg} kg)</option>)}
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Quantité initiale (bouteilles)</Label>
              <Input type="number" min="0" step="1" {...register('quantity')} />
            </div>
            {error && <p className="text-xs text-red-500 bg-red-50 p-2 rounded">{error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => { onClose(); reset() }}>Annuler</Button>
            <Button type="submit" disabled={loading}>{loading ? <Spinner size="sm" /> : 'Ajouter'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ApproModal({ open, label, currentQty, onClose, onSubmit, loading, error }: {
  open: boolean; label: string; currentQty: string
  onClose: () => void; onSubmit: (newQty: string) => void
  loading: boolean; error?: string
}) {
  const { register, handleSubmit, watch, reset } = useForm<{ added: string }>({ defaultValues: { added: '' } })
  const added = parseFloat(watch('added') || '0') || 0
  const newQty = parseFloat(currentQty) + added

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); reset() } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Approvisionnement</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((_) => onSubmit(String(newQty)))}>
          <DialogBody className="space-y-4">
            <p className="text-sm font-medium text-gray-800">{label}</p>
            <div className="bg-gray-50 rounded p-3 flex justify-between text-sm">
              <span className="text-gray-500">Stock actuel</span>
              <span className="font-semibold">{currentQty}</span>
            </div>
            <div className="space-y-1">
              <Label>Quantité reçue *</Label>
              <Input type="number" step="0.01" min="0.01" {...register('added', { required: true, min: 0.01 })}
                placeholder="Nombre d'unités reçues" autoFocus />
            </div>
            {added > 0 && (
              <div className="bg-blue-50 rounded p-3 flex justify-between text-sm">
                <span className="text-blue-700">Nouveau stock</span>
                <span className="font-bold text-blue-700">{newQty.toFixed(2)}</span>
              </div>
            )}
            {error && <p className="text-xs text-red-500 bg-red-50 p-2 rounded">{error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => { onClose(); reset() }}>Annuler</Button>
            <Button type="submit" disabled={loading || added <= 0}>
              {loading ? <Spinner size="sm" /> : 'Valider l\'appro'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
