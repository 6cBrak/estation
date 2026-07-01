// ─── Auth ────────────────────────────────────────────────────────────────────
export type Role = 'super_admin' | 'manager' | 'cashier'

export interface User {
  id: string
  username: string
  email: string
  first_name: string
  last_name: string
  role: Role
  station: string | null
}

export interface AuthTokens {
  access: string
  refresh: string
}

// ─── Station ─────────────────────────────────────────────────────────────────
export interface Station {
  id: string
  code: string
  name: string
  address: string
  city: string
  phone: string
  gauge_tolerance_pct: string
  cash_tolerance_xof: string
}

// ─── Journal ─────────────────────────────────────────────────────────────────
export type JournalStatus = 'draft' | 'closed' | 'validated'

export interface JournalFuelLine {
  id: string
  nozzle: string
  nozzle_label: string
  tank_id: string
  tank_label: string
  fuel_type: string
  unit_price: string
  is_tank_reference: boolean
  index_open: string
  index_close: string | null
  return_volume: string
  received_volume: string
  gauged_stock_open: string
  gauged_stock_close: string | null
  diff_comment: string
  output_volume: string | null
  sold_volume: string | null
  theoretical_stock: string | null
  gauge_diff: string | null
  amount_xof: string | null
  monthly_gauge_diff: string | null
}

export interface JournalLubricantLine {
  id: string
  lubricant: string
  lubricant_name: string
  stock_open: string
  purchased_qty: string
  sold_qty: string
  gauged_qty: string | null
  stock_cumul: string
  stock_close_theoretical: string
  diff: string | null
}

export interface JournalSalesRecap {
  id: string
  category: string
  category_display: string
  qty: string
  unit_price_xof: string
  daily_value_xof: string
  previous_day_cumul_xof: string
  monthly_cumul_xof: string
  previous_month_total_xof: string
}

export interface JournalPaymentSummary {
  id: string
  cash_amount_xof: string
  tickets_amount_xof: string
  tpe_amount_xof: string
  mobile_money_amount_xof: string
  credit_amount_xof: string
  reimbursements_xof: string
  ecart_pompiste_xof: string
  total_xof: string
  avoir_fuel_xof: string
  avoir_cash_xof: string
  avoir_total_xof: string
  avoir_solde_xof: string
  ecart_encaissement_xof: string
  ecart_encaissement_cumul_xof: string
}

export interface JournalExpense {
  id: string
  journal: string
  label: string
  amount_xof: string
  category: string
  category_display: string
  created_at: string
}

export interface StationJournal {
  id: string
  journal_number: string
  journal_date: string
  station: string
  station_name: string
  manager: string
  manager_name: string
  status: JournalStatus
  status_display: string
  is_editable: boolean
  opened_at: string
  closed_at: string | null
  validated_at: string | null
  validated_by: string | null
  validated_by_name: string | null
  notes: string
  pdf_url: string
  pdf_hash: string
  fuel_lines: JournalFuelLine[]
  lubricant_lines: JournalLubricantLine[]
  sales_recaps: JournalSalesRecap[]
  payment_summary: JournalPaymentSummary
  expenses: JournalExpense[]
  monthly_expenses_xof: string
}

export interface StationJournalListItem {
  id: string
  journal_number: string
  journal_date: string
  station: string
  station_name: string
  manager: string
  manager_name: string
  status: JournalStatus
  status_display: string
  opened_at: string
  closed_at: string | null
  validated_at: string | null
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
export interface TankStock {
  label: string
  fuel_type: string
  current_level: number
  capacity: number
  pct: number
  is_low: boolean
}

export interface DashboardAlert {
  type: 'tank_low' | 'gauge_diff' | 'cash_variance'
  label: string
  severity: 'warning' | 'critical'
}

export interface DashboardCharge {
  label: string
  category_display: string
  amount_xof: number
  status: 'pending' | 'validated' | 'rejected'
  status_display: string
}

export interface StationDashboard {
  date: string
  station: string
  station_code: string
  tank_stocks: TankStock[]
  alerts: DashboardAlert[]
  monthly_xof: number
  prev_month_xof: number
  evolution_pct: number | null
  open_sessions: number
  journal: {
    journal_number: string
    status: JournalStatus
    status_display: string
    total_fuel_xof: number
    total_liters: number
    total_sales_xof: number
    cash_variance_xof: number | null
    cash_alert: boolean
    fuel_summary?: { pump: string; fuel_type: string; sold_volume: string | null }[]
    payment_summary: {
      cash: number
      tickets: number
      tpe: number
      mobile_money: number
      credit: number
      total: number
    }
  } | null
  charges: {
    total_validated_xof: number
    total_pending_xof: number
    total_xof: number
    by_category: { label: string; total_xof: number; count: number }[]
    rows: DashboardCharge[]
  }
}

// ─── Pagination DRF ──────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
