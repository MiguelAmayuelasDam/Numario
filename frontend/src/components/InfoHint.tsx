import type { ReactNode } from "react"
import { HelpCircle } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface InfoHintProps {
  /** Qué explica este `?`, para el lector de pantalla: "Qué es la regla 50-30-20". */
  label: string
  title: string
  children: ReactNode
}

/**
 * Un `?` discreto que abre una explicación breve **junto al concepto que la
 * provoca**, sin sacar al usuario de donde está.
 *
 * Es la respuesta a "los tutoriales del principio no los ve nadie": la ayuda no
 * se va a buscar a una pestaña ni se sufre en un carrusel de bienvenida —
 * aparece donde nace la duda y solo si te interesa. El texto lo ponen los cuatro
 * conceptos (`hints.tsx`); este componente solo es el envoltorio.
 */
export function InfoHint({ label, title, children }: InfoHintProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <HelpCircle className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-2 text-sm">
        <p className="font-semibold">{title}</p>
        <div className="space-y-2 text-muted-foreground">{children}</div>
      </PopoverContent>
    </Popover>
  )
}
