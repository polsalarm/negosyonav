import { useState } from "react";

export type FormHelpMessage = {
  role: "user" | "assistant";
  content: string;
};

export type FormHelpMode =
  | { kind: "field"; label: string }
  | { kind: "general" };

export function useFormHelp(formName: string) {
  const [mode, setMode] = useState<FormHelpMode | null>(null);
  const [history, setHistory] = useState<FormHelpMessage[]>([]);

  const openFieldHelp = (fieldLabel: string) => {
    setMode({ kind: "field", label: fieldLabel });
    setHistory([]);
  };

  const openGeneralHelp = () => {
    setMode({ kind: "general" });
    setHistory([]);
  };

  const closeHelp = () => {
    setMode(null);
    setHistory([]);
  };

  const addMessage = (msg: FormHelpMessage) => {
    setHistory(prev => [...prev, msg]);
  };

  return {
    formName,
    mode,
    history,
    isOpen: mode !== null,
    isGeneral: mode?.kind === "general",
    fieldLabel: mode?.kind === "field" ? mode.label : "",
    openFieldHelp,
    openGeneralHelp,
    closeHelp,
    addMessage,
    setHistory,
  };
}
