"use client";

import { useActionState } from "react";
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
import { createUserAction, type FormState } from "../actions";

const initialState: FormState = { success: false, error: null };

export function NewUserForm() {
  const [state, formAction, isPending] = useActionState(
    createUserAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="displayName">Full name</Label>
        <Input id="displayName" name="displayName" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="jobTitle">Job title (optional)</Label>
        <Input
          id="jobTitle"
          name="jobTitle"
          placeholder="e.g. Plumber, Driver — defaults to the company setting if left blank"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <Select name="role" defaultValue="team_member">
          <SelectTrigger id="role" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="team_member">Team Member</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Starting password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
        />
        <p className="text-xs text-muted-foreground">
          They&apos;ll be required to change this the first time they sign in.
        </p>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error.message}
        </p>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating…" : "Create account"}
      </Button>
    </form>
  );
}
