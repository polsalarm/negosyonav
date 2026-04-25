import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  MapPin,
  FileText,
  Coins,
  Award,
  ChevronDown,
  Sparkles,
  MessageCircle,
  Menu,
} from "lucide-react";
import { sampleUserMessages } from "@/data/manilaData";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";
import AppDrawer from "@/components/AppDrawer";

type ChatMessage = { role: "user" | "assistant"; content: string };

const WELCOME_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "Kumusta! Ako si NegosyoNav, ang iyong gabay sa pag-register ng negosyo. 🏪\n\nSabihin mo lang sa akin:\n• Anong klaseng negosyo ang gusto mong simulan?\n• Saan mo ito itatayo? (city/municipality)\n\nHalimbawa: \"Gusto ko mag-open ng sari-sari store sa Tondo, Manila\"",
};

const FOLLOWUP_SUGGESTIONS = [
  "Magkano gagastusin?",
  "Anong forms kailangan?",
  "May grant ba ako?",
];

export default function Home() {
  const [, navigate] = useLocation();
  const [inputValue, setInputValue] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Default null = fresh chat. Picking a thread from drawer sets this.
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  // Optimistic local messages for the in-flight new chat (until server returns threadId).
  const [pendingMessages, setPendingMessages] = useState<ChatMessage[]>([]);
  const [pendingRoadmapReady, setPendingRoadmapReady] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const utils = trpc.useUtils();
  const threadQuery = trpc.ai.getThread.useQuery(
    activeThreadId ? { threadId: activeThreadId } : { threadId: "" },
    {
      enabled: !!activeThreadId,
      staleTime: 30_000,
    }
  );

  const chatMutation = trpc.ai.chat.useMutation({
    onMutate: (variables) => {
      if (activeThreadId) {
        const key = { threadId: activeThreadId };
        const prev = utils.ai.getThread.getData(key);
        utils.ai.getThread.setData(key, (curr) => {
          const prior = curr?.messages ?? [];
          return {
            threadId: activeThreadId,
            title: curr?.title ?? "Bagong chat",
            messages: [...prior, { role: "user", content: variables.content }],
            roadmapReady: curr?.roadmapReady ?? false,
          };
        });
        return { prev, optimisticThreadId: activeThreadId };
      } else {
        setPendingMessages((m) => [...m, { role: "user", content: variables.content }]);
        return { prev: null, optimisticThreadId: null };
      }
    },
    onSuccess: (data, _vars, ctx) => {
      if (ctx?.optimisticThreadId) {
        const key = { threadId: ctx.optimisticThreadId };
        utils.ai.getThread.setData(key, (curr) => {
          const prior = curr?.messages ?? [];
          return {
            threadId: ctx.optimisticThreadId!,
            title: data.title,
            messages: [...prior, { role: "assistant", content: data.content }],
            roadmapReady: data.roadmapReady,
          };
        });
      } else {
        // Was a fresh chat — server created the thread, now switch to it.
        setActiveThreadId(data.threadId);
        setPendingMessages([]);
        setPendingRoadmapReady(false);
        utils.ai.getThread.setData({ threadId: data.threadId }, {
          threadId: data.threadId,
          title: data.title,
          messages: [
            ...pendingMessages,
            { role: "assistant", content: data.content },
          ],
          roadmapReady: data.roadmapReady,
        });
      }
      utils.ai.listThreads.invalidate();
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.optimisticThreadId && ctx.prev) {
        utils.ai.getThread.setData({ threadId: ctx.optimisticThreadId }, ctx.prev);
      } else if (!ctx?.optimisticThreadId) {
        setPendingMessages((m) => m.slice(0, -1));
      }
      if (err.message === "LLM_UNAVAILABLE") {
        toast.error("Bumalik mamaya — busy ang AI 🙏");
      } else {
        toast.error("Pasensya na, may technical issue. Subukan mo ulit.");
      }
    },
  });

  const storedMessages = activeThreadId
    ? (threadQuery.data?.messages ?? [])
    : pendingMessages;
  const messages: ChatMessage[] =
    storedMessages.length === 0 ? [WELCOME_MESSAGE] : storedMessages;
  const isTyping = chatMutation.isPending;
  const roadmapReady = activeThreadId
    ? (threadQuery.data?.roadmapReady ?? false)
    : pendingRoadmapReady;
  const hasUserMessages = storedMessages.length > 0;

  const handleSelectThread = (threadId: string | null) => {
    setActiveThreadId(threadId);
    setPendingMessages([]);
    setPendingRoadmapReady(false);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isTyping]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 40), 120)}px`;
  }, [inputValue]);

  const handleSend = (text?: string) => {
    const msg = (text ?? inputValue).trim();
    if (!msg || isTyping) return;
    setInputValue("");
    chatMutation.mutate(
      activeThreadId ? { content: msg, threadId: activeThreadId } : { content: msg }
    );
    inputRef.current?.focus();
  };

  return (
    <div className="min-h-screen flex flex-col bg-warm-cream">
      <AppDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        activeThreadId={activeThreadId}
        onSelectThread={handleSelectThread}
      />
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-border">
        <div className="container flex items-center justify-between h-14">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="-ml-2 inline-flex items-center justify-center h-11 w-11 rounded-lg text-earth-brown hover:bg-mango-light active:bg-mango-light transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="font-[var(--font-display)] text-lg text-earth-brown tracking-tight">
              NegosyoNav
            </span>
            <div className="w-8 h-8 rounded-lg bg-teal flex items-center justify-center">
              <MapPin className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      {!hasUserMessages && !roadmapReady && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden"
        >
          <div className="relative">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663595373104/ZbKGxbkduWCL2xYHgfFPXg/hero-manila-street-jvEYVVKWcrpWYPWKF3uKev.webp"
              alt="Manila street scene with sari-sari stores and carinderia"
              className="w-full h-56 sm:h-72 object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-warm-cream via-warm-cream/60 to-transparent" />
          </div>
          <div className="container relative -mt-20 pb-6">
            <h1 className="font-[var(--font-display)] text-2xl sm:text-3xl text-earth-brown leading-tight">
              Simulan ang iyong
              <br />
              <span className="text-teal">Lakad Roadmap</span>
            </h1>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-md leading-relaxed font-[var(--font-body)]">
              I-describe mo lang ang iyong negosyo sa Taglish — at bibigyan ka
              namin ng step-by-step guide para sa registration sa Manila.
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2 mt-4">
              {[
                { icon: FileText, label: "Documents" },
                { icon: Coins, label: "Cost Estimate" },
                { icon: MapPin, label: "Office Locations" },
                { icon: Award, label: "Grant Matching" },
              ].map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-earth-brown bg-white border border-border px-3 py-1.5 rounded-full shadow-sm"
                >
                  <Icon className="w-3.5 h-3.5 text-teal" />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Scroll hint */}
          <div className="flex justify-center pb-2">
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            </motion.div>
          </div>
        </motion.section>
      )}

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto pb-40">
        <div className="container max-w-2xl py-4 space-y-4">
          <AnimatePresence>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                    msg.role === "user"
                      ? "bg-teal text-white rounded-br-md"
                      : "bg-white text-foreground border border-border rounded-bl-md"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <Streamdown>{msg.content}</Streamdown>
                  ) : (
                    msg.content
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {isTyping && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="bg-white border border-border rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 rounded-full bg-teal"
                      animate={{ y: [0, -6, 0] }}
                      transition={{
                        repeat: Infinity,
                        duration: 0.6,
                        delay: i * 0.15,
                      }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* View Roadmap CTA */}
          {roadmapReady && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="flex justify-center pt-4"
            >
              <Button
                onClick={() => navigate("/roadmap")}
                className="bg-mango hover:bg-mango/90 text-earth-brown font-[var(--font-display)] text-base px-8 py-6 rounded-2xl shadow-lg hover:shadow-xl transition-all"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Tingnan ang Lakad Roadmap
              </Button>
            </motion.div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Sticky Chat Input */}
      <div className="fixed bottom-16 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-border z-40">
        <div className="container max-w-2xl py-3">
          {/* Quick suggestions — always visible, swap copy after first reply */}
          <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
            {(hasUserMessages ? FOLLOWUP_SUGGESTIONS : sampleUserMessages).map((msg) => (
              <button
                key={msg}
                onClick={() => handleSend(msg)}
                disabled={isTyping}
                className="shrink-0 inline-flex items-center text-[11px] font-medium text-teal bg-teal-light border border-teal/20 px-2.5 py-1 rounded-full hover:bg-teal/20 transition-colors disabled:opacity-50"
              >
                {msg}
              </button>
            ))}
          </div>

          {/* Input bar */}
          <div className="flex items-end gap-1.5">
            <div className="flex-1 relative">
              <MessageCircle className="absolute left-2.5 top-3 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <textarea
                ref={inputRef}
                rows={1}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  if (e.nativeEvent.isComposing) return;
                  if (e.shiftKey) return;
                  e.preventDefault();
                  handleSend();
                }}
                placeholder="I-describe ang iyong negosyo..."
                aria-label="Chat message input"
                enterKeyHint="send"
                className="block w-full pl-8 pr-3 py-2 h-10 min-h-10 max-h-[120px] rounded-lg bg-muted border border-border text-base focus:outline-none focus:ring-2 focus:ring-teal/40 transition-all font-[var(--font-body)] resize-none overflow-y-auto leading-6"
              />
            </div>
            <Button
              onClick={() => handleSend()}
              disabled={!inputValue.trim() || isTyping}
              aria-label="Send message"
              className="bg-teal hover:bg-teal/90 text-white rounded-lg h-10 w-10 p-0 shrink-0 shadow-md"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
