/*
 * NegosyoNav — Generic mobile-first form wizard.
 * Drives Barangay Clearance, DTI, and BIR forms from a shared schema +
 * step definitions. Field names match either the AcroForm widget name
 * (Barangay) or the field `key` (DTI/BIR), so values flow straight into
 * the PDF generator.
 */
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, Download, Loader2, Search, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export type SchemaField = {
  name: string;
  type: "text" | "checkbox";
  label: string;
  group?: string;
  required?: boolean;
};

export type StepDef =
  | { title: string; subtitle?: string; kind: "radio"; group: string }
  | { title: string; subtitle?: string; kind: "fields"; names: string[] }
  | { title: string; subtitle?: string; kind: "chips"; group: string; specifyMap?: Record<string, string> }
  | { title: string; subtitle?: string; kind: "review" };

type Props = {
  schema: SchemaField[];
  steps: StepDef[];
  prefill: Record<string, string | boolean>;
  getValue: (name: string, fallback: string | boolean) => string | boolean;
  setValue: (name: string, value: string | boolean) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  onHelp: (label: string) => void;
};

export default function FormWizard({ schema, steps, prefill, getValue, setValue, onSubmit, isSubmitting, onHelp }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [chipSearch, setChipSearch] = useState("");

  const byName = useMemo(() => {
    const m = new Map<string, SchemaField>();
    for (const f of schema) m.set(f.name, f);
    return m;
  }, [schema]);

  const fieldsForStep = (step: StepDef): SchemaField[] => {
    if (step.kind === "fields") {
      return step.names.map(n => byName.get(n)).filter((f): f is SchemaField => !!f);
    }
    if (step.kind === "radio" || step.kind === "chips") {
      return schema.filter(f => f.group === step.group && !f.name.endsWith("_specify"));
    }
    return [];
  };

  const resolved = (name: string): string | boolean => {
    const def = byName.get(name);
    const fb = prefill[name] ?? (def?.type === "checkbox" ? false : "");
    return getValue(name, fb);
  };

  const validateStep = (idx: number): string[] => {
    const step = steps[idx];
    const out: string[] = [];
    if (step.kind === "radio") {
      const fs = fieldsForStep(step);
      const anyChecked = fs.some(f => resolved(f.name) === true);
      if (fs[0]?.required && !anyChecked) out.push(`Pumili ng ${step.title.toLowerCase()}.`);
    } else if (step.kind === "fields") {
      for (const f of fieldsForStep(step)) {
        if (f.required) {
          const v = resolved(f.name);
          if (typeof v !== "string" || v.trim() === "") out.push(`${f.label} ay required.`);
        }
      }
    }
    return out;
  };

  const goNext = () => {
    const errs = validateStep(stepIndex);
    if (errs.length > 0) {
      setErrors(errs);
      return;
    }
    setErrors([]);
    setStepIndex(i => Math.min(i + 1, steps.length - 1));
  };

  const goBack = () => {
    setErrors([]);
    setStepIndex(i => Math.max(i - 1, 0));
  };

  const handleRadio = (group: string, picked: string) => {
    const fs = schema.filter(f => f.group === group && f.type === "checkbox");
    for (const f of fs) setValue(f.name, f.name === picked);
  };

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-[var(--font-mono)] uppercase tracking-wider text-muted-foreground">
            Step {stepIndex + 1} of {steps.length}
          </span>
          <span className="text-[10px] font-[var(--font-mono)] text-teal">{step.title}</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-teal"
            initial={false}
            animate={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      <div>
        <h3 className="font-[var(--font-display)] text-base text-earth-brown">{step.title}</h3>
        {step.subtitle && <p className="text-xs text-muted-foreground mt-0.5">{step.subtitle}</p>}
      </div>

      {/* Step content */}
      <div className="min-h-[220px]">
        {step.kind === "radio" && (
          <RadioGroup
            fields={fieldsForStep(step)}
            isChecked={(name) => resolved(name) === true}
            onPick={(name) => handleRadio(step.group, name)}
          />
        )}

        {step.kind === "fields" && (
          <FieldsList
            fields={fieldsForStep(step)}
            getText={(name) => {
              const v = resolved(name);
              return typeof v === "string" ? v : "";
            }}
            setText={(name, v) => setValue(name, v)}
            onHelp={onHelp}
          />
        )}

        {step.kind === "chips" && (
          <ChipPicker
            fields={fieldsForStep(step)}
            search={chipSearch}
            onSearch={setChipSearch}
            isSelected={(name) => resolved(name) === true}
            toggle={(name) => setValue(name, !(resolved(name) === true))}
            specifyMap={step.specifyMap ?? {}}
            getSpecify={(name) => {
              const v = resolved(name);
              return typeof v === "string" ? v : "";
            }}
            setSpecify={(name, v) => setValue(name, v)}
          />
        )}

        {step.kind === "review" && (
          <ReviewSummary
            steps={steps}
            schema={schema}
            resolved={(n) => resolved(n)}
            jumpTo={(idx) => setStepIndex(idx)}
          />
        )}
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-jeepney-red/10 border border-jeepney-red/30 rounded-lg px-3 py-2">
          {errors.map((e, i) => (
            <p key={i} className="text-xs text-jeepney-red">• {e}</p>
          ))}
        </div>
      )}

      {/* Sticky-ish nav (within the expanded card) */}
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/50">
        <Button
          onClick={goBack}
          disabled={stepIndex === 0}
          variant="outline"
          className="rounded-xl border-teal/30 text-teal min-h-11 px-5"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />Back
        </Button>

        {!isLast ? (
          <Button
            onClick={goNext}
            className="bg-teal hover:bg-teal/90 text-white rounded-xl font-[var(--font-display)] min-h-11 px-6 flex-1"
          >
            Next<ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        ) : (
          <Button
            onClick={onSubmit}
            disabled={isSubmitting}
            className="bg-teal hover:bg-teal/90 text-white rounded-xl font-[var(--font-display)] min-h-11 px-6 flex-1"
          >
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating…</>
            ) : (
              <><Download className="w-4 h-4 mr-2" />I-download ang PDF</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function RadioGroup({
  fields,
  isChecked,
  onPick,
}: {
  fields: SchemaField[];
  isChecked: (name: string) => boolean;
  onPick: (name: string) => void;
}) {
  return (
    <div className="space-y-2">
      {fields.map(f => {
        const checked = isChecked(f.name);
        return (
          <button
            key={f.name}
            type="button"
            onClick={() => onPick(f.name)}
            className={`w-full text-left px-4 py-3 rounded-xl border min-h-11 flex items-center gap-3 transition-colors ${
              checked
                ? "bg-teal-light border-teal text-earth-brown"
                : "bg-white border-border hover:border-teal/40"
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                checked ? "border-teal bg-teal" : "border-muted-foreground/40"
              }`}
            >
              {checked && <span className="w-2 h-2 rounded-full bg-white" />}
            </span>
            <span className="text-sm flex-1">{f.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function FieldsList({
  fields,
  getText,
  setText,
  onHelp,
}: {
  fields: SchemaField[];
  getText: (name: string) => string;
  setText: (name: string, value: string) => void;
  onHelp: (label: string) => void;
}) {
  return (
    <div className="space-y-3">
      {fields.map(f => (
        <div key={f.name}>
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            {f.label}
            {f.required && <span className="text-jeepney-red">*</span>}
            <button
              type="button"
              onClick={() => onHelp(f.label)}
              className="ml-auto text-muted-foreground/60 hover:text-teal transition-colors"
              title={`Tulong sa "${f.label}"`}
            >
              <HelpCircle className="w-3 h-3" />
            </button>
          </label>
          <input
            type="text"
            inputMode={
              f.name.includes("capital") || f.name.includes("fee") || f.name.includes("amount") || f.name.includes("zip") || f.name === "street_no" || f.name === "dti_cap"
                ? "numeric"
                : undefined
            }
            autoComplete={
              f.name === "email" || f.name.endsWith("_email") ? "email"
                : f.name === "telephone_no" || f.name.endsWith("_mobile") || f.name.endsWith("_contact") ? "tel"
                : undefined
            }
            value={getText(f.name)}
            onChange={(e) => setText(f.name, e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white border border-border text-base focus:outline-none focus:ring-2 focus:ring-teal/40 font-[var(--font-body)] mt-0.5 min-h-11"
          />
        </div>
      ))}
    </div>
  );
}

function ChipPicker({
  fields,
  search,
  onSearch,
  isSelected,
  toggle,
  specifyMap,
  getSpecify,
  setSpecify,
}: {
  fields: SchemaField[];
  search: string;
  onSearch: (s: string) => void;
  isSelected: (name: string) => boolean;
  toggle: (name: string) => void;
  specifyMap: Record<string, string>;
  getSpecify: (name: string) => string;
  setSpecify: (name: string, value: string) => void;
}) {
  const q = search.trim().toLowerCase();
  const filtered = q ? fields.filter(f => f.label.toLowerCase().includes(q)) : fields;
  const selectedFields = fields.filter(f => isSelected(f.name));

  return (
    <div className="space-y-3">
      {selectedFields.length > 0 && (
        <div className="bg-teal-light/50 border border-teal/30 rounded-lg px-3 py-2">
          <p className="text-[10px] font-[var(--font-mono)] uppercase tracking-wider text-teal mb-1">
            Selected ({selectedFields.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {selectedFields.map(f => (
              <button
                key={f.name}
                type="button"
                onClick={() => toggle(f.name)}
                className="text-xs px-2 py-1 rounded-full bg-teal text-white hover:bg-teal/90 min-h-7"
              >
                {f.label} ✕
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search type ng business…"
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-border text-base focus:outline-none focus:ring-2 focus:ring-teal/40 min-h-11"
        />
      </div>

      <div className="flex flex-wrap gap-2 max-h-[260px] overflow-y-auto">
        {filtered.map(f => {
          const sel = isSelected(f.name);
          return (
            <button
              key={f.name}
              type="button"
              onClick={() => toggle(f.name)}
              className={`text-xs px-3 py-2 rounded-full border min-h-9 transition-colors ${
                sel
                  ? "bg-teal text-white border-teal"
                  : "bg-white text-earth-brown border-border hover:border-teal/40"
              }`}
            >
              {f.label}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground py-2">Walang nahanap. Try other keyword.</p>
        )}
      </div>

      {Object.entries(specifyMap).map(([trigger, target]) => {
        if (!isSelected(trigger)) return null;
        const triggerField = fields.find(f => f.name === trigger);
        return (
          <div key={target}>
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              {triggerField?.label} — specify
            </label>
            <input
              type="text"
              value={getSpecify(target)}
              onChange={(e) => setSpecify(target, e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white border border-border text-base focus:outline-none focus:ring-2 focus:ring-teal/40 mt-0.5 min-h-11"
            />
          </div>
        );
      })}
    </div>
  );
}

function ReviewSummary({
  steps,
  schema,
  resolved,
  jumpTo,
}: {
  steps: StepDef[];
  schema: SchemaField[];
  resolved: (name: string) => string | boolean;
  jumpTo: (stepIndex: number) => void;
}) {
  const byName = new Map(schema.map(f => [f.name, f]));

  // Mirror the step ordering, skipping the review step itself.
  const sections = steps
    .map((s, idx) => {
      if (s.kind === "review") return null;
      let names: string[] = [];
      if (s.kind === "fields") names = s.names;
      else if (s.kind === "radio" || s.kind === "chips") {
        names = schema.filter(f => f.group === s.group && !f.name.endsWith("_specify")).map(f => f.name);
        if (s.kind === "chips" && s.specifyMap) {
          for (const target of Object.values(s.specifyMap)) names.push(target);
        }
      }
      return { idx, title: s.title, names };
    })
    .filter((x): x is { idx: number; title: string; names: string[] } => !!x);

  return (
    <div className="space-y-3">
      {sections.map(s => {
        const filledLabels: string[] = [];
        for (const n of s.names) {
          const f = byName.get(n);
          if (!f) continue;
          const v = resolved(n);
          if (f.type === "checkbox") {
            if (v === true) filledLabels.push(f.label);
          } else if (typeof v === "string" && v.trim() !== "") {
            filledLabels.push(`${f.label}: ${v}`);
          }
        }
        return (
          <button
            key={s.idx}
            type="button"
            onClick={() => jumpTo(s.idx)}
            className="w-full text-left bg-white border border-border rounded-xl p-3 hover:border-teal/40 transition-colors"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <h4 className="font-[var(--font-display)] text-xs text-earth-brown">{s.title}</h4>
              <span className="text-[10px] text-teal font-[var(--font-mono)]">Edit →</span>
            </div>
            {filledLabels.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Walang naipasok pa.</p>
            ) : (
              <ul className="space-y-0.5">
                {filledLabels.map((l, i) => (
                  <li key={i} className="text-xs text-earth-brown flex items-start gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-success shrink-0 mt-0.5" />
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            )}
          </button>
        );
      })}
    </div>
  );
}
