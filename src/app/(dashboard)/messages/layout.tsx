/**
 * Full-bleed di dalam shell — `data-chat-shell` memicu DashboardShell
 * untuk melepas max-width, padding, dan mengisi sisa viewport.
 */
import { ChatKeyboardInset } from "@/components/chat-keyboard-inset";

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
      <ChatKeyboardInset />
      {children}
    </div>
  );
}
