/*
 * NegosyoNav — Grant & Livelihood Matching (Feature 04)
 * Design System Refresh: Amber eligible badges, larger cards, 48dp touch targets.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Award, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  ExternalLink, AlertTriangle, Sparkles, Loader2,
} from "lucide-react";
import ChatFab from "@/components/ChatFab";

export default function Grants() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [expandedGrant, setExpandedGrant] = useState<string | null>(null);

  const profileQuery = trpc.profile.get.useQuery(undefined, { enabled: isAuthenticated });
  const p = profileQuery.data;

  const grantsQuery = trpc.grants.check.useQuery(
    {
      capitalization: p?.capitalization ?? undefined,
      businessType: p?.businessType ?? undefined,
      numberOfEmployees: p?.numberOfEmployees ?? undefined,
    },
    { enabled: true }
  );

  const grants = grantsQuery.data || [];
  const eligibleCount = grants.filter(g => g.eligible).length;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-border">
        <div className="container flex items-center gap-3 h-14">
          <button
            onClick={() => navigate("/roadmap")}
            className="p-2 rounded-xl hover:bg-muted transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Bumalik sa Roadmap"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-base text-foreground"
              style={{ fontFamily: "var(--font-display)" }}>
              Grant & Livelihood Matching
            </h1>
            <p className="text-xs text-muted-foreground">Auto-matched based on your profile</p>
          </div>
          {/* Amber badge for eligible count — Design.md: amber = grants */}
          {eligibleCount > 0 && (
            <span className="text-sm font-bold text-mango bg-mango-light border border-mango/30 px-3 py-1.5 rounded-full">
              {eligibleCount} eligible
            </span>
          )}
        </div>
      </header>

      <div className="container max-w-2xl mt-4 space-y-4">

        {/* Eligibility summary — amber accent */}
        {eligibleCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-mango-light rounded-2xl border border-mango/30 p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-mango/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6 text-mango" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground"
                  style={{ fontFamily: "var(--font-display)" }}>
                  May {eligibleCount} na grant na pwede mong i-apply!
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Based on your profile. I-check ang bawat program sa ibaba.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Sign-in prompt */}
        {!isAuthenticated && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-muted rounded-2xl border border-border p-4"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-mango shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-base text-foreground"
                  style={{ fontFamily: "var(--font-display)" }}>
                  Sign in para sa personalized matching
                </h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  I-complete ang iyong Negosyante Profile para ma-auto-check ang eligibility mo.
                  Showing general programs below.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Grant cards */}
        {grantsQuery.isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Kinukuha ang mga grants...</p>
          </div>
        ) : (
          grants.map((grant, i) => {
            const isExpanded = expandedGrant === grant.id;
            return (
              <motion.div
                key={grant.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className={`bg-white rounded-2xl border overflow-hidden ${
                  grant.eligible ? "border-mango/30" : "border-border"
                }`}
              >
                <button
                  onClick={() => setExpandedGrant(isExpanded ? null : grant.id)}
                  className="w-full text-left p-4 min-h-[72px]"
                >
                  <div className="flex items-start gap-3">
                    {/* Status icon — amber for eligible, muted for not */}
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                      grant.eligible ? "bg-mango-light" : "bg-muted"
                    }`}>
                      {grant.eligible
                        ? <CheckCircle2 className="w-6 h-6 text-mango" />
                        : <XCircle className="w-6 h-6 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Eligible / Not Eligible badge */}
                      <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full mb-2 ${
                        grant.eligible
                          ? "bg-mango-light text-mango border border-mango/30"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {grant.eligible ? "✓ Eligible" : "✗ Hindi Eligible"}
                      </span>
                      <h3 className="font-bold text-base text-foreground leading-snug"
                        style={{ fontFamily: "var(--font-display)" }}>
                        {grant.name}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-0.5">{grant.agency}</p>
                    </div>
                    <div className="shrink-0 ml-1">
                      {isExpanded
                        ? <ChevronUp className="w-5 h-5 text-muted-foreground" />
                        : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                    </div>
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-5 border-t border-border/50 pt-4 space-y-4">

                        {/* Assessment */}
                        <div className={`rounded-xl p-4 ${grant.eligible ? "bg-mango-light border border-mango/20" : "bg-muted"}`}>
                          <p className="text-sm text-foreground leading-relaxed">
                            <span className="font-bold">Assessment: </span>{grant.reason}
                          </p>
                        </div>

                        {/* Benefits */}
                        <div>
                          <h4 className="text-sm font-bold text-foreground mb-3">Mga Benepisyo:</h4>
                          <ul className="space-y-2">
                            {grant.benefits.map((b, j) => (
                              <li key={j} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                                <Award className="w-4 h-4 text-mango shrink-0 mt-0.5" />
                                {b}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Where to apply */}
                        <div className="bg-muted rounded-xl p-4">
                          <p className="text-sm text-foreground leading-relaxed">
                            <span className="font-bold">Saan mag-apply: </span>{grant.whereToApply}
                          </p>
                        </div>

                        {grant.eligible && (
                          <Button
                            variant="outline"
                            className="w-full h-12 rounded-xl border-mango/40 text-mango font-bold text-sm hover:bg-mango-light"
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Alamin Pa at Mag-apply
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}

        {/* Back nav */}
        <div className="flex justify-center pt-4">
          <Button
            onClick={() => navigate("/roadmap")}
            variant="outline"
            className="rounded-xl border-border text-muted-foreground hover:bg-muted min-h-[48px] px-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />Bumalik sa Roadmap
          </Button>
        </div>
      </div>

      <ChatFab />
    </div>
  );
}
