"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { users } from "@/db/schema";
import { useAutoDismiss } from "@/hooks/use-auto-dismiss";
import {
  RESOURCES,
  getCurrentLevel,
  type AccessLevel,
} from "@/lib/auth/permission-catalog";
import {
  deleteUserAction,
  updateAccessLevelsAction,
  updateUserAction,
  type FormState,
} from "../actions";
import { PasswordResetSection } from "./password-reset-section";

const initialFormState: FormState = { success: false, error: null };

const LEVEL_LABELS: Record<AccessLevel | "none", string> = {
  none: "No access",
  read: "Read",
  write: "Read & Write",
  delete: "Read, Write & Delete",
};

type User = typeof users.$inferSelect;

export function EditUserForm({
  user,
  currentPermissions,
}: {
  user: User;
  currentPermissions: string[];
}) {
  return (
    <div className="space-y-10">
      <DetailsSection
        key={`details-${user.updatedAt.toISOString()}`}
        user={user}
      />
      {user.role === "manager" && (
        <PermissionsSection
          userId={user.id}
          currentPermissions={currentPermissions}
        />
      )}
      <PasswordResetSection userId={user.id} />
      <DeleteSection user={user} />
    </div>
  );
}

function DetailsSection({ user }: { user: User }) {
  const boundAction = updateUserAction.bind(null, user.id);
  const [state, formAction, isPending] = useActionState(
    boundAction,
    initialFormState,
  );
  const showMessage = useAutoDismiss(
    state,
    Boolean(state.success || state.error),
  );
  const [role, setRole] = useState(user.role);

  return (
    <form action={formAction} className="space-y-4">
      <h2 className="text-sm font-semibold">Details</h2>
      <input type="hidden" name="role" value={role} />

      <div className="space-y-2">
        <Label htmlFor="displayName">Full name</Label>
        <Input
          id="displayName"
          name="displayName"
          defaultValue={user.displayName}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="jobTitle">Job title</Label>
        <Input
          id="jobTitle"
          name="jobTitle"
          defaultValue={user.jobTitle ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <Select value={role} onValueChange={(v) => setRole(v ?? user.role)}>
          <SelectTrigger id="role" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="team_member">Team Member</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={user.isActive}
          className="size-4"
        />
        Active — unchecking this blocks sign-in without deleting the account
      </label>

      {showMessage && state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error.message}
        </p>
      )}
      {showMessage && state.success && (
        <p role="status" className="text-sm text-green-600">
          Saved.
        </p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save details"}
      </Button>
    </form>
  );
}

function PermissionsSection({
  userId,
  currentPermissions,
}: {
  userId: string;
  currentPermissions: string[];
}) {
  const [isPending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const showMessage = useAutoDismiss(savedAt, savedAt !== null);
  const grantedKeys = new Set(currentPermissions);

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          await updateAccessLevelsAction(userId, formData);
          setSavedAt(Date.now());
        });
      }}
      className="space-y-4"
    >
      <h2 className="text-sm font-semibold">Access</h2>
      <div className="space-y-3">
        {RESOURCES.map((resource) => {
          const currentLevel = getCurrentLevel(resource.key, grantedKeys);
          const availableLevels: (AccessLevel | "none")[] = ["none", "read"];
          if (resource.maxLevel === "write" || resource.maxLevel === "delete") {
            availableLevels.push("write");
          }
          if (resource.maxLevel === "delete") {
            availableLevels.push("delete");
          }

          return (
            <div
              key={resource.key}
              className="flex items-center justify-between gap-4"
            >
              <Label htmlFor={`access_${resource.key}`} className="flex-1">
                {resource.label}
              </Label>
              <select
                id={`access_${resource.key}`}
                name={`access_${resource.key}`}
                defaultValue={currentLevel}
                className="rounded-md border border-input px-3 py-2 text-sm"
              >
                {availableLevels.map((level) => (
                  <option key={level} value={level}>
                    {LEVEL_LABELS[level]}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
      {showMessage && (
        <p role="status" className="text-sm text-green-600">
          Saved.
        </p>
      )}
      <Button type="submit" disabled={isPending} variant="outline">
        {isPending ? "Saving…" : "Save access"}
      </Button>
    </form>
  );
}

function DeleteSection({ user }: { user: User }) {
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <div>
        <h2 className="text-sm font-semibold">Delete account</h2>
        <p className="mt-1 mb-2 text-xs text-muted-foreground">
          Permanent — cannot be undone.
        </p>
        <Button variant="destructive" onClick={() => setConfirming(true)}>
          Delete {user.displayName}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Delete account</h2>
      <p className="text-xs text-muted-foreground">
        Type <strong>{user.displayName}</strong> to confirm — this is permanent.
      </p>
      <Input
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        className="max-w-xs"
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          variant="destructive"
          disabled={confirmText !== user.displayName || isPending}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteUserAction(user.id);
              if (!result.success && result.error) {
                setError(result.error.message);
              }
            })
          }
        >
          {isPending ? "Deleting…" : "Confirm delete"}
        </Button>
        <Button variant="outline" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
