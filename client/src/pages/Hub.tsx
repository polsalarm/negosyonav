/*
 * Negosyante Hub — Community Board
 * Design System Refresh: Community Purple for Hub identity, larger touch targets.
 */
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Streamdown } from "streamdown";
import {
  ArrowLeft,
  Users,
  ThumbsUp,
  ThumbsDown,
  MessageSquarePlus,
  AlertTriangle,
  Lightbulb,
  HelpCircle,
  Star,
  X,
  Send,
  Shield,
} from "lucide-react";

const CATEGORIES = [
  { value: "all", label: "Lahat", icon: Users },
  { value: "tip", label: "Tips", icon: Lightbulb },
  { value: "warning", label: "Babala", icon: AlertTriangle },
  { value: "question", label: "Tanong", icon: HelpCircle },
  { value: "experience", label: "Kwento", icon: Star },
] as const;

/* Design.md: Community chips use purple (#534AB7) */
const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  tip:        { bg: "bg-community-light", text: "text-community", border: "border-community/20" },
  warning:    { bg: "bg-destructive/10",  text: "text-destructive", border: "border-destructive/20" },
  question:   { bg: "bg-primary/10",      text: "text-primary",     border: "border-primary/20" },
  experience: { bg: "bg-mango-light",     text: "text-foreground",  border: "border-mango/20" },
};

const CATEGORY_ICONS: Record<string, typeof Lightbulb> = {
  tip: Lightbulb,
  warning: AlertTriangle,
  question: HelpCircle,
  experience: Star,
};

const SEED_POSTS = [
  {
    id: "seed-1",
    userId: 0,
    authorName: "Aling Rosa",
    lguTag: "manila_city",
    category: "tip" as const,
    title: "Mabilis lang kumuha ng permit sa E-BOSS Lounge!",
    content: "Kung pupunta kayo sa Manila City Hall para sa Mayor's Permit, diretso kayo sa E-BOSS Lounge sa Ground Floor. Hindi kayo kailangan pumila sa Room 110. Natapos ako in 2 hours lang! Bring complete documents ha.",
    upvotes: 24,
    downvotes: 1,
    isFlagged: false,
    createdAt: new Date("2026-04-20T08:00:00Z"),
    updatedAt: new Date("2026-04-20T08:00:00Z"),
  },
  {
    id: "seed-2",
    userId: 0,
    authorName: "Kuya Ben",
    lguTag: "manila_city",
    category: "warning" as const,
    title: "Mag-ingat sa mga fixer sa labas ng City Hall!",
    content: "May mga tao sa labas ng Manila City Hall na mag-ooffer na 'tulungan' kayo sa permit. Huwag kayong papayag — ₱3,000-₱5,000 ang singil nila para sa process na kaya niyong gawin mag-isa. Lahat ng info nasa NegosyoNav na! Kaya niyo 'to!",
    upvotes: 42,
    downvotes: 0,
    isFlagged: false,
    createdAt: new Date("2026-04-18T10:00:00Z"),
    updatedAt: new Date("2026-04-18T10:00:00Z"),
  },
  {
    id: "seed-3",
    userId: 0,
    authorName: "Maria Santos",
    lguTag: "manila_city",
    category: "experience" as const,
    title: "Nakapag-register na ako ng carinderia ko sa Sampaloc!",
    content: "Salamat sa NegosyoNav! Hindi ko alam dati na kailangan ko pala ng Cedula bago Mayor's Permit. Natapos ko lahat in 1 week lang. Total gastos ko: ₱6,200. Nag-apply din ako sa BMBE para sa tax exemption. Kaya niyo rin 'to mga ka-negosyante!",
    upvotes: 18,
    downvotes: 0,
    isFlagged: false,
    createdAt: new Date("2026-04-15T14:00:00Z"),
    updatedAt: new Date("2026-04-15T14:00:00Z"),
  },
  {
    id: "seed-4",
    userId: 0,
    authorName: "Tatay Jun",
    lguTag: "manila_city",
    category: "question" as const,
    title: "Kailangan ba talaga ng Fire Safety Certificate para sa sari-sari store?",
    content: "Nag-apply ako ng Mayor's Permit para sa maliit na sari-sari store sa Tondo. Sabi nila kailangan ko ng FSIC from BFP. Pero maliit lang naman ang tindahan ko, attached sa bahay. May exemption ba para sa ganito?",
    upvotes: 8,
    downvotes: 0,
    isFlagged: false,
    createdAt: new Date("2026-04-12T09:00:00Z"),
    updatedAt: new Date("2026-04-12T09:00:00Z"),
  },
];

