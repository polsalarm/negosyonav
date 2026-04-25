import { useLocation } from "wouter";
import { MessageCircle } from "lucide-react";

export default function ChatFab() {
  const [, navigate] = useLocation();
  return (
    <button
      type="button"
      aria-label="Open chat assistant"
      onClick={() => navigate("/")}
      className="fixed right-4 bottom-20 z-40 h-14 w-14 rounded-full bg-teal text-white shadow-lg flex items-center justify-center hover:bg-teal/90 active:scale-95 transition-all"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <MessageCircle className="w-6 h-6" />
    </button>
  );
}
