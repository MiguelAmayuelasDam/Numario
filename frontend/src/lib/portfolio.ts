import type { Asset, InvestmentGroup } from "@/lib/api"

/**
 * Peso efectivo de un activo sobre el total: grupo × split del grupo × activo
 * (literal). Un activo suelto pesa directamente su % del total.
 */
export function effectiveFraction(asset: Asset, groups: InvestmentGroup[]): number {
  const assetFrac = Number(asset.weight) / 100
  if (asset.group_id) {
    const group = groups.find((g) => g.id === asset.group_id)
    if (!group) return 0
    const groupFrac = Number(group.weight) / 100
    const classPct =
      asset.asset_class === "variable" ? Number(group.variable_pct) : Number(group.fixed_pct)
    return groupFrac * (classPct / 100) * assetFrac
  }
  return assetFrac
}
