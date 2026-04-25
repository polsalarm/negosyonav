/*
 * NegosyoNav — Grant & Livelihood Matching (Feature 04)
 * Auto-checks user profile against LGU grants, DOLE programs, Negosyo Center funds.
 * Surfaces alert cards automatically if eligible.
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
    <div className="min-h-screen bg-warm-cream pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-border">
        <div className="container flex items-center gap-3 h-14">
          <button onClick={() => navigate("/roadmap")} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-earth-brown" />
          </button>
          <div className="flex-1">
            <h1 className="font-[var(--font-display)] text-sm text-earth-brown">Grant & Livelihood Matching</h1>
            <p className="text-[10px] text-muted-foreground font-[var(--font-mono)]">Auto-matched based on your profile</p>
          </div>
          <span className="text-xs font-[var(--font-mono)] text-teal bg-teal/10 px-2 py-1 rounded-full">
            {eligibleCount} eligible
          </span>
        </div>
      </header>

      <div className="container max-w-2xl mt-4 space-y-4">
        {/* Eligibility summary */}
        {eligibleCount > 0 && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-teal-light rounded-2xl border border-teal/30 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-teal shrink-0" />
              <div>
                <h3 className="font-[var(--font-display)] text-sm text-earth-brown">
                  May {eligibleCount} na grant/program ka na pwedeng i-apply!
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Based on your profile data. Check each program below for details.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {!isAuthenticated && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-mango-light rounded-2xl border border-mango/30 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-mango shrink-0 mt-0.5" />
              <div>
                <h3 className="font-[var(--font-display)] text-sm text-earth-brown">Sign in for personalized matching</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Complete your Negosyante Profile para ma-auto-check ang eligibility mo.
                  Showing general programs below.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Grant cards */}
        {grantsQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-teal" />
          </div>
        ) : (
          grants.map((grant, i) => {
            const isExpanded = expandedGrant === grant.id;
            return (
              <motion.div
                key={grant.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
                  grant.eligible ? "border-teal/30" : "border-border"
                }`}
              >
                <button onClick={() => setExpandedGrant(isExpanded ? null : grant.id)} className="w-full text-left p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      grant.eligible ? "bg-teal/10" : "bg-muted"
                    }`}>
                      {grant.eligible ? (
                        <CheckCircle2 className="w-5 h-5 text-teal" />
                      ) : (
                        <XCircle className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-[var(--font-mono)] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          grant.eligible ? "text-teal bg-teal/10" : "text-muted-foreground bg-muted"
                        }`}>
                          {grant.eligible ? "Eligible" : "Not Eligible"}
                        </span>
                      </div>
                      <h3 className="font-[var(--font-display)] text-sm text-earth-brown leading-snug">{grant.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{grant.agency}</p>
                    </div>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />}
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-3">
                        {/* Reason */}
                        <div className={`rounded-xl p-3 ${grant.eligible ? "bg-teal-light" : "bg-muted"}`}>
                          <p className="text-xs text-earth-brown">
                            <span className="font-semibold">Assessment: </span>{grant.reason}
                          </p>
                        </div>

                        {/* Benefits */}
                        <div>
                          <h4 className="text-xs font-semibold text-earth-brown mb-2">Benefits:</h4>
                          <ul className="space-y-1.5">
                            {grant.benefits.map((b, j) => (
                              <li key={j} className="flex items-start gap-2 text-xs text-muted-foreground">
                                <Award className="w-3.5 h-3.5 text-mango shrink-0 mt-0.5" />
                                {b}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Where to apply */}
                        <div className="bg-muted rounded-xl p-3">
                          <p className="text-xs text-earth-brown">
                            <span className="font-semibold">Where to Apply: </span>{grant.whereToApply}
                          </p>
                        </div>

                        {grant.eligible && (
                          <Button variant="outline" size="sm" className="w-full rounded-xl border-teal/30 text-teal text-xs">
                            <ExternalLink className="w-3 h-3 mr-1" />
                            Learn More & Apply
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
          <Button onClick={() => navigate("/roadmap")} variant="outline" className="rounded-xl border-mango/30 text-earth-brown hover:bg-mango-light">
            <ArrowLeft className="w-4 h-4 mr-2" />Back to Roadmap
          </Button>
        </div>
      </div>

      <ChatFab />
    </div>
  );
}
