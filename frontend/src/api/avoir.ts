import api from '@/lib/axios'

export interface AvoirWithdrawal {
  id: string
  station: string
  station_name: string
  withdrawal_date: string
  withdrawal_type: 'fuel' | 'cash'
  withdrawal_type_display: string
  amount_xof: string
  notes: string
  created_at: string
}

export interface AvoirSummary {
  avoir_total_xof: string
  withdrawals_fuel_xof: string
  withdrawals_cash_xof: string
  withdrawals_total_xof: string
  balance_xof: string
}

export const avoirApi = {
  list: (params: Record<string, string>) =>
    api.get<AvoirWithdrawal[]>('/journal/avoir-withdrawals/', { params }),

  summary: (params: { station: string; month: string; year: string }) =>
    api.get<AvoirSummary>('/journal/avoir-withdrawals/summary/', { params }),

  create: (data: {
    station: string
    withdrawal_date: string
    withdrawal_type: string
    amount_xof: string
    notes?: string
  }) => api.post<AvoirWithdrawal>('/journal/avoir-withdrawals/', data),

  delete: (id: string) =>
    api.delete(`/journal/avoir-withdrawals/${id}/`),
}
