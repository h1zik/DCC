import type { AgentUser } from "@/lib/agent/types";
import type { AiApiRole } from "./auth";

/** User sintetis untuk delegasi ke agent queries (read-only, akses penuh ruangan). */
export function createAiApiAgentUser(role: AiApiRole): AgentUser {
  const mappedRole =
    role === "ALL" || role === "CEO" || role === "ADMINISTRATOR"
      ? "CEO"
      : role === "FINANCE"
        ? "FINANCE"
        : role === "LOGISTICS"
          ? "LOGISTICS"
          : "NORMAL_USER";

  return {
    id: "ai-api-service",
    name: "Odysseus AI",
    email: "ai@internal",
    role: mappedRole,
  };
}
