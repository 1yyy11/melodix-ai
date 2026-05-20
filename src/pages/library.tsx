import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect, useRef, useCallback } from "react";
import { TrackCard } from "@/components/tracks/track-card";
import { Library as LibraryIcon, Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function Library() {
  const [location, setLocation] = useLocation();
  const { isAuthenticated, token } = useAuth();

  const [search, setSearch] = useState("");
  const [tracks, setTracks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const loadedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Синхронизация поискового запроса с параметром URL
  useEffect(() => {
    const params = new URLSearchParams(location.split("?")[1] || "");
    const searchParam = params.get("search") || "";
    setSearch(searchParam);
  }, [location]);

  // Мемоизируем authFetch чтобы он обновлялся при смене token
  const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    return fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  }, [token]);

  useEffect(() => {
    if (!isAuthenticated || loadedRef.current) {
      setIsLoading(false);
      return;
    }

    loadedRef.current = true;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    authFetch("http://localhost:3001/api/tracks", { signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setTracks(Array.isArray(data) ? data : []);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') {
          return;
        }

        console.error("Error loading tracks:", err);
        
        if (err.message?.includes('401')) {
          console.log('Auth error, redirecting to login...');
          window.location.href = '/login';
        }
        setIsLoading(false);
      });

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [isAuthenticated, authFetch]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSearch = e.target.value;
    setSearch(newSearch);
    const params = new URLSearchParams();
    if (newSearch) params.set("search", newSearch);
    setLocation(`/library${params.toString() ? `?${params.toString()}` : ""}`, { replace: true });
  };

  const filteredTracks = tracks.filter((track: any) =>
    track.title?.toLowerCase().includes(search.toLowerCase()) ||
    track.genre?.toLowerCase().includes(search.toLowerCase()) ||
    track.artist_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="h-[80vh] flex flex-col items-center justify-center text-center max-w-md mx-auto">
          <LibraryIcon className="w-24 h-24 text-muted-foreground/30 mb-6" />
          <h1 className="text-3xl font-display font-bold mb-4">Ваша медиатека</h1>
          <p className="text-muted-foreground mb-8">Войдите, чтобы получить доступ к вашим трекам.</p>
          <Link href="/login">
            <Button size="lg" className="rounded-full px-8">Войти</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8 pb-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-display font-bold flex items-center gap-3">
              <LibraryIcon className="w-8 h-8 text-primary" />
              Медиатека
            </h1>
            <p className="text-muted-foreground mt-2">Все треки в одном месте.</p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Поиск треков..."
                className="pl-9 bg-card border-border/50 focus:border-primary"
                value={search}
                onChange={handleSearchChange}
              />
            </div>
            <Button variant="outline" size="icon" className="shrink-0 bg-card border-border/50">
              <SlidersHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="bg-card rounded-2xl p-4 animate-pulse h-64 border border-border/50" />
            ))}
          </div>
        ) : filteredTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center glass-card rounded-3xl">
            <h3 className="text-2xl font-bold mb-2">Здесь пока тихо</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-8">
              Вы ещё не сгенерировали ни одного трека. Перейдите в студию и позвольте AI сделать своё дело.
            </p>
            <Link href="/generate">
              <Button size="lg" className="rounded-full shadow-lg shadow-primary/20">
                Перейти в студию
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filteredTracks.map((track: any) => (
              <TrackCard key={track.id} track={track} queueContext={filteredTracks} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}