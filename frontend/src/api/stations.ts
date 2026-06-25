import api from '@/lib/axios'
import type { Station } from '@/types'

export type CreateStationData = {
  code: string
  name: string
  address?: string
  city?: string
  phone?: string
  gauge_tolerance_pct?: string
  cash_tolerance_xof?: string
}

export const stationsApi = {
  list: () => api.get<Station[]>('/stations/'),
  get: (id: string) => api.get<Station>(`/stations/${id}/`),
  create: (data: CreateStationData) => api.post<Station>('/stations/', data),
  update: (id: string, data: Partial<Station>) => api.patch<Station>(`/stations/${id}/`, data),
}
