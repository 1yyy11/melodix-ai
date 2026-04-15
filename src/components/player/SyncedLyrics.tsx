import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from "@/contexts/AuthContext";
// ... (интерфейс SyncedLyricsProps без изменений)

export function SyncedLyrics({ artist, title, currentTime }: SyncedLyricsProps) {
    const [lyrics, setLyrics] = useState<{ time: number; text: string }[]>([]);
    const [plainLyrics, setPlainLyrics] = useState<string | null>(null);
    const [currentLineIndex, setCurrentLineIndex] = useState(-1);
    const [isLoading, setIsLoading] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchAllLyrics = async () => {
            setIsLoading(true);
            setPlainLyrics(null);
            setLyrics([]);
            
            // 1. Пробуем получить синхронизированный текст
            try {
                const lrcRes = await fetch(`/api/lyrics-lrc?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`);
                const lrcData = await lrcRes.json();
                
                if (lrcData.syncedLyrics) {
                    const parsed = parseLRC(lrcData.syncedLyrics);
                    if (parsed.length > 0) {
                        setLyrics(parsed);
                        setIsLoading(false);
                        return;
                    }
                }
            } catch (e) { console.error("LRC fetch failed", e); }

            // 2. Если синхронизированного нет, получаем обычный текст через ваш старый API
            try {
                const plainRes = await fetch(`/api/lyrics?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`);
                const plainData = await plainRes.json();
                if (plainData.lyrics && !plainData.lyrics.includes('Текст не найден')) {
                    setPlainLyrics(plainData.lyrics);
                } else {
                    setPlainLyrics("Текст для этой песни не найден.");
                }
            } catch (e) { 
                console.error("Plain lyrics fetch failed", e);
                setPlainLyrics("Ошибка загрузки текста.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchAllLyrics();
    }, [artist, title]);

    // Эффект для подсветки строки (только для синхронизированных текстов)
    useEffect(() => {
        if (lyrics.length === 0) return;
        
        let index = lyrics.findIndex((_, i) => currentTime < lyrics[i].time);
        if (index === -1) index = lyrics.length - 1;
        else if (index > 0) index = index - 1;
        
        if (index !== currentLineIndex) {
            setCurrentLineIndex(index);
            document.getElementById(`lyric-line-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [currentTime, lyrics, currentLineIndex]);

    // Функция для парсинга LRC
    const parseLRC = (lrcContent: string): { time: number; text: string }[] => {
        const lines = lrcContent.split('\n');
        return lines
            .map(line => {
                const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2})\](.*)/);
                if (match) {
                    const time = parseInt(match[1]) * 60 + parseInt(match[2]) + parseInt(match[3]) / 100;
                    return { time, text: match[4].trim() };
                }
                return null;
            })
            .filter(l => l !== null);
    };

    if (isLoading) return <div className="text-center text-muted-foreground">Загрузка текста...</div>;
    if (plainLyrics) return <div className="whitespace-pre-wrap text-sm leading-relaxed p-4">{plainLyrics}</div>;
    if (lyrics.length === 0) return <div className="text-center text-muted-foreground">Не удалось загрузить текст для этой песни.</div>;

    // Рендер синхронизированных строк
    return (
        <div ref={containerRef} className="h-64 overflow-y-auto text-center space-y-2 p-4">
            {lyrics.map((line, idx) => (
                <div
                    key={idx}
                    id={`lyric-line-${idx}`}
                    className={`transition-all duration-300 ${
                        idx === currentLineIndex
                            ? 'text-primary text-lg font-bold scale-105'
                            : 'text-muted-foreground text-sm opacity-60'
                    }`}
                >
                    {line.text || '♪'}
                </div>
            ))}
        </div>
    );
}