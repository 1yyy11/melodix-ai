import { useEffect, useRef, useState } from "react";
import { 
  Play, Pause, SkipBack, SkipForward, 
  Volume2, VolumeX, Repeat, Shuffle,
  Heart, Share2, ListMusic, Music2, FileText, X
} from "lucide-react";
import { usePlayer } from "@/hooks/use-player";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/utils";
import { useAddFavorite, useRemoveFavorite } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { LyricsPanel } from "@/components/player/lyrics-panel";
// Импортируем хук для управления панелью текста
import { useLyrics } from "@/contexts/LyricsContext";

export function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { isOpen: isLyricsOpen, openLyrics, closeLyrics } = useLyrics();
  
  const { 
    currentTrack, isPlaying, volume, progress, duration, 
    isMuted, isShuffled, isRepeating,
    togglePlay, nextTrack, prevTrack, setVolume, setProgress, setDuration,
    toggleMute, toggleShuffle, toggleRepeat
  } = usePlayer();
  
  const [localProgress, setLocalProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [lyricsText, setLyricsText] = useState('');
  const [loadingLyrics, setLoadingLyrics] = useState(false);
  const [artistName, setArtistName] = useState('');
const [currentTime, setCurrentTime] = useState(0); // <-- ДОБАВЬТЕ ЭТУ СТРОКУ
  const queryClient = useQueryClient();
  const addFavMutation = useAddFavorite();
  const removeFavMutation = useRemoveFavorite();
  const [parsedLyrics, setParsedLyrics] = useState<any[]>([]);
  const [currentLine, setCurrentLine] = useState(0);
  const [audioReady, setAudioReady] = useState(false);

  // Получаем имя исполнителя при загрузке трека
  useEffect(() => {
    if (currentTrack?.artist_id) {
      fetch(`/api/artist/${currentTrack.artist_id}`)
        .then(res => res.json())
        .then(data => setArtistName(data.name))
        .catch(err => console.error('Failed to fetch artist:', err));
    }
  }, [currentTrack]);

  // Загрузка аудио при смене трека
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack?.audioUrl) {
      setAudioReady(false);
      return;
    }

    console.log("🎵 Загружаем аудио:", currentTrack.audioUrl);
    setAudioReady(false);
    
    audio.src = currentTrack.audioUrl;
    audio.load();

    const handleCanPlay = () => {
      console.log("✅ Аудио загружено, можно играть");
      setAudioReady(true);
      if (isPlaying) {
        audio.play().catch(e => console.log("Play error:", e));
      }
    };

    const handleError = (e) => {
      console.error("❌ Ошибка загрузки аудио:", e);
      setAudioReady(false);
    };

    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);
    
    return () => {
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
      audio.pause();
      audio.src = '';
      audio.load();
    };
  }, [currentTrack?.audioUrl]);

  // Handle audio element events
 // Handle audio element events
