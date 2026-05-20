// src/services/api.ts
import { authService } from './auth.service';

const API_URL = 'http://localhost:3001/api';

export const api = {
  // Получить статистику пользователя
  getUserStats: async () => {
    return authService.authFetch(`${API_URL}/user/stats`);
  },
  
  // Получить историю прослушиваний
  getHistory: async () => {
    return authService.authFetch(`${API_URL}/user/history`);
  },
  
  // Получить все треки
  getTracks: async () => {
    return fetch(`${API_URL}/tracks`);
  },
  
  // Получить избранное
  getFavorites: async () => {
    return authService.authFetch(`${API_URL}/favorites`);
  },
  
  // Добавить в избранное
  addToFavorites: async (trackId: string) => {
    return authService.authFetch(`${API_URL}/favorites`, {
      method: 'POST',
      body: JSON.stringify({ trackId })
    });
  },
  
  // Удалить из избранного
  removeFromFavorites: async (trackId: string) => {
    return authService.authFetch(`${API_URL}/favorites/${trackId}`, {
      method: 'DELETE'
    });
  },
  
  // Получить плейлисты
  getPlaylists: async () => {
    return authService.authFetch(`${API_URL}/playlists`);
  },
  
  // Создать плейлист
  createPlaylist: async (name: string, description?: string) => {
    return authService.authFetch(`${API_URL}/playlists`, {
      method: 'POST',
      body: JSON.stringify({ name, description })
    });
  },
  
  // Отправить прослушивание
  addPlay: async (trackId: string) => {
    return authService.authFetch(`${API_URL}/plays`, {
      method: 'POST',
      body: JSON.stringify({ trackId })
    });
  },
  
  // Получить статистику прослушиваний
  getListeningStats: async () => {
    return authService.authFetch(`${API_URL}/user/listening-stats`);
  }
};