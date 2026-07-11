import { useState } from "react"
import { CalendarIcon } from "lucide-react"

import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const displayFmt = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

function formatDisplay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`)
  return displayFmt.format(d)
}

// Selector de fecha con calendario en un popover: un solo clic abre el
// calendario, sin el formato nativo dd/mm/aaaa.
export function DatePicker({
  value,
  onChange,
  placeholder,
  min,
  max,
  className,
  "aria-label": ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  min?: string
  max?: string
  className?: string
  "aria-label"?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            "flex h-9 items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            className,
          )}
        >
          <CalendarIcon className="size-4 text-muted-foreground" />
          <span className={value ? "" : "text-muted-foreground"}>
            {value ? formatDisplay(value) : placeholder}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <Calendar
          value={value}
          min={min}
          max={max}
          onSelect={(isoDate) => {
            onChange(isoDate)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
