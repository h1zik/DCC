"use client";

import { Copy } from "lucide-react";
import { hub } from "@/components/research-hub/research-hub-primitives";
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
          className="bg-muted/60 text-foreground inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium"
        >
          {k}
        </span>
      ))}
    </div>
  );
}

export function CopyKeywordsPanel({
  data,
  bare = false,
}: {
  data: CopyKeywords;
  bare?: boolean;
}) {
  const tabs = (
    <Tabs defaultValue="title">
      <TabsList className="mb-3 h-8">
        <TabsTrigger value="title" className="text-xs">
          Judul Listing
        </TabsTrigger>
        <TabsTrigger value="desc" className="text-xs">
          Deskripsi
        </TabsTrigger>
        <TabsTrigger value="social" className="text-xs">
          Sosmed
        </TabsTrigger>
      </TabsList>
      <TabsContent value="title" className="animate-in fade-in duration-200 motion-reduce:animate-none">
        <KeywordChips items={data.listingTitle ?? []} />
      </TabsContent>
      <TabsContent value="desc" className="animate-in fade-in duration-200 motion-reduce:animate-none">
        <KeywordChips items={data.listingDescription ?? []} />
      </TabsContent>
      <TabsContent value="social" className="animate-in fade-in duration-200 motion-reduce:animate-none">
        <KeywordChips items={data.socialMedia ?? []} />
      </TabsContent>
    </Tabs>
  );

  if (bare) {
    return <div className={hub.panel}>{tabs}</div>;
  }

  return (
    <div className={hub.panel}>
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Copy className="size-4" aria-hidden />
        Copywriting Keywords
      </p>
      {tabs}
    </div>
  );
}
