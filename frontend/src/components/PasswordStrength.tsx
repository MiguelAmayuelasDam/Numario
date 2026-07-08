import { Check, X } from "lucide-react"

import { evaluatePassword, type Identity } from "@/lib/password"
import { cn } from "@/lib/utils"

const REQUIREMENTS: { key: keyof ReturnType<typeof evaluatePassword>["checks"]; label: string }[] =
  [
    { key: "length", label: "Al menos 8 caracteres" },
    { key: "upper", label: "Una mayúscula" },
    { key: "lower", label: "Una minúscula" },
    { key: "digit", label: "Un número" },
    { key: "symbol", label: "Un símbolo" },
    { key: "notCommon", label: "No es una contraseña común" },
    { key: "notIdentity", label: "No contiene tu email ni tu nick" },
  ]

const BAR_COLORS = [
  "bg-destructive",
  "bg-destructive",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-lime-500",
  "bg-green-600",
]

const STRENGTH_LABEL = ["Muy débil", "Muy débil", "Débil", "Aceptable", "Fuerte", "Muy fuerte"]

export function PasswordStrength({
  password,
  identity,
}: {
  password: string
  identity?: Identity
}) {
  const { checks, score, valid } = evaluatePassword(password, identity)

  if (password.length === 0) return null

  return (
    <div className="space-y-2" data-testid="password-strength">
      <div className="flex items-center gap-2">
        <div className="flex h-1.5 flex-1 gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={cn(
                "h-full flex-1 rounded-full transition-colors",
                i < score ? BAR_COLORS[score] : "bg-muted",
              )}
            />
          ))}
        </div>
        <span className="w-20 text-right text-xs text-muted-foreground">
          {STRENGTH_LABEL[score]}
        </span>
      </div>
      <ul className="space-y-1">
        {REQUIREMENTS.map((req) => {
          const ok = checks[req.key]
          return (
            <li
              key={req.key}
              className={cn(
                "flex items-center gap-1.5 text-xs",
                ok ? "text-green-600" : "text-muted-foreground",
              )}
            >
              {ok ? <Check className="size-3.5" /> : <X className="size-3.5" />}
              {req.label}
            </li>
          )
        })}
      </ul>
      {valid ? null : (
        <p className="sr-only" role="status">
          La contraseña aún no cumple todos los requisitos
        </p>
      )}
    </div>
  )
}
