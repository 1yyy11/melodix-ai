import { useEffect, useState, useRef } from "react";
import { X, Music2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLyrics } from "@/contexts/LyricsContext";

interface LyricsPanelProps {
  currentTrack: {
    id: string;
    title: string;
    artist?: string;
    artist_id?: string;
    audioUrl?: string;
  } | null;
  isPlaying?: boolean;
  currentTime?: number;
}

export function LyricsPanel({ currentTrack, isPlaying, currentTime = 0 }: LyricsPanelProps) {
  const { isOpen, closeLyrics } = useLyrics();
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [parsedLyrics, setParsedLyrics] = useState<{ time: number; text: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [artistName, setArtistName] = useState<string>("");
  const [currentLine, setCurrentLine] = useState(0);
  const [loadedTrackId, setLoadedTrackId] = useState<string | null>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  // Получаем имя исполнителя
  useEffect(() => {
    if (currentTrack?.artist_id) {
      fetch(`http://localhost:3001/api/artist/${currentTrack.artist_id}`)
        .then(res => res.json())
        .then(data => setArtistName(data.name))
        .catch(err => console.error('Failed to fetch artist:', err));
    } else if (currentTrack?.artist) {
      setArtistName(currentTrack.artist);
    }
  }, [currentTrack?.id, currentTrack?.artist_id]);

  // Сброс и загрузка текста при смене трека
  useEffect(() => {
    if (currentTrack?.id && currentTrack.id !== loadedTrackId) {
      setParsedLyrics([]);
      setLyrics(null);
      setError(null);
      setCurrentLine(0);
      setLoadedTrackId(null);
      
      if (isOpen) {
        fetchLyrics();
      }
    }
  }, [currentTrack?.id, isOpen]);

  // Загрузка текста при открытии панели
  useEffect(() => {
    if (isOpen && currentTrack && currentTrack.id !== loadedTrackId) {
      fetchLyrics();
    }
  }, [isOpen, currentTrack?.id]);

  // Синхронизация текущей строки с временем
  useEffect(() => {
    if (!parsedLyrics.length) return;

    for (let i = 0; i < parsedLyrics.length; i++) {
      const currentLineTime = parsedLyrics[i].time;
      const nextLineTime = parsedLyrics[i + 1]?.time || Infinity;

      if (currentTime >= currentLineTime && currentTime < nextLineTime) {
        if (currentLine !== i) {
          setCurrentLine(i);
          setTimeout(() => {
            activeLineRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 100);
        }
        break;
      }
    }
  }, [currentTime, parsedLyrics]);

  const fetchLyrics = async () => {
    if (!currentTrack) return;
    
    setIsLoading(true);
    setError(null);
    
    let artist = artistName;
    if (!artist && currentTrack.artist_id) {
      try {
        const res = await fetch(`http://localhost:3001/api/artist/${currentTrack.artist_id}`);
        const data = await res.json();
        artist = data.name;
        setArtistName(artist);
      } catch (err) {
        console.error(err);
      }
    }
    
    try {
      const res = await fetch(
        `http://localhost:3001/api/lyrics-lrc?artist=${encodeURIComponent(artist || "Unknown")}&title=${encodeURIComponent(currentTrack.title)}`
      );
      const data = await res.json();
      
      if (data.syncedLyrics) {
        const parsed = parseLRC(data.syncedLyrics);
        setParsedLyrics(parsed);
        setLyrics(null);
      } else if (data.plainLyrics) {
        setParsedLyrics([]);
        setLyrics(cleanLyrics(data.plainLyrics));
      } else {
        setError("Текст не найден");
      }
      
      setLoadedTrackId(currentTrack.id);
    } catch (err) {
      console.error("Error fetching lyrics:", err);
      setError("Ошибка загрузки текста");
    } finally {
      setIsLoading(false);
    }
  };

  const parseLRC = (lrc: string) => {
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
      .filter(Boolean) as { time: number; text: string }[];
  };

  const cleanLyrics = (text: string) => {
    return text
      .split('\n')
      .map(line => {
        let cleanLine = line
          .replace(/\d+\s+Contributors.*$/i, '')
          .replace(/\([Ss]nippet[^)]*\)/g, '')
          .replace(/\[.*?\]/g, '')
          .trim();
        
        if (!cleanLine || cleanLine.length < 2) return null;
        if (cleanLine.match(/^[A-Za-z\s]+Lyrics$/i)) return null;
        return cleanLine;
      })
      .filter(Boolean)
      .join('\n');
  };

  const isChangingTrack = currentTrack?.id && currentTrack.id !== loadedTrackId && !isLoading;

  if (!isOpen) return null;

  return (
    <>
      {/* Панель с текстом - БЕЗ затемнения фона */}
      <div className="fixed top-0 right-0 h-full w-full sm:w-[500px] bg-gradient-to-b from-gray-900 to-black shadow-2xl z-50 flex flex-col animate-slideIn">
        {/* Заголовок */}
        <div className="sticky top-0 bg-gray-900/95 backdrop-blur-sm border-b border-gray-700 p-5 flex justify-between items-center">
          <div className="flex-1">
            <h3 className="text-white font-semibold text-lg">Текст песни</h3>
            {currentTrack && (
              <p className="text-gray-400 text-sm mt-1">
                {currentTrack.title} — {artistName || currentTrack.artist || "Unknown Artist"}
              </p>
            )}
          </div>
          <button
            onClick={closeLyrics}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400 hover:text-white" />
          </button>
        </div>
        
        {/* Содержимое */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {isLoading || isChangingTrack ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-gray-400 mt-4">
                {isChangingTrack ? "Загрузка текста для новой песни..." : "Загрузка текста..."}
              </p>
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <Music2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-red-400">{error}</p>
              <button
                onClick={fetchLyrics}
                className="mt-4 px-4 py-2 bg-gray-800 rounded-lg text-gray-300 hover:bg-gray-700 transition"
              >
                Попробовать снова
              </button>
            </div>
          ) : parsedLyrics.length > 0 ? (
            <div className="space-y-3 text-center">
              {parsedLyrics.map((line, idx) => (
                <div
                  key={idx}
                  ref={idx === currentLine ? activeLineRef : null}
                  className={cn(
                    "transition-all duration-300 cursor-pointer py-1",
                    idx === currentLine
                      ? "text-primary text-xl font-bold scale-105"
                      : "text-gray-400 text-base hover:text-gray-300"
                  )}
                >
                  {line.text}
                </div>
              ))}
            </div>
          ) : lyrics ? (
            <div className="text-gray-300 text-base leading-loose whitespace-pre-wrap break-words font-mono">
              {lyrics.split('\n').map((line, i) => (
                <p key={i} className="mb-2 hover:text-primary transition-colors">
                  {line || '\u00A0'}
                </p>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <Music2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500">Текст не загружен</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}