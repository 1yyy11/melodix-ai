import { useState, useEffect, useRef, useCallback } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/contexts/AuthContext";
import { Clock, Music2, Calendar, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface HistoryItem {
    played_at: string;
    track_id: string;
    title: string;
    duration: number;
    genre: string;
    mood: string;
    artist_name: string;
    cover_url: string;
}

interface ListeningStats {
    totalPlays: number;
    topTracks: { id: string; title: string; artist_name: string; play_count: number }[];
    topGenres: { genre: string; play_count: number }[];
    topArtists: { name: string; play_count: number }[];
    last7Days: { date: string; plays: number }[];
}

const API_URL = "http://localhost:3001/api";

export default function ListeningHistory() {
    const { user, token, isLoading: authLoading } = useAuth();
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [stats, setStats] = useState<ListeningStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const historyLoadedRef = useRef(false);
    const statsLoadedRef = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    // ✅ Мемоизируем authFetch с зависимостью от token
    const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
        const response = await fetch(url, {
            ...options,
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                ...(options.headers || {}),
            },
        });

        let data: any = null;
        const text = await response.text();

        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = null;
        }

        if (!response.ok) {
            const msg = data?.error || "Request failed";
            if (response.status === 401) {
                console.log("Session expired, redirecting to login...");
                window.location.href = "/login";
                throw new Error("UNAUTHORIZED");
            }
            throw new Error(msg);
        }

        return data;
    }, [token]);

    // =========================================================
    // LOAD HISTORY — только один раз
    // =========================================================
    const fetchHistory = useCallback(async () => {
        if (historyLoadedRef.current) return;
        historyLoadedRef.current = true;

        try {
            const data = await authFetch(`${API_URL}/user/history`);
            setHistory(data || []);
        } catch (error) {
            if (error instanceof Error && error.message !== "UNAUTHORIZED") {
                console.error('Error fetching history:', error);
            }
        }
    }, [authFetch]);

    // =========================================================
    // LOAD STATS — только один раз
    // =========================================================
    const fetchStats = useCallback(async () => {
        if (statsLoadedRef.current) return;
        statsLoadedRef.current = true;

        try {
            const data = await authFetch(`${API_URL}/user/listening-stats`);
            setStats(data || null);
        } catch (error) {
            if (error instanceof Error && error.message !== "UNAUTHORIZED") {
                console.error('Error fetching stats:', error);
            }
        }
    }, [authFetch]);

    // =========================================================
    // INIT — загружаем только один раз при монтировании
    // =========================================================
    useEffect(() => {
        if (!authLoading && user) {
            Promise.all([fetchHistory(), fetchStats()]).finally(() => {
                setIsLoading(false);
            });
        } else if (!authLoading && !user) {
            setIsLoading(false);
        }
    }, [authLoading, user, fetchHistory, fetchStats]);

    // Cleanup при размонтировании
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    // =========================================================
    // FORMAT DURATION
    // =========================================================
    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // =========================================================
    // FORMAT DATE
    // =========================================================
    const formatDate = (dateStr: string) => {
        return format(new Date(dateStr), "dd MMMM yyyy, HH:mm", { locale: ru });
    };

    // =========================================================
    // LOADING STATE
    // =========================================================
    if (authLoading || isLoading) {
        return (
            <Layout>
                <div className="flex items-center justify-center h-full min-h-[400px]">
                    <Clock className="w-8 h-8 animate-spin text-primary" />
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
                <div className="text-center py-20">
                    <Clock className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                    <h1 className="text-2xl font-bold mb-2">История прослушиваний</h1>
                    <p className="text-muted-foreground">Войдите, чтобы просмотреть свою историю.</p>
                </div>
            </Layout>
        );
    }

    // =========================================================
    // UI
    // =========================================================
    return (
        <Layout>
            <div className="max-w-5xl mx-auto space-y-8 pb-20">
                <h1 className="text-3xl font-display font-bold flex items-center gap-3">
                    <Clock className="w-8 h-8 text-primary" />
                    История прослушиваний
                </h1>

                {/* Статистика */}
                {stats && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-card rounded-2xl p-6 border border-border/50">
                            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-primary" />
                                Общая статистика
                            </h2>
                            <div className="text-3xl font-bold mb-2">{stats.totalPlays}</div>
                            <div className="text-muted-foreground text-sm">всего прослушиваний</div>
                            
                            {stats.topArtists.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-border/50">
                                    <div className="text-sm font-medium mb-2">Любимые исполнители</div>
                                    {stats.topArtists.map(artist => (
                                        <div key={artist.name} className="flex justify-between text-sm">
                                            <span>{artist.name}</span>
                                            <span className="text-muted-foreground">{artist.play_count} раз</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            
                            {stats.topGenres.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-border/50">
                                    <div className="text-sm font-medium mb-2">Любимые жанры</div>
                                    {stats.topGenres.map(genre => (
                                        <div key={genre.genre} className="flex justify-between text-sm">
                                            <span>{genre.genre}</span>
                                            <span className="text-muted-foreground">{genre.play_count} раз</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        <div className="bg-card rounded-2xl p-6 border border-border/50">
                            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-primary" />
                                Активность за неделю
                            </h2>
                            <div className="space-y-2">
                                {stats.last7Days.map(day => (
                                    <div key={day.date} className="flex justify-between items-center">
                                        <span className="text-sm">{format(new Date(day.date), "EEEE", { locale: ru })}</span>
                                        <div className="flex-1 mx-4 h-2 bg-secondary rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-primary rounded-full" 
                                                style={{ width: `${(day.plays / Math.max(...stats.last7Days.map(d => d.plays), 1)) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-sm text-muted-foreground">{day.plays}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Список прослушиваний */}
                {history.length === 0 ? (
                    <div className="text-center py-12 bg-card rounded-2xl border border-border/50">
                        <Music2 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                        <p className="text-muted-foreground">Вы ещё не слушали треки</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {history.map((item, idx) => (
                            <div key={idx} className="bg-card rounded-xl p-4 border border-border/50 flex items-center gap-4 hover:bg-secondary/30 transition">
                                <div className="w-12 h-12 rounded-lg bg-secondary overflow-hidden shrink-0">
                                    {item.cover_url ? (
                                        <img 
                                            src={item.cover_url.startsWith('http') ? item.cover_url : `http://localhost:3001${item.cover_url}`} 
                                            alt="" 
                                            className="w-full h-full object-cover" 
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Music2 className="w-5 h-5 text-muted-foreground" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">{item.title}</div>
                                    <div className="text-sm text-muted-foreground truncate">{item.artist_name}</div>
                                    <div className="text-xs text-muted-foreground/70 mt-1 flex gap-3">
                                        <span>{item.genre || "—"}</span>
                                        <span>{formatDuration(item.duration)}</span>
                                    </div>
                                </div>
                                <div className="text-xs text-muted-foreground whitespace-nowrap">
                                    {formatDate(item.played_at)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Layout>
    );
}