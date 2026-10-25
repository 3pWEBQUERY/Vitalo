"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ConfirmDialog } from "@/app/admin/components/ui";

/** Submit button that asks in a dialog before a destructive action, then submits its form. */
export function ConfirmButton({
  label,
  question,
  title,
  confirmLabel,
  className = "danger",
}: {
  label: string;
  question: string;
  title?: string;
  confirmLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const { pending } = useFormStatus();
  const destructive = className.includes("danger");
  return (
    <>
      <button ref={ref} type="button" className={className} disabled={pending} aria-busy={pending} onClick={() => setOpen(true)}>
        {pending && <span className="spinner" aria-hidden />}
        {label}
      </button>
      <ConfirmDialog
        open={open}
        options={{ title: title ?? question, text: title ? question : undefined, confirmLabel: confirmLabel ?? label, tone: destructive ? "danger" : "default" }}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          ref.current?.form?.requestSubmit();
        }}
      />
    </>
  );
}