useEffect(() => {
  const audio = audioRef.current;
  if (!audio) return;

  const updateTime = () => {
    if (!isDragging) {
      setProgress(audio.currentTime);
      setLocalProgress(audio.currentTime);
      setCurrentTime(audio.currentTime); // <-- ДОБАВЬТЕ ЭТУ СТРОКУ
    }
  };

  const updateDuration = () => setDuration(audio.duration);
  const handleEnded = () => nextTrack();

  audio.addEventListener('timeupdate', updateTime);
  audio.addEventListener('loadedmetadata', updateDuration);
  audio.addEventListener('ended', handleEnded);

  return () => {
    audio.removeEventListener('timeupdate', updateTime);
    audio.removeEventListener('loadedmetadata', updateDuration);
    audio.removeEventListener('ended', handleEnded);
  };
}, [isDragging, setProgress, setDuration, nextTrack]);
  // Handle play/pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioReady || !currentTrack?.audioUrl) return;

    if (isPlaying) {
      audio.play().catch(e => console.log("Play error:", e));
    } else {
      audio.pause();
    }
  }, [isPlaying, audioReady, currentTrack?.audioUrl]);

  // Handle volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Синхронизация текста
  useEffect(() => {
    setParsedLyrics([]);
    setLyricsText('');
    setCurrentLine(0);
  }, [currentTrack]);

  useEffect(() => {
    if (!parsedLyrics.length) return;

    const interval = setInterval(() => {
      const currentTime = audioRef.current?.currentTime || 0;

      for (let i = 0; i < parsedLyrics.length; i++) {
        if (
          i === parsedLyrics.length - 1 ||
          (currentTime >= parsedLyrics[i].time &&
           currentTime < parsedLyrics[i + 1].time)
        ) {
          setCurrentLine(i);
          break;
        }
      }
    }, 200);

    return () => clearInterval(interval);
  }, [parsedLyrics]);

  const handleSeek = (value: number[]) => {
    setIsDragging(true);
    setLocalProgress(value[0]);
  };

  const handleSeekCommit = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setProgress(value[0]);
    }
    setIsDragging(false);
  };

  const handleToggleFavorite = () => {
    if (!currentTrack) return;
    if (currentTrack.isFavorite) {
      removeFavMutation.mutate({ trackId: currentTrack.id }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/tracks'] })
      });
    } else {
      addFavMutation.mutate({ trackId: currentTrack.id }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/tracks'] })
      });
    }
  };

  const fetchLyrics = async () => {
    if (!currentTrack) return;
    
    setLoadingLyrics(true);
    
    let artist = artistName;
    if (!artist && currentTrack.artist_id) {
      const res = await fetch(`/api/artist/${currentTrack.artist_id}`);
      const data = await res.json();
      artist = data.name;
    }
    
    try {
      const res = await fetch(`/api/lyrics-lrc?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(currentTrack.title)}`);
      const data = await res.json();
      
      if (data.syncedLyrics) {
        const parsed = parseLRC(data.syncedLyrics);
        setParsedLyrics(parsed);
        setLyricsText('');
      } else if (data.plainLyrics) {
        setParsedLyrics([]);
        setLyricsText(data.plainLyrics);
      } else {
        setParsedLyrics([]);
        setLyricsText('Текст не найден');
      }
      // Открываем панель после загрузки текста
      openLyrics();
    } catch (err) {
      console.error(err);
      setLyricsText('Ошибка загрузки');
      openLyrics();
    } finally {
      setLoadingLyrics(false);
    }
  };

  function parseLRC(lrc: string) {
    const lines = lrc.split('\n');
    return lines
      .map(line => {
        const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2})\](.*)/);
        if (!match) return null;
        const minutes = parseInt(match[1]);
        const seconds = parseInt(match[2]);
        return {
          time: minutes * 60 + seconds,
          text: match[4].trim()
        };
      })
      .filter(Boolean);
  }

  if (!currentTrack) return null;

  return (
    <>
      <audio 
        ref={audioRef} 
        src={currentTrack?.audioUrl} 
        preload="auto"
        loop={isRepeating}
        onError={(e) => console.error('❌ Ошибка аудио:', e, 'URL:', currentTrack?.audioUrl)}
        onCanPlay={() => console.log('✅ Аудио готово, URL:', currentTrack?.audioUrl)}
      />
      
      <div className="fixed bottom-0 left-0 right-0 h-24 bg-card/95 backdrop-blur-xl border-t border-border/50 z-40 flex items-center justify-between px-4 sm:px-6 shadow-2xl">
        {/* Track Info */}
        <div className="flex items-center gap-4 w-1/4 min-w-[200px]">
          <div className="w-14 h-14 rounded-lg bg-secondary overflow-hidden shrink-0 shadow-md">
            {currentTrack.coverUrl ? (
              <img src={currentTrack.coverUrl} alt={currentTrack.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/40 to-accent/40 flex items-center justify-center">
                <Music2 className="w-6 h-6 text-white/70" />
              </div>
            )}
          </div>
          <div className="flex flex-col truncate">
            <span className="font-semibold text-sm truncate text-foreground">{currentTrack.title}</span>
            <span className="text-xs text-muted-foreground truncate">{artistName || currentTrack.artist_id}</span>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className={cn("shrink-0", currentTrack.isFavorite ? "text-primary" : "text-muted-foreground hover:text-foreground")}
            onClick={handleToggleFavorite}
            disabled={addFavMutation.isPending || removeFavMutation.isPending}
          >
            <Heart className="w-5 h-5" fill={currentTrack.isFavorite ? "currentColor" : "none"} />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={fetchLyrics}
            className={cn("text-muted-foreground hover:text-foreground", isLyricsOpen && "text-primary")}
          >
            <FileText className="w-4 h-4" />
          </Button>
        </div>

        {/* Controls */}
        <div className="flex-1 max-w-2xl flex flex-col items-center justify-center gap-2 px-8">
          <div className="flex items-center gap-4 sm:gap-6">
            <Button 
              variant="ghost" 
              size="icon" 
              className={cn("hidden sm:flex", isShuffled ? "text-primary" : "text-muted-foreground")}
              onClick={toggleShuffle}
            >
              <Shuffle className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={prevTrack} className="text-foreground hover:text-primary transition-colors">
              <SkipBack className="w-5 h-5" />
            </Button>
            <Button 
              size="icon" 
              className="w-10 h-10 rounded-full bg-foreground text-background hover:bg-primary hover:text-primary-foreground hover:scale-105 transition-all shadow-lg shadow-black/20"
              onClick={togglePlay}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={nextTrack} className="text-foreground hover:text-primary transition-colors">
              <SkipForward className="w-5 h-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className={cn("hidden sm:flex", isRepeating ? "text-primary" : "text-muted-foreground")}
              onClick={toggleRepeat}
            >
              <Repeat className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="w-full flex items-center gap-3 text-xs text-muted-foreground font-mono">
            <span className="w-10 text-right">{formatTime(isDragging ? localProgress : progress)}</span>
            <div className="flex-1 player-slider-container group h-4 flex items-center">
              <Slider 
                value={[isDragging ? localProgress : progress]} 
                max={duration || 100} 
                step={0.1}
                onValueChange={handleSeek}
                onValueCommit={handleSeekCommit}
                className="cursor-pointer"
              />
            </div>
            <span className="w-10">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right Controls */}
        <div className="w-1/4 flex items-center justify-end gap-2 min-w-[150px]">
          <Button variant="ghost" size="icon" className="hidden lg:flex text-muted-foreground hover:text-foreground">
            <ListMusic className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="hidden lg:flex text-muted-foreground hover:text-foreground">
            <Share2 className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 w-24 ml-2 group">
            <Button variant="ghost" size="icon" onClick={toggleMute} className="shrink-0 text-muted-foreground hover:text-foreground">
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>
            <Slider 
              value={[isMuted ? 0 : volume * 100]} 
              max={100} 
              step={1}
              onValueChange={(v) => setVolume(v[0] / 100)}
              className="w-full"
            />
          </div>
        </div>
      </div>

     <LyricsPanel 
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
      />
    </>
  );
}