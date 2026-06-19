import "server-only";

/** Brand Hub studio outputs are shared org-wide among Project Managers. */
export function brandStudioBrandFilter(ownerBrandId?: string | null) {
  return ownerBrandId ? { ownerBrandId } : {};
}
