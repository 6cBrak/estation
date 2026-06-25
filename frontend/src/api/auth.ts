import api from '@/lib/axios'
import type { AuthTokens, User } from '@/types'

export const authApi = {
  login: (username: string, password: string) =>
    api.post<AuthTokens>('/auth/login/', { username, password }),

  refresh: (refresh: string) =>
    api.post<{ access: string }>('/auth/refresh/', { refresh }),

  logout: (refresh: string) =>
    api.post('/auth/logout/', { refresh }),

  me: () => api.get<User>('/auth/users/me/'),
}
