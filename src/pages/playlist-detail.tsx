import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { Layout } from "@/components/layout";
import { ArrowLeft, Play, Heart, MoreHorizontal, Clock, Pause } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { usePlayer } from "@/hooks/use-player";

interface Track {
  id: string;
  title: string;
  artist_name?: string;
  artist?: string;
  audio_url?: string;
  cover_url?: string;
  duration?: number;
  genre?: string;
  mood?: string;
  tempo?: number;
}

interface Playlist {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  tracks: Track[];
}

export default function PlaylistDetail() {
  const { id } = useParams();
  const { token } = useAuth();
  const { toast } = useToast();
  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayer();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchPlaylist();
    }
  }, [id]);

  const fetchPlaylist = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:3001/api/playlists/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setPlaylist(data);
      } else {
        toast({
          title: "Ошибка",
          description: "Плейлист не найден",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error fetching playlist:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить плейлист",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayTrack = (track: Track, index: number) => {
    if (playlist?.tracks) {
      const queue = playlist.tracks.slice(index);
      playTrack(track, queue);
    }
  };

  const handlePlayAll = () => {
    if (playlist?.tracks && playlist.tracks.length > 0) {
      playTrack(playlist.tracks[0], playlist.tracks);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU');
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full min-h-[400px]">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!playlist) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-white text-xl">Плейлист не найден</h2>
          <Link href="/playlists">
            <Button className="mt-4">Вернуться к плейлистам</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const isCurrentTrackPlaying = (trackId: string) => {
    return currentTrack?.id === trackId && isPlaying;
  };

  return (
    <Layout>
      <div className="p-6">
        {/* Кнопка назад */}
        <Link href="/playlists">
          <Button variant="ghost" className="mb-6 text-gray-400 hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Назад к плейлистам
          </Button>
        </Link>

        {/* Информация о плейлисте */}
        <div className="flex gap-6 mb-8">
          <div className="w-48 h-48 bg-gradient-to-br from-primary/30 to-primary/5 rounded-lg flex items-center justify-center">
            <div className="text-6xl">📋</div>
          </div>
          <div className="flex-1">
            <p className="text-gray-400 text-sm mb-2">Плейлист</p>
            <h1 className="text-3xl font-bold text-white mb-2">{playlist.name}</h1>
            {playlist.description && (
              <p className="text-gray-400 mb-4">{playlist.description}</p>
            )}
            <div className="flex items-center gap-4">
              <p className="text-gray-500 text-sm">
                {playlist.tracks?.length || 0} треков • Создан {formatDate(playlist.created_at)}
              </p>
              {playlist.tracks && playlist.tracks.length > 0 && (
                <Button 
                  onClick={handlePlayAll}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Воспроизвести всё
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Таблица треков */}
        {playlist.tracks && playlist.tracks.length > 0 ? (
          <div className="bg-gray-800/30 rounded-lg border border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800/50 border-b border-gray-700">
                  <tr className="text-left text-gray-400 text-sm">
                    <th className="px-4 py-3 w-12">#</th>
                    <th className="px-4 py-3">Название</th>
                    <th className="px-4 py-3">Исполнитель</th>
                    <th className="px-4 py-3">Жанр</th>
                    <th className="px-4 py-3 w-20">
                      <Clock className="w-4 h-4" />
                    </th>
                    <th className="px-4 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {playlist.tracks.map((track, index) => (
                    <tr 
                      key={track.id} 
                      className={`border-b border-gray-700/50 hover:bg-gray-800/50 transition cursor-pointer ${
                        currentTrack?.id === track.id ? 'bg-primary/10' : ''
                      }`}
                      onClick={() => handlePlayTrack(track, index)}
                    >
                      <td className="px-4 py-3 text-gray-400">{index + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-700 rounded overflow-hidden flex-shrink-0">
                            {track.cover_url ? (
                              <img src={track.cover_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-lg">
                                {isCurrentTrackPlaying(track.id) ? '🎵' : '🎶'}
                              </div>
                            )}
                          </div>
                          <span className={`font-medium ${
                            currentTrack?.id === track.id ? 'text-primary' : 'text-white'
                          }`}>
                            {track.title}
                          </span>
                          {isCurrentTrackPlaying(track.id) && (
                            <span className="text-xs text-primary animate-pulse">▶ Воспроизводится</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{track.artist_name || track.artist || "Unknown"}</td>
                      <td className="px-4 py-3 text-gray-400">{track.genre || "—"}</td>
                      <td className="px-4 py-3 text-gray-400">{formatDuration(track.duration)}</td>
                      <td className="px-4 py-3">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlayTrack(track, index);
                          }}
                          className="p-2 hover:bg-gray-700 rounded-full transition"
                        >
                          {isCurrentTrackPlaying(track.id) ? (
                            <Pause className="w-4 h-4 text-primary" />
                          ) : (
                            <Play className="w-4 h-4 text-gray-400 hover:text-primary" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-800/30 rounded-lg border border-gray-700">
            <p className="text-gray-400">В этом плейлисте пока нет треков</p>
            <Link href="/">
              <Button className="mt-4">Найти музыку</Button>
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
}