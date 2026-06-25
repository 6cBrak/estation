import { create } from 'zustand'
import api from '@/api/client'

interface User {
  id: string
  username: string
  first_name: string
  last_name: string
  role: 'super_admin' | 'manager' | 'cashier'
  station: string | null
  station_name: string | null
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  fetchMe: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('access_token'),

  login: async (username, password) => {
    const { data } = await api.post('/auth/login/', { username, password })
    localStorage.setItem('access_token', data.access)
    localStorage.setItem('refresh_token', data.refresh)
    set({ isAuthenticated: true })
    const me = await api.get('/auth/users/me/')
    set({ user: me.data })
  },

  logout: async () => {
    try {
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) await api.post('/auth/logout/', { refresh })
    } finally {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      set({ user: null, isAuthenticated: false })
    }
  },

  fetchMe: async () => {
    try {
      const { data } = await api.get('/auth/users/me/')
      set({ user: data, isAuthenticated: true })
    } catch {
      set({ user: null, isAuthenticated: false })
    }
  },
}))
