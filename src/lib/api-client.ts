import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Базовые типы (соответствуют вашей БД)
export interface Track {
  id: string;
  title: string;
  artist_id?: string;
  audio_url?: string;
  audioUrl?: string;
  cover_url?: string;
  coverUrl?: string;
  lyrics?: string;
  duration?: number;
  play_count?: number;
  created_at?: string;
  isFavorite?: boolean;
  genre?: string;
  mood?: string;
  tempo?: number;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  user_id?: string;
  created_at?: string;
  tracks?: Track[];
}

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
}

// API функции
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

const api = {
  async request(endpoint: string, options?: RequestInit) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'API request failed');
    }
    
    return response.json();
  },

  // Авторизация
  async login(email: string, password: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async register(email: string, password: string, name?: string) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  },

  async logout() {
    return this.request('/auth/logout', { method: 'POST' });
  },

  async getCurrentUser() {
    return this.request('/user');
  },

  // Треки
  async getTracks(): Promise<Track[]> {
    const data = await this.request('/tracks');
    // Преобразуем snake_case в camelCase для фронта
    return data.map((track: any) => ({
      id: track.id,
      title: track.title,
      artist_id: track.artist_id,
      audioUrl: track.audio_url || track.audioUrl,
      coverUrl: track.cover_url || track.coverUrl,
      lyrics: track.lyrics,
      duration: track.duration,
      play_count: track.play_count,
      created_at: track.created_at,
      isFavorite: false,
    }));
  },

  async getTrack(id: string): Promise<Track> {
    const track = await this.request(`/tracks/${id}`);
    return {
      id: track.id,
      title: track.title,
      artist_id: track.artist_id,
      audioUrl: track.audio_url,
      coverUrl: track.cover_url,
      lyrics: track.lyrics,
      duration: track.duration,
      play_count: track.play_count,
      created_at: track.created_at,
      isFavorite: false,
    };
  },

  // Избранное
  async getFavorites(userId?: string): Promise<Track[]> {
    const url = userId ? `/favorites?userId=${userId}` : '/favorites';
    const data = await this.request(url);
    return data.map((track: any) => ({
      id: track.id,
      title: track.title,
      artist_id: track.artist_id,
      audioUrl: track.audio_url,
      coverUrl: track.cover_url,
      duration: track.duration,
      isFavorite: true,
    }));
  },

  async addFavorite(trackId: string, userId?: string): Promise<void> {
    await this.request('/favorites', {
      method: 'POST',
      body: JSON.stringify({ trackId, userId }),
    });
  },

  async removeFavorite(trackId: string, userId?: string): Promise<void> {
    const url = userId ? `/favorites/${trackId}?userId=${userId}` : `/favorites/${trackId}`;
    await this.request(url, { method: 'DELETE' });
  },

  // Плейлисты
  async getPlaylists(userId?: string): Promise<Playlist[]> {
    const url = userId ? `/playlists?userId=${userId}` : '/playlists';
    const data = await this.request(url);
    return data.map((playlist: any) => ({
      ...playlist,
      tracks: playlist.tracks?.map((track: any) => ({
        id: track.id,
        title: track.title,
        artist_id: track.artist_id,
        audioUrl: track.audio_url,
        coverUrl: track.cover_url,
        duration: track.duration,
      })) || [],
    }));
  },

  async createPlaylist(name: string, userId?: string): Promise<Playlist> {
    return this.request('/playlists', {
      method: 'POST',
      body: JSON.stringify({ name, userId }),
    });
  },

  // Генерация трека
  async generateTrack(params: {
    genre: string;
    mood: string;
    tempo?: number;
    instruments?: string[];
    prompt?: string;
    userId?: string;
  }): Promise<Track> {
    const track = await this.request('/generate', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return {
      id: track.id,
      title: track.title,
      genre: track.genre,
      mood: track.mood,
      tempo: track.tempo,
      duration: track.duration,
      created_at: track.created_at,
    };
  },

  // История прослушиваний
  async addPlay(trackId: string, userId?: string): Promise<void> {
    await this.request('/plays', {
      method: 'POST',
      body: JSON.stringify({ trackId, userId }),
    });
  },

  // Получение текста песни
  async getLyrics(artist: string, title: string): Promise<{ lyrics: string | null }> {
    try {
      const response = await this.request(`/lyrics?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`);
      return response;
    } catch (error) {
      console.error('Error fetching lyrics:', error);
      return { lyrics: null };
    }
  },
};

