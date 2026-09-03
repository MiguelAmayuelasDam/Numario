import { useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"

import { PasswordStrength } from "@/components/PasswordStrength"
import { ThemeToggle } from "@/components/ThemeToggle"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api, ApiError } from "@/lib/api"
import { evaluatePassword } from "@/lib/password"

export default function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get("token") ?? ""

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const passwordValid = evaluatePassword(password).valid
  const passwordsMatch = password === confirm
  const canSubmit = token !== "" && passwordValid && passwordsMatch
  const showMismatch = confirm.length > 0 && !passwordsMatch

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await api.resetPassword(token, password)
      navigate("/login", {
        replace: true,
        state: { notice: "Contraseña actualizada. Ya puedes iniciar sesión." },
      })
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "No se pudo cambiar la contraseña")
      } else {
        setError("No se pudo cambiar la contraseña")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center p-4">
      <ThemeToggle className="absolute right-4 top-4" />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Nueva contraseña</CardTitle>
          <CardDescription>Elige una contraseña nueva para tu cuenta</CardDescription>
        </CardHeader>
        <CardContent>
          {token === "" ? (
            <div className="space-y-4">
              <p className="text-sm text-destructive" role="alert">
                El enlace no es válido. Pide uno nuevo desde «Recuperar contraseña».
              </p>
              <Button asChild className="w-full">
                <Link to="/forgot-password">Recuperar contraseña</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <PasswordStrength password={password} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Repetir contraseña</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  aria-invalid={showMismatch}
                  required
                />
                {showMismatch ? (
                  <p className="text-xs text-destructive" role="alert">
                    Las contraseñas no coinciden
                  </p>
                ) : null}
              </div>
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={!canSubmit || submitting}>
                {submitting ? "Guardando…" : "Cambiar contraseña"}
              </Button>
            </form>
          )}
          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Link to="/login" className="font-medium text-primary hover:underline">
              Volver a iniciar sesión
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
