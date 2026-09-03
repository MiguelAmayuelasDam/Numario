import { useState } from "react"
import { Link } from "react-router-dom"

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
import { api } from "@/lib/api"

export default function ForgotPassword() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (email.trim() === "" || submitting) return
    setSubmitting(true)
    try {
      // La respuesta es siempre la misma exista o no el email (no se filtra).
      // Por eso mostramos el mismo mensaje incluso si la API fallara puntualmente.
      await api.forgotPassword(email.trim())
    } catch {
      // Silencioso a propósito: no revelar nada sobre el email.
    } finally {
      setSent(true)
      setSubmitting(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center p-4">
      <ThemeToggle className="absolute right-4 top-4" />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Recuperar contraseña</CardTitle>
          <CardDescription>
            {sent
              ? "Revisa tu correo"
              : "Te enviaremos un enlace para crear una contraseña nueva"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Si <span className="font-medium text-foreground">{email.trim()}</span> está
                registrado, te hemos enviado un correo con un enlace para restablecer tu
                contraseña. El enlace caduca en 1 hora.
              </p>
              <Button asChild className="w-full">
                <Link to="/login">Volver a iniciar sesión</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
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
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Enviando…" : "Enviar enlace"}
              </Button>
            </form>
          )}
          <p className="mt-4 text-center text-sm text-muted-foreground">
            ¿Te acuerdas de tu contraseña?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Inicia sesión
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
