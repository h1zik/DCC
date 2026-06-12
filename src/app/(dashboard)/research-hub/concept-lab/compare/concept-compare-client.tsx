"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ConceptCompareTable } from "@/components/research-hub/concept-compare-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type ComparePageData = {
  summary: string;
  dimensions: {
    label: string;
    scores: {
      conceptId: string;
      conceptTitle: string;
      score: number;
      note: string;
    }[];
  }[];
  winnerId: string | null;
  recommendation: string;
  conceptIds: string[];
};

export function ConceptCompareClient({ data }: { data: ComparePageData }) {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/research-hub/concept-lab"
          className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 text-xs"
        >
          <ArrowLeft className="size-3" /> Kembali ke Concept Lab
        </Link>
        <h1 className="text-xl font-semibold">Perbandingan Konsep</h1>
        <p className="text-muted-foreground text-sm">
          {data.conceptIds.length} konsep dibandingkan head-to-head
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ringkasan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed">
          <p>{data.summary}</p>
          {data.recommendation ? (
            <p className="font-medium">{data.recommendation}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Matrix Perbandingan</CardTitle>
        </CardHeader>
        <CardContent>
          <ConceptCompareTable dimensions={data.dimensions} />
        </CardContent>
      </Card>
    </div>
  );
}
