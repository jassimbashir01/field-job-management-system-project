"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAutoDismiss } from "@/hooks/use-auto-dismiss";
import type { customerContacts, customers } from "@/db/schema";
import {
  addContactAction,
  deleteCustomerAction,
  removeContactAction,
  type FormState,
} from "../actions";

const initialState: FormState = { success: false, error: null };

type Customer = typeof customers.$inferSelect;
type Contact = typeof customerContacts.$inferSelect;

export function ContactsSection({
  customerId,
  contacts,
}: {
  customerId: string;
  contacts: Contact[];
}) {
  const boundAddAction = addContactAction.bind(null, customerId);
  const [state, formAction, isPending] = useActionState(
    boundAddAction,
    initialState,
  );
  const showMessage = useAutoDismiss(
    state,
    Boolean(state.success || state.error),
  );
  const [, startRemoveTransition] = useTransition();

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">Contacts</h2>

      {contacts.length > 0 && (
        <div className="divide-y rounded-md border">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="flex items-center justify-between px-4 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{contact.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[contact.title, contact.phone, contact.email]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  startRemoveTransition(() =>
                    removeContactAction(customerId, contact.id),
                  )
                }
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      <form action={formAction} className="space-y-2 rounded-md border p-4">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="contact-name" className="sr-only">
              Name
            </Label>
            <Input id="contact-name" name="name" placeholder="Name" required />
          </div>
          <div>
            <Label htmlFor="contact-title" className="sr-only">
              Title
            </Label>
            <Input id="contact-title" name="title" placeholder="Title" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="contact-phone" className="sr-only">
              Phone
            </Label>
            <Input id="contact-phone" name="phone" placeholder="Phone" />
          </div>
          <div>
            <Label htmlFor="contact-email" className="sr-only">
              Email
            </Label>
            <Input
              id="contact-email"
              name="email"
              type="email"
              placeholder="Email"
            />
          </div>
        </div>
        {showMessage && state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error.message}
          </p>
        )}
        <Button type="submit" variant="outline" disabled={isPending}>
          {isPending ? "Adding…" : "Add contact"}
        </Button>
      </form>
    </div>
  );
}

export function CustomerDeleteSection({ customer }: { customer: Customer }) {
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <div>
        <h2 className="text-sm font-semibold">Delete customer</h2>
        <p className="mt-1 mb-2 text-xs text-muted-foreground">
          Permanent — cannot be undone.
        </p>
        <Button variant="destructive" onClick={() => setConfirming(true)}>
          Delete {customer.name}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Delete customer</h2>
      <p className="text-xs text-muted-foreground">
        Type <strong>{customer.name}</strong> to confirm — this is permanent,
        and also deletes their contacts and custom field values.
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
          disabled={confirmText !== customer.name || isPending}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteCustomerAction(customer.id);
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
