"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import type { ModelPurpose, ProviderModel } from "@documind/shared";
import { MODEL_PURPOSES } from "@documind/shared";
import { api } from "@/lib/api";
import { errorText } from "@/lib/error-text";

type Purpose = { key: ModelPurpose; dimensions?: number };

export function SettingsForm() {
  const t = useTranslations("settings");
  const te = useTranslations("errors");

  const [hint, setHint] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState<"idle" | "ok" | "error">("idle");
  const [keyError, setKeyError] = useState<string | null>(null);
  const [models, setModels] = useState<
    Record<ModelPurpose, { current: string | null; available: ProviderModel[] } | null>
  >({
    vision: null,
    embedding: null,
    chat: null,
  });
  const [dimensions, setDimensions] = useState<string>("");
  const [modelError, setModelError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getProvider()
      .then((res) => setHint(res.hint))
      .catch(() => setHint(null));
    for (const purpose of MODEL_PURPOSES) {
      api
        .getModels(purpose)
        .then((res) =>
          setModels((prev) => ({
            ...prev,
            [purpose]: { current: res.current?.modelId ?? null, available: res.available },
          })),
        )
        .catch(() =>
          setModels((prev) => ({ ...prev, [purpose]: { current: null, available: [] } })),
        );
    }
  }, []);

  const saveKey = useCallback(async () => {
    const value = apiKey.trim();
    if (value.length < 20) {
      setKeyError(te("VALIDATION_ERROR"));
      return;
    }
    try {
      const res = await api.saveProvider(value);
      setHint(res.hint);
      setApiKey("");
      setSaved("ok");
      setKeyError(null);
    } catch (caught) {
      setKeyError(errorText(te, caught instanceof Error ? caught.message : undefined));
      setSaved("error");
    }
  }, [apiKey, te]);

  const saveModel = useCallback(
    async (purpose: ModelPurpose, modelId: string) => {
      setModelError(null);
      try {
        await api.saveModel({
          purpose,
          modelId,
          dimensions:
            purpose === "embedding" ? (dimensions === "" ? null : Number(dimensions)) : undefined,
        });
      } catch (caught) {
        setModelError(errorText(te, caught instanceof Error ? caught.message : undefined));
      }
    },
    [dimensions, te],
  );

  const inputClass =
    "w-full rounded-none border-0 border-b border-rule-soft bg-transparent px-0 py-1 font-mono text-[12.5px] font-bold text-text outline-none transition focus:border-accent";
  const labelClass = "font-display text-[10px] font-bold uppercase tracking-[1px] text-text-3";

  return (
    <div className="flex flex-col gap-6 px-4 py-5">
      <section className="flex flex-col gap-2 border-b border-rule-soft/60 pb-5">
        <label className="flex flex-col gap-0.5 border-b border-rule-soft/60 pb-2">
          <span className={labelClass}>{t("apiKey.label")}</span>
          <input
            type="password"
            value={apiKey}
            placeholder={hint ?? t("apiKey.placeholder")}
            disabled={!hint ? false : false}
            onChange={(e) => setApiKey(e.target.value)}
            className={inputClass}
          />
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void saveKey()}
            disabled={apiKey.trim().length === 0}
            className="rounded-[3px] border border-accent bg-accent-soft px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-[1.2px] text-accent transition hover:bg-accent hover:text-sheet disabled:opacity-50"
          >
            {t("apiKey.save")}
          </button>
          {hint ? (
            <span className="font-mono text-[11px] text-text-2">
              {t("apiKey.current", { hint })}
            </span>
          ) : null}
          {saved === "ok" ? (
            <span className="flex items-center gap-1 font-mono text-[11px] font-bold text-[color:var(--success)]">
              <Check size={12} strokeWidth={2.2} /> {t("apiKey.saved")}
            </span>
          ) : null}
        </div>
        {keyError ? (
          <p role="alert" className="font-mono text-[11.5px] font-bold text-accent">
            {keyError}
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        {MODEL_PURPOSES.map((purpose) => {
          const block = models[purpose];
          return (
            <label key={purpose} className="flex items-center gap-3">
              <span className={labelClass + " basis-[110px]"}>{t(`models.${purpose}`)}</span>
              <select
                value={block?.current ?? ""}
                onChange={(e) => void saveModel(purpose, e.target.value)}
                disabled={!block}
                className={inputClass + " flex-1 border-b border-rule-soft"}
              >
                {(block?.available.length ?? 0) === 0 ? (
                  <option value="">{t("models.none")}</option>
                ) : null}
                {(block?.available ?? []).map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                    {model.free ? "" : " · $"}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
        <label className="flex items-center gap-3">
          <span className={labelClass + " basis-[110px]"}>{t("models.dimensions")}</span>
          <input
            type="number"
            value={dimensions}
            placeholder={t("models.dimensionsHint")}
            onChange={(e) => setDimensions(e.target.value)}
            className={inputClass + " w-[140px]"}
          />
        </label>
        {modelError ? (
          <p role="alert" className="font-mono text-[11.5px] font-bold text-accent">
            {modelError}
          </p>
        ) : null}
      </section>
    </div>
  );
}
