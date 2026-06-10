export type RoomDocumentRow = {
  id: string;
  title: string | null;
  fileName: string;
  mimeType: string;
  size: number;
  publicPath: string;
  thumbPath: string | null;
  createdAt: Date;
  folderId: string | null;
  tags: string[];
  uploadedBy: { id: string; name: string | null; email: string };
};
