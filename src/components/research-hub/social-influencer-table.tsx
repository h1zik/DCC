import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type InfluencerRow = {
  author: string;
  platform: string;
  mentions: number;
  totalEngagement: number;
  topUrl: string | null;
};

export function SocialInfluencerTable({ rows }: { rows: InfluencerRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Belum ada influencer teridentifikasi.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>Author</TableHead>
            <TableHead>Platform</TableHead>
            <TableHead className="text-right">Mentions</TableHead>
            <TableHead className="text-right">Engagement</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, idx) => (
            <TableRow
              key={`${row.platform}-${row.author}`}
              className="transition-colors duration-150 motion-reduce:transition-none hover:bg-muted/40"
            >
              <TableCell>
                <span
                  className="flex size-6 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_14%,transparent)] text-[11px] font-bold tabular-nums text-[var(--lab-accent,var(--primary))]"
                  aria-hidden
                >
                  {idx + 1}
                </span>
              </TableCell>
              <TableCell className="font-medium">
                {row.topUrl ? (
                  <a
                    href={row.topUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    @{row.author}
                  </a>
                ) : (
                  `@${row.author}`
                )}
              </TableCell>
              <TableCell>
                <span className="bg-muted text-muted-foreground inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase">
                  {row.platform}
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">{row.mentions}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {row.totalEngagement.toLocaleString("id-ID")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
