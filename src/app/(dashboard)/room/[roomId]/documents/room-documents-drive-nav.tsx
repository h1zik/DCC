"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Folder,
  FolderOpen,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  getChildFolders,
  getFolderBreadcrumbs,
  type RoomFolderNode,
} from "@/lib/room-document-folders";

export type DriveFolderRow = RoomFolderNode & {
  _count: { documents: number };
};

export function DriveBreadcrumb({
  currentFolderId,
  folders,
  onNavigate,
}: {
  currentFolderId: string | null;
  folders: RoomFolderNode[];
  onNavigate: (folderId: string | null) => void;
}) {
  const crumbs = getFolderBreadcrumbs(currentFolderId, folders);
  return (
    <nav
      aria-label="Lokasi folder"
      className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5 text-sm"
    >
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={c.id ?? "root"} className="flex min-w-0 items-center gap-0.5">
            {i > 0 ? (
              <ChevronRight
                className="text-muted-foreground size-3.5 shrink-0 opacity-60"
                aria-hidden
              />
            ) : null}
            {isLast ? (
              <span className="text-foreground truncate font-medium">{c.name}</span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(c.id)}
                className="text-muted-foreground hover:text-foreground truncate transition-colors hover:underline"
              >
                {c.name}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function DriveFolderTreeNode({
  folder,
  folders,
  currentFolderId,
  depth,
  isRoomManager,
  onNavigate,
  onRename,
  onDelete,
  onDownload,
}: {
  folder: DriveFolderRow;
  folders: DriveFolderRow[];
  currentFolderId: string | null;
  depth: number;
  isRoomManager: boolean;
  onNavigate: (folderId: string | null) => void;
  onRename: (folder: DriveFolderRow) => void;
  onDelete: (folder: DriveFolderRow) => void;
  onDownload: (folder: DriveFolderRow) => void;
}) {
  const children = getChildFolders(folders, folder.id) as DriveFolderRow[];
  const [expanded, setExpanded] = useState(depth < 1);
  const active = currentFolderId === folder.id;
  const hasChildren = children.length > 0;

  return (
    <div>
      <div className="group flex items-center gap-0.5" style={{ paddingLeft: depth * 12 }}>
        {hasChildren ? (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground flex size-6 shrink-0 items-center justify-center rounded-md"
            aria-label={expanded ? "Ciutkan" : "Bentangkan"}
            onClick={() => setExpanded((v) => !v)}
          >
            <ChevronDown
              className={cn("size-3.5 transition-transform", !expanded && "-rotate-90")}
            />
          </button>
        ) : (
          <span className="size-6 shrink-0" aria-hidden />
        )}
        <button
          type="button"
          onClick={() => onNavigate(folder.id)}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
            active
              ? "bg-primary text-primary-foreground"
              : "text-foreground hover:bg-muted",
          )}
        >
          {active ? (
            <FolderOpen className="size-4 shrink-0 opacity-90" />
          ) : (
            <Folder className="size-4 shrink-0 opacity-70" />
          )}
          <span className="min-w-0 flex-1 truncate">{folder.name}</span>
          <span
            className={cn(
              "shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
              active
                ? "bg-primary-foreground/15 text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {folder._count.documents}
          </span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Aksi folder ${folder.name}`}
                className="text-muted-foreground hover:text-foreground size-7 shrink-0 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100"
              />
            }
          >
            <MoreVertical className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={4}>
            <DropdownMenuItem onClick={() => onDownload(folder)}>
              <Download className="size-3.5" />
              Unduh sebagai ZIP
            </DropdownMenuItem>
            {isRoomManager ? (
              <>
                <DropdownMenuItem onClick={() => onRename(folder)}>
                  <Pencil className="size-3.5" />
                  Ganti nama
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDelete(folder)}
                >
                  <Trash2 className="size-3.5" />
                  Hapus folder
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {expanded && hasChildren
        ? children.map((child) => (
            <DriveFolderTreeNode
              key={child.id}
              folder={child}
              folders={folders}
              currentFolderId={currentFolderId}
              depth={depth + 1}
              isRoomManager={isRoomManager}
              onNavigate={onNavigate}
              onRename={onRename}
              onDelete={onDelete}
              onDownload={onDownload}
            />
          ))
        : null}
    </div>
  );
}

export function DriveFolderTree({
  folders,
  currentFolderId,
  rootFileCount,
  isRoomManager,
  onNavigate,
  onRename,
  onDelete,
  onDownload,
}: {
  folders: DriveFolderRow[];
  currentFolderId: string | null;
  rootFileCount: number;
  isRoomManager: boolean;
  onNavigate: (folderId: string | null) => void;
  onRename: (folder: DriveFolderRow) => void;
  onDelete: (folder: DriveFolderRow) => void;
  onDownload: (folder: DriveFolderRow) => void;
}) {
  const roots = getChildFolders(folders, null) as DriveFolderRow[];
  const atRoot = currentFolderId === null;

  return (
    <nav className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={() => onNavigate(null)}
        className={cn(
          "flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
          atRoot
            ? "bg-primary text-primary-foreground"
            : "text-foreground hover:bg-muted",
        )}
      >
        {atRoot ? (
          <FolderOpen className="size-4 shrink-0" />
        ) : (
          <Folder className="size-4 shrink-0 opacity-70" />
        )}
        <span className="min-w-0 flex-1 truncate font-medium">Semua file</span>
        <span
          className={cn(
            "shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
            atRoot
              ? "bg-primary-foreground/15 text-primary-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          {rootFileCount}
        </span>
      </button>
      {roots.map((f) => (
        <DriveFolderTreeNode
          key={f.id}
          folder={f}
          folders={folders}
          currentFolderId={currentFolderId}
          depth={0}
          isRoomManager={isRoomManager}
          onNavigate={onNavigate}
          onRename={onRename}
          onDelete={onDelete}
          onDownload={onDownload}
        />
      ))}
    </nav>
  );
}

export function DriveFolderGridCard({
  folder,
  view,
  isRoomManager,
  onOpen,
  onRename,
  onDelete,
  onDownload,
}: {
  folder: DriveFolderRow;
  view: "grid" | "list";
  isRoomManager: boolean;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  onDownload: () => void;
}) {
  if (view === "list") {
    return (
      <li>
        <div className="hover:bg-muted/40 flex items-center gap-3 px-3 py-2 transition-colors">
          <button
            type="button"
            onClick={onOpen}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            <div className="bg-amber-500/15 text-amber-700 dark:text-amber-400 flex size-9 shrink-0 items-center justify-center rounded-md">
              <Folder className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-foreground truncate text-sm font-medium">{folder.name}</p>
              <p className="text-muted-foreground text-[11px]">Folder</p>
            </div>
          </button>
          <span className="text-muted-foreground text-[11px] tabular-nums">
            {folder._count.documents} file
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Aksi folder" />
              }
            >
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onDownload}>
                <Download className="size-3.5" />
                Unduh ZIP
              </DropdownMenuItem>
              {isRoomManager ? (
                <>
                  <DropdownMenuItem onClick={onRename}>
                    <Pencil className="size-3.5" />
                    Ganti nama
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={onDelete}>
                    <Trash2 className="size-3.5" />
                    Hapus
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </li>
    );
  }

  return (
    <li>
      <div className="border-border bg-card group relative overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md">
        <button
          type="button"
          onClick={onOpen}
          className="flex w-full flex-col items-stretch text-left"
        >
          <div className="bg-amber-500/10 flex aspect-[4/3] items-center justify-center">
            <Folder className="text-amber-600 dark:text-amber-400 size-12 opacity-90" />
          </div>
          <div className="space-y-0.5 p-3">
            <p className="text-foreground line-clamp-2 text-sm font-medium leading-snug">
              {folder.name}
            </p>
            <p className="text-muted-foreground text-[11px]">
              Folder · {folder._count.documents} file
            </p>
          </div>
        </button>
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            className="size-8 shadow-sm"
            aria-label="Unduh folder sebagai ZIP"
            title="Unduh ZIP"
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
          >
            <Download className="size-4" />
          </Button>
          {isRoomManager ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="secondary"
                    className="size-8 shadow-sm"
                    aria-label="Aksi folder"
                  />
                }
              >
                <MoreVertical className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onRename}>
                  <Pencil className="size-3.5" />
                  Ganti nama
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={onDelete}>
                  <Trash2 className="size-3.5" />
                  Hapus
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
    </li>
  );
}
