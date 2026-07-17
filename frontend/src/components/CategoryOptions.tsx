import type { Category } from "@/lib/api"
import { SelectGroup, SelectItem, SelectLabel } from "@/components/ui/select"
import { BUCKET_META, groupByBucket } from "@/lib/format"

interface CategoryOptionsProps {
  categories: Category[]
}

/**
 * Opciones de un `Select` de categorías, **agrupadas por cubo** y en el orden en
 * que el usuario piensa (Vida → Mes → Inversión → Ingresos → No computable).
 *
 * Cada grupo lleva su cabecera con el color del cubo, para que al elegir una
 * categoría se vea de un vistazo dónde va a caer el gasto: la lista plana
 * obligaba a saberse de memoria a qué cubo pertenece cada una de las 79.
 *
 * Se usa dentro de `<SelectContent>`, después de las opciones especiales
 * ("Sin categoría", "Todas las categorías"), que no pertenecen a ningún cubo.
 */
export function CategoryOptions({ categories }: CategoryOptionsProps) {
  return (
    <>
      {groupByBucket(categories).map(([bucket, items]) => (
        <SelectGroup key={bucket}>
          <SelectLabel className="flex items-center gap-2 pt-3 text-muted-foreground">
            <span className={"size-2 shrink-0 rounded-full " + BUCKET_META[bucket].dot} />
            {BUCKET_META[bucket].label}
            <span className="ml-1 h-px flex-1 bg-border" />
          </SelectLabel>
          {items.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.emoji ? `${c.emoji} ` : ""}
              {c.name}
            </SelectItem>
          ))}
        </SelectGroup>
      ))}
    </>
  )
}
