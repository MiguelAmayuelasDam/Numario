// Cliente HTTP de la API. Centraliza la base URL, la inyección del token Bearer
// y el refresco automático (un intento) cuando el access token caduca (401).

import { parseValidationErrors, type FieldErrors } from "@/lib/validation"

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000"
const BASE = `${API_URL}/api/v1`

const ACCESS_KEY = "numario.access"
const REFRESH_KEY = "numario.refresh"

export interface User {
  id: string
  email: string
  nickname: string
}

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
}

export type Bucket = "living" | "monthly" | "investment" | "income" | "transfer"
// income = ingreso · expense = gasto · transfer = no computable
export type TransactionType = "income" | "expense" | "transfer"

export interface Category {
  id: string
  name: string
  bucket: Bucket
  emoji: string | null
  is_default: boolean
}

export interface Transaction {
  id: string
  amount: string
  type: TransactionType
  concept: string
  occurred_on: string
  category_id: string | null
  category: Category | null
  source: string
  created_at: string
}

export interface TransactionInput {
  amount: string
  type: TransactionType
  concept: string
  occurred_on: string
  category_id?: string | null
}

export interface TransactionFilters {
  from?: string
  to?: string
  category_id?: string
  type?: TransactionType
  size?: number
}

export interface SplitPart {
  amount: string
  category_id: string | null
}

export interface PreviewRow {
  concept: string
  occurred_on: string
  amount: string
  type: TransactionType
  suggested_category_id: string | null
  category: Category | null
  source: "learned" | "rule" | null
  duplicate: boolean
}

export interface ImportSummary {
  total: number
  classified: number
  needs_review: number
  duplicates: number
  errors: number
}

export interface PreviewResponse {
  rows: PreviewRow[]
  summary: ImportSummary
  error_details: string[]
}

export interface ConfirmItem {
  amount: string
  type: TransactionType
  concept: string
  occurred_on: string
  category_id: string | null
}

export interface Budget {
  monthly_income: string // ingreso "habitual" por defecto
  living_pct: number
  monthly_pct: number
  investment_pct: number
}

// Payload de PUT /budget: porcentajes siempre; `monthly_income` solo si se quiere
// cambiar el ingreso habitual (si se omite, no se toca).
export interface BudgetUpdate {
  living_pct: number
  monthly_pct: number
  investment_pct: number
  monthly_income?: string
}

// `unset` = sin ingreso configurado: no hay presupuesto contra el que comparar,
// así que el semáforo no opina. No es lo mismo que "ok".
export type BucketStatus = "unset" | "ok" | "warning" | "over"

export interface BucketStat {
  bucket: Bucket
  label: string
  budget: string
  spent: string
  pct: number
  status: BucketStatus
}

export interface CategoryStat {
  category_id: string | null
  name: string
  emoji: string | null
  bucket: Bucket | null
  spent: string
  forecast: string | null
}

export interface AnalyticsOverview {
  period_label: string
  date_from: string
  date_to: string
  is_current: boolean
  income_base: string // ingreso base del periodo (mes, o suma de los 12 en año)
  summary: { income: string; expense: string; net: string }
  buckets: BucketStat[]
  categories: CategoryStat[]
}

export interface SeriesPoint {
  label: string
  year: number
  month: number | null
  income: string
  expense: string
}

export interface EmergencyContribution {
  id: string
  amount: string
  occurred_on: string
}

export interface EmergencyFund {
  monthly_need: string // gasto mensual de referencia (ingreso habitual)
  target_months: number // meses objetivo (3–6)
  target: string
  saved: string
  remaining: string
  pct: number
  contributions: EmergencyContribution[]
}

// ── Cartera de inversión ────────────────────────────────────────────────────

export type AssetClass = "variable" | "fija"
export type AssetKind = "etf" | "fondo" | "accion" | "cripto" | "otro"

export interface Asset {
  id: string
  name: string
  asset_class: AssetClass
  kind: AssetKind
  weight: string
  group_id: string | null
  active: boolean
}

export interface InvestmentGroup {
  id: string
  name: string
  weight: string // % del total (grupos + activos sueltos suman 100)
  variable_pct: string // split interno del grupo (suman 100)
  fixed_pct: string
}

export interface GroupInput {
  name: string
  weight: string
  variable_pct: string
  fixed_pct: string
}

export interface MonthAsset {
  asset: Asset
  planned: string // lo que le tocaría según el reparto
  contributed: string // lo aportado de verdad este mes
  done: boolean
  total_contributed: string // acumulado de toda su historia
}

export interface Contribution {
  id: string
  asset_id: string | null
  concept: string
  amount: string
  occurred_on: string
}

export interface AssetInput {
  name: string
  asset_class: AssetClass
  kind: AssetKind
  weight: string
  group_id?: string | null
}

export type Granularity = "month" | "year"

