"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAutoDismiss } from "@/hooks/use-auto-dismiss";
import {
  deleteJobFileAction,
  uploadJobFileAction,
  type UploadFormState,
} from "./files-actions";

const initialState: UploadFormState = { success: false, error: null };

export interface JobFile {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  caption: string | null;
  uploadedByDisplayName: string;
  createdAt: Date;
}

function formatSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function JobFilesSection({
  jobId,
  files,
  disabled,
}: {
  jobId: string;
  files: JobFile[];
  disabled?: boolean;
}) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Files & photos</h2>
        {!disabled && !showForm && (
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
            Add file
          </Button>
        )}
      </div>

      {files.length === 0 ? (
        <p className="text-sm text-muted-foreground">No files uploaded yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {files.map((file) => (
            <FileCard
              key={file.id}
              jobId={jobId}
              file={file}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      {!disabled && showForm && (
        <UploadForm jobId={jobId} onDone={() => setShowForm(false)} />
      )}
    </div>
  );
}

function FileCard({
  jobId,
  file,
  disabled,
}: {
  jobId: string;
  file: JobFile;
  disabled?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const url = `/api/jobs/${jobId}/files/${file.id}`;
  const isImage = file.contentType.startsWith("image/");

  return (
    <div className="space-y-1 rounded-md border p-2">
      {isImage ? (
        <a href={url} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element -- see comment above */}
          <img
            src={url}
            alt={file.caption ?? file.fileName}
            loading="lazy"
            className="aspect-square w-full rounded object-cover"
          />
        </a>
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex aspect-square w-full items-center justify-center rounded bg-muted text-xs text-muted-foreground"
        >
          PDF
        </a>
      )}
      <p className="truncate text-xs font-medium" title={file.fileName}>
        {file.caption || file.fileName}
      </p>
      <p className="text-xs text-muted-foreground">
        {formatSize(file.sizeBytes)} · {file.uploadedByDisplayName}
      </p>
      <p className="text-xs text-muted-foreground">
        {formatTimestamp(file.createdAt)}
      </p>
      {!disabled && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          disabled={isPending}
          onClick={() =>
            startTransition(() => deleteJobFileAction(jobId, file.id))
          }
        >
          {isPending ? "Removing…" : "Remove"}
        </Button>
      )}
    </div>
  );
}

function UploadForm({ jobId, onDone }: { jobId: string; onDone: () => void }) {
  const boundAction = uploadJobFileAction.bind(null, jobId);
  const [state, formAction, isPending] = useActionState(
    boundAction,
    initialState,
  );
  const showMessage = useAutoDismiss(
    state,
    Boolean(state.success || state.error),
  );

  const [inputKey, setInputKey] = useState(0);
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state.success) {
      setInputKey((key) => key + 1);
    }
  }

  useEffect(() => {
    if (state.success) {
      onDone();
    }
  }, [state.success, onDone]);

  return (
    <form action={formAction} className="space-y-2 rounded-md border p-4">
      <div className="space-y-2">
        <Label htmlFor="file">File</Label>
        <input
          key={inputKey}
          id="file"
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          required
          className="block w-full text-sm"
        />
        <p className="text-xs text-muted-foreground">
          JPEG, PNG, WebP, or PDF. 4 MB max.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="caption">Caption (optional)</Label>
        <Input
          id="caption"
          name="caption"
          placeholder="e.g. Before — leak under sink"
        />
      </div>
      {showMessage && state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error.message}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" variant="outline" disabled={isPending}>
          {isPending ? "Uploading…" : "Upload"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
