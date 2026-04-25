import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Streamdown } from "streamdown";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { X, Send, Loader2, MessageCircle, HelpCircle } from "lucide-react";
import type { FormHelpMessage } from "@/hooks/useFormHelp";

interface FormHelpDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  formName: string;
  fieldLabel: string;
  isGeneral: boolean;
  history: FormHelpMessage[];
  onAddMessage: (msg: FormHelpMessage) => void;
  userProfile?: Record<string, unknown>;
}

const FIELD_QUICK_PROMPTS = [
  "Ano ito?",
  "Ano ang ilalagay ko?",
  "May example ba?",
];

const GENERAL_QUICK_PROMPTS = [
  "Anong order ng forms?",
  "Magkano lahat ng bayad?",
  "Saan ko ito ipa-file?",
  "Qualified ba ako sa BMBE?",
];

export default function FormHelpDrawer({
  isOpen,
  onClose,
  formName,
  fieldLabel,
  isGeneral,
  history,
  onAddMessage,
  userProfile,
}: FormHelpDrawerProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const formHelpMutation = trpc.ai.formHelp.useMutation({
    onSuccess: (data) => {
      onAddMessage({ role: "assistant", content: data.content });
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, formHelpMutation.isPending]);

  const sendQuestion = (question: string) => {
    if (!question.trim() || formHelpMutation.isPending) return;

    const userMsg: FormHelpMessage = { role: "user", content: question };
    onAddMessage(userMsg);
    setInput("");

    formHelpMutation.mutate({
      formName: formName || undefined,
      fieldLabel: isGeneral ? undefined : fieldLabel,
      userQuestion: question,
      conversationHistory: history,
      userProfile,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendQuestion(input);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/30 z-[55]"
          />

          {/* Drawer — z above BottomNav (z-50) so input bar isn't covered */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[60] bg-white rounded-t-3xl shadow-2xl max-h-[80vh] flex flex-col pb-[env(safe-area-inset-bottom)]"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-muted-foreground/20 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center gap-3 px-4 pb-3 border-b border-border">
              <div className="w-8 h-8 bg-teal/10 rounded-xl flex items-center justify-center">
                <HelpCircle className="w-4 h-4 text-teal" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground font-[var(--font-mono)] uppercase tracking-wider">
                  {isGeneral ? "NegosyoNav Assistant" : formName}
                </p>
                <p className="text-sm font-[var(--font-display)] text-earth-brown truncate">
                  {isGeneral ? "Kausapin si NegosyoNav" : fieldLabel}
                </p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
              {history.length === 0 && (
                <div className="text-center py-4">
                  <MessageCircle className="w-8 h-8 text-teal/40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">
                    {isGeneral
                      ? "Magtanong tungkol sa forms, registration, grants, o kahit anong NegosyoNav topic!"
                      : "Tanungin mo ako tungkol sa field na ito!"}
                  </p>
                </div>
              )}
              {history.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm font-[var(--font-body)] leading-relaxed ${
                      msg.role === "user"
                        ? "bg-teal text-white rounded-br-sm"
                        : "bg-muted text-earth-brown rounded-bl-sm"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-2 prose-pre:my-2 prose-code:text-[0.85em] prose-a:text-teal prose-a:underline prose-strong:text-earth-brown break-words">
                        <Streamdown>{msg.content}</Streamdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {formHelpMutation.isPending && (
                <div className="flex justify-start">
                  <div className="bg-muted px-3 py-2 rounded-2xl rounded-bl-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-teal" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Quick prompts */}
            {history.length === 0 && (
              <div className="px-4 pb-2 flex gap-2 flex-wrap">
                {(isGeneral ? GENERAL_QUICK_PROMPTS : FIELD_QUICK_PROMPTS).map(q => (
                  <button
                    key={q}
                    onClick={() => sendQuestion(q)}
                    disabled={formHelpMutation.isPending}
                    className="text-xs bg-teal/10 text-teal px-3 py-1.5 rounded-full font-[var(--font-display)] hover:bg-teal/20 transition-colors disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <form onSubmit={handleSubmit} className="flex gap-2 px-4 pb-4 pt-2 border-t border-border">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={isGeneral ? "Magtanong kay NegosyoNav..." : "Magtanong tungkol sa field na ito..."}
                className="flex-1 min-h-11 px-3 rounded-xl bg-muted border border-border text-base focus:outline-none focus:ring-2 focus:ring-teal/40 font-[var(--font-body)]"
                disabled={formHelpMutation.isPending}
                inputMode="text"
                autoComplete="off"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || formHelpMutation.isPending}
                className="bg-teal hover:bg-teal/90 text-white rounded-xl shrink-0 min-h-11 min-w-11"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
