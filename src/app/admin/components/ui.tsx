"use client";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { createContext, useActionState, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Icon } from "@/components/Icon";

// MARK: Toasts

type Tone = "success" | "error" | "info";
type Toast = { id: number; tone: Tone; text: string };
const ToastContext = createContext<(tone: Tone, text: string) => void>(() => {});

export const useToast = () => useContext(ToastContext);

/** Short confirmations in the bottom right. They stay put while the pointer rests on them. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(0);
  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);
  const last = useRef({ text: "", at: 0 });
  const show = useCallback((tone: Tone, text: string) => {
    // The same message within a moment is one event (e.g. effects run twice in development).
    if (last.current.text === text && Date.now() - last.current.at < 800) return;
    last.current = { text, at: Date.now() };
    const id = ++next.current;
    setToasts((all) => [...all.slice(-3), { id, tone, text }]);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toasts" role="region" aria-label="Meldungen" aria-live="polite">
        {toasts.map((t) => <ToastItem key={t.id} toast={t} onDone={() => dismiss(t.id)} />)}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(onDone, toast.tone === "error" ? 7000 : 3800);
    return () => clearTimeout(timer);
  }, [paused, onDone, toast.tone]);
  return (
    <div className={`toast toast-${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <Icon name={toast.tone === "success" ? "check" : toast.tone === "error" ? "alert" : "info"} size={18} />
      <span>{toast.text}</span>
      <button type="button" className="toast-close" onClick={onDone} aria-label="Schliessen"><Icon name="x" size={14} /></button>
    </div>
  );
}

// MARK: Dialog

export type ConfirmOptions = { title: string; text?: string; confirmLabel?: string; tone?: "danger" | "default" };

/** Modal confirmation built on <dialog>: focus is trapped, Escape cancels. */
export function ConfirmDialog({ open, options, onConfirm, onCancel }: { open: boolean; options: ConfirmOptions; onConfirm: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={ref} className="dialog" onCancel={(e) => { e.preventDefault(); onCancel(); }} onClick={(e) => e.target === ref.current && onCancel()}>
      <div className="dialog-body">
        <div className={`dialog-icon ${options.tone === "danger" ? "danger" : ""}`}><Icon name={options.tone === "danger" ? "alert" : "info"} size={20} /></div>
        <div>
          <h2>{options.title}</h2>
          {options.text && <p>{options.text}</p>}
        </div>
      </div>
      <div className="dialog-actions">
        <button type="button" className="btn secondary" onClick={onCancel}>Abbrechen</button>
        <button type="button" className={`btn ${options.tone === "danger" ? "danger-solid" : "primary"}`} onClick={onConfirm} autoFocus>{options.confirmLabel ?? "Bestätigen"}</button>
      </div>
    </dialog>
  );
}


// MARK: Keep input after errors

/**
 * React clears uncontrolled forms after an action. When the action failed, this puts the
 * entered values back so nobody has to type them again. Call `capture` on submit.
 */
