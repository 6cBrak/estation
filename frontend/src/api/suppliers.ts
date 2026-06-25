import api from '@/lib/axios'
import type { PaginatedResponse } from '@/types'

export interface Supplier {
  id: string; code: string; name: string; category: string; category_display?: string
  contact_name: string; phone: string; email: string; address: string; is_active: boolean
}
export interface PurchaseOrderItem {
  id?: string; item_type: string; description: string; quantity: string
  unit: string; unit_price_xof: string; subtotal_xof?: string
  fuel_type?: string | null; lubricant?: string | null
  product?: string | null; gas_format?: string | null
}
export interface PurchaseOrder {
  id: string; order_number: string; station: string; station_name?: string
  supplier: string; supplier_name?: string; status: string; status_display?: string
  ordered_at: string; expected_delivery_date?: string | null
  sent_at?: string | null; notes: string; total_xof?: string
  items: PurchaseOrderItem[]
}
export interface DeliveryItem {
  id?: string; order_item?: string | null; item_type: string; description: string
  ordered_quantity: string; received_quantity: string; unit_price_xof: string
  variance?: string; subtotal_xof?: string
  fuel_type?: string | null; lubricant?: string | null
  product?: string | null; gas_format?: string | null
}
export interface Delivery {
  id: string; delivery_number: string; station: string; station_name?: string
  supplier: string; supplier_name?: string; purchase_order?: string | null
  status: string; status_display?: string; delivered_at: string
  confirmed_at?: string | null; confirmed_by?: string | null; confirmed_by_name?: string
  tank_level_before?: string | null; tank_level_after?: string | null
  notes: string; items: DeliveryItem[]
}

export const suppliersApi = {
  listSuppliers: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<Supplier>>('/suppliers/suppliers/', { params }),
  createSupplier: (data: Omit<Supplier, 'id' | 'is_active' | 'category_display'>) =>
    api.post<Supplier>('/suppliers/suppliers/', data),
  updateSupplier: (id: string, data: Partial<Supplier>) =>
    api.patch<Supplier>(`/suppliers/suppliers/${id}/`, data),

  listOrders: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<PurchaseOrder>>('/suppliers/purchase-orders/', { params }),
  createOrder: (data: Omit<PurchaseOrder, 'id' | 'order_number' | 'status' | 'total_xof' | 'sent_at' | 'station_name' | 'supplier_name' | 'status_display'>) =>
    api.post<PurchaseOrder>('/suppliers/purchase-orders/', data),
  sendOrder: (id: string) =>
    api.post<PurchaseOrder>(`/suppliers/purchase-orders/${id}/send/`),
  cancelOrder: (id: string) =>
    api.post<PurchaseOrder>(`/suppliers/purchase-orders/${id}/cancel/`),

  listDeliveries: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<Delivery>>('/suppliers/deliveries/', { params }),
  createDelivery: (data: Partial<Delivery>) =>
    api.post<Delivery>('/suppliers/deliveries/', data),
  confirmDelivery: (id: string) =>
    api.post<Delivery>(`/suppliers/deliveries/${id}/confirm/`),
}
