import { useState } from "react";

export type FormHelpMessage = {
  role: "user" | "assistant";
  content: string;
};

export function useFormHelp(formName: string) {
  const [activeField, setActiveField] = useState<{ label: string } | null>(null);
  const [history, setHistory] = useState<FormHelpMessage[]>([]);

  const openHelp = (fieldLabel: string) => {
    setActiveField({ label: fieldLabel });
    setHistory([]);
  };

  const closeHelp = () => {
    setActiveField(null);
    setHistory([]);
  };

  const addMessage = (msg: FormHelpMessage) => {
    setHistory(prev => [...prev, msg]);
  };

  return {
    formName,
    activeField,
    history,
    isOpen: !!activeField,
    openHelp,
    closeHelp,
    addMessage,
    setHistory,
  };
}