export function useKeepValuesOnError(formRef: React.RefObject<HTMLFormElement | null>, failure: unknown) {
  const snapshot = useRef<[string, FormDataEntryValue][] | null>(null);
  useEffect(() => {
    if (!failure || !snapshot.current) return;
    const entries = snapshot.current;
    const frame = requestAnimationFrame(() => {
      const form = formRef.current;
      if (!form) return;
      const used = new Map<string, number>();
      for (const element of Array.from(form.elements) as HTMLInputElement[]) {
        if (!element.name || element.type === "file" || element.type === "hidden" || element.type === "submit") continue;
        const values = entries.filter(([name]) => name === element.name).map(([, v]) => String(v));
        if (element.type === "checkbox" || element.type === "radio") {
          element.checked = values.includes(element.value);
          continue;
        }
        const index = used.get(element.name) ?? 0;
        used.set(element.name, index + 1);
        if (values[index] !== undefined) element.value = values[index];
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [failure, formRef]);
  return () => {
    if (formRef.current) snapshot.current = Array.from(new FormData(formRef.current).entries());
  };
}

// MARK: Forms

type Result = void | { error?: string; message?: string } | undefined;

/**
 * Runs a server action, shows a toast with the outcome and keeps redirects working.
 * With `confirm` the action waits for the confirmation dialog.
 */
export function ActionForm({
  action,
  success,
  confirm,
  className,
  children,
  resetOnSuccess = false,
  id,
}: {
  action: (formData: FormData) => Promise<Result> | Result;
  success?: string;
  confirm?: ConfirmOptions;
  className?: string;
  children: React.ReactNode;
  resetOnSuccess?: boolean;
  id?: string;
}) {
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const confirmed = useRef(false);
  const [asking, setAsking] = useState(false);
  const [failure, setFailure] = useState(0);
  const capture = useKeepValuesOnError(formRef, failure);

  async function run(formData: FormData) {
    try {
      const result = await action(formData);
      if (result && result.error) {
        toast("error", result.error);
        setFailure((n) => n + 1);
        return;
      }
      const text = (result && result.message) || success;
      if (text) toast("success", text);
      if (resetOnSuccess) formRef.current?.reset();
    } catch (error) {
      if (isRedirectError(error)) {
        if (success) toast("success", success);
        throw error;
      }
      console.error(error);
      toast("error", "Das hat nicht geklappt. Bitte erneut versuchen.");
    }
  }

  return (
    <>
      <form
        ref={formRef}
        id={id}
        className={className}
        action={run}
        onSubmit={(event) => {
          capture();
          if (!confirm || confirmed.current) {
            confirmed.current = false;
            return;
          }
          event.preventDefault();
          setAsking(true);
        }}
      >
        {children}
      </form>
      {confirm && (
        <ConfirmDialog
          open={asking}
          options={confirm}
          onCancel={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false);
            confirmed.current = true;
            formRef.current?.requestSubmit();
          }}
        />
      )}
    </>
  );
}

/** Submit button that shows progress while its form's action runs. */
export function SubmitButton({ children, className = "btn primary", icon, pendingLabel, disabled, name, value, title }: {
  children: React.ReactNode;
  className?: string;
  icon?: Parameters<typeof Icon>[0]["name"];
  pendingLabel?: string;
  disabled?: boolean;
  name?: string;
  value?: string;
  title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || disabled} aria-busy={pending} name={name} value={value} title={title}>
      {pending ? <span className="spinner" aria-hidden /> : icon ? <Icon name={icon} size={16} /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

// MARK: Flash after redirects

/** Shows a toast once, e.g. for "?created=1" after a redirect, then removes the parameter. */
export function Flash({ message, tone = "success" }: { message?: string | null; tone?: Tone }) {
  const toast = useToast();
  useEffect(() => {
    if (!message) return;
    toast(tone, message);
    const url = new URL(window.location.href);
    for (const key of ["created", "deleted", "merged", "saved", "added"]) url.searchParams.delete(key);
    window.history.replaceState(null, "", url);
  }, [message, tone, toast]);
  return null;
}

// MARK: Bulk selection

export type BulkOption = { value: string; label: string; destructive?: boolean };

/**
 * Wraps a table whose rows carry <input type="checkbox" name="ids">. A header checkbox with
 * [data-select-all] toggles all rows. With a selection, a bar offers the bulk actions.
 */
export function BulkTable({ action, options, noun, children }: {
  action: (formData: FormData) => Promise<{ message?: string; error?: string } | void>;
  options: BulkOption[];
  noun: [string, string];
  children: React.ReactNode;
}) {
  const toast = useToast();
  const ref = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [count, setCount] = useState(0);
  const [op, setOp] = useState(options[0]?.value ?? "");
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);

  const boxes = () => Array.from(ref.current?.querySelectorAll<HTMLInputElement>('input[name="ids"]') ?? []);
  const sync = useCallback(() => {
    const all = boxes();
    const checked = all.filter((b) => b.checked).length;
    all.forEach((b) => b.closest("tr")?.setAttribute("data-selected", String(b.checked)));
    const head = ref.current?.querySelector<HTMLInputElement>("[data-select-all]");
    if (head) {
      head.checked = checked > 0 && checked === all.length;
      head.indeterminate = checked > 0 && checked < all.length;
    }
    setCount(checked);
  }, []);
  useEffect(() => sync());

  const clear = () => {
    boxes().forEach((b) => (b.checked = false));
    sync();
  };

  async function run() {
    const data = new FormData();
    boxes().filter((b) => b.checked).forEach((b) => data.append("ids", b.value));
    data.set("op", op);
    setPending(true);
    try {
      const result = await action(data);
      if (result?.error) toast("error", result.error);
      else {
        toast("success", result?.message ?? "Erledigt.");
        clear();
      }
    } catch {
      toast("error", "Das hat nicht geklappt. Bitte erneut versuchen.");
    } finally {
      setPending(false);
    }
  }

  const chosen = options.find((o) => o.value === op);
  return (
    <div
      ref={ref}
      onChange={(e) => {
        const target = e.target as HTMLInputElement;
        if (target.matches("[data-select-all]")) boxes().forEach((b) => (b.checked = target.checked));
        if (target.matches("[data-select-all], input[name='ids']")) sync();
      }}
    >
      {children}
      {count > 0 && (
        <form
          ref={formRef}
          className="bulk-bar"
          onSubmit={(e) => {
            e.preventDefault();
            if (chosen?.destructive) setAsking(true);
            else run();
          }}
        >
          <strong>{count} {count === 1 ? noun[0] : noun[1]} ausgewählt</strong>
          <select value={op} onChange={(e) => setOp(e.target.value)} aria-label="Aktion">
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button type="submit" className={`btn ${chosen?.destructive ? "danger-solid" : "primary"}`} disabled={pending}>
            {pending && <span className="spinner" aria-hidden />}Ausführen
          </button>
          <button type="button" className="btn secondary" onClick={clear}>Auswahl aufheben</button>
          <ConfirmDialog
            open={asking}
            options={{ title: `${count} ${count === 1 ? noun[0] : noun[1]}: ${chosen?.label}?`, text: "Das lässt sich nicht rückgängig machen.", confirmLabel: chosen?.label, tone: "danger" }}
            onCancel={() => setAsking(false)}
            onConfirm={() => {
              setAsking(false);
              run();
            }}
          />
        </form>
      )}
    </div>
  );
}

// MARK: Forms with returned state

type State = { error?: string; message?: string };

/** Form for actions with (previousState, formData) that return an error or a message, shown as a toast. */
export function StateForm({ action, children, className, resetOnSuccess = false }: {
  action: (state: State, formData: FormData) => Promise<State>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, run] = useActionState<State, FormData>(action, {});
  const capture = useKeepValuesOnError(formRef, state.error ? state : null);
  useEffect(() => {
    if (state.error) toast("error", state.error);
    else if (state.message) {
      toast("success", state.message);
      if (resetOnSuccess) formRef.current?.reset();
    }
  }, [state, toast, resetOnSuccess]);
  return (
    <form ref={formRef} action={run} className={className} onSubmit={capture}>
      {state.error && <div className="alert" role="alert"><Icon name="alert" size={16} />{state.error}</div>}
      {children}
    </form>
  );
}
