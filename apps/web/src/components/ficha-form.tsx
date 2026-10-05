"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import type { ExtractionResult } from "@documind/shared";
import { api, ApiError, type ExtractionDetail } from "@/lib/api";
import { errorText } from "@/lib/error-text";
import {
  FICHA_FIELDS,
  fromExtraction,
  itemsTotalsMismatch,
  toExtraction,
  type EditableFicha,
  type FieldSpec,
} from "@/lib/ficha";
import { DocTypeSwitcher } from "./doc-type-switcher";
import { ItemsGrid } from "./items-grid";
import { ItemsTotalAlert } from "./items-total-alert";

type SaveState = "idle" | "saving" | "saved" | "error";

function FichaField({
  spec,
  value,
  disabled,
  onChange,
}: {
  spec: FieldSpec;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("review");
  const inputClass =
    "w-full min-w-0 rounded-none border-0 border-b border-rule-soft bg-transparent px-0 py-1 font-mono text-[12.5px] font-bold text-text outline-none transition focus:border-accent disabled:opacity-60";
  return (
    <label className="flex flex-col gap-0.5 border-b border-rule-soft/60 pb-2">
      <span className="font-display text-[10px] font-bold uppercase tracking-[1px] text-text-3">
        {t(`fields.${spec.label}`)}
      </span>
      {spec.kind === "textarea" ? (
        <textarea
          rows={2}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} leading-[1.5]`}
        />
      ) : (
        <input
          type={spec.kind === "date" ? "date" : "text"}
          inputMode={spec.kind === "number" ? "decimal" : undefined}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      )}
    </label>
  );
}

export function FichaForm({
  docId,
  docName,
  initial,
  readOnly,
  tokens,
  onConfirmed,
}: {
  docId: string;
  docName: string;
  initial: ExtractionResult;
  readOnly: boolean;
  tokens: { prompt: number; completion: number };
  onConfirmed: () => void;
}) {
  const t = useTranslations("review");
  const te = useTranslations("errors");
  const locale = useLocale();
  const [ficha, setFicha] = useState<EditableFicha>(() => fromExtraction(initial));
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [editingArchived, setEditingArchived] = useState(false);
  const [auditGlimpse, setAuditGlimpse] = useState<{ count: number; paths: string[] } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<EditableFicha | null>(null);
  const editable = editingArchived || !readOnly;

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  useEffect(() => {
    if (saveState !== "saved") return;
    const fade = setTimeout(() => setSaveState("idle"), 1800);
    return () => clearTimeout(fade);
  }, [saveState]);

  const persist = useCallback(async () => {
    const target = pending.current;
    if (!target) return;
    pending.current = null;
    try {
      const data = toExtraction(target, initial.confianza);
      const saved: ExtractionDetail = editingArchived
        ? await api.patchConfirmed(docId, data)
        : await api.patchExtraction(docId, data);
      if (saved.fieldAudit) {
        const paths = Object.keys(saved.fieldAudit);
        setAuditGlimpse(paths.length > 0 ? { count: paths.length, paths: paths.slice(-3) } : null);
      } else {
        setAuditGlimpse(null);
      }
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [docId, initial.confianza, editingArchived]);

  const update = useCallback(
    (next: EditableFicha) => {
      setFicha(next);
      if (!editable) return;
      pending.current = next;
      if (timer.current) clearTimeout(timer.current);
      setSaveState("saving");
      timer.current = setTimeout(() => {
        void persist();
      }, 800);
    },
    [persist, editable],
  );

  const handleConfirm = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setConfirming(true);
    setConfirmError(null);
    try {
      await persist();
      await api.confirmDocument(docId);
      onConfirmed();
    } catch (error) {
      setConfirmError(errorText(te, error instanceof ApiError ? error.code : undefined));
      setConfirming(false);
    }
  }, [persist, docId, onConfirmed, te]);

  const num = (n: number) => new Intl.NumberFormat(locale).format(n);
  const mismatch = itemsTotalsMismatch(ficha);

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-bg">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-6">
        <span className="min-w-0 truncate font-mono text-[13.5px] font-bold text-text">
          {docName}
        </span>
        <span className="flex-1" />
        {editable && saveState !== "idle" && (
          <span
            role="status"
            className={`font-display text-[10.5px] font-bold uppercase tracking-[1.2px] ${
              saveState === "error"
                ? "text-accent"
                : saveState === "saved"
                  ? "text-[color:var(--success)]"
                  : "text-text-3"
            }`}
          >
            {saveState === "saving"
              ? t("saving")
              : saveState === "saved"
                ? t("saved")
                : t("saveError")}
          </span>
        )}
        <span
          className={`flex items-center gap-2 rounded-full border border-rule-soft bg-sheet px-3 py-1.5 font-display text-[10.5px] font-bold uppercase tracking-[1.2px] ${
            readOnly ? "text-[color:var(--success)]" : "text-accent"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${readOnly ? "bg-[color:var(--success)]" : "bg-accent"}`}
          />
          {readOnly ? t("statusConfirmed") : t("statusDraft")}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-6">
        <div className="mx-auto flex max-w-[720px] flex-col gap-4">
          <div className="overflow-hidden rounded-[3px] border-[1.5px] border-rule bg-sheet">
            <div className="flex h-[30px] items-center gap-2 border-b border-rule bg-band px-3.5">
              <span className="font-display text-[10.5px] font-bold uppercase tracking-[1.4px] text-rule">
                {t("sheetTitle")}
              </span>
              <span className="flex-1" />
              <span className="font-mono text-[10px] text-text-3">
                {t("tokens", { prompt: tokens.prompt, completion: tokens.completion })}
              </span>
              {readOnly && !editingArchived && (
                <button
                  type="button"
                  onClick={() => setEditingArchived(true)}
                  className="flex items-center gap-1.5 rounded-[2px] border-2 border-rule px-2 py-0.5 font-display text-[9.5px] font-bold uppercase tracking-[1px] text-rule transition hover:bg-sheet focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <Pencil size={11} strokeWidth={1.8} />
                  {t("editArchived")}
                </button>
              )}
            </div>
            <div className="flex flex-col gap-3 px-4 py-3.5">
              {editingArchived && (
                <p
                  role="note"
                  className="border border-[#D9A400] bg-[#FBF3D9] px-3 py-2 font-display text-[10.5px] font-bold uppercase tracking-[1.2px] text-[#7A5C00]"
                >
                  {t("reembedWarning")}
                </p>
              )}
              <DocTypeSwitcher
                value={ficha.doc_type}
                disabled={!editable}
                onChange={(type) => update({ ...ficha, doc_type: type })}
              />
              {FICHA_FIELDS[ficha.doc_type].map((spec) => (
                <FichaField
                  key={spec.path}
                  spec={spec}
                  value={ficha.fields[spec.path] ?? ""}
                  disabled={!editable}
                  onChange={(value) =>
                    update({ ...ficha, fields: { ...ficha.fields, [spec.path]: value } })
                  }
                />
              ))}
              <ItemsGrid
                docType={ficha.doc_type}
                rows={ficha.items}
                disabled={!editable}
                onRowsChange={(rows) => update({ ...ficha, items: rows })}
              />
              {editable && <ItemsTotalAlert mismatch={mismatch} />}
              <div className="flex items-center justify-between border-t border-rule-soft pt-2">
                <span className="font-display text-[10px] font-bold uppercase tracking-[1px] text-text-3">
                  {t("confidence")}
                </span>
                <span className="font-mono text-[12.5px] font-bold text-[color:var(--success)]">
                  {num(initial.confianza)}
                </span>
              </div>
              {auditGlimpse && (
                <div className="overflow-hidden rounded-[3px] border border-carbon bg-carbon">
                  <div className="flex h-[26px] items-center gap-2 bg-carbon px-3">
                    <span className="font-display text-[9.5px] font-bold uppercase tracking-[1.4px] text-carbon-soft">
                      {t("auditTitle", { count: auditGlimpse.count })}
                    </span>
                  </div>
                  <p className="px-3 pb-2 font-mono text-[11px] text-carbon-text">
                    {auditGlimpse.paths.join(" · ")}
                  </p>
                </div>
              )}
              {!readOnly && (
                <div className="flex items-center justify-end gap-3 border-t border-rule pt-3">
                  {confirmError && (
                    <span role="alert" className="font-mono text-[11px] font-bold text-accent">
                      {confirmError}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleConfirm()}
                    disabled={confirming}
                    className="rounded-[2px] border-2 border-accent px-4 py-2 font-display text-[11px] font-bold uppercase tracking-[1.4px] text-accent transition hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
                  >
                    {confirming ? t("confirming") : t("confirm")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
