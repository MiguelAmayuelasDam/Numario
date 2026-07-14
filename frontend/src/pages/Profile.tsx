import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/context/AuthContext"
import { ApiError } from "@/lib/api"

export default function Profile() {
  const { user, updateProfile } = useAuth()
  const currentNick = user?.nickname
  const [nickname, setNickname] = useState(currentNick ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Sincroniza el input si el nick cambia (p. ej. al restaurar la sesión).
  useEffect(() => {
    if (currentNick) setNickname(currentNick)
  }, [currentNick])

  const changed = nickname.trim() !== (user?.nickname ?? "")
  const valid = nickname.trim().length >= 3
  const canSave = changed && valid && !saving

  const save = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await updateProfile(nickname.trim())
      setSaved(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar")
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto max-w-lg p-4 sm:p-8">
      <h1 className="mb-6 text-3xl font-bold">Mi perfil</h1>

      <div className="space-y-5 rounded-xl border p-6">
        <div className="space-y-1.5">
          <Label htmlFor="nickname">Nick</Label>
          <div className="flex gap-2">
            <Input
              id="nickname"
              value={nickname}
              maxLength={30}
              onChange={(e) => {
                setNickname(e.target.value)
                setSaved(false)
              }}
            />
            <Button onClick={() => void save()} disabled={!canSave}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
          {nickname.trim().length > 0 && !valid ? (
            <p className="text-sm text-destructive">El nick debe tener al menos 3 caracteres.</p>
          ) : null}
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {saved ? <p className="text-sm text-income">Nick actualizado.</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={user?.email ?? ""} disabled readOnly />
          <p className="text-xs text-muted-foreground">El email no se puede cambiar por ahora.</p>
        </div>
      </div>
    </main>
  )
}
