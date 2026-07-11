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
}

export interface SplitPart {
  amount: string
  category_id: string | null
}

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
  auth?: boolean // adjunta el Bearer y reintenta con refresh en 401
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = false } = options

  const doFetch = (): Promise<Response> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    const access = tokenStore.getAccess()
    if (auth && access) headers.Authorization = `Bearer ${access}`
    return fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
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
}
