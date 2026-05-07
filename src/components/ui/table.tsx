"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

type TableProps = React.ComponentProps<"table"> & {
  /**
   * Tabel mengisi lebar kontainer: `table-fixed`, teks boleh wrap,
   * dan kontainer mendukung scroll dua arah (cocok untuk grid lebar).
   */
  fitViewport?: boolean;
  /** Class tambahan pada wrapper di luar `<table>`. */
  containerClassName?: string;
  /** Style inline untuk wrapper (mis. `maxHeight` untuk viewport scroll internal). */
  containerStyle?: React.CSSProperties;
};

function Table({
  className,
  containerClassName,
  containerStyle,
  fitViewport = false,
  ...props
}: TableProps) {
  return (
    <div
      data-slot="table-container"
      style={containerStyle}
      className={cn(
        "relative w-full",
        fitViewport
          ? "min-w-0 overflow-auto [&_th]:whitespace-normal [&_td]:whitespace-normal [&_th]:break-words [&_td]:break-words [&_th]:align-top [&_td]:align-top [&_th]:px-1.5 [&_td]:px-1.5 [&_th]:py-1.5 [&_td]:py-1.5 [&_th]:h-auto [&_th]:min-h-8"
          : "overflow-x-auto [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap",
        containerClassName,
      )}
    >
      <table
        data-slot="table"
        className={cn(
          "w-full caption-bottom text-sm",
          fitViewport && "table-fixed min-w-0",
          className,
        )}
        {...props}
      />
    </div>
  )
}

type TableHeaderProps = React.ComponentProps<"thead"> & {
  /**
   * Sticky kolom header di atas saat scroll vertikal di dalam viewport.
   * Cocok dipakai berbarengan dengan `Table.containerStyle.maxHeight`.
   */
  sticky?: boolean;
};

function TableHeader({ className, sticky = false, ...props }: TableHeaderProps) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "[&_tr]:border-b",
        sticky &&
          "[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card supports-backdrop-filter:[&_th]:bg-card/95 supports-backdrop-filter:[&_th]:backdrop-blur-sm [&_th]:shadow-[inset_0_-1px_0_var(--border)]",
        className,
      )}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn("p-2 align-middle [&:has([role=checkbox])]:pr-0", className)}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
