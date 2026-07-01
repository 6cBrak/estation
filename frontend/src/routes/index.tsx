import { createBrowserRouter, Navigate } from 'react-router-dom'
import MainLayout from '@/layouts/MainLayout'
import RequireAuth from '@/components/RequireAuth'
import LoginPage from '@/features/auth/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import JournalPage from '@/features/journal/JournalPage'
import JournalDetailPage from '@/features/journal/JournalDetailPage'
import SettingsPage from '@/features/settings/SettingsPage'
import UsersPage from '@/features/users/UsersPage'
import FuelPage from '@/features/fuel/FuelPage'
import StocksPage from '@/features/stocks/StocksPage'
import SuppliersPage from '@/features/suppliers/SuppliersPage'
import ReportsPage from '@/features/reports/ReportsPage'
import CaissePage from '@/features/sales/CaissePage'
import ChargesPage from '@/pages/ChargesPage'
import AvoirPage from '@/features/avoir/AvoirPage'
import CreditStatePage from '@/pages/CreditStatePage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <MainLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'journal', element: <JournalPage /> },
      { path: 'journal/:id', element: <JournalDetailPage /> },
      { path: 'sales', element: <CaissePage /> },
      { path: 'fuel', element: <FuelPage /> },
      { path: 'stock', element: <StocksPage /> },
      { path: 'suppliers', element: <SuppliersPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'charges', element: <ChargesPage /> },
      { path: 'avoir', element: <AvoirPage /> },
      { path: 'credits-etat', element: <CreditStatePage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