export class ApiError extends Error {
  status: number
  fieldErrors: FieldErrors
  constructor(status: number, message: string, fieldErrors: FieldErrors = {}) {
    super(message)
    this.status = status
    this.fieldErrors = fieldErrors
    this.name = "ApiError"
  }
}

export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: (pair: TokenPair) => {
    localStorage.setItem(ACCESS_KEY, pair.access_token)
    localStorage.setItem(REFRESH_KEY, pair.refresh_token)
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

async function buildApiError(response: Response): Promise<ApiError> {
  try {
    const data = await response.json()
    if (typeof data.detail === "string") {
      return new ApiError(response.status, data.detail)
    }
    if (Array.isArray(data.detail)) {
      const fieldErrors = parseValidationErrors(data.detail)
      const first = Object.values(fieldErrors)[0] ?? "Revisa los datos introducidos."
      return new ApiError(response.status, first, fieldErrors)
    }
    return new ApiError(response.status, response.statusText)
  } catch {
    return new ApiError(response.status, response.statusText)
  }
}

interface RequestOptions {
  method?: string
  body?: unknown
  form?: FormData // subida de archivo (multipart); no se fija Content-Type
  auth?: boolean // adjunta el Bearer y reintenta con refresh en 401
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, form, auth = false } = options

  const doFetch = (): Promise<Response> => {
    const headers: Record<string, string> = {}
    // Con FormData el navegador pone el Content-Type (con boundary); no lo tocamos.
    if (form === undefined) headers["Content-Type"] = "application/json"
    const access = tokenStore.getAccess()
    if (auth && access) headers.Authorization = `Bearer ${access}`
    return fetch(`${BASE}${path}`, {
      method,
      headers,
      body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
    })
  }

  let response = await doFetch()

  // Un único intento de refresh si el access token ha caducado.
  if (response.status === 401 && auth && tokenStore.getRefresh()) {
    const refreshed = await tryRefresh()
    if (refreshed) {
      response = await doFetch()
    }
  }

  if (!response.ok) {
    throw await buildApiError(response)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

async function tryRefresh(): Promise<boolean> {
  const refresh_token = tokenStore.getRefresh()
  if (!refresh_token) return false
  try {
    const response = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token }),
    })
    if (!response.ok) {
      tokenStore.clear()
      return false
    }
    tokenStore.set((await response.json()) as TokenPair)
    return true
  } catch {
    return false
  }
}

