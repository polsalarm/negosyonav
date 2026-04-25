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
import { AuthProvider } from "./contexts/AuthContext";
import RequireAuth from "./components/RequireAuth";
import {
  MessageCircle, Map, Users, User, FileText, Award, MapPin, CalendarDays,
} from "lucide-react";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/404" component={NotFound} />
      <Route>
        <RequireAuth>
          <Switch>
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

  // Don't show bottom nav on certain pages
  const hideOn = ["/places", "/calendar", "/grants", "/planner", "/login"];
  if (hideOn.includes(location)) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-border z-50 safe-area-bottom">
      <div className="container max-w-2xl flex items-center justify-around h-16">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
                isActive
                  ? "text-teal"
                  : "text-muted-foreground hover:text-earth-brown"
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? "text-teal" : ""}`} />
              <span className={`text-[10px] font-[var(--font-mono)] ${isActive ? "font-semibold" : ""}`}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
            <BottomNav />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
