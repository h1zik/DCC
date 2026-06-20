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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Author</TableHead>
          <TableHead>Platform</TableHead>
          <TableHead className="text-right">Mentions</TableHead>
          <TableHead className="text-right">Engagement</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            key={`${row.platform}-${row.author}`}
            className="transition-colors duration-150 motion-reduce:transition-none hover:bg-muted/40"
          >
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
            <TableCell className="text-muted-foreground text-xs uppercase">
              {row.platform}
            </TableCell>
            <TableCell className="text-right tabular-nums">{row.mentions}</TableCell>
            <TableCell className="text-right tabular-nums">
              {row.totalEngagement.toLocaleString("id-ID")}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
