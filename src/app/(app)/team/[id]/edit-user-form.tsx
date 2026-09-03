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
import { PERMISSIONS, type PermissionKey } from "@/lib/auth/permission-catalog";
import {
  deleteUserAction,
  updatePermissionsAction,
  updateUserAction,
  type FormState,
} from "../actions";
import { PasswordResetSection } from "./password-reset-section";

const initialFormState: FormState = { success: false, error: null };

const PERMISSION_LABELS: Record<PermissionKey, string> = {
  [PERMISSIONS.JOBS_CREATE]: "Create jobs",
  [PERMISSIONS.JOBS_EDIT]: "Edit jobs",
  [PERMISSIONS.JOBS_SCHEDULE]: "Schedule jobs",
  [PERMISSIONS.JOBS_ASSIGN]: "Assign technicians",
  [PERMISSIONS.CUSTOMERS_MANAGE]: "Manage customers",
  [PERMISSIONS.SITES_MANAGE]: "Manage sites",
  [PERMISSIONS.TEMPLATES_MANAGE]: "Manage templates",
  [PERMISSIONS.REPORTS_VIEW]: "View reports",
  [PERMISSIONS.TEAM_RESET_PASSWORD]: "Reset team member passwords",
};

type User = typeof users.$inferSelect;

export function EditUserForm({
  user,
  currentPermissions,
}: {
  user: User;
  currentPermissions: PermissionKey[];
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
  currentPermissions: PermissionKey[];
}) {
  const [isPending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const showMessage = useAutoDismiss(savedAt, savedAt !== null);

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          await updatePermissionsAction(userId, formData);
          setSavedAt(Date.now());
        });
      }}
      className="space-y-3"
    >
      <h2 className="text-sm font-semibold">Permissions</h2>
      <div className="space-y-2">
        {Object.values(PERMISSIONS).map((permission) => (
          <label key={permission} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="permissions"
              value={permission}
              defaultChecked={currentPermissions.includes(permission)}
              className="size-4"
            />
            {PERMISSION_LABELS[permission]}
          </label>
        ))}
      </div>
      {showMessage && (
        <p role="status" className="text-sm text-green-600">
          Saved.
        </p>
      )}
      <Button type="submit" disabled={isPending} variant="outline">
        {isPending ? "Saving…" : "Save permissions"}
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
