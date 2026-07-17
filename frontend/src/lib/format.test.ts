import { describe, expect, it } from "vitest"

import { type AmountSizes, BUCKET_ORDER, amountSizeClass, groupByBucket } from "@/lib/format"
import type { Bucket } from "@/lib/api"

const SIZES: AmountSizes = ["grande", "medio", "pequeño"]

describe("amountSizeClass", () => {
  it("deja el tamaño grande para los importes del día a día", () => {
    expect(amountSizeClass("0,00 €", SIZES)).toBe("grande")
    expect(amountSizeClass("42,90 €", SIZES)).toBe("grande")
    expect(amountSizeClass("1.234,56 €", SIZES)).toBe("grande")
  })

  it("baja un paso con los miles largos", () => {
    expect(amountSizeClass("12.345,67 €", SIZES)).toBe("medio")
    expect(amountSizeClass("123.456,78 €", SIZES)).toBe("medio")
  })

  it("baja al mínimo con los millones, que son los que desbordaban", () => {
    expect(amountSizeClass("1.234.567,89 €", SIZES)).toBe("pequeño")
    // El tope del validador (MAX_AMOUNT): el caso que se comía el donut.
    expect(amountSizeClass("9.999.999,00 €", SIZES)).toBe("pequeño")
  })

  it("cuenta también el signo, que ocupa", () => {
    expect(amountSizeClass("−9.999.999,00 €", SIZES)).toBe("pequeño")
  })
})

const item = (name: string, bucket: Bucket) => ({ name, bucket })

describe("groupByBucket", () => {
  it("presenta los cubos en el orden del 50-30-20, no en el que llegan", () => {
    // Tal y como los sirve la API: ordenados por nombre de cubo, que
    // alfabéticamente da "income, investment, living…" y no significa nada.
    const grouped = groupByBucket([
      item("Nómina", "income"),
      item("Inversiones", "investment"),
      item("Supermercado", "living"),
      item("Restaurante", "monthly"),
      item("Traspasos", "transfer"),
    ])

    expect(grouped.map(([bucket]) => bucket)).toEqual([
      "living",
      "monthly",
      "investment",
      "income",
      "transfer",
    ])
  })

  it("mete cada categoría en su cubo", () => {
    const grouped = groupByBucket([
      item("Supermercado", "living"),
      item("Restaurante", "monthly"),
      item("Hipoteca", "living"),
    ])

    expect(grouped).toEqual([
      ["living", [item("Supermercado", "living"), item("Hipoteca", "living")]],
      ["monthly", [item("Restaurante", "monthly")]],
    ])
  })

  it("omite los cubos que no tienen ninguna categoría", () => {
    const grouped = groupByBucket([item("Supermercado", "living")])

    expect(grouped).toHaveLength(1)
    expect(grouped[0][0]).toBe("living")
  })

  it("devuelve vacío si no hay categorías", () => {
    expect(groupByBucket([])).toEqual([])
  })

  it("respeta el orden original dentro de cada cubo", () => {
    const grouped = groupByBucket([
      item("Zapatos", "monthly"),
      item("Agua", "monthly"),
      item("Manzana", "monthly"),
    ])

    // No reordena: la API ya los manda por nombre y no nos toca opinar.
    expect(grouped[0][1].map((i) => i.name)).toEqual(["Zapatos", "Agua", "Manzana"])
  })

  it("BUCKET_ORDER cubre todos los cubos que existen", () => {
    const all: Bucket[] = ["living", "monthly", "investment", "income", "transfer"]
    expect([...BUCKET_ORDER].sort()).toEqual([...all].sort())
  })
})
