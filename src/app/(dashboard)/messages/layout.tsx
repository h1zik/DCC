/**
 * Full-bleed di dalam shell — `data-chat-shell` memicu DashboardShell
 * untuk melepas max-width, padding, dan mengisi sisa viewport.
 */
export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      data-chat-shell
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      {children}
    </div>
  );
}
