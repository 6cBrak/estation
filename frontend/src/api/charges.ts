import api from '@/lib/axios'
import type { PaginatedResponse } from '@/types'

export interface Charge {
  id: string
  station: string
  station_name: string
  journal: string | null
  journal_number: string | null
  category: string
  category_display: string
  label: string
  amount_xof: string
  charge_date: string
  payment_method: string
  payment_method_display: string
  reference: string
  status: 'pending' | 'validated' | 'rejected'
  status_display: string
  notes: string
  validated_by: string | null
  validated_by_name: string | null
  validated_at: string | null
  rejection_reason: string
  created_by: string | null
  created_by_name: string | null
  created_at: string
}

export interface ChargeCreateInput {
  category: string
  label: string
  amount_xof: string
  charge_date: string
  payment_method: string
  reference?: string
  journal?: string | null
  notes?: string
}

export const CHARGE_CATEGORIES = [
  { value: 'operational', label: 'Dépense opérationnelle' },
  { value: 'petite_caisse', label: 'Petite caisse' },
  { value: 'salary', label: 'Salaires' },
  { value: 'other', label: 'Autre' },
]

export const CHARGE_PAYMENT_METHODS = [
  { value: 'cash', label: 'Espèces' },
  { value: 'bank_transfer', label: 'Virement bancaire' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'check', label: 'Chèque' },
]

export const chargesApi = {
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<Charge>>('/charges/', { params }),

  create: (data: ChargeCreateInput) =>
    api.post<Charge>('/charges/', data),

  update: (id: string, data: Partial<ChargeCreateInput>) =>
    api.patch<Charge>(`/charges/${id}/`, data),

  delete: (id: string) =>
    api.delete(`/charges/${id}/`),

  review: (id: string, data: { action: 'validate' | 'reject'; rejection_reason?: string }) =>
    api.post<Charge>(`/charges/${id}/review/`, data),
}
