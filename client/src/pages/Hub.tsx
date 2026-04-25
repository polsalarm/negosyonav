/*
 * Negosyante Hub — Community Board
 * Reddit-style community where real vendors share LGU tips, fixer warnings,
 * and actual experiences. Filtered by LGU tag.
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
  MapPin,
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

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  tip: { bg: "bg-teal/10", text: "text-teal", border: "border-teal/20", icon: "text-teal" },
  warning: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", icon: "text-red-500" },
  question: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", icon: "text-blue-500" },
  experience: { bg: "bg-mango/10", text: "text-earth-brown", border: "border-mango/20", icon: "text-mango" },
};

const CATEGORY_ICONS: Record<string, typeof Lightbulb> = {
  tip: Lightbulb,
  warning: AlertTriangle,
  question: HelpCircle,
  experience: Star,
};

// Seed data for demo purposes when DB is empty
const SEED_POSTS = [
  {
    id: -1,
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
    id: -2,
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
    id: -3,
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
    id: -4,
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
  const { user, isAuthenticated } = useAuth();
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

  // Combine DB posts with seed data
  const allPosts = useMemo(() => {
    const real = dbPosts || [];
    // Only show seed data if no real posts exist
    if (real.length === 0) return SEED_POSTS;
    return real;
  }, [dbPosts]);

  const filteredPosts = useMemo(() => {
    if (selectedCategory === "all") return allPosts;
    return allPosts.filter((p) => p.category === selectedCategory);
  }, [allPosts, selectedCategory]);

  const handleVote = (postId: number, voteType: "up" | "down") => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    if (postId < 0) return; // Can't vote on seed posts
    voteMutation.mutate({ postId, voteType });
  };

  const handleCreatePost = () => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    if (!newTitle.trim() || !newContent.trim()) return;
    createPost.mutate({
      title: newTitle,
      content: newContent,
      category: newCategory,
      lguTag: "manila_city",
    });
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Ngayon";
    if (days === 1) return "Kahapon";
    if (days < 7) return `${days} araw na ang nakakaraan`;
    return d.toLocaleDateString("fil-PH", { month: "short", day: "numeric" });
  };

  return (
    <div className="min-h-screen bg-warm-cream">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-border">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-[var(--font-display)] text-base text-earth-brown leading-tight">
                Negosyante Hub
              </h1>
              <p className="text-[10px] text-muted-foreground font-[var(--font-body)]">
                Manila City • Community Board
              </p>
            </div>
          </div>
          <Button
            onClick={() => {
              if (!isAuthenticated) {
                window.location.href = getLoginUrl();
                return;
              }
              setShowCreateForm(true);
            }}
            className="bg-teal hover:bg-teal/90 text-white text-xs px-3 py-1.5 h-auto rounded-full"
          >
            <MessageSquarePlus className="w-3.5 h-3.5 mr-1" />
            Mag-post
          </Button>
        </div>
      </header>

      {/* Category Filter */}
      <div className="sticky top-14 z-40 bg-warm-cream/95 backdrop-blur-sm border-b border-border/50">
        <div className="container py-2">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {CATEGORIES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setSelectedCategory(value)}
                className={`shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
                  selectedCategory === value
                    ? "bg-teal text-white shadow-sm"
                    : "bg-white text-muted-foreground border border-border hover:border-teal/30"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Posts List */}
      <div className="container max-w-2xl py-4 space-y-3 pb-20">
        <AnimatePresence>
          {filteredPosts.map((post, i) => {
            const style = CATEGORY_STYLES[post.category] || CATEGORY_STYLES.tip;
            const CategoryIcon = CATEGORY_ICONS[post.category] || Lightbulb;
            return (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden"
              >
                {/* Post Header */}
                <div className="px-4 pt-4 pb-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-teal/10 flex items-center justify-center">
                        <span className="text-xs font-bold text-teal">
                          {post.authorName.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-foreground">
                          {post.authorName}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-2">
                          {formatDate(post.createdAt)}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${style.bg} ${style.text} border ${style.border}`}
                    >
                      <CategoryIcon className={`w-3 h-3 ${style.icon}`} />
                      {post.category === "tip" && "Tip"}
                      {post.category === "warning" && "Babala"}
                      {post.category === "question" && "Tanong"}
                      {post.category === "experience" && "Kwento"}
                    </span>
                  </div>

                  {/* Fixer Warning Badge */}
                  {post.category === "warning" && (
                    <div className="flex items-center gap-1.5 mb-2 px-2 py-1 bg-red-50 border border-red-200 rounded-lg">
                      <Shield className="w-3.5 h-3.5 text-red-500" />
                      <span className="text-[10px] font-semibold text-red-700">
                        FIXER WARNING
                      </span>
                    </div>
                  )}

                  <h3 className="text-sm font-bold text-earth-brown leading-snug mb-1">
                    {post.title}
                  </h3>
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    <Streamdown>{post.content}</Streamdown>
                  </div>
                </div>

                {/* Post Actions */}
                <div className="px-4 py-2 border-t border-border/50 flex items-center gap-4">
                  <button
                    onClick={() => handleVote(post.id, "up")}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-teal transition-colors"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span className="font-[var(--font-mono)]">{post.upvotes}</span>
                  </button>
                  <button
                    onClick={() => handleVote(post.id, "down")}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                    <span className="font-[var(--font-mono)]">{post.downvotes}</span>
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredPosts.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-sm text-muted-foreground">
              Wala pang posts sa category na ito.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
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
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl p-5 max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-[var(--font-display)] text-lg text-earth-brown">
                  Mag-share sa Hub
                </h2>
                <button onClick={() => setShowCreateForm(false)}>
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* Category Selector */}
              <div className="flex gap-2 mb-4">
                {(["tip", "warning", "question", "experience"] as const).map((cat) => {
                  const style = CATEGORY_STYLES[cat];
                  const Icon = CATEGORY_ICONS[cat];
                  return (
                    <button
                      key={cat}
                      onClick={() => setNewCategory(cat)}
                      className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                        newCategory === cat
                          ? `${style.bg} ${style.text} ${style.border} ring-2 ring-offset-1 ring-teal/20`
                          : "bg-white text-muted-foreground border-border"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {cat === "tip" && "Tip"}
                      {cat === "warning" && "Babala"}
                      {cat === "question" && "Tanong"}
                      {cat === "experience" && "Kwento"}
                    </button>
                  );
                })}
              </div>

              {/* Title */}
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ano ang title ng post mo?"
                className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-teal/40 mb-3 font-[var(--font-body)]"
              />

              {/* Content */}
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="I-share ang iyong experience, tip, o tanong..."
                rows={4}
                className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-teal/40 mb-4 resize-none font-[var(--font-body)]"
              />

              <Button
                onClick={handleCreatePost}
                disabled={!newTitle.trim() || !newContent.trim() || createPost.isPending}
                className="w-full bg-teal hover:bg-teal/90 text-white font-[var(--font-display)] py-3 rounded-xl"
              >
                <Send className="w-4 h-4 mr-2" />
                {createPost.isPending ? "Nagpo-post..." : "I-post sa Hub"}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
