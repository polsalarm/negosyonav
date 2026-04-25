import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Roadmap from "./pages/Roadmap";
import Hub from "./pages/Hub";
import Profile from "./pages/Profile";
import Forms from "./pages/Forms";
import Grants from "./pages/Grants";
import Places from "./pages/Places";
import Calendar from "./pages/Calendar";
import Planner from "./pages/Planner";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import { AuthProvider } from "./contexts/AuthContext";
import RequireAuth from "./components/RequireAuth";
import OnboardingGate from "./components/OnboardingGate";
import {
  MessageCircle, Map, Users, User, FileText,
} from "lucide-react";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/404" component={NotFound} />
      <Route>
        <RequireAuth>
          <OnboardingGate>
            <Switch>
              <Route path={"/onboarding"} component={Onboarding} />
              <Route path={"/"} component={Home} />
              <Route path={"/roadmap"} component={Roadmap} />
              <Route path={"/hub"} component={Hub} />
              <Route path={"/profile"} component={Profile} />
              <Route path={"/forms"} component={Forms} />
              <Route path={"/grants"} component={Grants} />
              <Route path={"/places"} component={Places} />
              <Route path={"/calendar"} component={Calendar} />
              <Route path={"/planner"} component={Planner} />
              <Route component={NotFound} />
            </Switch>
          </OnboardingGate>
        </RequireAuth>
      </Route>
    </Switch>
  );
}

function BottomNav() {
  const [location, navigate] = useLocation();

  const navItems = [
    { path: "/", icon: MessageCircle, label: "Chat" },
    { path: "/roadmap", icon: Map, label: "Roadmap" },
    { path: "/forms", icon: FileText, label: "Forms" },
    { path: "/hub", icon: Users, label: "Hub" },
    { path: "/profile", icon: User, label: "Profile" },
  ];

  const hideOn = ["/places", "/calendar", "/grants", "/planner", "/login", "/onboarding"];
  if (hideOn.includes(location)) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="container max-w-2xl flex items-center justify-around h-16">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[48px] rounded-xl px-2 py-1 transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              <div className={`rounded-lg px-3 py-0.5 transition-colors ${
                isActive ? "bg-forest-light" : ""
              }`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={`text-[11px] font-semibold ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
}

function useAutoHideScrollbars() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      document.body.classList.add("is-scrolling");
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        document.body.classList.remove("is-scrolling");
      }, 800);
    };
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll, { capture: true });
      if (timer) clearTimeout(timer);
    };
  }, []);
}

function App() {
  useAutoHideScrollbars();
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <ScrollToTop />
            <Router />
            <BottomNav />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