export default function Hub() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState<"tip" | "warning" | "question" | "experience">("tip");

  const { data: dbPosts, refetch } = trpc.community.list.useQuery({ lguTag: "manila_city" });
  const createPost = trpc.community.create.useMutation({
    onSuccess: () => {
      refetch();
      setShowCreateForm(false);
      setNewTitle("");
      setNewContent("");
    },
  });
  const voteMutation = trpc.community.vote.useMutation({ onSuccess: () => refetch() });

  const allPosts = useMemo(() => {
    const real = dbPosts || [];
    if (real.length === 0) return SEED_POSTS;
    return real;
  }, [dbPosts]);

  const filteredPosts = useMemo(() => {
    if (selectedCategory === "all") return allPosts;
    return allPosts.filter((p) => p.category === selectedCategory);
  }, [allPosts, selectedCategory]);

  const handleVote = (postId: string, voteType: "up" | "down") => {
    if (!isAuthenticated) { window.location.href = getLoginUrl(); return; }
    voteMutation.mutate({ postId, voteType });
  };

  const handleCreatePost = () => {
    if (!isAuthenticated) { window.location.href = getLoginUrl(); return; }
    if (!newTitle.trim() || !newContent.trim()) return;
    createPost.mutate({ title: newTitle, content: newContent, category: newCategory, lguTag: "manila_city" });
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const days = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return "Ngayon";
    if (days === 1) return "Kahapon";
    if (days < 7) return `${days} araw na ang nakakaraan`;
    return d.toLocaleDateString("fil-PH", { month: "short", day: "numeric" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header — community purple identity */}
      <header className="sticky top-0 z-50 bg-white border-b border-border">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="p-2 rounded-xl hover:bg-muted transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Bumalik"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <div>
              <h1 className="font-bold text-base text-foreground leading-tight"
                style={{ fontFamily: "var(--font-display)" }}>
                Negosyante Hub
              </h1>
              <p className="text-xs text-muted-foreground">
                Manila City • Community Board
              </p>
            </div>
          </div>
          <Button
            onClick={() => {
              if (!isAuthenticated) { window.location.href = getLoginUrl(); return; }
              setShowCreateForm(true);
            }}
            className="bg-community hover:bg-community/90 text-white text-sm font-bold px-4 h-10 rounded-full"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <MessageSquarePlus className="w-4 h-4 mr-1.5" />
            Mag-post
          </Button>
        </div>
      </header>

      {/* Category Filter — community purple for active state */}
      <div className="sticky top-14 z-40 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="container py-3">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
            {CATEGORIES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setSelectedCategory(value)}
                className={`shrink-0 flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-full transition-all min-h-[44px] ${
                  selectedCategory === value
                    ? "bg-community text-white shadow-sm"
                    : "bg-white text-muted-foreground border border-border hover:border-community/30 hover:text-community"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Posts List */}
      <div className="container max-w-2xl py-4 space-y-3 pb-24">
        <AnimatePresence>
          {filteredPosts.map((post, i) => {
            const style = CATEGORY_STYLES[post.category] || CATEGORY_STYLES.tip;
            const CategoryIcon = CATEGORY_ICONS[post.category] || Lightbulb;
            return (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="bg-white rounded-2xl border border-border overflow-hidden"
              >
                {/* Post header */}
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-community-light flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-community">
                          {post.authorName.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground leading-tight">{post.authorName}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(post.createdAt)}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${style.bg} ${style.text} border ${style.border}`}>
                      <CategoryIcon className="w-3.5 h-3.5" />
                      {post.category === "tip" && "Tip"}
                      {post.category === "warning" && "Babala"}
                      {post.category === "question" && "Tanong"}
                      {post.category === "experience" && "Kwento"}
                    </span>
                  </div>

                  {/* Fixer warning banner */}
                  {post.category === "warning" && (
                    <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-xl">
                      <Shield className="w-4 h-4 text-destructive shrink-0" />
                      <span className="text-xs font-bold text-destructive uppercase tracking-wide">
                        Fixer Warning
                      </span>
                    </div>
                  )}

                  <h3 className="font-bold text-base text-foreground leading-snug mb-2"
                    style={{ fontFamily: "var(--font-display)" }}>
                    {post.title}
                  </h3>
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    <Streamdown>{post.content}</Streamdown>
                  </div>
                </div>

                {/* Vote actions — 48dp tap targets */}
                <div className="px-4 py-2 border-t border-border/50 flex items-center gap-1">
                  <button
                    onClick={() => handleVote(String(post.id), "up")}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors min-h-[44px] px-3 rounded-xl hover:bg-muted"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    <span className="font-semibold" style={{ fontFamily: "var(--font-mono)" }}>{post.upvotes}</span>
                  </button>
                  <button
                    onClick={() => handleVote(String(post.id), "down")}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-colors min-h-[44px] px-3 rounded-xl hover:bg-muted"
                  >
                    <ThumbsDown className="w-4 h-4" />
                    <span className="font-semibold" style={{ fontFamily: "var(--font-mono)" }}>{post.downvotes}</span>
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredPosts.length === 0 && (
          <div className="text-center py-16">
            <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-base font-semibold text-muted-foreground">
              Wala pang posts sa category na ito.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Maging una kang mag-share ng experience mo!
            </p>
          </div>
        )}
      </div>

      {/* Create Post Modal */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
            onClick={() => setShowCreateForm(false)}
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl p-5 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-lg text-foreground" style={{ fontFamily: "var(--font-display)" }}>
                  Mag-share sa Hub
                </h2>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="p-2 rounded-xl hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* Category selector */}
              <div className="flex flex-wrap gap-2 mb-5">
                {(["tip", "warning", "question", "experience"] as const).map((cat) => {
                  const style = CATEGORY_STYLES[cat];
                  const Icon = CATEGORY_ICONS[cat];
                  return (
                    <button
                      key={cat}
                      onClick={() => setNewCategory(cat)}
                      className={`flex items-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-full border transition-all min-h-[44px] ${
                        newCategory === cat
                          ? `${style.bg} ${style.text} ${style.border}`
                          : "bg-white text-muted-foreground border-border"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {cat === "tip" && "Tip"}
                      {cat === "warning" && "Babala"}
                      {cat === "question" && "Tanong"}
                      {cat === "experience" && "Kwento"}
                    </button>
                  );
                })}
              </div>

              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ano ang title ng post mo?"
                className="w-full px-4 h-14 rounded-xl bg-muted border border-border text-base focus:outline-none focus:ring-2 focus:ring-community/40 mb-3"
              />
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="I-share ang iyong experience, tip, o tanong..."
                rows={5}
                className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-base focus:outline-none focus:ring-2 focus:ring-community/40 mb-5 resize-none"
              />
              <Button
                onClick={handleCreatePost}
                disabled={!newTitle.trim() || !newContent.trim() || createPost.isPending}
                className="w-full h-14 bg-community hover:bg-community/90 text-white font-bold text-base rounded-xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                <Send className="w-5 h-5 mr-2" />
                {createPost.isPending ? "Nagpo-post..." : "I-post sa Hub"}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
