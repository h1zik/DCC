"use client";

import { Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type CopyKeywords = {
  listingTitle?: string[];
  listingDescription?: string[];
  socialMedia?: string[];
};

function KeywordChips({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">—</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((k) => (
        <span
          key={k}
          className="bg-muted text-foreground rounded-full px-2.5 py-1 text-xs"
        >
          {k}
        </span>
      ))}
    </div>
  );
}

export function CopyKeywordsPanel({ data }: { data: CopyKeywords }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Copy className="size-4" aria-hidden />
          Copywriting Keywords
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="title">
          <TabsList className="mb-3">
            <TabsTrigger value="title">Judul Listing</TabsTrigger>
            <TabsTrigger value="desc">Deskripsi</TabsTrigger>
            <TabsTrigger value="social">Sosmed</TabsTrigger>
          </TabsList>
          <TabsContent value="title">
            <KeywordChips items={data.listingTitle ?? []} />
          </TabsContent>
          <TabsContent value="desc">
            <KeywordChips items={data.listingDescription ?? []} />
          </TabsContent>
          <TabsContent value="social">
            <KeywordChips items={data.socialMedia ?? []} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
