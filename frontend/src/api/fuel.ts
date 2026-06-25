import api from '@/lib/axios'

export interface FuelType {
  id: string; station: string | null; code: string; name: string; unit_price: string
}
export interface Tank {
  id: string; station: string; fuel_type: string; fuel_type_name?: string
  label: string; capacity_liters: string; current_level_liters: string
  low_threshold_liters: string; is_active: boolean
}
export interface Nozzle {
  id: string; station: string; tank: string; tank_label?: string
  fuel_type_name?: string; label: string; display_order: number; is_active: boolean
}

export const fuelApi = {
  // Types carburant
  listTypes: (params?: Record<string, string>) => api.get<FuelType[]>('/fuel/types/', { params }),
  createType: (data: Omit<FuelType, 'id'>) => api.post<FuelType>('/fuel/types/', data),
  updateType: (id: string, data: Partial<FuelType>) => api.patch<FuelType>(`/fuel/types/${id}/`, data),
  deleteType: (id: string) => api.delete(`/fuel/types/${id}/`),

  // Cuves
  listTanks: (params?: Record<string, string>) => api.get<Tank[]>('/fuel/tanks/', { params }),
  createTank: (data: Omit<Tank, 'id' | 'is_active' | 'fuel_type_name'>) =>
    api.post<Tank>('/fuel/tanks/', data),
  updateTank: (id: string, data: Partial<Tank>) => api.patch<Tank>(`/fuel/tanks/${id}/`, data),
  deleteTank: (id: string) => api.patch(`/fuel/tanks/${id}/`, { is_active: false }),

  // Pistolets
  listNozzles: (params?: Record<string, string>) => api.get<Nozzle[]>('/fuel/nozzles/', { params }),
  createNozzle: (data: Omit<Nozzle, 'id' | 'is_active' | 'tank_label' | 'fuel_type_name'>) =>
    api.post<Nozzle>('/fuel/nozzles/', data),
  updateNozzle: (id: string, data: Partial<Nozzle>) => api.patch<Nozzle>(`/fuel/nozzles/${id}/`, data),
  deleteNozzle: (id: string) => api.patch(`/fuel/nozzles/${id}/`, { is_active: false }),
}
