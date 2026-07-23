import { cache } from "react";
import { auth } from "@/lib/auth";

/**
 * Dedup `auth()` dalam satu render pass (root layout + layout grup + page
 * memanggilnya masing-masing; decode JWT cukup sekali per request).
 */
export const getSession = cache(() => auth());
