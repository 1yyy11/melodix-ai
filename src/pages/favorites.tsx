import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Heart, Loader2, Play } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePlayer } from "@/hooks/use-player";

interface Track {
  id: string;
  title: string;
  artist?: string;
  artist_name?: string;
  audio_url?: string;
  audioUrl?: string;
  cover_url?: string;
  coverUrl?: string;
  duration?: number;
  genre?: string;
  mood?: string;
  play_count?: number;
}

const API_URL = "http://localhost:3001/api";

export default function Favorites() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { playTrack } = usePlayer();
  const [favorites, setFavorites] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // =========================================================
  // SAFE FETCH (session-based)
  // =========================================================
  const api = async (url: string, options: RequestInit = {}) => {
    const res = await fetch(url, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    let data: any = null;
    const text = await res.text();

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      const msg = data?.error || "Request failed";
      if (res.status === 401) {
        throw new Error("UNAUTHORIZED");
      }
      throw new Error(msg);
    }

    return data;
  };

  // =========================================================
  // НОРМАЛИЗАЦИЯ ТРЕКА
  // =========================================================
  const normalizeTrack = (track: any): Track => {
    return {
      ...track,
      audioUrl: track.audio_url || track.audioUrl,
      coverUrl: track.cover_url || track.coverUrl,
      artist_name: track.artist_name || track.artist || "Unknown Artist",
    };
  };

  // =========================================================
  // LOAD FAVORITES
  // =========================================================
  const fetchFavorites = async () => {
    setIsLoading(true);
    try {
      const data = await api(`${API_URL}/favorites`);
      const normalizedTracks = Array.isArray(data) 
        ? data.map(normalizeTrack) 
        : [];
      setFavorites(normalizedTracks);
    } catch (e: any) {
      if (e.message === "UNAUTHORIZED") {
        console.warn("⚠️ Не авторизован");
        setFavorites([]);
      } else {
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить избранное",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // =========================================================
  // REMOVE FAVORITE
  // =========================================================
  const handleRemoveFavorite = async (trackId: string) => {
    try {
      await api(`${API_URL}/favorites/${trackId}`, {
        method: "DELETE",
      });

      setFavorites((prev) => prev.filter((track) => track.id !== trackId));
      toast({
        title: "Успех",
        description: "Трек удалён из избранного",
      });
    } catch (error) {
      console.error("Error removing favorite:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось удалить трек из избранного",
        variant: "destructive",
      });
    }
  };

  // =========================================================
  // PLAY ALL FAVORITES
  // =========================================================
  const handlePlayAll = () => {
    if (!favorites.length) return;

    console.log("🎵 Playing all favorites:", favorites.length, "tracks");
    console.log("🎵 First track:", favorites[0]);

    playTrack(favorites[0], favorites);
  };

  // =========================================================
  // PLAY SINGLE TRACK
  // =========================================================
  const handlePlayTrack = (track: Track) => {
    playTrack(track, favorites);
  };

  // =========================================================
  // FORMAT DURATION
  // =========================================================
  const formatDuration = (seconds?: number) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // =========================================================
  // INIT
  // =========================================================
  useEffect(() => {
    if (!authLoading && user) {
      fetchFavorites();
    } else if (!authLoading && !user) {
      setIsLoading(false);
    }
  }, [authLoading, user]);

  // =========================================================
  // LOADING STATE
  // =========================================================
  if (authLoading || isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  // =========================================================
  // NOT LOGGED IN
  // =========================================================
  if (!user) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
          <Heart className="w-24 h-24 text-gray-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Войдите в аккаунт</h2>
          <p className="text-gray-400 mb-6">Чтобы видеть избранные треки</p>
          <Link href="/login">
            <Button size="lg" className="rounded-full px-8">Войти</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  // =========================================================
  // UI (СТРОКИ с кнопкой прослушивания)
  // =========================================================
  return (
    <Layout>
      <div className="p-6">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">Избранное</h1>
            <p className="text-gray-400 mt-1">
              {favorites.length} {favorites.length === 1 ? "трек" : "треков"}
            </p>
          </div>

          {/* PLAY ALL BUTTON */}
          {favorites.length > 0 && (
            <Button
              onClick={handlePlayAll}
              className="rounded-full px-6 bg-primary hover:bg-primary/90"
            >
              <Play className="w-4 h-4 mr-2 fill-current" />
              Воспроизвести
            </Button>
          )}
        </div>

        {favorites.length === 0 ? (
          <div className="text-center py-12 bg-gray-800/30 rounded-lg border border-gray-700">
            <Heart className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              Нет избранных треков
            </h3>
            <p className="text-gray-400 mb-4">
              Добавьте треки в избранное, чтобы они появились здесь
            </p>
            <Link href="/">
              <Button variant="outline" className="border-gray-600 text-white hover:bg-gray-700">
                Найти музыку
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {favorites.map((track) => (
              <div
                key={track.id}
                className="bg-gray-800/50 rounded-lg border border-gray-700 p-4 hover:bg-gray-800 transition group"
              >
                <div className="flex items-center gap-4">
                  {/* Обложка */}
                  <div
                    className="relative w-12 h-12 bg-gray-700 rounded-md overflow-hidden flex-shrink-0 cursor-pointer"
                    onClick={() => handlePlayTrack(track)}
                  >
                    {track.coverUrl || track.cover_url ? (
                      <img
                        src={(track.coverUrl || track.cover_url)?.startsWith('http')
                          ? (track.coverUrl || track.cover_url)
                          : `http://localhost:3001${track.coverUrl || track.cover_url}`}
                        alt={track.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                        <span className="text-xl">🎵</span>
                      </div>
                    )}
                  </div>

                  {/* Информация о треке */}
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => handlePlayTrack(track)}
                  >
                    <h3 className="text-white font-medium truncate">{track.title}</h3>
                    <p className="text-gray-400 text-sm truncate">
                      {track.artist_name || track.artist || "Unknown Artist"}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">{formatDuration(track.duration)}</p>
                  </div>

                  {/* Кнопка воспроизведения */}
                  <button
                    onClick={() => handlePlayTrack(track)}
                    className="p-2 rounded-full hover:bg-gray-700 transition opacity-0 group-hover:opacity-100"
                  >
                    <Play className="w-5 h-5 text-primary" />
                  </button>

                  {/* Кнопка удаления из избранного */}
                  <button
                    onClick={() => handleRemoveFavorite(track.id)}
                    className="p-2 rounded-full hover:bg-gray-700 transition"
                  >
                    <Heart className="w-5 h-5 fill-red-500 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}