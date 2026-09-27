import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type KolAuditEntity =
  | "profile"
  | "change_request"
  | "schedule"
  | "order"
  | "campaign"
  | "budget"
  | "brief"
  | "category"
  | "endorse_type"
  | "product";

type Client = Prisma.TransactionClient | typeof prisma;

/** Catat satu jejak perubahan KOL Hub (append-only). */
export async function logKolAudit(
  client: Client,
  input: {
    actorId: string | null;
    entityType: KolAuditEntity;
    entityId: string;
    action: string;
    meta?: Prisma.InputJsonValue;
  },
) {
  await client.kolAuditEvent.create({
    data: {
      actorId: input.actorId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      meta: input.meta,
    },
  });
}
