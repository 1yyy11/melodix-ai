import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/contexts/AuthContext";
import { User, Activity, Music2, ListMusic, Heart, Loader2, Edit2, Save, X, Camera, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { api } from '../services/api';

interface UserStats {
    generatedTracks: number;
    favorites: number;
    playlists: number;
    totalPlays: number;
    favoriteGenre?: string;
    favoriteMood?: string;
    memberSince?: string;
}
const API_URL = "http://localhost:3001/api";
export default function Profile() {
    const { user, token, isAuthenticated, logout, updateProfile } = useAuth();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [stats, setStats] = useState<UserStats>({
        generatedTracks: 0,
        favorites: 0,
        playlists: 0,
        totalPlays: 0,
        favoriteGenre: 'Недостаточно данных',
        favoriteMood: 'Недостаточно данных',
        memberSince: new Date().toISOString()
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [firstName, setFirstName] = useState(user?.firstName || '');
    const [lastName, setLastName] = useState(user?.lastName || '');
    const [isSaving, setIsSaving] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [avatarPreview, setAvatarPreview] = useState(user?.profileImageUrl || '');

    useEffect(() => {
        if (isAuthenticated && token) {
            fetchUserStats();
        }
    }, [isAuthenticated, token]);

    // Функция для авторизованных запросов с credentials
    const authFetch = async (url: string, options: RequestInit = {}) => {
        return fetch(url, {
            ...options,
            credentials: 'include',  // ✅ отправляем cookies
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                ...options.headers,
            },
        });
    };

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
            const response = await fetch('http://localhost:3001/api/user/avatar', {
                method: 'POST',
                credentials: 'include',  // ✅ для cookies
                headers: {
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                },
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
            const response = await fetch('http://localhost:3001/api/user/avatar', {
                method: 'DELETE',
                credentials: 'include',  // ✅ для cookies
                headers: {
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                },
            });
            if (!response.ok) throw new Error('Delete failed');
            setAvatarPreview('');
            if (updateProfile) await updateProfile({ profileImageUrl: '' });
            toast({ title: "Успех", description: "Аватар удалён" });
        } catch (error) {
            toast({ title: "Ошибка", description: "Не удалось удалить аватар", variant: "destructive" });
        }
    };

    const fetchUserStats = async () => {
        setIsLoading(true);
        try {
            // Получаем статистику пользователя
            const statsResponse = await authFetch('http://localhost:3001/api/user/stats');
            
            if (statsResponse.ok) {
                const statsData = await statsResponse.json();
                setStats(prev => ({
                    ...prev,
                    generatedTracks: statsData.generatedTracks || 0,
                    favorites: statsData.favorites || 0,
                    playlists: statsData.playlists || 0,
                    totalPlays: statsData.totalPlays || 0
                }));
            }

            // Получаем предпочтения пользователя
            const prefsResponse = await authFetch('http://localhost:3001/api/user/preferences');
            
            if (prefsResponse.ok) {
                const prefsData = await prefsResponse.json();
                if (prefsData.preferred_genres && prefsData.preferred_genres.length > 0) {
                    setStats(prev => ({ ...prev, favoriteGenre: prefsData.preferred_genres[0] }));
                }
                if (prefsData.preferred_moods && prefsData.preferred_moods.length > 0) {
                    setStats(prev => ({ ...prev, favoriteMood: prefsData.preferred_moods[0] }));
                }
            }

            // Получаем дату регистрации пользователя
            const userResponse = await authFetch('http://localhost:3001/api/user');
            
            if (userResponse.ok) {
                const userData = await userResponse.json();
                if (userData.createdAt) {
                    setStats(prev => ({ ...prev, memberSince: userData.createdAt }));
                }
            }

        } catch (error) {
            console.error('Error fetching user stats:', error);
            toast({
                title: "Ошибка",
                description: "Не удалось загрузить статистику",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveProfile = async () => {
        setIsSaving(true);
        try {
            await updateProfile({ firstName, lastName });
            setIsEditing(false);
            toast({ title: "Успех", description: "Профиль обновлён" });
        } catch (error) {
            toast({ title: "Ошибка", description: "Не удалось обновить профиль", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

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

    const handleLogout = () => {
        logout();
        window.location.href = '/login';
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'Недавно';
        try {
            return format(new Date(dateString), 'MMMM yyyy', { locale: ru });
        } catch {
            return 'Недавно';
        }
    };

    return (
        <Layout>
            <div className="max-w-5xl mx-auto space-y-10 pb-20">
                
                {/* Header */}
                <div className="glass-card rounded-3xl p-8 md:p-12 flex flex-col md:flex-row items-center md:items-start gap-8 relative overflow-hidden">
                   
                    {/* Аватар с возможностью загрузки */}
                    <div className="relative z-10 w-32 h-32 md:w-40 md:h-40 rounded-full bg-secondary border-4 border-background overflow-hidden shrink-0 shadow-2xl group">
                        {avatarPreview ? (
                            <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/40 to-accent/40">
                                <User className="w-16 h-16 text-white/80" />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="p-2 rounded-full bg-white/20 hover:bg-white/30"
                                disabled={uploadingAvatar}
                            >
                                <Camera className="w-6 h-6 text-white" />
                            </button>
                            {avatarPreview && (
                                <button
                                    onClick={handleDeleteAvatar}
                                    className="p-2 rounded-full bg-white/20 hover:bg-white/30 ml-2"
                                >
                                    <Trash2 className="w-6 h-6 text-white" />
                                </button>
                            )}
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleAvatarUpload}
                            disabled={uploadingAvatar}
                        />
                        {uploadingAvatar && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                <Loader2 className="w-8 h-8 animate-spin text-white" />
                            </div>
                        )}
                    </div>
                   
                    <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-primary/20 via-accent/10 to-background z-0"></div>
                    
                    <div className="relative z-10 text-center md:text-left flex-1 mt-2">
                        {isEditing ? (
                            <div className="space-y-3">
                                <div className="flex gap-3 justify-center md:justify-start">
                                    <Input
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        placeholder="Имя"
                                        className="bg-gray-800 border-gray-700 w-32"
                                    />
                                    <Input
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        placeholder="Фамилия"
                                        className="bg-gray-800 border-gray-700 w-32"
                                    />
                                </div>
                                <div className="flex gap-2 justify-center md:justify-start">
                                    <Button onClick={handleSaveProfile} size="sm" disabled={isSaving}>
                                        <Save className="w-4 h-4 mr-2" />
                                        {isSaving ? 'Сохранение...' : 'Сохранить'}
                                    </Button>
                                    <Button onClick={() => {
                                        setIsEditing(false);
                                        setFirstName(user?.firstName || '');
                                        setLastName(user?.lastName || '');
                                    }} variant="outline" size="sm">
                                        <X className="w-4 h-4 mr-2" />
                                        Отмена
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-2">
                                    {user?.firstName || user?.email?.split('@')[0] || 'Создатель'} {user?.lastName || ''}
                                </h1>
                                <p className="text-muted-foreground text-lg mb-6">{user?.email}</p>
                                <div className="flex flex-wrap justify-center md:justify-start gap-3">
                                    <Button 
                                        variant="outline" 
                                        className="rounded-full border-border/50 bg-background/50 backdrop-blur-sm"
                                        onClick={() => setIsEditing(true)}
                                    >
                                        <Edit2 className="w-4 h-4 mr-2" />
                                        Редактировать
                                    </Button>
                                    <Button 
                                        variant="destructive" 
                                        onClick={handleLogout} 
                                        className="rounded-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-white border-none shadow-none"
                                    >
                                        Выйти
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Stats Grid */}
                <div>
                    <h2 className="text-2xl font-display font-bold mb-6">Ваша статистика</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                        <StatCard 
                            icon={<Music2 className="text-primary" />} 
                            label="Создано треков" 
                            value={stats.generatedTracks} 
                            loading={isLoading} 
                        />
                        <StatCard 
                            icon={<Heart className="text-accent" />} 
                            label="В избранном" 
                            value={stats.favorites} 
                            loading={isLoading} 
                        />
                        <StatCard 
                            icon={<ListMusic className="text-blue-400" />} 
                            label="Плейлистов" 
                            value={stats.playlists} 
                            loading={isLoading} 
                        />
                        <StatCard 
                            icon={<Activity className="text-emerald-400" />} 
                            label="Прослушиваний" 
                            value={stats.totalPlays} 
                            loading={isLoading} 
                        />
                    </div>
                </div>

                {/* Insights */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-secondary/30 rounded-3xl p-8 border border-border/50">
                        <h3 className="text-xl font-bold mb-6">Любимые предпочтения</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-background rounded-2xl border border-border/50">
                                <span className="text-muted-foreground">Любимый жанр</span>
                                <span className="font-bold text-primary">{stats.favoriteGenre || 'Недостаточно данных'}</span>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-background rounded-2xl border border-border/50">
                                <span className="text-muted-foreground">Любимое настроение</span>
                                <span className="font-bold text-accent">{stats.favoriteMood || 'Недостаточно данных'}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-secondary/30 rounded-3xl p-8 border border-border/50">
                        <h3 className="text-xl font-bold mb-6">Информация об аккаунте</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-background rounded-2xl border border-border/50">
                                <span className="text-muted-foreground">Дата регистрации</span>
                                <span className="font-medium text-foreground">
                                    {formatDate(stats.memberSince)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-background rounded-2xl border border-border/50">
                                <span className="text-muted-foreground">Подписка</span>
                                <span className="font-bold bg-primary/20 text-primary px-3 py-1 rounded-full text-xs">Бесплатная</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}

function StatCard({ icon, label, value, loading }: { icon: React.ReactNode; label: string; value: number; loading: boolean }) {
    return (
        <div className="bg-card rounded-3xl p-6 border border-border/50 flex flex-col items-center justify-center text-center gap-3 hover:-translate-y-1 transition-transform shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center">
                {icon}
            </div>
            <div>
                {loading ? (
                    <div className="h-8 w-16 bg-secondary animate-pulse rounded-md mx-auto mb-1"></div>
                ) : (
                    <div className="text-3xl font-display font-bold">{value}</div>
                )}
                <div className="text-sm text-muted-foreground font-medium">{label}</div>
            </div>
        </div>
    );
}