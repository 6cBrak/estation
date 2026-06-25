import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Station } from '@/types'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  currentStation: Station | null
  isAuthenticated: boolean

  setTokens: (access: string, refresh: string) => void
  setUser: (user: User) => void
  setCurrentStation: (station: Station) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      currentStation: null,
      isAuthenticated: false,

      setTokens: (access, refresh) => {
        localStorage.setItem('access_token', access)
        localStorage.setItem('refresh_token', refresh)
        set({ accessToken: access, refreshToken: refresh, isAuthenticated: true })
      },

      setUser: (user) => set({ user }),

      setCurrentStation: (station) => set({ currentStation: station }),

      logout: () => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          currentStation: null,
          isAuthenticated: false,
        })
      },
    }),
    {
      name: 'estation-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        currentStation: state.currentStation,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
