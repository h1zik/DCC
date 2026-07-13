/**
 * Diff isu antar dua crawl (baru/diperbaiki/tetap). Kunci identitas isu =
 * `type + url` (isu agregat ber-url null dibandingkan lewat count). Pure agar
 * mudah di-test.
 */

export type DiffableIssue = {
  type: string;
  url: string | null;
  severity: string;
  message: string;
  count: number;
};

export type IssueDiffEntry = {
  type: string;
  url: string | null;
  severity: string;
  message: string;
};

export type IssueDiff = {
  new: number;
  fixed: number;
  persisting: number;
  newIssues: IssueDiffEntry[];
  fixedIssues: IssueDiffEntry[];
};

const ENTRY_CAP = 50;

function keyOf(issue: DiffableIssue): string {
  return `${issue.type}::${issue.url ?? ""}`;
}

export function diffCrawlIssues(
  previous: DiffableIssue[],
  current: DiffableIssue[],
): IssueDiff {
  const prevMap = new Map(previous.map((i) => [keyOf(i), i]));
  const currMap = new Map(current.map((i) => [keyOf(i), i]));

  const newIssues: IssueDiffEntry[] = [];
  const fixedIssues: IssueDiffEntry[] = [];
  let persisting = 0;

  for (const [key, issue] of currMap) {
    const prev = prevMap.get(key);
    if (!prev) {
      newIssues.push({
        type: issue.type,
        url: issue.url,
        severity: issue.severity,
        message: issue.message,
      });
    } else if (issue.url == null && issue.count > prev.count) {
      // Isu agregat yang bertambah dihitung "baru" (memburuk).
      newIssues.push({
        type: issue.type,
        url: null,
        severity: issue.severity,
        message: `${issue.message} (${prev.count} → ${issue.count})`,
      });
    } else {
      persisting += 1;
    }
  }

  for (const [key, issue] of prevMap) {
    if (!currMap.has(key)) {
      fixedIssues.push({
        type: issue.type,
        url: issue.url,
        severity: issue.severity,
        message: issue.message,
      });
    }
  }

  return {
    new: newIssues.length,
    fixed: fixedIssues.length,
    persisting,
    newIssues: newIssues.slice(0, ENTRY_CAP),
    fixedIssues: fixedIssues.slice(0, ENTRY_CAP),
  };
}
