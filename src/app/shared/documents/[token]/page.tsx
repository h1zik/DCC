import { notFound } from "next/navigation";
import { Download, FileText, Folder, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";

type PageProps = { params: Promise<{ token: string }> };

export default async function SharedDocumentPage({ params }: PageProps) {
  const { token } = await params;
  const now = new Date();
  const documentShare = await prisma.roomDocumentShare.findFirst({
    where: {
      token,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      document: {
        trashedAt: null,
        OR: [{ folderId: null }, { folder: { trashedAt: null } }],
      },
    },
    select: {
      document: {
        select: {
          title: true,
          fileName: true,
          mimeType: true,
          size: true,
          room: { select: { name: true } },
        },
      },
    },
  });
  const folderShare = documentShare
    ? null
    : await prisma.roomDocumentFolderShare.findFirst({
        where: {
          token,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          folder: { trashedAt: null },
        },
        select: {
          folder: {
            select: {
              name: true,
              room: { select: { name: true } },
            },
          },
        },
      });
  if (!documentShare && !folderShare) notFound();

  const isFolder = folderShare != null;
  const name = documentShare
    ? documentShare.document.title || documentShare.document.fileName
    : folderShare!.folder.name;
  const roomName = documentShare
    ? documentShare.document.room.name
    : folderShare!.folder.room.name;

  return (
    <main className="bg-muted/30 flex min-h-screen items-center justify-center p-4">
      <section className="border-border bg-card w-full max-w-lg rounded-2xl border p-6 shadow-xl sm:p-8">
        <div className="bg-primary/10 text-primary mb-5 flex size-12 items-center justify-center rounded-xl">
          {isFolder ? <Folder className="size-6" /> : <FileText className="size-6" />}
        </div>
        <p className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
          Dibagikan dari {roomName}
        </p>
        <h1 className="text-foreground break-words text-xl font-semibold">{name}</h1>
        <div className="text-muted-foreground mt-3 flex items-center gap-2 text-sm">
          <ShieldCheck className="size-4" />
          Tautan hanya-baca
        </div>
        {documentShare ? (
          <p className="text-muted-foreground mt-2 text-xs">
            {documentShare.document.mimeType} · {Math.ceil(documentShare.document.size / 1024)} KB
          </p>
        ) : (
          <p className="text-muted-foreground mt-2 text-xs">
            Folder akan diunduh sebagai arsip ZIP beserta seluruh isinya.
          </p>
        )}
        <Button render={<a href={`/api/shared/documents/${token}`} />} className="mt-6 w-full">
          <Download className="size-4" />
          {isFolder ? "Unduh folder" : "Unduh file"}
        </Button>
      </section>
    </main>
  );
}
