import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"

import { PasswordStrength } from "@/components/PasswordStrength"
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
import { useAuth } from "@/context/AuthContext"
import { ApiError } from "@/lib/api"
import { evaluatePassword } from "@/lib/password"

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [nickname, setNickname] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const passwordValid = evaluatePassword(password, { email, nickname }).valid
  const passwordsMatch = password === confirm
  const canSubmit =
    nickname.trim().length >= 3 && email.length > 0 && passwordValid && passwordsMatch

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await register(email, nickname, password)
      navigate("/", { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 422 ? "Revisa los datos introducidos." : err.message)
      } else {
        setError("No se pudo completar el registro")
      }
    } finally {
      setSubmitting(false)
    }
  }

  const showMismatch = confirm.length > 0 && !passwordsMatch

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Crear cuenta</CardTitle>
          <CardDescription>Empieza a controlar tus finanzas con Numario</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="nickname">Nick</Label>
              <Input
                id="nickname"
                type="text"
                autoComplete="username"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
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
              <PasswordStrength password={password} identity={{ email, nickname }} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Repetir contraseña</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
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
              {submitting ? "Creando cuenta…" : "Registrarme"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Inicia sesión
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
