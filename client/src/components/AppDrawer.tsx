import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Plus,
  MessageCircle,
  Map as MapIcon,
  FileText,
  Users,
  User,
  MapPin,
  Calendar,
  Award,
  Clock,
  Trash2,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeThreadId: string | null;
  onSelectThread: (threadId: string | null) => void;
};

const NAV_ITEMS: Array<{ to: string; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { to: "/", label: "Chat", icon: MessageCircle },
  { to: "/roadmap", label: "Lakad Roadmap", icon: MapIcon },
  { to: "/forms", label: "Forms", icon: FileText },
  { to: "/hub", label: "Negosyante Hub", icon: Users },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/places", label: "Places", icon: MapPin },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/grants", label: "Grants", icon: Award },
  { to: "/planner", label: "Planner", icon: Clock },
];

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return "kanina lang";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.round(day / 30);
  return `${mo}mo ago`;
}

export default function AppDrawer({ open, onOpenChange, activeThreadId, onSelectThread }: Props) {
  const [location, navigate] = useLocation();
  const utils = trpc.useUtils();
  const threadsQuery = trpc.ai.listThreads.useQuery(undefined, {
    enabled: open,
    staleTime: 10_000,
  });
  const deleteThread = trpc.ai.deleteThread.useMutation({
    onSuccess: () => {
      utils.ai.listThreads.invalidate();
    },
    onError: () => toast.error("Hindi na-delete. Try ulit."),
  });

  const close = () => onOpenChange(false);

  const startNewChat = () => {
    onSelectThread(null);
    if (location !== "/") navigate("/");
    close();
  };

  const goTo = (to: string) => {
    if (to !== location) navigate(to);
    close();
  };

  const pickThread = (threadId: string) => {
    onSelectThread(threadId);
    if (location !== "/") navigate("/");
    close();
  };

  const handleDelete = (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeThreadId === threadId) onSelectThread(null);
    deleteThread.mutate({ threadId });
  };

  const threads = threadsQuery.data ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-full sm:max-w-full p-0 bg-warm-cream"
      >
        <SheetHeader className="border-b border-border bg-white/80 backdrop-blur-md">
          <SheetTitle className="font-[var(--font-display)] text-xl text-earth-brown">
            NegosyoNav
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Manila City — gabay sa pag-register ng negosyo
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-6">
            {/* New Chat */}
            <Button
              type="button"
              onClick={startNewChat}
              className="w-full min-h-11 bg-teal hover:bg-teal/90 text-white font-medium rounded-xl shadow-sm"
            >
              <Plus className="w-5 h-5 mr-2" />
              Bagong chat
            </Button>

            {/* Nav */}
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-2">
                Mga feature
              </h3>
              <nav className="grid grid-cols-1 gap-1">
                {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
                  const isActive = location === to;
                  return (
                    <button
                      key={to}
                      type="button"
                      onClick={() => goTo(to)}
                      className={cn(
                        "flex items-center gap-3 min-h-11 px-3 rounded-lg text-left text-sm font-medium transition-colors",
                        isActive
                          ? "bg-teal-light text-teal"
                          : "text-foreground hover:bg-mango-light active:bg-mango-light"
                      )}
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      <span className="truncate">{label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* History */}
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-2">
                Mga nakaraang chat
              </h3>
              {threadsQuery.isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : threads.length === 0 ? (
                <p className="text-xs text-muted-foreground px-2 py-3">
                  Wala pang dating chat. Simulan mo na — itanong mo lang ang
                  iyong negosyo.
                </p>
              ) : (
                <ul className="space-y-1">
                  {threads.map((t) => {
                    const isActive = t.threadId === activeThreadId;
                    return (
                      <li key={t.threadId}>
                        <div
                          className={cn(
                            "group flex items-start gap-2 rounded-lg px-2 py-2 transition-colors",
                            isActive
                              ? "bg-teal-light"
                              : "hover:bg-mango-light"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => pickThread(t.threadId)}
                            className="flex-1 min-w-0 text-left"
                          >
                            <p
                              className={cn(
                                "text-sm font-medium truncate",
                                isActive ? "text-teal" : "text-foreground"
                              )}
                            >
                              {t.title}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {t.messageCount} mensahe · {relativeTime(t.updatedAt)}
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDelete(t.threadId, e)}
                            aria-label={`Delete chat ${t.title}`}
                            className="shrink-0 h-11 w-11 -m-2 inline-flex items-center justify-center text-muted-foreground hover:text-jeepney-red rounded-md"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
