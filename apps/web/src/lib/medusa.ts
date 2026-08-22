import Medusa from "@medusajs/js-sdk"

const MEDUSA_BACKEND_URL = import.meta.env.VITE_MEDUSA_BACKEND_URL || "http://localhost:9000"
const PUBLISHABLE_KEY = import.meta.env.VITE_MEDUSA_PUBLISHABLE_KEY || ""

export const sdk = new Medusa({
  baseUrl: MEDUSA_BACKEND_URL,
  publishableKey: PUBLISHABLE_KEY,
  debug: import.meta.env.DEV && import.meta.env.VITE_MEDUSA_DEBUG === 'true',
})

// Default region for PawTag (New Zealand)
export const DEFAULT_REGION = "NZ"

// Cache NZ region ID — it never changes at runtime
let _nzRegionId: string | null = null;

export async function getNzRegionId(): Promise<string> {
  if (_nzRegionId) return _nzRegionId;
  const { regions } = await sdk.store.region.list()
  const nz = regions.find((r) => r.countries?.some((c) => c.iso_2 === "nz"))
  if (!nz) throw new Error("NZ region not found in Medusa")
  _nzRegionId = nz.id;
  return nz.id
}
