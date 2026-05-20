import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";

import { Layout } from "@/components/layout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

import {
  ArrowLeft,
  ListMusic,
  Music,
  Loader2,
  Play,
} from "lucide-react";

import { TrackCard } from "@/components/tracks/track-card";
import { usePlayer } from "@/hooks/use-player";

interface Track {
  id: string;
  title: string;
  artist_name?: string;
  artist?: string;
  audio_url?: string;
  audioUrl?: string;
  cover_url?: string;
  coverUrl?: string;
  duration?: number;
  genre?: string;
  mood?: string;
  play_count?: number;
}

interface Playlist {
  id: string;
  name: string;
  description?: string;
  tracks: Track[];
  created_at: string;
}
const API_URL = "http://localhost:3001/api";


export default function PlaylistDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const { playTrack } = usePlayer();

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);

  // =========================================================
  // API
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

    const text = await res.text();

    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error("UNAUTHORIZED");
      }

      throw new Error(data?.error || "Request failed");
    }

    return data;
  };

  // =========================================================
  // НОРМАЛИЗАЦИЯ ТРЕКА (приводим к формату TrackCard)
  // =========================================================
  const normalizeTrack = (track: any): Track => {
    return {
      ...track,
      // Приводим audio_url к audioUrl (TrackCard ожидает audioUrl)
      audioUrl: track.audio_url || track.audioUrl,
      // Приводим cover_url к coverUrl
      coverUrl: track.cover_url || track.coverUrl,
      // Убеждаемся, что artist_name есть
      artist_name: track.artist_name || track.artist || "Unknown Artist",
    };
  };

  // =========================================================
  // LOAD PLAYLIST
  // =========================================================
  const fetchPlaylist = async () => {
    if (!id) return;

    setIsLoading(true);

    try {
      const data = await api(`${API_URL}/playlists/${id}`);

      // Нормализуем треки
      const normalizedTracks: Track[] = Array.isArray(data.tracks)
        ? data.tracks.map(normalizeTrack)
        : [];

      setPlaylist({
        ...data,
        tracks: normalizedTracks,
      });

      console.log("✅ Playlist loaded, tracks:", normalizedTracks.length);
      console.log("📝 First track:", normalizedTracks[0]);
    } catch (error: any) {
      console.error("Playlist load error:", error);

      if (error.message === "UNAUTHORIZED") {
        toast({
          title: "Ошибка",
          description: "Необходимо войти в аккаунт",
          variant: "destructive",
        });

        setLocation("/login");
      } else {
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить плейлист",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // =========================================================
  // REMOVE TRACK
  // =========================================================
  const handleRemoveTrack = async (trackId: string) => {
    if (!playlist) return;

    setIsRemoving(trackId);

    try {
      await api(`${API_URL}/playlists/${id}/tracks/${trackId}`, {
        method: "DELETE",
      });

      setPlaylist((prev) =>
        prev
          ? {
              ...prev,
              tracks: prev.tracks.filter((t) => t.id !== trackId),
            }
          : prev
      );

      toast({
        title: "Успех",
        description: "Трек удалён из плейлиста",
      });
    } catch (error) {
      console.error("Remove track error:", error);

      toast({
        title: "Ошибка",
        description: "Не удалось удалить трек",
        variant: "destructive",
      });
    } finally {
      setIsRemoving(null);
    }
  };

  // =========================================================
  // PLAY PLAYLIST (с нормализованными треками)
  // =========================================================
  const handlePlayPlaylist = () => {
    if (!playlist?.tracks?.length) return;

    console.log("🎵 Playing playlist:", playlist.tracks.length, "tracks");
    console.log("🎵 First track:", playlist.tracks[0]);

    // Передаём нормализованные треки в плеер
    playTrack(playlist.tracks[0], playlist.tracks);
  };

  // =========================================================
  // INIT
  // =========================================================
  useEffect(() => {
    if (!authLoading && user) {
      fetchPlaylist();
    }

    if (!authLoading && !user) {
      setLocation("/login");
    }
  }, [id, authLoading, user]);

  // =========================================================
  // LOADING
  // =========================================================
  if (authLoading || isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  // =========================================================
  // NOT FOUND
  // =========================================================
  if (!playlist) {
    return (
      <Layout>
        <div className="text-center py-20">
          <ListMusic className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />

          <h1 className="text-2xl font-bold mb-2">
            Плейлист не найден
          </h1>

          <Button onClick={() => setLocation("/playlists")}>
            Вернуться назад
          </Button>
        </div>
      </Layout>
    );
  }

  // =========================================================
  // UI
  // =========================================================
  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* BACK */}
        <Button
          variant="ghost"
          onClick={() => setLocation("/playlists")}
          className="mb-6 text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад
        </Button>

        {/* HEADER */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            {playlist.name}
          </h1>

          {playlist.description && (
            <p className="text-gray-400 mb-3">
              {playlist.description}
            </p>
          )}

          <div className="flex items-center gap-4 flex-wrap">
            <p className="text-sm text-gray-500">
              {playlist.tracks.length} треков
            </p>

            {/* PLAY PLAYLIST */}
            <Button
              onClick={handlePlayPlaylist}
              disabled={!playlist.tracks.length}
              className="rounded-full px-6"
            >
              <Play className="w-4 h-4 mr-2 fill-current" />
              Воспроизвести
            </Button>
          </div>
        </div>

        {/* EMPTY */}
        {playlist.tracks.length === 0 ? (
          <div className="text-center py-16 bg-gray-800/30 rounded-2xl border border-gray-700">
            <Music className="w-14 h-14 text-gray-500 mx-auto mb-4" />

            <h3 className="text-lg font-semibold text-white mb-2">
              Плейлист пуст
            </h3>

            <p className="text-gray-400">
              Добавьте треки из библиотеки
            </p>
          </div>
        ) : (
          /* TRACKS GRID */
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {playlist.tracks.map((track) => (
              <div
                key={track.id}
                className="relative group"
              >
                {/* TRACK CARD */}
                <TrackCard
                  track={track}
                  queueContext={playlist.tracks}
                />

                {/* REMOVE BUTTON */}
                <button
                  onClick={() => handleRemoveTrack(track.id)}
                  disabled={isRemoving === track.id}
                  className="
                    absolute
                    top-2
                    right-2
                    z-10
                    opacity-0
                    group-hover:opacity-100
                    transition
                    bg-black/70
                    hover:bg-black
                    rounded-full
                    p-2
                    text-red-400
                    disabled:opacity-50
                  "
                >
                  {isRemoving === track.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "✕"
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}