export const api = {
  register: (email: string, nickname: string, password: string): Promise<User> =>
    request<User>("/auth/register", { method: "POST", body: { email, nickname, password } }),

  login: (identifier: string, password: string): Promise<TokenPair> =>
    request<TokenPair>("/auth/login", { method: "POST", body: { identifier, password } }),

  me: (): Promise<User> => request<User>("/auth/me", { auth: true }),

  updateProfile: (nickname: string): Promise<User> =>
    request<User>("/auth/me", { method: "PATCH", body: { nickname }, auth: true }),

  logout: (refresh_token: string): Promise<void> =>
    request<void>("/auth/logout", { method: "POST", body: { refresh_token }, auth: true }),

  categories: {
    list: (): Promise<Category[]> => request<Category[]>("/categories", { auth: true }),
    create: (name: string, bucket: Bucket): Promise<Category> =>
      request<Category>("/categories", { method: "POST", body: { name, bucket }, auth: true }),
  },

  transactions: {
    list: (filters: TransactionFilters = {}): Promise<Transaction[]> => {
      const params = new URLSearchParams()
      if (filters.from) params.set("from", filters.from)
      if (filters.to) params.set("to", filters.to)
      if (filters.category_id) params.set("category_id", filters.category_id)
      if (filters.type) params.set("type", filters.type)
      if (filters.size) params.set("size", String(filters.size))
      const qs = params.toString()
      return request<Transaction[]>(`/transactions${qs ? `?${qs}` : ""}`, { auth: true })
    },
    create: (input: TransactionInput): Promise<Transaction> =>
      request<Transaction>("/transactions", { method: "POST", body: input, auth: true }),
    update: (id: string, input: Partial<TransactionInput>): Promise<Transaction> =>
      request<Transaction>(`/transactions/${id}`, { method: "PATCH", body: input, auth: true }),
    remove: (id: string): Promise<void> =>
      request<void>(`/transactions/${id}`, { method: "DELETE", auth: true }),
    split: (id: string, parts: SplitPart[]): Promise<Transaction[]> =>
      request<Transaction[]>(`/transactions/${id}/split`, {
        method: "POST",
        body: { parts },
        auth: true,
      }),
  },

  imports: {
    preview: (file: File): Promise<PreviewResponse> => {
      const form = new FormData()
      form.append("file", file)
      return request<PreviewResponse>("/import/preview", { method: "POST", form, auth: true })
    },
    confirm: (items: ConfirmItem[]): Promise<{ created: number }> =>
      request<{ created: number }>("/import/confirm", { method: "POST", body: { items }, auth: true }),
  },

  budget: {
    get: (): Promise<Budget> => request<Budget>("/budget", { auth: true }),
    update: (b: BudgetUpdate): Promise<Budget> =>
      request<Budget>("/budget", { method: "PUT", body: b, auth: true }),
    setIncome: (year: number, month: number, amount: string): Promise<void> =>
      request<void>("/budget/income", {
        method: "PUT",
        body: { year, month, amount },
        auth: true,
      }),
  },

  forecast: {
    set: (category_id: string, amount: string): Promise<void> =>
      request<void>("/forecast", {
        method: "PUT",
        body: { category_id, amount },
        auth: true,
      }),
  },

  analytics: {
    overview: (granularity: Granularity, year: number, month: number): Promise<AnalyticsOverview> =>
      request<AnalyticsOverview>(
        `/analytics/overview?granularity=${granularity}&year=${year}&month=${month}`,
        { auth: true },
      ),
    series: (granularity: Granularity, year: number, count: number): Promise<SeriesPoint[]> =>
      request<SeriesPoint[]>(
        `/analytics/series?granularity=${granularity}&year=${year}&count=${count}`,
        { auth: true },
      ),
    recent: (months = 6): Promise<SeriesPoint[]> =>
      request<SeriesPoint[]>(`/analytics/recent?months=${months}`, { auth: true }),
  },

  emergencyFund: {
    get: (): Promise<EmergencyFund> => request<EmergencyFund>("/emergency-fund", { auth: true }),
    addContribution: (amount: string, occurred_on: string): Promise<EmergencyContribution> =>
      request<EmergencyContribution>("/emergency-fund/contributions", {
        method: "POST",
        body: { amount, occurred_on },
        auth: true,
      }),
    deleteContribution: (id: string): Promise<void> =>
      request<void>(`/emergency-fund/contributions/${id}`, { method: "DELETE", auth: true }),
    setTarget: (months: number): Promise<EmergencyFund> =>
      request<EmergencyFund>("/emergency-fund/target", {
        method: "PUT",
        body: { months },
        auth: true,
      }),
    setMonthlyNeed: (amount: string): Promise<EmergencyFund> =>
      request<EmergencyFund>("/emergency-fund/monthly-need", {
        method: "PUT",
        body: { amount },
        auth: true,
      }),
  },

  investment: {
    listGroups: (): Promise<InvestmentGroup[]> =>
      request<InvestmentGroup[]>("/investment/groups", { auth: true }),
    createGroup: (input: GroupInput): Promise<InvestmentGroup> =>
      request<InvestmentGroup>("/investment/groups", { method: "POST", body: input, auth: true }),
    updateGroup: (id: string, changes: Partial<GroupInput>): Promise<InvestmentGroup> =>
      request<InvestmentGroup>(`/investment/groups/${id}`, {
        method: "PATCH",
        body: changes,
        auth: true,
      }),
    deleteGroup: (id: string): Promise<void> =>
      request<void>(`/investment/groups/${id}`, { method: "DELETE", auth: true }),
    listAssets: (): Promise<Asset[]> =>
      request<Asset[]>("/investment/assets", { auth: true }),
    createAsset: (input: AssetInput): Promise<Asset> =>
      request<Asset>("/investment/assets", { method: "POST", body: input, auth: true }),
    updateAsset: (id: string, changes: Partial<AssetInput> & { active?: boolean }): Promise<Asset> =>
      request<Asset>(`/investment/assets/${id}`, { method: "PATCH", body: changes, auth: true }),
    deleteAsset: (id: string): Promise<void> =>
      request<void>(`/investment/assets/${id}`, { method: "DELETE", auth: true }),
    status: (on: string, total: string): Promise<MonthAsset[]> =>
      request<MonthAsset[]>(`/investment/status?on=${on}&total=${total}`, { auth: true }),
    history: (assetId?: string): Promise<Contribution[]> =>
      request<Contribution[]>(
        `/investment/history${assetId ? `?asset_id=${assetId}` : ""}`,
        { auth: true },
      ),
    contributionDates: (): Promise<string[]> =>
      request<string[]>("/investment/contribution-dates", { auth: true }),
    contribute: (
      asset_id: string,
      amount: string,
      occurred_on?: string,
      extra = false,
    ): Promise<Transaction> =>
      request<Transaction>("/investment/contributions", {
        method: "POST",
        body: { asset_id, amount, ...(occurred_on ? { occurred_on } : {}), ...(extra ? { extra: true } : {}) },
        auth: true,
      }),
    undoContribution: (asset_id: string, on: string): Promise<void> =>
      request<void>(`/investment/contributions?asset_id=${asset_id}&on=${on}`, {
        method: "DELETE",
        auth: true,
      }),
  },
}
