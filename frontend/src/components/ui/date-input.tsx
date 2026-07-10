import { useState } from "react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// Input de fecha que muestra un placeholder ("Inicio"/"Fin") cuando está vacío
// y se convierte en selector de fecha al enfocarlo o al tener valor. `max` limita
// la fecha máxima seleccionable (p. ej. hoy, para no permitir fechas futuras).
export function DateInput({
  value,
  onChange,
  placeholder,
  max,
  className,
  ...props
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  max?: string
  className?: string
} & Omit<React.ComponentProps<"input">, "value" | "onChange" | "type">) {
  const [focused, setFocused] = useState(false)
  const asDate = focused || value !== ""

  return (
    <Input
      type={asDate ? "date" : "text"}
      placeholder={placeholder}
      value={value}
      max={max}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => onChange(e.target.value)}
      className={cn(className)}
      {...props}
    />
  )
}
