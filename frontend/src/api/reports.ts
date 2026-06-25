import api from '@/lib/axios'
import type { StationDashboard } from '@/types'

export const reportsApi = {
  stationDashboard: (params?: { station?: string; date?: string }) =>
    api.get<StationDashboard>('/reports/dashboard/station/', { params }),

  networkDashboard: (params?: { date?: string }) =>
    api.get('/reports/dashboard/network/', { params }),

  salesReport: (params: { station?: string; date_from: string; date_to: string }) =>
    api.get('/reports/sales/', { params }),

  stockReport: (params?: { station?: string }) =>
    api.get('/reports/stocks/', { params }),

  reconciliation: (params: { station?: string; date: string }) =>
    api.get('/reports/reconciliation/', { params }),

  salesExcelUrl: (params: { station?: string; date_from: string; date_to: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString()
    return `/api/v1/reports/sales/export/excel/?${qs}`
  },
}
