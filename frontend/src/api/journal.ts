import api from '@/lib/axios'
import type {
  PaginatedResponse,
  StationJournal,
  StationJournalListItem,
} from '@/types'

export const journalApi = {
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<StationJournalListItem>>('/journal/journals/', { params }),

  get: (id: string) =>
    api.get<StationJournal>(`/journal/journals/${id}/`),

  open: (data: { station?: string; journal_date?: string }) =>
    api.post<StationJournal>('/journal/journals/', data),

  close: (id: string, notes?: string) =>
    api.post<StationJournal>(`/journal/journals/${id}/close/`, { notes }),

  validate: (id: string) =>
    api.post<StationJournal>(`/journal/journals/${id}/validate/`, { confirm: true }),

  reopen: (id: string) =>
    api.post<StationJournal>(`/journal/journals/${id}/reopen/`),

  syncPumps: (id: string) =>
    api.post<{ journal: StationJournal; added: number }>(`/journal/journals/${id}/sync-nozzles/`),

  deleteJournal: (id: string) =>
    api.post(`/journal/journals/${id}/delete/`),

  pdfUrl: (id: string) => `/api/v1/journal/journals/${id}/pdf/`,

  updateFuelLine: (id: string, data: Partial<{
    index_open: string
    index_close: string
    return_volume: string
    received_volume: string
    gauged_stock_open: string
    gauged_stock_close: string
    diff_comment: string
  }>) => api.patch(`/journal/fuel-lines/${id}/`, data),

  updateLubricantLine: (id: string, data: Partial<{
    purchased_qty: string
    sold_qty: string
    gauged_qty: string
  }>) => api.patch(`/journal/lubricant-lines/${id}/`, data),

  updateSalesRecap: (id: string, data: Partial<{
    qty: string
    unit_price_xof: string
    daily_value_xof: string
  }>) => api.patch(`/journal/sales-recaps/${id}/`, data),

  updatePaymentSummary: (id: string, data: Partial<{
    cash_amount_xof: string
    tickets_amount_xof: string
    tpe_amount_xof: string
    mobile_money_amount_xof: string
    credit_amount_xof: string
    reimbursements_xof: string
    avoir_fuel_xof: string
    avoir_cash_xof: string
  }>) => api.patch(`/journal/payment-summaries/${id}/`, data),

  creditState: (params: { station?: string; from_date?: string; to_date?: string }) =>
    api.get<{
      station_id: string
      station_name: string
      total_credit_xof: string
      total_reimbursements_xof: string
      solde_restant_xof: string
      entries: {
        date: string
        journal_number: string
        credit_xof: string
        reimbursement_xof: string
        solde_cumul_xof: string
      }[]
    }>('/journal/journals/credit-state/', { params }),

  createExpense: (data: { journal?: string; expense_date?: string; label: string; amount_xof: string; category: string }) =>
    api.post(`/journal/expenses/`, data),
  deleteExpense: (id: string) =>
    api.delete(`/journal/expenses/${id}/`),

  listExpenses: (params: Record<string, string>) =>
    api.get<import('@/types').JournalExpense[]>(`/journal/expenses/`, { params }),
  expensesSummary: (params: { month: string; year: string; station?: string }) =>
    api.get<{ by_category: Record<string, { label: string; total: string }>; total_xof: string }>(
      `/journal/expenses/summary/`, { params }
    ),
}
