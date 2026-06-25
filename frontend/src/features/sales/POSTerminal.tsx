import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { salesApi, PAYMENT_METHODS } from '@/api/sales'
import type { CartItem, SaleItemInput, SalePaymentInput } from '@/api/sales'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { DialogBody, DialogFooter } from '@/components/ui/dialog'
import { Plus, Minus, Trash2, ShoppingCart, CheckCircle, AlertTriangle } from 'lucide-react'
import { formatXOF, cn } from '@/lib/utils'

type CatalogTab = 'lubricant_boutique' | 'lubricant_piste' | 'gas' | 'service'

const TABS: { id: CatalogTab; label: string }[] = [
  { id: 'lubricant_boutique', label: 'Lubrifiants boutique' },
  { id: 'lubricant_piste', label: 'Lubrifiants piste' },
  { id: 'gas', label: 'Gaz' },
  { id: 'service', label: 'Services' },
]

interface POSTerminalProps {
  onSubmit: (data: { items: SaleItemInput[]; payments: SalePaymentInput[] }) => void
  onCancel: () => void
  loading: boolean
  error?: string
}

export default function POSTerminal({ onSubmit, onCancel, loading, error }: POSTerminalProps) {
  const [activeTab, setActiveTab] = useState<CatalogTab>('lubricant_boutique')
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [payAmount, setPayAmount] = useState('')

  // ── Chargement du catalogue ────────────────────────────────────────────────
  const { data: lubData, isLoading: lubLoading } = useQuery({
    queryKey: ['pos-lub-stocks'],
    queryFn: () => salesApi.listLubricantStocks().then((r) => r.data.results ?? []),
  })
  const { data: gasData, isLoading: gasLoading } = useQuery({
    queryKey: ['pos-gas-stocks'],
    queryFn: () => salesApi.listGasStocks().then((r) => r.data.results ?? []),
  })
  const { data: svcData, isLoading: svcLoading } = useQuery({
    queryKey: ['pos-services'],
    queryFn: () => salesApi.listServices().then((r) => {
      if (Array.isArray(r.data)) return r.data
      return (r.data as { results?: typeof r.data[] })?.results ?? []
    }),
  })

  // ── Catalogue filtré ───────────────────────────────────────────────────────
  const catalogItems = useMemo(() => {
    const q = search.toLowerCase()
    if (activeTab === 'lubricant_boutique') {
      return (lubData ?? [])
        .filter((s) => parseFloat(s.quantity) > 0 && parseFloat(s.sale_price_boutique_xof) > 0)
        .filter((s) => !q || s.product_name.toLowerCase().includes(q) || s.brand_name.toLowerCase().includes(q))
        .map((s) => ({
          key: `lub_b_${s.id}`,
          item_type: 'lubricant_boutique',
          label: `${s.brand_name} ${s.product_name} ${s.grade}`,
          unit_price_xof: parseFloat(s.sale_price_boutique_xof),
          stock_id: s.id,
          max_qty: parseFloat(s.quantity),
          stock_qty: parseFloat(s.quantity),
        }))
    }
    if (activeTab === 'lubricant_piste') {
      return (lubData ?? [])
        .filter((s) => parseFloat(s.quantity) > 0 && parseFloat(s.sale_price_piste_xof) > 0)
        .filter((s) => !q || s.product_name.toLowerCase().includes(q) || s.brand_name.toLowerCase().includes(q))
        .map((s) => ({
          key: `lub_p_${s.id}`,
          item_type: 'lubricant_piste',
          label: `${s.brand_name} ${s.product_name} ${s.grade}`,
          unit_price_xof: parseFloat(s.sale_price_piste_xof),
          stock_id: s.id,
          max_qty: parseFloat(s.quantity),
          stock_qty: parseFloat(s.quantity),
        }))
    }
    if (activeTab === 'gas') {
      return (gasData ?? [])
        .filter((s) => parseInt(s.quantity) > 0)
        .filter((s) => !q || s.format_label.toLowerCase().includes(q))
        .map((s) => ({
          key: `gas_${s.id}`,
          item_type: 'gas',
          label: `Gaz ${s.format_label}`,
          unit_price_xof: parseFloat(s.sale_price_xof),
          stock_id: s.id,
          max_qty: parseInt(s.quantity),
          stock_qty: parseInt(s.quantity),
        }))
    }
    if (activeTab === 'service') {
      return (svcData ?? [])
        .filter((s) => !q || s.name.toLowerCase().includes(q))
        .map((s) => ({
          key: `svc_${s.id}`,
          item_type: 'service',
          label: s.name,
          unit_price_xof: parseFloat(s.default_price_xof),
          stock_id: s.id,
          max_qty: undefined,
          stock_qty: undefined,
        }))
    }
    return []
  }, [activeTab, lubData, gasData, svcData, search])

  const isLoading = lubLoading || gasLoading || svcLoading

  // ── Gestion du panier ──────────────────────────────────────────────────────
  const addToCart = (item: typeof catalogItems[0]) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.key === item.key)
      if (existing) {
        if (item.max_qty !== undefined && existing.quantity >= item.max_qty) return prev
        return prev.map((c) =>
          c.key === item.key ? { ...c, quantity: c.quantity + 1 } : c
        )
      }
      return [...prev, {
        key: item.key,
        item_type: item.item_type,
        label: item.label,
        quantity: 1,
        unit_price_xof: item.unit_price_xof,
        lubricant_stock_id: item.item_type.startsWith('lubricant') ? item.stock_id : undefined,
        gas_stock_id: item.item_type === 'gas' ? item.stock_id : undefined,
        service_id: item.item_type === 'service' ? item.stock_id : undefined,
        max_qty: item.max_qty,
      }]
    })
  }

  const setQty = (key: string, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((c) => c.key !== key))
    } else {
      setCart((prev) => prev.map((c) => {
        if (c.key !== key) return c
        if (c.max_qty !== undefined && qty > c.max_qty) return c
        return { ...c, quantity: qty }
      }))
    }
  }

  const removeFromCart = (key: string) => setCart((prev) => prev.filter((c) => c.key !== key))

  // ── Calculs ────────────────────────────────────────────────────────────────
  const total = cart.reduce((s, it) => s + it.quantity * it.unit_price_xof, 0)
  const paid = parseFloat(payAmount) || 0
  const diff = total - paid

  // ── Soumission ─────────────────────────────────────────────────────────────
  const handleEncaisser = () => {
    if (cart.length === 0 || total === 0 || Math.abs(diff) > 1) return
    onSubmit({
      items: cart.map((c) => ({
        item_type: c.item_type,
        label: c.label,
        quantity: String(c.quantity),
        unit_price_xof: String(c.unit_price_xof),
        lubricant_stock_id: c.lubricant_stock_id ?? null,
        gas_stock_id: c.gas_stock_id ?? null,
        service_id: c.service_id ?? null,
      })),
      payments: [{
        method: payMethod,
        amount_xof: String(paid),
      }],
    })
  }

  const inCartQty = (key: string) => cart.find((c) => c.key === key)?.quantity ?? 0

  return (
    <>
      <DialogBody className="p-0">
        <div className="grid grid-cols-[1fr_300px] h-[70vh]">
          {/* ── Catalogue ── */}
          <div className="flex flex-col border-r">
            {/* Tabs */}
            <div className="flex border-b bg-gray-50 shrink-0">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setSearch('') }}
                  className={cn(
                    'px-3 py-2.5 text-xs font-medium border-b-2 -mb-px whitespace-nowrap',
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600 bg-white'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {/* Recherche */}
            <div className="px-3 py-2 border-b shrink-0">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un produit…"
                className="h-8 text-sm"
              />
            </div>
            {/* Grille produits */}
            <div className="flex-1 overflow-y-auto p-3">
              {isLoading ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : catalogItems.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  {search ? 'Aucun résultat.' : 'Aucun produit disponible en stock.'}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {catalogItems.map((item) => {
                    const qtyInCart = inCartQty(item.key)
                    const outOfStock = item.max_qty !== undefined && qtyInCart >= item.max_qty
                    return (
                      <button
                        key={item.key}
                        onClick={() => addToCart(item)}
                        disabled={outOfStock}
                        className={cn(
                          'text-left p-3 rounded-lg border transition-all text-sm',
                          outOfStock
                            ? 'opacity-40 cursor-not-allowed bg-gray-50 border-gray-200'
                            : qtyInCart > 0
                            ? 'border-blue-400 bg-blue-50 hover:bg-blue-100'
                            : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50'
                        )}
                      >
                        <p className="font-medium text-gray-800 leading-tight line-clamp-2">{item.label}</p>
                        <p className="text-blue-700 font-bold mt-1">{formatXOF(item.unit_price_xof)}</p>
                        <div className="flex items-center justify-between mt-1">
                          {item.max_qty !== undefined ? (
                            <span className={cn('text-xs', item.max_qty <= 3 ? 'text-orange-600' : 'text-gray-400')}>
                              Stock : {item.max_qty}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">Service</span>
                          )}
                          {qtyInCart > 0 && (
                            <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                              {qtyInCart}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Panier ── */}
          <div className="flex flex-col bg-gray-50">
            <div className="px-3 py-2.5 border-b bg-white shrink-0">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                <ShoppingCart size={15} />
                Panier {cart.length > 0 && <span className="text-gray-400 font-normal">({cart.length} article{cart.length > 1 ? 's' : ''})</span>}
              </div>
            </div>

            {/* Lignes panier */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {cart.length === 0 ? (
                <p className="text-xs text-gray-400 text-center pt-6">
                  Cliquez sur un produit pour l'ajouter.
                </p>
              ) : (
                cart.map((item) => (
                  <div key={item.key} className="bg-white rounded border p-2">
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-xs font-medium text-gray-800 leading-tight flex-1">{item.label}</p>
                      <button onClick={() => removeFromCart(item.key)} className="text-red-400 hover:text-red-600 shrink-0">
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setQty(item.key, item.quantity - 1)}
                          className="w-6 h-6 rounded border flex items-center justify-center hover:bg-gray-100 text-gray-600"
                        >
                          <Minus size={11} />
                        </button>
                        <span className="w-7 text-center text-sm font-bold">{item.quantity}</span>
                        <button
                          onClick={() => setQty(item.key, item.quantity + 1)}
                          disabled={item.max_qty !== undefined && item.quantity >= item.max_qty}
                          className="w-6 h-6 rounded border flex items-center justify-center hover:bg-gray-100 text-gray-600 disabled:opacity-30"
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                      <span className="text-sm font-semibold text-blue-700">
                        {formatXOF(item.quantity * item.unit_price_xof)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Total + paiement */}
            <div className="border-t bg-white p-3 space-y-3 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Total</span>
                <span className="text-lg font-bold text-blue-700">{formatXOF(total)}</span>
              </div>

              <div className="space-y-1.5">
                <Select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="h-8 text-sm"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </Select>
                <Input
                  type="number"
                  step="500"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder={`Montant reçu (FCFA)`}
                  className="h-8 text-sm"
                  onFocus={() => { if (!payAmount) setPayAmount(String(total)) }}
                />
                {payAmount && total > 0 && (
                  <div className={cn(
                    'flex items-center justify-between text-xs rounded px-2 py-1',
                    Math.abs(diff) <= 1 ? 'bg-green-50 text-green-700' : diff > 0 ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
                  )}>
                    {Math.abs(diff) <= 1 ? (
                      <span className="flex items-center gap-1"><CheckCircle size={11} /> Montant exact</span>
                    ) : diff > 0 ? (
                      <span className="flex items-center gap-1"><AlertTriangle size={11} /> Manque {formatXOF(diff)}</span>
                    ) : (
                      <span>Rendu monnaie : {formatXOF(-diff)}</span>
                    )}
                  </div>
                )}
              </div>

              {error && <p className="text-xs text-red-500 bg-red-50 rounded p-2">{error}</p>}
            </div>
          </div>
        </div>
      </DialogBody>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={loading}>Annuler</Button>
        <Button
          onClick={handleEncaisser}
          disabled={loading || cart.length === 0 || total === 0 || Math.abs(diff) > 1 || !payAmount}
          className="min-w-[160px]"
        >
          {loading ? <Spinner size="sm" /> : `Encaisser ${total > 0 ? formatXOF(total) : ''}`}
        </Button>
      </DialogFooter>
    </>
  )
}
