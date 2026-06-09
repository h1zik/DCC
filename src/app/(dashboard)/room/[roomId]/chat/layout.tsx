type ChatLayoutProps = {
  children: React.ReactNode;
};

/** Chat full-bleed: isi sisa viewport, hanya area pesan yang scroll. */
export default function RoomChatLayout({ children }: ChatLayoutProps) {
  return (
    <div
      data-chat-shell
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
    >
      {children}
    </div>
  );
}
