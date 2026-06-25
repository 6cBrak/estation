import api from '@/lib/axios'
import type { User, PaginatedResponse } from '@/types'

export interface UserCreate {
  username: string; password: string; first_name: string; last_name: string
  email?: string; phone?: string; role: string; station?: string | null
}

export const usersApi = {
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<User>>('/auth/users/', { params }),
  get: (id: string) => api.get<User>(`/auth/users/${id}/`),
  create: (data: UserCreate) => api.post<User>('/auth/users/', data),
  update: (id: string, data: Partial<UserCreate>) =>
    api.patch<User>(`/auth/users/${id}/`, data),
  deactivate: (id: string) => api.patch(`/auth/users/${id}/`, { is_active: false }),
}
