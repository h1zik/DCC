"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ReportShareLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}${path}`
        : path;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link disalin.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Gagal menyalin link.");
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={handleCopy}>
      <Link2 className="mr-1.5 size-3.5" />
      {copied ? "Tersalin" : "Copy Link Internal"}
    </Button>
  );
}
