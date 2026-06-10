"use client";

import {
  CalendarDays,
  ChevronDown,
  Flag,
  Link2,
  ListChecks,
  Paperclip,
  Plus,
  Tag,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { TaskPriority, TaskStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TaskDocumentUploadOptions } from "@/components/tasks/task-document-upload-options";
import type { RoomFolderNode } from "@/lib/room-document-folders";
import { taskStatusLabel } from "@/lib/task-status-ui";
import { cn } from "@/lib/utils";

export type TaskFormTag = {
  id: string;
  name: string;
  colorHex: string;
};

export type TaskFormUser = {
  id: string;
  name: string | null;
  email: string;
};

export type TaskFormPendingLink = {
  id: string;
  url: string;
  title: string;
};

/* -------------------------------------------------------------------------- */
/*                               Section shell                                 */
/* -------------------------------------------------------------------------- */

export function TaskFormSection({
  icon,
  title,
  description,
  children,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "border-border/70 bg-card/40 space-y-3 rounded-xl border p-4 shadow-sm",
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        {icon ? (
          <span
            className="bg-primary/10 text-primary mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg"
            aria-hidden
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <h3 className="text-foreground text-sm font-semibold">{title}</h3>
          {description ? (
            <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function TaskFormCollapsibleSection({
  icon,
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <div className="border-border/70 bg-card/40 overflow-hidden rounded-xl border shadow-sm">
        <CollapsibleTrigger className="hover:bg-muted/30 flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors">
          {icon ? (
            <span
              className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg"
              aria-hidden
            >
              {icon}
            </span>
          ) : null}
          <span className="text-foreground min-w-0 flex-1 text-sm font-semibold">
            {title}
          </span>
          {badge}
          <ChevronDown
            className="text-muted-foreground size-4 shrink-0 transition-transform [[data-panel-open]_&]:rotate-180"
            aria-hidden
          />
        </CollapsibleTrigger>
        <CollapsiblePanel>
          <div className="border-border/60 space-y-3 border-t px-4 py-4">
            {children}
          </div>
        </CollapsiblePanel>
      </div>
    </Collapsible>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Core field blocks                              */
/* -------------------------------------------------------------------------- */

export function TaskFormEssentials({
  projectId,
  projects,
  onProjectChange,
  projectDisabled,
  title,
  onTitleChange,
  titleId = "task-form-title",
  description,
  onDescriptionChange,
  descriptionId = "task-form-desc",
}: {
  projectId: string;
  projects: { value: string; label: React.ReactNode }[];
  onProjectChange: (id: string) => void;
  projectDisabled?: boolean;
  title: string;
  onTitleChange: (v: string) => void;
  titleId?: string;
  description: string;
  onDescriptionChange: (v: string) => void;
  descriptionId?: string;
}) {
  return (
    <TaskFormSection
      icon={<ListChecks className="size-4" />}
      title="Apa tugasnya?"
      description="Judul yang jelas memudahkan tim menemukan tugas di papan."
    >
      {projects.length > 1 ? (
        <div className="space-y-1.5">
          <Label className="text-xs">Proyek</Label>
          <Select
            value={projectId}
            items={projects}
            disabled={projectDisabled}
            onValueChange={(v) => {
              if (v) onProjectChange(v);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pilih proyek" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor={titleId} className="text-xs">
          Judul tugas <span className="text-destructive">*</span>
        </Label>
        <Input
          id={titleId}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Misalnya: Desain landing page Q3"
          className="text-base"
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={descriptionId} className="text-xs">
          Deskripsi <span className="text-muted-foreground font-normal">(opsional)</span>
        </Label>
        <Textarea
          id={descriptionId}
          rows={3}
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Konteks, deliverable, atau catatan untuk tim…"
          className="resize-y min-h-[4.5rem]"
        />
      </div>
    </TaskFormSection>
  );
}

export function priorityLabel(p: TaskPriority): string {
  switch (p) {
    case TaskPriority.HIGH:
      return "Tinggi";
    case TaskPriority.MEDIUM:
      return "Sedang";
    case TaskPriority.LOW:
      return "Rendah";
    default:
      return p;
  }
}

function priorityTone(p: TaskPriority): string {
  switch (p) {
    case TaskPriority.HIGH:
      return "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300";
    case TaskPriority.MEDIUM:
      return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case TaskPriority.LOW:
      return "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

export function TaskFormPlanning({
  status,
  onStatusChange,
  statusDisabled,
  priority,
  onPriorityChange,
  dueDate,
  onDueDateChange,
  dueDateId = "task-form-due",
  approval,
  onApprovalChange,
  approvalDisabled,
  approvalId = "task-form-approval",
  showStatus = true,
}: {
  status: TaskStatus;
  onStatusChange: (s: TaskStatus) => void;
  statusDisabled?: boolean;
  priority: TaskPriority;
  onPriorityChange: (p: TaskPriority) => void;
  dueDate: string;
  onDueDateChange: (v: string) => void;
  dueDateId?: string;
  approval: boolean;
  onApprovalChange: (v: boolean) => void;
  approvalDisabled?: boolean;
  approvalId?: string;
  showStatus?: boolean;
}) {
  return (
    <TaskFormSection
      icon={<CalendarDays className="size-4" />}
      title="Jadwal & prioritas"
      description="Atur kapan harus selesai dan seberapa penting tugas ini."
    >
      <div
        className={cn(
          "grid gap-3",
          showStatus ? "sm:grid-cols-3" : "sm:grid-cols-2",
        )}
      >
        {showStatus ? (
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select
              value={status}
              disabled={statusDisabled}
              onValueChange={(v) => {
                if (v) onStatusChange(v as TaskStatus);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.values(TaskStatus) as TaskStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {taskStatusLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label className="text-xs">Prioritas</Label>
          <Select
            value={priority}
            onValueChange={(v) => {
              if (v) onPriorityChange(v as TaskPriority);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.values(TaskPriority) as TaskPriority[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {priorityLabel(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={dueDateId} className="text-xs">
            Deadline
          </Label>
          <Input
            id={dueDateId}
            type="date"
            value={dueDate}
            onChange={(e) => onDueDateChange(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
            priorityTone(priority),
          )}
        >
          <Flag className="size-3" aria-hidden />
          {priorityLabel(priority)}
        </span>
        {showStatus ? (
          <Badge variant="outline">{taskStatusLabel(status)}</Badge>
        ) : null}
      </div>
      <label
        htmlFor={approvalId}
        className="border-border/60 hover:bg-muted/30 flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors"
      >
        <Checkbox
          id={approvalId}
          checked={approval}
          disabled={approvalDisabled}
          onCheckedChange={(c) => onApprovalChange(c === true)}
          className="mt-0.5"
        />
        <span className="min-w-0">
          <span className="text-foreground block text-sm font-medium">
            Perlu persetujuan CEO
          </span>
          <span className="text-muted-foreground text-xs">
            Tugas tidak bisa ditandai selesai sebelum disetujui.
          </span>
        </span>
      </label>
    </TaskFormSection>
  );
}

function userLabel(u: TaskFormUser): string {
  return u.name?.trim() || u.email;
}

function userInitial(u: TaskFormUser): string {
  return userLabel(u).slice(0, 1).toUpperCase();
}

export function TaskFormPeople({
  users,
  assigneeIds,
  onAssigneeToggle,
  assigneeDisabled,
  tags,
  selectedTagIds,
  onTagToggle,
  canCreateTag,
  newTagName,
  onNewTagNameChange,
  newTagColorHex,
  onNewTagColorChange,
  onCreateTag,
  createTagPending,
  roomId,
}: {
  users: TaskFormUser[];
  assigneeIds: string[];
  onAssigneeToggle: (userId: string, selected: boolean) => void;
  assigneeDisabled?: boolean;
  tags: TaskFormTag[];
  selectedTagIds: string[];
  onTagToggle: (tagId: string, selected: boolean) => void;
  canCreateTag?: boolean;
  newTagName: string;
  onNewTagNameChange: (v: string) => void;
  newTagColorHex: string;
  onNewTagColorChange: (v: string) => void;
  onCreateTag: () => void;
  createTagPending?: boolean;
  roomId?: string;
}) {
  return (
    <TaskFormSection
      icon={<Users className="size-4" />}
      title="Tim & label"
      description="Tentukan siapa yang mengerjakan dan label untuk memfilter tugas."
    >
      <div className="space-y-2">
        <Label className="text-xs">PIC (penanggung jawab)</Label>
        {users.length === 0 ? (
          <p className="text-muted-foreground text-xs">Belum ada anggota ruangan.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {users.map((u) => {
              const selected = assigneeIds.includes(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  disabled={assigneeDisabled}
                  onClick={() => onAssigneeToggle(u.id, !selected)}
                  className={cn(
                    "inline-flex max-w-full items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    selected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground",
                    assigneeDisabled && "cursor-not-allowed opacity-60",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                      selected ? "bg-primary text-primary-foreground" : "bg-muted",
                    )}
                    aria-hidden
                  >
                    {userInitial(u)}
                  </span>
                  <span className="truncate">{userLabel(u)}</span>
                </button>
              );
            })}
          </div>
        )}
        {assigneeDisabled ? (
          <p className="text-muted-foreground text-xs">
            PIC ditetapkan oleh manager ruangan.
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Tag</Label>
        {tags.length === 0 ? (
          <p className="text-muted-foreground text-xs">Belum ada tag di ruangan ini.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const selected = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => onTagToggle(tag.id, !selected)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    selected
                      ? "border-transparent text-white shadow-sm"
                      : "border-border bg-background text-foreground hover:bg-muted/50",
                  )}
                  style={
                    selected
                      ? { backgroundColor: tag.colorHex, borderColor: tag.colorHex }
                      : undefined
                  }
                >
                  <span
                    className="size-2 rounded-full"
                    style={{
                      backgroundColor: selected ? "rgba(255,255,255,0.9)" : tag.colorHex,
                    }}
                    aria-hidden
                  />
                  {tag.name}
                </button>
              );
            })}
          </div>
        )}
        {canCreateTag ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-2">
            <Tag className="text-muted-foreground size-4 shrink-0" aria-hidden />
            <Input
              placeholder="Buat tag baru…"
              value={newTagName}
              onChange={(e) => onNewTagNameChange(e.target.value)}
              maxLength={40}
              disabled={createTagPending || !roomId}
              className="h-8 min-w-[8rem] flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onCreateTag();
                }
              }}
            />
            <Input
              type="color"
              value={newTagColorHex}
              onChange={(e) => onNewTagColorChange(e.target.value.toUpperCase())}
              className="size-8 shrink-0 cursor-pointer border-0 p-0.5"
              disabled={createTagPending || !roomId}
              title="Warna tag"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 shrink-0"
              disabled={createTagPending || !roomId || !newTagName.trim()}
              onClick={onCreateTag}
            >
              <Plus className="size-3.5" />
              {createTagPending ? "…" : "Tag"}
            </Button>
          </div>
        ) : null}
      </div>
    </TaskFormSection>
  );
}

/* -------------------------------------------------------------------------- */
/*                            Sub-tugas & lampiran                             */
/* -------------------------------------------------------------------------- */

export function TaskFormChecklistDraft({
  items,
  draft,
  onDraftChange,
  onAdd,
  onRemove,
}: {
  items: string[];
  draft: string;
  onDraftChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="space-y-3">
      {items.length > 0 ? (
        <ul className="space-y-1.5">
          {items.map((item, index) => (
            <li
              key={`${item}-${index}`}
              className="bg-muted/30 flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
            >
              <span className="bg-primary/15 text-primary flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-bold">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate">{item}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Hapus sub-tugas"
                onClick={() => onRemove(index)}
              >
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-xs">
          Pecah tugas besar jadi langkah-langkah kecil. Opsional — bisa ditambah
          nanti.
        </p>
      )}
      <div className="flex gap-2">
        <Input
          placeholder="Tulis sub-tugas, lalu Enter…"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
        />
        <Button type="button" variant="secondary" onClick={onAdd}>
          Tambah
        </Button>
      </div>
    </div>
  );
}

export function TaskFormAttachmentsDraft({
  pendingFiles,
  onPickFiles,
  onRemoveFile,
  pendingLinks,
  linkUrl,
  onLinkUrlChange,
  linkTitle,
  onLinkTitleChange,
  onAddLink,
  onRemoveLink,
  disabled,
  roomId,
  documentFolders,
  alsoSaveToDocuments,
  onAlsoSaveToDocumentsChange,
  documentsFolderId,
  onDocumentsFolderIdChange,
  fileInputId = "task-form-file",
}: {
  pendingFiles: File[];
  onPickFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (index: number) => void;
  pendingLinks: TaskFormPendingLink[];
  linkUrl: string;
  onLinkUrlChange: (v: string) => void;
  linkTitle: string;
  onLinkTitleChange: (v: string) => void;
  onAddLink: () => void;
  onRemoveLink: (id: string) => void;
  disabled?: boolean;
  roomId?: string;
  documentFolders?: RoomFolderNode[];
  alsoSaveToDocuments: boolean;
  onAlsoSaveToDocumentsChange: (v: boolean) => void;
  documentsFolderId: string | null;
  onDocumentsFolderIdChange: (v: string | null) => void;
  fileInputId?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label
          htmlFor={fileInputId}
          className="text-foreground flex items-center gap-2 text-sm font-medium"
        >
          <Paperclip className="text-muted-foreground size-4" />
          File
        </Label>
        <label
          htmlFor={fileInputId}
          className={cn(
            "border-border hover:border-primary/40 hover:bg-muted/20 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-6 text-center transition-colors",
            disabled && "pointer-events-none opacity-50",
          )}
        >
          <Paperclip className="text-muted-foreground size-5" aria-hidden />
          <span className="text-foreground text-sm font-medium">
            Klik untuk pilih file
          </span>
          <span className="text-muted-foreground text-xs">
            Bisa lebih dari satu file sekaligus
          </span>
        </label>
        <input
          id={fileInputId}
          type="file"
          multiple
          disabled={disabled}
          onChange={onPickFiles}
          className="sr-only"
        />
        {roomId && documentFolders ? (
          <TaskDocumentUploadOptions
            roomId={roomId}
            folders={documentFolders}
            enabled={alsoSaveToDocuments}
            onEnabledChange={onAlsoSaveToDocumentsChange}
            folderId={documentsFolderId}
            onFolderIdChange={onDocumentsFolderIdChange}
            disabled={disabled}
          />
        ) : null}
        {pendingFiles.length > 0 ? (
          <ul className="space-y-1">
            {pendingFiles.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="bg-muted/30 flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
              >
                <Paperclip className="text-muted-foreground size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Hapus file"
                  onClick={() => onRemoveFile(index)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="border-border/60 space-y-2 border-t pt-4">
        <Label className="text-foreground flex items-center gap-2 text-sm font-medium">
          <Link2 className="text-muted-foreground size-4" />
          Tautan eksternal
        </Label>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            type="url"
            inputMode="url"
            placeholder="https://drive.google.com/…"
            value={linkUrl}
            onChange={(e) => onLinkUrlChange(e.target.value)}
            disabled={disabled}
            className="font-mono text-sm sm:col-span-2"
          />
          <Input
            type="text"
            placeholder="Judul tampilan (opsional)"
            value={linkTitle}
            onChange={(e) => onLinkTitleChange(e.target.value)}
            disabled={disabled}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={disabled || !linkUrl.trim()}
            onClick={onAddLink}
          >
            Tambah tautan
          </Button>
        </div>
        {pendingLinks.length > 0 ? (
          <ul className="space-y-1">
            {pendingLinks.map((link) => (
              <li
                key={link.id}
                className="bg-muted/30 flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
              >
                <Link2 className="text-muted-foreground size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">
                  {link.title || link.url}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Hapus tautan"
                  onClick={() => onRemoveLink(link.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
