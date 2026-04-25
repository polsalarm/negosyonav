import { trpc } from "@/lib/trpc";
import { auth } from "@/lib/firebase";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

// Register service worker for offline support
if ("serviceWorker" in navigator) {
  registerSW({
    onNeedRefresh() {
      console.log("[PWA] New content available, refresh to update.");
    },
    onOfflineReady() {
      console.log("[PWA] App ready to work offline.");
    },
  });
}

const queryClient = new QueryClient();

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      async headers() {
        const user = auth.currentUser;
        if (user) {
          const token = await user.getIdToken();
          return { Authorization: `Bearer ${token}` };
        }
        return {};
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
