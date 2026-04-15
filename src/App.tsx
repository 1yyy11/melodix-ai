import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Pages
import Home from "@/pages/home";
import Generate from "@/pages/generate";
import Library from "@/pages/library";
import Favorites from "@/pages/favorites";
import Playlists from "@/pages/playlists";
import PlaylistDetail from "@/pages/playlist-detail";
import Profile from "@/pages/profile";
import Login from "./pages/login";
import { LyricsProvider } from "@/contexts/LyricsContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        <ProtectedRoute>
          <Home />
        </ProtectedRoute>
      </Route>
      <Route path="/generate">
        <ProtectedRoute>
          <Generate />
        </ProtectedRoute>
      </Route>
      <Route path="/library">
        <ProtectedRoute>
          <Library />
        </ProtectedRoute>
      </Route>
      <Route path="/favorites">
        <ProtectedRoute>
          <Favorites />
        </ProtectedRoute>
      </Route>
      <Route path="/playlists">
        <ProtectedRoute>
          <Playlists />
        </ProtectedRoute>
      </Route>
      <Route path="/playlist/:id">
        <ProtectedRoute>
          <PlaylistDetail />
        </ProtectedRoute>
      </Route>
      <Route path="/profile">
        <ProtectedRoute>
          <Profile />
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
   <QueryClientProvider client={queryClient}>
  <AuthProvider>
    <LyricsProvider>  {/* Добавьте эту строку */}
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </LyricsProvider>  {/* Добавьте эту строку */}
  </AuthProvider>
</QueryClientProvider>
  );
}

export default App;