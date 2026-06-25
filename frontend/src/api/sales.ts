import api from '@/lib/axios'
import type { PaginatedResponse } from '@/types'

export interface CashSession {
  id: string
  station: string
  station_name: string
  cashier: string
  cashier_name: string
  opened_at: string
  closed_at: string | null
  opening_amount_xof: string
  counted_cash_xof: string | null
  total_sales_xof: string
  cash_expected_xof: string
  variance_xof: string | null
  status: 'open' | 'closed' | 'validated'
  notes: string
}

export interface SaleItemInput {
  item_type: string
  label: string
  quantity: string
  unit_price_xof: string
  lubricant_stock_id?: string | null
  gas_stock_id?: string | null
  service_id?: string | null
}

export interface SalePaymentInput {
  method: string
  amount_xof: string
  reference?: string
}

export interface SaleItem {
  id: string
  item_type: string
  label: string
  quantity: string
  unit_price_xof: string
  subtotal_xof: string
}

export interface SalePayment {
  id: string
  method: string
  amount_xof: string
  reference: string
}

export interface Sale {
  id: string
  sale_number: string
  station_name: string
  cashier_name: string
  total_xof: string
  status: 'completed' | 'cancelled'
  cancel_reason: string
  sold_at: string
  items: SaleItem[]
  payments: SalePayment[]
}

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Espèces' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'card_tpe', label: 'Carte TPE' },
  { value: 'ticket', label: 'Ticket / Bon carburant' },
  { value: 'credit', label: 'Crédit client' },
]

export const SALE_ITEM_TYPES = [
  { value: 'lubricant_boutique', label: 'Lubrifiant boutique' },
  { value: 'lubricant_piste', label: 'Lubrifiant piste' },
  { value: 'service', label: 'Service' },
  { value: 'gas', label: 'Gaz' },
  { value: 'product', label: 'Produit boutique' },
]

// ─── Catalogue POS ───────────────────────────────────────────────────────────

export interface LubricantStockItem {
  id: string
  product: string
  product_name: string
  brand_name: string
  grade: string
  sale_price_boutique_xof: string
  sale_price_piste_xof: string
  station: string
  quantity: string
}

export interface GasStockItem {
  id: string
  format: string
  format_label: string
  weight_kg: string
  sale_price_xof: string
  station: string
  quantity: string
}

export interface ServiceItem {
  id: string
  station: string
  code: string
  name: string
  default_price_xof: string
}

// ─── Cart ─────────────────────────────────────────────────────────────────────

export interface CartItem {
  key: string
  item_type: string
  label: string
  quantity: number
  unit_price_xof: number
  lubricant_stock_id?: string
  gas_stock_id?: string
  service_id?: string
  max_qty?: number
}

export const salesApi = {
  listSessions: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<CashSession>>('/sales/sessions/', { params }),
  openSession: (data: { opening_amount_xof: string }) =>
    api.post<CashSession>('/sales/sessions/open/', data),
  closeSession: (id: string, data: { counted_cash_xof: string; notes?: string }) =>
    api.post<CashSession>(`/sales/sessions/${id}/close/`, data),
  validateSession: (id: string) =>
    api.post<CashSession>(`/sales/sessions/${id}/validate/`),

  listSales: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<Sale>>('/sales/sales/', { params }),
  createSale: (data: { items: SaleItemInput[]; payments: SalePaymentInput[] }) =>
    api.post<Sale>('/sales/sales/', data),
  cancelSale: (id: string, reason: string) =>
    api.post<Sale>(`/sales/sales/${id}/cancel/`, { reason }),

  // Catalogue POS — accessible aux caissiers
  listLubricantStocks: () =>
    api.get<{ results: LubricantStockItem[] }>('/lubricants/stocks/'),
  listGasStocks: () =>
    api.get<{ results: GasStockItem[] }>('/gas/stocks/'),
  listServices: () =>
    api.get<ServiceItem[]>('/services/'),
}
