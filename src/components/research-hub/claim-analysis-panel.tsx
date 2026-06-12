import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type ClaimAnalysisData = {
  overused?: string[];
  underserved?: string[];
};

export function ClaimAnalysisPanel({ data }: { data: ClaimAnalysisData }) {
  const overused = data.overused ?? [];
  const underserved = data.underserved ?? [];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Klaim Overused</CardTitle>
        </CardHeader>
        <CardContent>
          {overused.length === 0 ? (
            <p className="text-muted-foreground text-sm">—</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {overused.map((item, i) => (
                <li key={`over-${i}`} className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  {item}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Klaim Underserved</CardTitle>
        </CardHeader>
        <CardContent>
          {underserved.length === 0 ? (
            <p className="text-muted-foreground text-sm">—</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {underserved.map((item, i) => (
                <li key={`under-${i}`} className="flex gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400">•</span>
                  {item}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
