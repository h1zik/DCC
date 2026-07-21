import { prisma } from "../src/lib/prisma";
import { readRoomDocumentText } from "../src/lib/room-document-text";

async function main() {
  const documents = await prisma.roomDocument.findMany({
    where: { searchText: null, trashedAt: null },
    select: { id: true, fileName: true, mimeType: true, publicPath: true },
  });
  let indexed = 0;
  for (const document of documents) {
    const extracted = await readRoomDocumentText(document);
    if (!extracted.text) continue;
    await prisma.roomDocument.update({
      where: { id: document.id },
      data: { searchText: extracted.text },
    });
    indexed += 1;
  }
  console.log(`Indexed ${indexed} of ${documents.length} room documents.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
