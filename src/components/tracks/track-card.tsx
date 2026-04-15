import { Play, Pause, Heart, MoreHorizontal, Clock, Activity, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Track, useAddFavorite, useRemoveFavorite } from "@workspace/api-client-react";
import { usePlayer } from "@/hooks/use-player";
import { formatTime } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { AddToPlaylistDialog } from "@/components/playlists/add-to-playlist-dialog";

interface TrackCardProps {
  track: Track;
  queueContext?: Track[];
}

export function TrackCard({ track, queueContext = [] }: TrackCardProps) {
  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayer();
  const isCurrentTrack = currentTrack?.id === track.id;
  const isCurrentlyPlaying = isCurrentTrack && isPlaying;
  
  const queryClient = useQueryClient();
  const addFav = useAddFavorite();
  const removeFav = useRemoveFavorite();

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
          <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
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
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="truncate">{track.genre} • {track.mood}</span>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground/80 mt-2">
          <span className="flex items-center gap-1 bg-secondary/50 px-2 py-1 rounded-md">
            <Activity className="w-3 h-3" /> {track.tempo} BPM
          </span>
          <span className="flex items-center gap-1 bg-secondary/50 px-2 py-1 rounded-md">
            <Clock className="w-3 h-3" /> {formatTime(track.duration)}
          </span>
        </div>
      </div>
    </div>
  );
}