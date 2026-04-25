/*
 * NegosyoNav Home Page
 * Design: Jeepney Modernism — warm mango/teal palette, vertical card-stack,
 * conversational chat UI at the bottom, Filipino micro-entrepreneur focused.
 * Now with real AI-powered Taglish chat via LLM backend.
 */
import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
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
  Users,
} from "lucide-react";
import { sampleUserMessages } from "@/data/manilaData";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const WELCOME_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "Kumusta! Ako si NegosyoNav, ang iyong gabay sa pag-register ng negosyo. 🏪\n\nSabihin mo lang sa akin:\n• Anong klaseng negosyo ang gusto mong simulan?\n• Saan mo ito itatayo? (city/municipality)\n\nHalimbawa: \"Gusto ko mag-open ng sari-sari store sa Tondo, Manila\"",
};

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [roadmapReady, setRoadmapReady] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chatMutation = trpc.ai.chat.useMutation();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = async (text?: string) => {
    const msg = text || inputValue.trim();
    if (!msg || isTyping) return;

    const newUserMessage: ChatMessage = { role: "user", content: msg };
    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);
    setInputValue("");
    setIsTyping(true);

    try {
      // Send only user/assistant messages (not system) to the backend
      const chatHistory = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await chatMutation.mutateAsync({ messages: chatHistory });

      const allMessages = [
        ...updatedMessages,
        { role: "assistant" as const, content: response.content },
      ];
      setMessages(allMessages);
      // Persist chat history for profile extraction
      sessionStorage.setItem('negosyonav_chat_history', JSON.stringify(
        allMessages.map(m => ({ role: m.role, content: m.content }))
      ));
      setRoadmapReady(true);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Pasensya na, may technical issue ngayon. Subukan mo ulit mamaya! 🙏",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-warm-cream">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-border">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal flex items-center justify-center">
              <MapPin className="w-4 h-4 text-white" />
            </div>
            <span className="font-[var(--font-display)] text-lg text-earth-brown tracking-tight">
              NegosyoNav
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/hub")}
              className="flex items-center gap-1.5 text-xs font-medium text-earth-brown bg-mango-light border border-mango/20 px-3 py-1.5 rounded-full hover:bg-mango/20 transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
              Hub
            </button>
            <span className="text-xs font-[var(--font-mono)] text-muted-foreground bg-mango-light px-2 py-1 rounded-full">
              Manila City
            </span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      {messages.length <= 1 && !roadmapReady && (
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
      <div className="flex-1 overflow-y-auto pb-56">
        <div className="container max-w-2xl py-4 space-y-4">
          <AnimatePresence>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
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
          {/* Quick suggestions */}
          {messages.length <= 1 && (
            <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
              {sampleUserMessages.map((msg, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(msg)}
                  className="shrink-0 text-xs font-medium text-teal bg-teal-light border border-teal/20 px-3 py-2 rounded-full hover:bg-teal/20 transition-colors"
                >
                  {msg}
                </button>
              ))}
            </div>
          )}

          {/* Input bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="I-describe ang iyong negosyo..."
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-teal/40 transition-all font-[var(--font-body)]"
              />
            </div>
            <Button
              onClick={() => handleSend()}
              disabled={!inputValue.trim() || isTyping}
              className="bg-teal hover:bg-teal/90 text-white rounded-xl h-11 w-11 p-0 shrink-0 shadow-md"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
