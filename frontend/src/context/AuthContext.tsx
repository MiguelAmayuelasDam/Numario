import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

import { api, tokenStore, type User } from "@/lib/api"

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  loading: boolean
  login: (identifier: string, password: string) => Promise<void>
  register: (email: string, nickname: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Al montar, si hay tokens persistidos intentamos restaurar la sesión.
  useEffect(() => {
    let active = true
    const restore = async () => {
      if (!tokenStore.getAccess()) {
        setLoading(false)
        return
      }
      try {
        const me = await api.me()
        if (active) setUser(me)
      } catch {
        tokenStore.clear()
      } finally {
        if (active) setLoading(false)
      }
    }
    void restore()
    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async (identifier: string, password: string) => {
    const tokens = await api.login(identifier, password)
    tokenStore.set(tokens)
    setUser(await api.me())
  }, [])

  const register = useCallback(
    async (email: string, nickname: string, password: string) => {
      await api.register(email, nickname, password)
      // Auto-login tras el registro para una UX fluida.
      const tokens = await api.login(email, password)
      tokenStore.set(tokens)
      setUser(await api.me())
    },
    [],
  )

  const logout = useCallback(async () => {
    const refresh = tokenStore.getRefresh()
    if (refresh) {
      try {
        await api.logout(refresh)
      } catch {
        // El logout es best-effort; limpiamos igualmente el estado local.
      }
    }
    tokenStore.clear()
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated: user !== null, loading, login, register, logout }),
    [user, loading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>")
  }
  return context
}
