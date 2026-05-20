import { useState, useEffect, useRef, useCallback } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/contexts/AuthContext";
import { 
    User, Activity, Music2, ListMusic, Heart, Loader2, 
    Edit2, Save, X, Camera, Trash2, TrendingUp, Clock, Award, Headphones,
    ArrowLeft, Calendar
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const API_URL = "http://localhost:3001/api";

// ============ ТИПЫ ============
interface UserStats {
    generatedTracks: number;
    favorites: number;
    playlists: number;
    totalPlays: number;
    favoriteGenre: string;
    favoriteMood: string;
    memberSince: string;
    listeningTime: number;
    streak: number;
}

interface ActivityItem {
    type: 'play' | 'favorite' | 'create' | 'playlist';
    title: string;
    timestamp: string;
    details?: string;
}

interface ListeningStats {
    totalPlays: number;
    topTracks: { id: string; title: string; artist_name: string; play_count: number }[];
    topGenres: { genre: string; play_count: number }[];
    topArtists: { name: string; play_count: number }[];
    last7Days: { date: string; plays: number }[];
}

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

// ============ КОМПОНЕНТ ============
export default function Profile() {
    const { user, token, isAuthenticated, logout, updateProfile, isLoading: authLoading } = useAuth();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Режим отображения: 'profile' | 'history'
    const [viewMode, setViewMode] = useState<'profile' | 'history'>('profile');
    
    // Профиль
    const [stats, setStats] = useState<UserStats>({
        generatedTracks: 0,
        favorites: 0,
        playlists: 0,
        totalPlays: 0,
        favoriteGenre: 'Недостаточно данных',
        favoriteMood: 'Недостаточно данных',
        memberSince: new Date().toISOString(),
        listeningTime: 0,
        streak: 0
    });
    const [listeningStats, setListeningStats] = useState<ListeningStats | null>(null);
    const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [avatarPreview, setAvatarPreview] = useState('');

    // История
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [historyStats, setHistoryStats] = useState<ListeningStats | null>(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const historyLoadedRef = useRef(false);

    // Синхронизация с user при изменении
    useEffect(() => {
        if (user) {
            setFirstName(user.firstName || '');
            setLastName(user.lastName || '');
            setAvatarPreview(user.profileImageUrl || '');
        }
    }, [user]);

    // Загрузка профиля
    useEffect(() => {
        if (!authLoading && user) {
            fetchProfileData();
        }
    }, [authLoading, user]);

    // ============ API ============
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
                window.location.href = "/login";
                throw new Error("UNAUTHORIZED");
            }
            throw new Error(msg);
        }

        return data;
    }, [token]);

    // ============ ЗАГРУЗКА ПРОФИЛЯ ============
    const fetchProfileData = async () => {
        setIsLoading(true);
        try {
            const [listeningRes, userRes] = await Promise.allSettled([
                authFetch(`${API_URL}/user/listening-stats`),
                authFetch(`${API_URL}/user`)
            ]);

            if (listeningRes.status === 'fulfilled' && listeningRes.value) {
                const data = listeningRes.value;
                setListeningStats({
                    totalPlays: data?.totalPlays || 0,
                    topGenres: Array.isArray(data?.topGenres) ? data.topGenres : [],
                    topArtists: Array.isArray(data?.topArtists) ? data.topArtists : [],
                    last7Days: Array.isArray(data?.last7Days) ? data.last7Days : [],
                });
                
                setStats(prev => ({
                    ...prev,
                    totalPlays: data.totalPlays || 0,
                    favoriteGenre: Array.isArray(data.topGenres) && data.topGenres.length > 0
                        ? data.topGenres[0].genre
                        : 'Недостаточно данных',
                }));
            }

            if (userRes.status === 'fulfilled' && userRes.value) {
                const data = userRes.value;
                if (data.createdAt) {
                    setStats(prev => ({ ...prev, memberSince: data.createdAt }));
                }
                if (data.preferences) {
                    setStats(prev => ({
                        ...prev,
                        favoriteMood: data.preferences.preferred_moods?.[0] || prev.favoriteMood,
                    }));
                }
            }

            await fetchExtraStats();

        } catch (error) {
            console.error('Error fetching data:', error);
            loadDemoData();
        } finally {
            setIsLoading(false);
        }
    };

    const fetchExtraStats = async () => {
        const endpoints = [
            { url: `${API_URL}/user/stats`, key: 'stats' },
            { url: `${API_URL}/user/favorites/count`, key: 'favorites' },
            { url: `${API_URL}/user/playlists/count`, key: 'playlists' },
            { url: `${API_URL}/user/activity?limit=5`, key: 'activity' },
        ];

        for (const endpoint of endpoints) {
            try {
                const res = await authFetch(endpoint.url);
                if (!res) continue;

                if (endpoint.key === 'stats') {
                    setStats(prev => ({
                        ...prev,
                        generatedTracks: res.generatedTracks ?? prev.generatedTracks,
                        favorites: res.favorites ?? prev.favorites,
                        playlists: res.playlists ?? prev.playlists,
                        listeningTime: res.listeningTime ?? prev.listeningTime,
                        streak: res.streak ?? prev.streak,
                        favoriteGenre: res.favoriteGenre || res.topGenres?.[0]?.genre || prev.favoriteGenre,
                        favoriteMood: res.favoriteMood || prev.favoriteMood,
                    }));
                } else if (endpoint.key === 'favorites') {
                    setStats(prev => ({ ...prev, favorites: res.count || res.favorites || 0 }));
                } else if (endpoint.key === 'playlists') {
                    setStats(prev => ({ ...prev, playlists: res.count || res.playlists || 0 }));
                } else if (endpoint.key === 'activity') {
                    setRecentActivity(res.activities || res.activity || res || []);
                }
            } catch (e) {
                // Эндпоинт не существует — пропускаем
            }
        }
    };

    // ============ ЗАГРУЗКА ИСТОРИИ ============
    const fetchHistoryData = async () => {
        if (historyLoadedRef.current) {
            setViewMode('history');
            return;
        }
        
        setHistoryLoading(true);
        try {
            const [historyRes, statsRes] = await Promise.allSettled([
                authFetch(`${API_URL}/user/history`),
                authFetch(`${API_URL}/user/listening-stats`)
            ]);

            if (historyRes.status === 'fulfilled' && historyRes.value) {
                setHistory(historyRes.value || []);
            }

            if (statsRes.status === 'fulfilled' && statsRes.value) {
                const data = statsRes.value;
                setHistoryStats({
                    totalPlays: data?.totalPlays || 0,
                    topTracks: Array.isArray(data?.topTracks) ? data.topTracks : [],
                    topGenres: Array.isArray(data?.topGenres) ? data.topGenres : [],
                    topArtists: Array.isArray(data?.topArtists) ? data.topArtists : [],
                    last7Days: Array.isArray(data?.last7Days) ? data.last7Days : [],
                });
            }

            historyLoadedRef.current = true;
            setViewMode('history');
        } catch (error) {
            console.error('Error fetching history:', error);
            toast({ title: "Ошибка", description: "Не удалось загрузить историю", variant: "destructive" });
        } finally {
            setHistoryLoading(false);
        }
    };

    const loadDemoData = () => {
        setStats({
            generatedTracks: 12,
            favorites: 48,
            playlists: 7,
            totalPlays: 342,
            favoriteGenre: 'Lo-Fi',
            favoriteMood: 'Спокойное',
            memberSince: '2025-01-15T10:00:00Z',
            listeningTime: 2847,
            streak: 5
        });
        setListeningStats({
            totalPlays: 342,
            topGenres: [
                { genre: 'Lo-Fi', play_count: 89 },
                { genre: 'Ambient', play_count: 45 },
                { genre: 'Electronic', play_count: 32 },
            ],
            topArtists: [
                { name: 'Unknown Artist', play_count: 56 },
                { name: 'Lo-Fi Beats', play_count: 34 },
            ],
            last7Days: Array.from({ length: 7 }, (_, i) => ({
                date: new Date(Date.now() - (6 - i) * 86400000).toISOString(),
                plays: Math.floor(Math.random() * 20) + 5
            }))
        });
        setRecentActivity([
            { type: 'play', title: 'Midnight Dreams', timestamp: new Date(Date.now() - 3600000).toISOString(), details: 'Lo-Fi' },
            { type: 'favorite', title: 'Ocean Waves', timestamp: new Date(Date.now() - 7200000).toISOString() },
            { type: 'create', title: 'Summer Vibes 2026', timestamp: new Date(Date.now() - 86400000).toISOString(), details: 'Плейлист' },
            { type: 'play', title: 'Rainy Day', timestamp: new Date(Date.now() - 172800000).toISOString(), details: 'Ambient' },
        ]);
    };

    // ============ ОБРАБОТЧИКИ ============

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            toast({ title: "Ошибка", description: "Можно загружать только изображения", variant: "destructive" });
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast({ title: "Ошибка", description: "Размер файла не должен превышать 5 МБ", variant: "destructive" });
            return;
        }

        setUploadingAvatar(true);
        const formData = new FormData();
        formData.append('avatar', file);
        
        try {
            const response = await fetch(`${API_URL}/user/avatar`, {
                method: 'POST',
                credentials: 'include',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                body: formData
            });
            
            if (!response.ok) throw new Error('Upload failed');
            const data = await response.json();
            setAvatarPreview(data.avatarUrl);
            if (updateProfile) await updateProfile({ profileImageUrl: data.avatarUrl });
            toast({ title: "Успех", description: "Аватар обновлён" });
        } catch (error) {
            toast({ title: "Ошибка", description: "Не удалось загрузить аватар", variant: "destructive" });
        } finally {
            setUploadingAvatar(false);
        }
    };
    
    const handleDeleteAvatar = async () => {
        try {
            const response = await fetch(`${API_URL}/user/avatar`, {
                method: 'DELETE',
                credentials: 'include',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            });
            
            if (!response.ok) throw new Error('Delete failed');
            setAvatarPreview('');
            if (updateProfile) await updateProfile({ profileImageUrl: '' });
            toast({ title: "Успех", description: "Аватар удалён" });
        } catch (error) {
            toast({ title: "Ошибка", description: "Не удалось удалить аватар", variant: "destructive" });
        }
    };

    // ============ РЕДАКТИРОВАНИЕ ИМЕНИ И ФАМИЛИИ ============
    const handleSaveProfile = async () => {
        setIsSaving(true);
        try {
            // Отправляем на бэкенд
            const response = await authFetch(`${API_URL}/user`, {
                method: 'PATCH',
                body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim() })
            });

            // Обновляем локальный контекст
            if (updateProfile) {
                await updateProfile({ firstName: firstName.trim(), lastName: lastName.trim() });
            }

            setIsEditing(false);
            toast({ title: "Успех", description: "Профиль обновлён" });
        } catch (error) {
            console.error('Save profile error:', error);
            toast({ title: "Ошибка", description: "Не удалось обновить профиль", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setFirstName(user?.firstName || '');
        setLastName(user?.lastName || '');
    };

    const handleLogout = () => {
        logout();
        window.location.href = '/login';
    };

    // ============ ХЕЛПЕРЫ ============

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'Недавно';
        try {
            return format(new Date(dateString), 'd MMMM yyyy', { locale: ru });
        } catch {
            return 'Недавно';
        }
    };

    const formatRelativeTime = (dateString: string) => {
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
            
            if (diffMinutes < 1) return 'только что';
            if (diffMinutes < 60) return `${diffMinutes} мин. назад`;
            if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} ч. назад`;
            if (diffMinutes < 10080) return `${Math.floor(diffMinutes / 1440)} дн. назад`;
            return format(date, 'd MMM', { locale: ru });
        } catch {
            return 'недавно';
        }
    };

    const formatDuration = (minutes: number) => {
        if (minutes < 60) return `${minutes} мин`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours < 24) return `${hours} ч ${mins} мин`;
        const days = Math.floor(hours / 24);
        return `${days} д ${hours % 24} ч`;
    };

    const formatTrackDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatHistoryDate = (dateStr: string) => {
        return format(new Date(dateStr), "dd MMMM yyyy, HH:mm", { locale: ru });
    };

    const getActivityIcon = (type: ActivityItem['type']) => {
        switch (type) {
            case 'play': return <Music2 className="w-4 h-4" />;
            case 'favorite': return <Heart className="w-4 h-4" />;
            case 'create': return <TrendingUp className="w-4 h-4" />;
            case 'playlist': return <ListMusic className="w-4 h-4" />;
            default: return <Activity className="w-4 h-4" />;
        }
    };

    const getActivityColor = (type: ActivityItem['type']) => {
        switch (type) {
            case 'play': return 'bg-blue-500/20 text-blue-400';
            case 'favorite': return 'bg-rose-500/20 text-rose-400';
            case 'create': return 'bg-emerald-500/20 text-emerald-400';
            case 'playlist': return 'bg-amber-500/20 text-amber-400';
            default: return 'bg-gray-500/20 text-gray-400';
        }
    };

    const getDayName = (dateStr: string) => {
        try {
            return format(new Date(dateStr), "EEE", { locale: ru });
        } catch {
            return '';
        }
    };

    // ============ РЕНДЕР ============

    if (!isAuthenticated) {
        return (
            <Layout>
                <div className="h-[80vh] flex flex-col items-center justify-center text-center max-w-md mx-auto">
                    <User className="w-24 h-24 text-muted-foreground/30 mb-6" />
                    <h1 className="text-3xl font-display font-bold mb-4">Ваш профиль</h1>
                    <p className="text-muted-foreground mb-8">Войдите, чтобы просмотреть статистику.</p>
                    <Button onClick={() => window.location.href = '/login'} size="lg" className="rounded-full px-8">
                        Войти
                    </Button>
                </div>
            </Layout>
        );
    }

    const displayName = user?.firstName || user?.email?.split('@')[0] || 'Создатель';
    const daysSinceJoin = stats.memberSince 
        ? differenceInDays(new Date(), new Date(stats.memberSince)) 
        : 0;

    // ============ РЕЖИМ ИСТОРИИ ============
    if (viewMode === 'history') {
        return (
            <Layout>
                <div className="max-w-5xl mx-auto space-y-8 pb-20 animate-in fade-in duration-300">
                    {/* Шапка истории */}
                    <div className="flex items-center gap-4">
                        <Button 
                            variant="ghost" 
                            className="rounded-full p-2 h-10 w-10"
                            onClick={() => setViewMode('profile')}
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div>
                            <h1 className="text-3xl font-bold flex items-center gap-3">
                                <Clock className="w-8 h-8 text-primary" />
                                История прослушиваний
                            </h1>
                            <p className="text-muted-foreground text-sm mt-1">
                                {history.length} треков прослушано
                            </p>
                        </div>
                    </div>

                    {historyLoading ? (
                        <div className="flex items-center justify-center h-[400px]">
                            <Clock className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <>
                            {/* Статистика истории */}
                            {historyStats && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="rounded-2xl bg-card border border-border/50 p-6">
                                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                            <TrendingUp className="w-5 h-5 text-primary" />
                                            Общая статистика
                                        </h2>
                                        <div className="text-3xl font-bold mb-2">{historyStats.totalPlays}</div>
                                        <div className="text-muted-foreground text-sm">всего прослушиваний</div>
                                        
                                        {historyStats.topArtists.length > 0 && (
                                            <div className="mt-4 pt-4 border-t border-border/50">
                                                <div className="text-sm font-medium mb-2">Любимые исполнители</div>
                                                {historyStats.topArtists.map(artist => (
                                                    <div key={artist.name} className="flex justify-between text-sm py-1">
                                                        <span>{artist.name}</span>
                                                        <span className="text-muted-foreground">{artist.play_count} раз</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        
                                        {historyStats.topGenres.length > 0 && (
                                            <div className="mt-4 pt-4 border-t border-border/50">
                                                <div className="text-sm font-medium mb-2">Любимые жанры</div>
                                                {historyStats.topGenres.map(genre => (
                                                    <div key={genre.genre} className="flex justify-between text-sm py-1">
                                                        <span>{genre.genre}</span>
                                                        <span className="text-muted-foreground">{genre.play_count} раз</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    
                                    {historyStats.last7Days.length > 0 && (
                                        <div className="rounded-2xl bg-card border border-border/50 p-6">
                                            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                                <Calendar className="w-5 h-5 text-primary" />
                                                Активность за неделю
                                            </h2>
                                            <div className="space-y-3">
                                                {historyStats.last7Days.map(day => (
                                                    <div key={day.date} className="flex items-center gap-3">
                                                        <span className="text-sm w-24 text-muted-foreground capitalize">
                                                            {format(new Date(day.date), "EEEE", { locale: ru })}
                                                        </span>
                                                        <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                                                            <div 
                                                                className="h-full bg-primary rounded-full transition-all duration-500" 
                                                                style={{ 
                                                                    width: `${(day.plays / Math.max(...historyStats.last7Days.map(d => d.plays), 1)) * 100}%` 
                                                                }}
                                                            />
                                                        </div>
                                                        <span className="text-sm font-medium w-8 text-right">{day.plays}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Список прослушиваний */}
                            {history.length === 0 ? (
                                <div className="text-center py-12 rounded-2xl bg-card border border-border/50">
                                    <Music2 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                                    <p className="text-muted-foreground">Вы ещё не слушали треки</p>
                                    <Button 
                                        variant="outline" 
                                        className="mt-4 rounded-full"
                                        onClick={() => setViewMode('profile')}
                                    >
                                        <ArrowLeft className="w-4 h-4 mr-2" />
                                        Вернуться в профиль
                                    </Button>
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
                                                    <span>{formatTrackDuration(item.duration)}</span>
                                                </div>
                                            </div>
                                            <div className="text-xs text-muted-foreground whitespace-nowrap">
                                                {formatHistoryDate(item.played_at)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </Layout>
        );
    }

    // ============ РЕЖИМ ПРОФИЛЯ ============
    return (
        <Layout>
            <div className="max-w-6xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
                
                {/* ===== HEADER ===== */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-card via-card to-secondary/20 border border-border/50 p-8 md:p-10">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
                    
                    <div className="relative flex flex-col md:flex-row items-center md:items-start gap-8">
                       
                        {/* Аватар */}
                        <div className="relative group">
                            <div className="w-36 h-36 md:w-44 md:h-44 rounded-full overflow-hidden border-4 border-background shadow-2xl bg-gradient-to-br from-primary/30 to-accent/30">
                                {avatarPreview ? (
                                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <User className="w-20 h-20 text-white/60" />
                                    </div>
                                )}
                            </div>
                            
                            <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-2.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                                    disabled={uploadingAvatar}
                                >
                                    <Camera className="w-5 h-5 text-white" />
                                </button>
                                {avatarPreview && (
                                    <button
                                        onClick={handleDeleteAvatar}
                                        className="p-2.5 rounded-full bg-white/20 hover:bg-rose-500/80 transition-colors"
                                    >
                                        <Trash2 className="w-5 h-5 text-white" />
                                    </button>
                                )}
                            </div>
                            
                            {uploadingAvatar && (
                                <div className="absolute inset-0 rounded-full bg-black/70 flex items-center justify-center">
                                    <Loader2 className="w-8 h-8 animate-spin text-white" />
                                </div>
                            )}
                            
                            <div className="absolute bottom-2 right-2 w-5 h-5 bg-emerald-500 border-4 border-background rounded-full" />
                            
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleAvatarUpload}
                                disabled={uploadingAvatar}
                            />
                        </div>
                       
                        {/* Информация */}
                        <div className="flex-1 text-center md:text-left space-y-4">
                            {isEditing ? (
                                <div className="space-y-4 max-w-md">
                                    <div className="flex gap-3 justify-center md:justify-start">
                                        <Input
                                            value={firstName}
                                            onChange={(e) => setFirstName(e.target.value)}
                                            placeholder="Имя"
                                            className="bg-background/80 border-border/50"
                                        />
                                        <Input
                                            value={lastName}
                                            onChange={(e) => setLastName(e.target.value)}
                                            placeholder="Фамилия"
                                            className="bg-background/80 border-border/50"
                                        />
                                    </div>
                                    <div className="flex gap-2 justify-center md:justify-start">
                                        <Button onClick={handleSaveProfile} disabled={isSaving} className="rounded-full">
                                            <Save className="w-4 h-4 mr-2" />
                                            {isSaving ? 'Сохранение...' : 'Сохранить'}
                                        </Button>
                                        <Button 
                                            onClick={handleCancelEdit}
                                            variant="outline" 
                                            className="rounded-full"
                                        >
                                            <X className="w-4 h-4 mr-2" />
                                            Отмена
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-1">
                                            {displayName} {user?.lastName || ''}
                                        </h1>
                                        <p className="text-muted-foreground text-lg">{user?.email}</p>
                                    </div>
                                    
                                    <div className="flex flex-wrap justify-center md:justify-start gap-2">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                                            <Award className="w-3.5 h-3.5" />
                                            {daysSinceJoin > 30 ? `${Math.floor(daysSinceJoin / 30)} мес.` : `${daysSinceJoin} дн.`} с нами
                                        </span>
                                        {stats.streak > 0 && (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 text-orange-500 text-sm font-medium">
                                                <TrendingUp className="w-3.5 h-3.5" />
                                                Серия {stats.streak} дней
                                            </span>
                                        )}
                                    </div>
                                    
                                    <div className="flex flex-wrap justify-center md:justify-start gap-3 pt-2">
                                        <Button 
                                            variant="outline" 
                                            className="rounded-full border-border/50"
                                            onClick={() => setIsEditing(true)}
                                        >
                                            <Edit2 className="w-4 h-4 mr-2" />
                                            Редактировать
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            onClick={handleLogout} 
                                            className="rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                                        >
                                            Выйти
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* ===== СТАТИСТИКА ===== */}
                <div>
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                        <Activity className="w-6 h-6 text-primary" />
                        Ваша статистика
                    </h2>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard 
                            icon={<Music2 className="w-6 h-6" />} 
                            label="Создано треков" 
                            value={stats.generatedTracks} 
                            loading={isLoading}
                            color="from-blue-500/20 to-blue-600/10"
                            iconColor="text-blue-400"
                        />
                        <StatCard 
                            icon={<Heart className="w-6 h-6" />} 
                            label="В избранном" 
                            value={stats.favorites} 
                            loading={isLoading}
                            color="from-rose-500/20 to-rose-600/10"
                            iconColor="text-rose-400"
                        />
                        <StatCard 
                            icon={<ListMusic className="w-6 h-6" />} 
                            label="Плейлистов" 
                            value={stats.playlists} 
                            loading={isLoading}
                            color="from-amber-500/20 to-amber-600/10"
                            iconColor="text-amber-400"
                        />
                        <StatCard 
                            icon={<Headphones className="w-6 h-6" />} 
                            label="Прослушиваний" 
                            value={stats.totalPlays} 
                            loading={isLoading}
                            color="from-emerald-500/20 to-emerald-600/10"
                            iconColor="text-emerald-400"
                        />
                    </div>
                </div>

                {/* ===== ДОП. МЕТРИКИ ===== */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <MetricCard 
                        icon={<Clock className="w-5 h-5" />}
                        label="Время прослушивания"
                        value={formatDuration(stats.listeningTime)}
                        subtext="За всё время"
                    />
                    <MetricCard 
                        icon={<TrendingUp className="w-5 h-5" />}
                        label="Активность"
                        value={`${stats.streak} дней`}
                        subtext="Подряд слушаете музыку"
                    />
                    <MetricCard 
                        icon={<Music2 className="w-5 h-5" />}
                        label="В среднем"
                        value={stats.totalPlays > 0 ? `${Math.round(stats.totalPlays / Math.max(daysSinceJoin, 1))}` : '0'}
                        subtext="Треков в день"
                    />
                </div>

                {/* ===== ДЕТАЛЬНАЯ СТАТИСТИКА ===== */}
                {listeningStats && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="rounded-3xl bg-card border border-border/50 p-8">
                            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-primary" />
                                Что вы слушаете
                            </h3>
                            
                            {listeningStats.topGenres.length > 0 && (
                                <div className="mb-6">
                                    <div className="text-sm font-medium mb-3 text-muted-foreground">Любимые жанры</div>
                                    <div className="space-y-3">
                                        {listeningStats.topGenres.slice(0, 5).map((genre) => {
                                            const max = Math.max(...listeningStats.topGenres.map(g => g.play_count), 1);
                                            const percent = (genre.play_count / max) * 100;
                                            return (
                                                <div key={genre.genre} className="space-y-1">
                                                    <div className="flex justify-between text-sm">
                                                        <span>{genre.genre}</span>
                                                        <span className="text-muted-foreground">{genre.play_count} раз</span>
                                                    </div>
                                                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                                        <div 
                                                            className="h-full bg-primary rounded-full transition-all duration-500"
                                                            style={{ width: `${percent}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {listeningStats.topArtists.length > 0 && (
                                <div>
                                    <div className="text-sm font-medium mb-3 text-muted-foreground">Любимые исполнители</div>
                                    <div className="space-y-2">
                                        {listeningStats.topArtists.slice(0, 5).map(artist => (
                                            <div key={artist.name} className="flex justify-between items-center p-3 rounded-xl bg-secondary/30">
                                                <span className="font-medium">{artist.name}</span>
                                                <span className="text-sm text-muted-foreground">{artist.play_count} раз</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {Array.isArray(listeningStats.last7Days) && listeningStats.last7Days.length > 0 && (
                            <div className="rounded-3xl bg-card border border-border/50 p-8">
                                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-primary" />
                                    Активность за неделю
                                </h3>
                                <div className="space-y-4">
                                    {listeningStats.last7Days.map(day => {
                                        const maxPlays = Math.max(...listeningStats.last7Days.map(d => d.plays), 1);
                                        const percent = (day.plays / maxPlays) * 100;
                                        return (
                                            <div key={day.date} className="flex items-center gap-4">
                                                <span className="text-sm w-20 text-muted-foreground capitalize">
                                                    {getDayName(day.date)}
                                                </span>
                                                <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-700"
                                                        style={{ width: `${percent}%` }}
                                                    />
                                                </div>
                                                <span className="text-sm font-medium w-8 text-right">{day.plays}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ===== ПРЕДПОЧТЕНИЯ + АКТИВНОСТЬ (КЛИКАБЕЛЬНАЯ) ===== */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* Предпочтения */}
                    <div className="rounded-3xl bg-card border border-border/50 p-8">
                        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <Heart className="w-5 h-5 text-rose-400" />
                            Любимые предпочтения
                        </h3>
                        <div className="space-y-4">
                            <PreferenceRow 
                                label="Любимый жанр"
                                value={stats.favoriteGenre}
                                icon={<Music2 className="w-4 h-4" />}
                                color="bg-blue-500/10 text-blue-400"
                                isLoading={isLoading}
                            />
                            <PreferenceRow 
                                label="Любимое настроение"
                                value={stats.favoriteMood}
                                icon={<Activity className="w-4 h-4" />}
                                color="bg-violet-500/10 text-violet-400"
                                isLoading={isLoading}
                            />
                        </div>
                    </div>
                    
                    {/* Недавняя активность — КЛИКАБЕЛЬНАЯ */}
                    <div 
                        className="rounded-3xl bg-card border border-border/50 p-8 cursor-pointer hover:border-primary/50 hover:shadow-lg transition-all duration-300 group"
                        onClick={fetchHistoryData}
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <Clock className="w-5 h-5 text-primary" />
                                Недавняя активность
                            </h3>
                            <ArrowLeft className="w-5 h-5 text-muted-foreground rotate-180 group-hover:text-primary transition-colors" />
                        </div>
                        
                        <div className="space-y-3">
                            {isLoading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 animate-pulse">
                                        <div className="w-10 h-10 rounded-lg bg-secondary" />
                                        <div className="flex-1 space-y-2">
                                            <div className="h-4 w-32 bg-secondary rounded" />
                                            <div className="h-3 w-20 bg-secondary rounded" />
                                        </div>
                                    </div>
                                ))
                            ) : recentActivity.length > 0 ? (
                                <>
                                    {recentActivity.slice(0, 4).map((activity, index) => (
                                        <div key={index} className="flex items-center gap-3 p-3 rounded-xl group-hover:bg-secondary/20 transition-colors">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getActivityColor(activity.type)}`}>
                                                {getActivityIcon(activity.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium truncate">{activity.title}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {activity.details && `${activity.details} • `}
                                                    {formatRelativeTime(activity.timestamp)}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="text-center pt-2">
                                        <span className="text-sm text-primary font-medium group-hover:underline">
                                            Смотреть всю историю →
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                    <p>Пока нет активности</p>
                                    <p className="text-sm mt-1">Нажмите, чтобы открыть историю</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ===== ИНФОРМАЦИЯ ОБ АККАУНТЕ ===== */}
                <div className="rounded-3xl bg-card border border-border/50 p-8">
                    <h3 className="text-xl font-bold mb-6">Информация об аккаунте</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <InfoRow label="Дата регистрации" value={formatDate(stats.memberSince)} />
                        <InfoRow label="Подписка" value={
                            <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                                Бесплатная
                            </span>
                        } />
                        <InfoRow label="Статус" value={
                            <span className="inline-flex items-center gap-1.5 text-emerald-400">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                Активен
                            </span>
                        } />
                    </div>
                </div>
            </div>
        </Layout>
    );
}

// ============ ПОДКОМПОНЕНТЫ ============

function StatCard({ 
    icon, 
    label, 
    value, 
    loading,
    color = "from-primary/20 to-primary/10",
    iconColor = "text-primary"
}: { 
    icon: React.ReactNode; 
    label: string; 
    value: number; 
    loading: boolean;
    color?: string;
    iconColor?: string;
}) {
    return (
        <div className="relative overflow-hidden rounded-2xl bg-card border border-border/50 p-6 flex flex-col items-center justify-center text-center gap-3 hover:scale-[1.02] hover:shadow-lg transition-all duration-300 group">
            <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-100 transition-opacity`} />
            <div className={`relative w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center ${iconColor}`}>
                {icon}
            </div>
            <div className="relative">
                {loading ? (
                    <div className="h-10 w-20 bg-secondary animate-pulse rounded-lg mx-auto mb-1" />
                ) : (
                    <div className="text-3xl font-bold tabular-nums">{value.toLocaleString('ru-RU')}</div>
                )}
                <div className="text-sm text-muted-foreground font-medium">{label}</div>
            </div>
        </div>
    );
}

function MetricCard({ icon, label, value, subtext }: { 
    icon: React.ReactNode; 
    label: string; 
    value: string; 
    subtext: string;
}) {
    return (
        <div className="rounded-2xl bg-card border border-border/50 p-6 flex items-center gap-4 hover:border-primary/30 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-primary shrink-0">
                {icon}
            </div>
            <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{subtext}</p>
            </div>
        </div>
    );
}

function PreferenceRow({ label, value, icon, color, isLoading }: {
    label: string;
    value: string;
    icon: React.ReactNode;
    color: string;
    isLoading: boolean;
}) {
    return (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-secondary/30 border border-border/30 hover:bg-secondary/50 transition-colors">
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                    {icon}
                </div>
                <span className="text-muted-foreground">{label}</span>
            </div>
            {isLoading ? (
                <div className="h-6 w-32 bg-secondary animate-pulse rounded-md" />
            ) : (
                <span className="font-bold text-foreground">{value}</span>
            )}
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5 p-4 rounded-2xl bg-secondary/30">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="font-medium">{value}</span>
        </div>
    );
}