import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

type BackendStatus = "loading" | "ok" | "error"

const STATUS_LABEL: Record<BackendStatus, string> = {
  loading: "comprobando…",
  ok: "ok",
  error: "sin conexión",
}

export default function App() {
  const [status, setStatus] = useState<BackendStatus>("loading")

  const checkBackend = useCallback(async () => {
    setStatus("loading")
    try {
      const res = await fetch(`${API_URL}/health`)
      const data = (await res.json()) as { status?: string }
      setStatus(res.ok && data.status === "ok" ? "ok" : "error")
    } catch {
      setStatus("error")
    }
  }, [])

  useEffect(() => {
    void checkBackend()
  }, [checkBackend])

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 p-8 text-center">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">FinPer</h1>
        <p className="mt-2 text-muted-foreground">Gestor de finanzas personales</p>
      </div>

      <p className="text-sm">
        Estado del backend:{" "}
        <span
          data-testid="backend-status"
          className={
            status === "ok"
              ? "font-semibold text-green-600"
              : status === "error"
                ? "font-semibold text-destructive"
                : "font-semibold text-muted-foreground"
          }
        >
          {STATUS_LABEL[status]}
        </span>
      </p>

      <Button onClick={() => void checkBackend()}>Reintentar</Button>
    </main>
  )
}
