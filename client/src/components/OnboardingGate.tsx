import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function OnboardingGate({ children }: { children: React.ReactNode }) {
  const meQuery = trpc.auth.me.useQuery(undefined, { staleTime: 30_000 });
  const [location, navigate] = useLocation();

  const isLoading = meQuery.isLoading;
  const completed = meQuery.data?.onboardingCompletedAt != null;

  useEffect(() => {
    if (isLoading) return;
    if (!meQuery.data) return;
    if (!completed && location !== "/onboarding") {
      navigate("/onboarding", { replace: true });
    } else if (completed && location === "/onboarding") {
      navigate("/", { replace: true });
    }
  }, [isLoading, completed, location, navigate, meQuery.data]);

  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Loading"
        className="min-h-screen bg-warm-cream flex items-center justify-center"
      >
        <Loader2 className="w-8 h-8 animate-spin text-teal" />
      </div>
    );
  }

  if (!completed && location !== "/onboarding") return null;
  if (completed && location === "/onboarding") return null;
  return <>{children}</>;
}
