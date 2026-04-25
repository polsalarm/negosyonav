import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Loader2, Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export default function Login() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error("Mag-type muna ng email para makapag-reset.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success("Reset link sent! Check your email.");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      const messages: Record<string, string> = {
        "auth/invalid-email": "Invalid ang email format.",
        "auth/user-not-found": "Walang account sa email na 'yan.",
        "auth/too-many-requests": "Too many attempts. Subukan ulit mamaya.",
      };
      toast.error(messages[code] ?? "May error. Subukan ulit.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "signup") {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName.trim()) {
          await updateProfile(credential.user, { displayName: displayName.trim() });
        }
        toast.success("Account created! Maligayang pagdating sa NegosyoNav!");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success("Welcome back! Tara, simulan na natin.");
      }
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      const messages: Record<string, string> = {
        "auth/invalid-credential": "Mali ang email o password. Subukan ulit.",
        "auth/email-already-in-use": "May account na ang email na ito. Sign in na lang.",
        "auth/weak-password": "Masyadong mahina ang password. Gumamit ng 6+ characters.",
        "auth/invalid-email": "Invalid ang email format.",
        "auth/too-many-requests": "Too many attempts. Subukan ulit mamaya.",
      };
      toast.error(messages[code] ?? "May error. Subukan ulit.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-warm-cream flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-teal rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white font-[var(--font-display)] text-2xl font-bold">N</span>
          </div>
          <h1 className="font-[var(--font-display)] text-2xl text-earth-brown">NegosyoNav</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signin" ? "I-sign in para ituloy ang iyong negosyo journey." : "Gumawa ng account — libre at madali lang!"}
          </p>
        </div>

        {/* Toggle */}
        <div className="flex bg-muted rounded-xl p-1 mb-6">
          <button
            onClick={() => setMode("signin")}
            className={`flex-1 py-2 rounded-lg text-sm font-[var(--font-display)] transition-all ${mode === "signin" ? "bg-white text-earth-brown shadow-sm" : "text-muted-foreground"}`}
          >
            Sign In
          </button>
          <button
            onClick={() => setMode("signup")}
            className={`flex-1 py-2 rounded-lg text-sm font-[var(--font-display)] transition-all ${mode === "signup" ? "bg-white text-earth-brown shadow-sm" : "text-muted-foreground"}`}
          >
            Mag-sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Pangalan mo (e.g. Juan dela Cruz)"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-border text-sm focus:outline-none focus:ring-2 focus:ring-teal/40 font-[var(--font-body)]"
              />
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-border text-sm focus:outline-none focus:ring-2 focus:ring-teal/40 font-[var(--font-body)]"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full pl-10 pr-10 py-3 rounded-xl bg-white border border-border text-sm focus:outline-none focus:ring-2 focus:ring-teal/40 font-[var(--font-body)]"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-earth-brown"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {mode === "signin" && (
            <button
              type="button"
              onClick={handleForgotPassword}
              className="block w-full text-right text-xs text-teal hover:text-teal/80 active:text-teal/70 min-h-11 px-2 font-[var(--font-mono)]"
            >
              Forgot password?
            </button>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-teal hover:bg-teal/90 text-white rounded-xl py-3 font-[var(--font-display)] text-sm"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading...</>
            ) : mode === "signin" ? (
              "Sign In"
            ) : (
              "Gumawa ng Account"
            )}
          </Button>
        </form>

        <button
          onClick={() => navigate("/")}
          className="w-full text-center text-xs text-muted-foreground mt-6 hover:text-teal transition-colors"
        >
          Bumalik sa Home
        </button>
      </motion.div>
    </div>
  );
}
