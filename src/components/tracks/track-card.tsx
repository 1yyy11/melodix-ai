import { Play, Pause, Heart, Clock, Activity, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Track, useAddFavorite, useRemoveFavorite } from "@workspace/api-client-react";
import { usePlayer } from "@/hooks/use-player";
import { formatTime } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { AddToPlaylistDialog } from "@/components/playlists/add-to-playlist-dialog";
import { useEffect, useState, memo } from "react";

interface TrackCardProps {
  track: Track & {
    artist?: string;      // ← из api/tracks
    artist_name?: string; // ← из api/tracks (аналог)
  };
  queueContext?: Track[];
}

export const TrackCard = memo(function TrackCard({ track, queueContext = [] }: TrackCardProps) {
  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayer();
  const isCurrentTrack = currentTrack?.id === track.id;
  const isCurrentlyPlaying = isCurrentTrack && isPlaying;
  const [artistName, setArtistName] = useState('');
  const queryClient = useQueryClient();
  const addFav = useAddFavorite();
  const removeFav = useRemoveFavorite();

  // ✅ Функция для получения имени исполнителя из разных полей
  const getArtistDisplayName = () => {
    // Приоритет: artist_name > artist > загруженный из API > заглушка
    if (track.artist_name) return track.artist_name;
    if (track.artist) return track.artist;
    if (artistName) return artistName;
    return 'Неизвестный исполнитель';
  };

  // Загружаем имя исполнителя только при смене track.artist_id (если нет прямых полей)
  useEffect(() => {
    // Если уже есть artist или artist_name — не нужно загружать
    if (track.artist_name || track.artist) {
      setArtistName('');
      return;
    }

    if (!track.artist_id) {
      setArtistName('');
      return;
    }

    let isMounted = true;

    fetch(`/api/artist/${track.artist_id}`)
      .then(res => res.json())
      .then(data => {
        if (isMounted && data?.name) {
          setArtistName(data.name);
        }
      })
      .catch(err => console.error('Failed to fetch artist:', err));

    return () => {
      isMounted = false;
    };
  }, [track.artist_id, track.artist_name, track.artist]);

  // ✅ Форматирование жанра и настроения (убираем unknown/null/undefined)
  const formatGenreMood = () => {
    const genre = track.genre && track.genre !== 'unknown' ? track.genre : null;
    const mood = track.mood && track.mood !== 'unknown' ? track.mood : null;
    
    if (genre && mood) return `${genre} • ${mood}`;
    if (genre) return genre;
    if (mood) return mood;
    return '—';
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCurrentTrack) {
      togglePlay();
    } else {
      playTrack(track, queueContext);
    }
  };

  const handleFavClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (track.isFavorite) {
      removeFav.mutate({ trackId: track.id }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/tracks'] })
      });
    } else {
      addFav.mutate({ trackId: track.id }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/tracks'] })
      });
    }
  };

  return (
    <div className="group relative bg-card hover:bg-secondary/80 rounded-2xl p-4 transition-all duration-300 border border-transparent hover:border-border/50 shadow-sm hover:shadow-xl flex flex-col gap-4">
      {/* Cover Art Area */}
      <div className="relative aspect-square rounded-xl overflow-hidden bg-secondary shadow-md">
        {track.coverUrl ? (
          <img 
            src={track.coverUrl.startsWith('http') ? track.coverUrl : `http://localhost:3001${track.coverUrl}`} 
            alt={track.title} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center transition-transform duration-500 group-hover:scale-105">
            <Activity className="w-12 h-12 text-primary/40" />
          </div>
        )}
        
        {/* Play Button Overlay */}
        <div className={cn(
          "absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-300 backdrop-blur-[2px]",
          isCurrentTrack ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}>
          <Button 
            size="icon" 
            className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-xl hover:scale-110 transition-transform"
            onClick={handlePlayClick}
          >
            {isCurrentlyPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
          </Button>
        </div>

        {/* Кнопки в правом верхнем углу */}
        <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all">
          {/* Кнопка избранного */}
          <button 
            onClick={handleFavClick}
            className="p-2 rounded-full bg-black/40 backdrop-blur-md text-white/80 hover:text-white hover:bg-black/60 transition-all"
          >
            <Heart 
              className={`w-4 h-4 ${track.isFavorite ? "text-primary fill-primary" : ""}`} 
            />
          </button>
          
          {/* Кнопка добавления в плейлист */}
          <AddToPlaylistDialog
            trackId={track.id}
            trackTitle={track.title}
            trigger={
              <button className="p-2 rounded-full bg-black/40 backdrop-blur-md text-white/80 hover:text-white hover:bg-black/60 transition-all">
                <Plus className="w-4 h-4" />
              </button>
            }
          />
        </div>
      </div>

      {/* Metadata */}
      <div className="flex flex-col gap-1 px-1">
        <h3 className="font-display font-bold text-lg truncate text-foreground group-hover:text-primary transition-colors">
          {track.title}
        </h3>
        <p className="text-xs text-muted-foreground truncate">
          {getArtistDisplayName()}
        </p>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="truncate text-xs">{formatGenreMood()}</span>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground/80 mt-2">
          {track.tempo && (
            <span className="flex items-center gap-1 bg-secondary/50 px-2 py-1 rounded-md">
              <Activity className="w-3 h-3" /> {track.tempo} BPM
            </span>
          )}
          <span className="flex items-center gap-1 bg-secondary/50 px-2 py-1 rounded-md">
            <Clock className="w-3 h-3" /> {formatTime(track.duration)}
          </span>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Кастомное сравнение для memo — пропускаем перерендер если ничего важного не изменилось
  if (prevProps.track.id !== nextProps.track.id) return false;
  if (prevProps.track.isFavorite !== nextProps.track.isFavorite) return false;
  
  // Сравниваем artist и artist_name
  if (prevProps.track.artist !== nextProps.track.artist) return false;
  if (prevProps.track.artist_name !== nextProps.track.artist_name) return false;
  
  // Для queueContext сравниваем по длине
  const prevLen = prevProps.queueContext?.length ?? 0;
  const nextLen = nextProps.queueContext?.length ?? 0;
  if (prevLen !== nextLen) return false;
  
  return true;
});