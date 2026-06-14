"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { SocialListeningPlatform } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMarketAnalyst } from "@/lib/research/auth";
import {
  beginSocialListeningSync,
  finalizeSocialListeningBatch,
} from "@/lib/research/social-listening/social-sync";

const monitorSchema = z.object({
  name: z.string().min(1).max(120),
  keywords: z.array(z.string().min(1).max(100)).min(1).max(20),
  platforms: z
    .array(z.nativeEnum(SocialListeningPlatform))
    .min(1)
    .max(2),
});

export async function createSocialListeningMonitor(
  input: z.infer<typeof monitorSchema>,
) {
  const session = await requireMarketAnalyst();
  const data = monitorSchema.parse(input);

  const monitor = await prisma.socialListeningMonitor.create({
    data: {
      name: data.name,
      keywords: data.keywords.map((k) => k.trim()),
      platforms: data.platforms,
      createdById: session.user.id,
    },
  });

  revalidatePath("/research-hub/social-listening");
  return { id: monitor.id };
}

export async function refreshSocialListeningMonitor(monitorId: string) {
  await requireMarketAnalyst();
  z.string().min(1).parse(monitorId);

  const { batchId } = await beginSocialListeningSync(monitorId);

  after(async () => {
    try {
      await finalizeSocialListeningBatch(batchId);
    } catch (err) {
      console.error("[refreshSocialListeningMonitor] finalize gagal", err);
    }
  });

  revalidatePath("/research-hub/social-listening");
  revalidatePath(`/research-hub/social-listening/${monitorId}`);
}

export async function toggleSocialListeningMonitorActive(
  monitorId: string,
  isActive: boolean,
) {
  await requireMarketAnalyst();
  z.string().min(1).parse(monitorId);

  await prisma.socialListeningMonitor.update({
    where: { id: monitorId },
    data: { isActive },
  });

  revalidatePath("/research-hub/social-listening");
}

export async function deleteSocialListeningMonitor(monitorId: string) {
  await requireMarketAnalyst();
  z.string().min(1).parse(monitorId);

  await prisma.socialListeningMonitor.delete({ where: { id: monitorId } });
  revalidatePath("/research-hub/social-listening");
}
