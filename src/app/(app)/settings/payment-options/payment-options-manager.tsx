"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { paymentOptions } from "@/db/schema";
import { useAutoDismiss } from "@/hooks/use-auto-dismiss";
import {
  createPaymentOptionAction,
  deletePaymentOptionAction,
  setPaymentOptionActiveAction,
  updatePaymentOptionAction,
  type FormState,
} from "./actions";

type Option = typeof paymentOptions.$inferSelect;

const initialState: FormState = { success: false, error: null };

export function PaymentOptionsManager({ options }: { options: Option[] }) {
  return (
    <div className="space-y-8">
      <div className="divide-y rounded-md border">
        {options.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">
            No payment options yet. Add the ways customers can pay you — bank
            transfer details, a PayPal link, and so on.
          </p>
        )}
        {options.map((option) => (
          <OptionRow key={option.id} option={option} />
        ))}
      </div>
      <NewOptionForm />
    </div>
  );
}

function OptionFields({ option }: { option?: Option }) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`label-${option?.id ?? "new"}`}>Name</Label>
        <Input
          id={`label-${option?.id ?? "new"}`}
          name="label"
          defaultValue={option?.label}
          placeholder="e.g. Bank transfer"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`details-${option?.id ?? "new"}`}>Details</Label>
        <Textarea
          id={`details-${option?.id ?? "new"}`}
          name="details"
          defaultValue={option?.details ?? ""}
          rows={4}
          placeholder={
            "Account name, account number, sort code, reference to use…"
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`url-${option?.id ?? "new"}`}>
          Payment link (optional)
        </Label>
        <Input
          id={`url-${option?.id ?? "new"}`}
          name="url"
          type="url"
          defaultValue={option?.url ?? ""}
          placeholder="https://paypal.me/yourcompany"
        />
        <p className="text-xs text-muted-foreground">
          Must start with https://. Shown to the customer as a button.
        </p>
      </div>
    </>
  );
}

function OptionRow({ option }: { option: Option }) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (notice?.kind !== "success") return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  function run(
    name: string,
    action: () => Promise<FormState>,
    successText: string,
    failureText: string,
  ) {
    setNotice(null);
    setActiveAction(name);
    startTransition(async () => {
      const result = await action();
      if (result.success) {
        setNotice({ kind: "success", text: successText });
        setConfirmingDelete(false);
        router.refresh();
      } else {
        setNotice({
          kind: "error",
          text: result.error?.message ?? failureText,
        });
      }
      setActiveAction(null);
    });
  }

  const busy = (name: string) => isPending && activeAction === name;

  if (editing) {
    return (
      <div className="p-4">
        <EditOptionForm
          option={option}
          onSaved={() => {
            setEditing(false);
            setNotice({ kind: "success", text: "Saved." });
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2 px-4 py-3 text-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium">
            {option.label}
            {!option.isActive && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                (inactive)
              </span>
            )}
          </p>
          {option.details && (
            <p className="mt-1 text-xs whitespace-pre-wrap text-muted-foreground">
              {option.details}
            </p>
          )}
          {option.url && (
            <p className="mt-1 text-xs break-all text-muted-foreground">
              {option.url}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => setEditing(true)}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() =>
              run(
                "toggle",
                () => setPaymentOptionActiveAction(option.id, !option.isActive),
                option.isActive ? "Deactivated." : "Reactivated.",
                "Couldn't update this option.",
              )
            }
          >
            {busy("toggle")
              ? "Saving…"
              : option.isActive
                ? "Deactivate"
                : "Reactivate"}
          </Button>
          {!confirmingDelete ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => {
                setNotice(null);
                setConfirmingDelete(true);
              }}
            >
              Delete
            </Button>
          ) : (
            <>
              <Button
                variant="destructive"
                size="sm"
                disabled={isPending}
                onClick={() =>
                  run(
                    "delete",
                    () => deletePaymentOptionAction(option.id),
                    "Deleted.",
                    "Couldn't delete this option.",
                  )
                }
              >
                {busy("delete") ? "Deleting…" : "Confirm delete"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => setConfirmingDelete(false)}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {notice && (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          className={
            notice.kind === "error"
              ? "text-xs text-destructive"
              : "text-xs text-green-600"
          }
        >
          {notice.text}
        </p>
      )}
    </div>
  );
}

function EditOptionForm({
  option,
  onSaved,
  onCancel,
}: {
  option: Option;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    async (previous: FormState, formData: FormData) => {
      const result = await updatePaymentOptionAction(
        option.id,
        previous,
        formData,
      );
      if (result.success) {
        onSaved();
        router.refresh();
      }
      return result;
    },
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <OptionFields option={option} />

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error.message}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save changes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function NewOptionForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    async (previous: FormState, formData: FormData) => {
      const result = await createPaymentOptionAction(previous, formData);
      if (result.success) router.refresh();
      return result;
    },
    initialState,
  );
  const showMessage = useAutoDismiss(
    state,
    Boolean(state.success || state.error),
  );

  return (
    <form action={formAction} className="space-y-4 rounded-md border p-4">
      <h2 className="text-sm font-semibold">Add a payment option</h2>

      <OptionFields />

      {showMessage && state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error.message}
        </p>
      )}
      {showMessage && state.success && (
        <p role="status" className="text-sm text-green-600">
          Added.
        </p>
      )}

      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? "Adding…" : "Add option"}
      </Button>
    </form>
  );
}
