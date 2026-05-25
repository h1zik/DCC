/**
 * Full-bleed di dalam shell: tinggi = viewport minus header Command Center saja.
 */
export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-m-4 flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col overflow-hidden md:-m-8">
      {children}
    </div>
  );
}
