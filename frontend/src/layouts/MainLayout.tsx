import { useState, useRef, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, BookOpen, ShoppingCart, Fuel,
  Users, Package, Truck, BarChart2, LogOut,
  Menu, X, ChevronRight, Fuel as FuelIcon, Settings, ChevronsUpDown, Check, Receipt, Wallet,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { cn, unwrapList } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { authApi } from '@/api/auth'
import { stationsApi } from '@/api/stations'
import type { Role, Station } from '@/types'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  roles: Role[]
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Tableau de bord', icon: <LayoutDashboard size={18} />, roles: ['manager', 'cashier'] },
  { to: '/', label: 'Réseau', icon: <LayoutDashboard size={18} />, roles: ['super_admin'] },
  { to: '/journal', label: 'Journal du jour', icon: <BookOpen size={18} />, roles: ['super_admin', 'manager'] },
  { to: '/sales', label: 'Caisse', icon: <ShoppingCart size={18} />, roles: ['super_admin', 'manager', 'cashier'] },
  { to: '/fuel', label: 'Carburant', icon: <Fuel size={18} />, roles: ['super_admin', 'manager'] },
  { to: '/stock', label: 'Stocks', icon: <Package size={18} />, roles: ['super_admin', 'manager'] },
  { to: '/charges', label: 'Charges', icon: <Receipt size={18} />, roles: ['super_admin', 'manager'] },
  { to: '/avoir', label: 'Avoir numérique', icon: <Wallet size={18} />, roles: ['super_admin', 'manager'] },
  { to: '/suppliers', label: 'Fournisseurs', icon: <Truck size={18} />, roles: ['super_admin', 'manager'] },
  { to: '/reports', label: 'Rapports', icon: <BarChart2 size={18} />, roles: ['super_admin', 'manager'] },
  { to: '/users', label: 'Utilisateurs', icon: <Users size={18} />, roles: ['super_admin'] },
  { to: '/settings', label: 'Paramétrage', icon: <Settings size={18} />, roles: ['super_admin', 'manager'] },
]

function StationSwitcher({ open }: { open: boolean }) {
  const { user, currentStation, setCurrentStation } = useAuthStore()
  const [expanded, setExpanded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data: stations = [] } = useQuery({
    queryKey: ['stations'],
    queryFn: () => stationsApi.list().then((r) => unwrapList<Station>(r.data)),
    enabled: user?.role === 'super_admin',
  })

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setExpanded(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (!currentStation) return null

  return (
    <div ref={ref} className="mx-3 mt-3 relative">
      <button
        onClick={() => user?.role === 'super_admin' && setExpanded((v) => !v)}
        className={cn(
          'w-full rounded-lg bg-blue-800 px-3 py-2 text-left',
          user?.role === 'super_admin' ? 'hover:bg-blue-700 cursor-pointer' : 'cursor-default'
        )}
      >
        <p className="text-xs text-blue-300 uppercase tracking-wide flex items-center justify-between">
          Station
          {user?.role === 'super_admin' && open && <ChevronsUpDown size={11} className="text-blue-400" />}
        </p>
        {open && <p className="text-sm font-semibold truncate mt-0.5">{currentStation.name}</p>}
      </button>

      {expanded && open && stations.length > 1 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg bg-white shadow-lg border border-gray-200 py-1 max-h-60 overflow-y-auto">
          {stations.map((s) => (
            <button
              key={s.id}
              onClick={() => { setCurrentStation(s); setExpanded(false) }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
            >
              <Check
                size={13}
                className={s.id === currentStation.id ? 'text-blue-600' : 'text-transparent'}
              />
              <span className="truncate">{s.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MainLayout() {
  const { user, logout, refreshToken } = useAuthStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const visibleNav = NAV_ITEMS.filter(
    (item) => user && item.roles.includes(user.role)
  )

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken)
    } catch { /* ignore */ }
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col bg-blue-900 text-white transition-all duration-200 shrink-0',
          sidebarOpen ? 'w-56' : 'w-14'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-blue-800">
          <FuelIcon size={22} className="text-white shrink-0" />
          {sidebarOpen && (
            <span className="font-bold text-sm truncate">E-Station</span>
          )}
        </div>

        {/* Station courante — cliquable pour super_admin */}
        <StationSwitcher open={sidebarOpen} />

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                  'hover:bg-blue-800',
                  isActive ? 'bg-blue-700 font-semibold' : 'text-blue-100'
                )
              }
              title={!sidebarOpen ? item.label : undefined}
            >
              <span className="shrink-0">{item.icon}</span>
              {sidebarOpen && <span className="truncate">{item.label}</span>}
              {sidebarOpen && <ChevronRight size={14} className="ml-auto opacity-40" />}
            </NavLink>
          ))}
        </nav>

        {/* User + logout */}
        <div className="border-t border-blue-800 p-3">
          {sidebarOpen && user && (
            <div className="mb-2 px-1">
              <p className="text-xs font-semibold truncate">
                {user.first_name || user.username}
              </p>
              <p className="text-xs text-blue-300 capitalize">{user.role.replace('_', ' ')}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm text-blue-100 hover:bg-blue-800 transition-colors"
            title="Déconnexion"
          >
            <LogOut size={16} className="shrink-0" />
            {sidebarOpen && 'Déconnexion'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 h-14 shrink-0">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <span className="text-sm text-gray-500">
            {new Date().toLocaleDateString('fr-FR', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })}
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