// ============= REACT QUERY ХУКИ =============

// Треки
export const useGetTracks = () => useQuery({
  queryKey: ['tracks'],
  queryFn: () => api.getTracks(),
});

export const useGetTrack = (id: string) => useQuery({
  queryKey: ['track', id],
  queryFn: () => api.getTrack(id),
  enabled: !!id,
});

// Избранное
export const useGetFavorites = (userId?: string) => useQuery({
  queryKey: ['favorites', userId],
  queryFn: () => api.getFavorites(userId),
});

export const useAddFavorite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ trackId, userId }: { trackId: string; userId?: string }) =>
      api.addFavorite(trackId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      queryClient.invalidateQueries({ queryKey: ['tracks'] });
    },
  });
};

export const useRemoveFavorite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ trackId, userId }: { trackId: string; userId?: string }) =>
      api.removeFavorite(trackId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      queryClient.invalidateQueries({ queryKey: ['tracks'] });
    },
  });
};

// Плейлисты
export const useGetPlaylists = (userId?: string) => useQuery({
  queryKey: ['playlists', userId],
  queryFn: () => api.getPlaylists(userId),
});

export const useCreatePlaylist = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, userId }: { name: string; userId?: string }) =>
      api.createPlaylist(name, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
    },
  });
};

// Генерация
export const useGenerateTrack = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      genre: string;
      mood: string;
      tempo?: number;
      instruments?: string[];
      prompt?: string;
      userId?: string;
    }) => api.generateTrack(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracks'] });
    },
  });
};

// История прослушиваний
export const useAddPlay = () => {
  return useMutation({
    mutationFn: ({ trackId, userId }: { trackId: string; userId?: string }) =>
      api.addPlay(trackId, userId),
  });
};

// Текст песни
export const useGetLyrics = (artist: string, title: string) => useQuery({
  queryKey: ['lyrics', artist, title],
  queryFn: () => api.getLyrics(artist, title),
  enabled: !!(artist && title),
});

// Авторизация
export const useLogin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      api.login(email, password),
    onSuccess: (data) => {
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
        queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      }
    },
  });
};

export const useRegister = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password, name }: { email: string; password: string; name?: string }) =>
      api.register(email, password, name),
    onSuccess: (data) => {
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
        queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      }
    },
  });
};

export const useGetCurrentUser = () => useQuery({
  queryKey: ['currentUser'],
  queryFn: () => api.getCurrentUser(),
  retry: false,
});

export const useLogout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () => {
      localStorage.removeItem('user');
      queryClient.clear();
    },
  });
};

// Профиль (адаптер для совместимости)
export const useGetProfile = () => {
  const { data: user, ...rest } = useGetCurrentUser();
  return {
    data: user,
    ...rest,
  };
};

export const useUpdateProfile = () => {
  return useMutation({
    mutationFn: (data: Partial<User>) => {
      // TODO: реализовать эндпоинт обновления профиля на бэкенде
      console.log('Update profile:', data);
      return Promise.resolve(data);
    },
  });
};

// Рекомендации (заглушка, можно реализовать позже)
export const useGetRecommendations = () => useQuery({
  queryKey: ['recommendations'],
  queryFn: async () => {
    const tracks = await api.getTracks();
    return tracks.slice(0, 10);
  },
});

// Поиск (заглушка)
export const useSearchTracks = (query: string) => useQuery({
  queryKey: ['search', query],
  queryFn: async () => {
    const tracks = await api.getTracks();
    return tracks.filter(track => 
      track.title.toLowerCase().includes(query.toLowerCase())
    );
  },
  enabled: query.length > 0,
});

// Экспорт типов
export type { Track as TrackType, Playlist as PlaylistType, User as UserType };