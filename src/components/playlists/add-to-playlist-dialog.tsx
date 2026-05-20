import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { ListMusic, Loader2, Plus } from 'lucide-react';

interface Playlist {
  id: string;
  name: string;
  description?: string;
}

interface AddToPlaylistDialogProps {
  trackId: string;
  trackTitle: string;
  trigger: React.ReactNode;
}

const API_URL = "http://localhost:3001/api";

export function AddToPlaylistDialog({ trackId, trackTitle, trigger }: AddToPlaylistDialogProps) {
  const { token } = useAuth();
  const { toast } = useToast();
  
  const [isOpen, setIsOpen] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const loadedRef = useRef(false);

  // ✅ Мемоизируем authFetch с зависимостью от token
  const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    return fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  }, [token]);

  // ✅ Загружаем плейлисты только при открытии диалога
  const loadPlaylists = useCallback(async () => {
    if (loadedRef.current && isOpen) return; // Если уже загружены и диалог открыт — не перезагружаем

    setIsLoading(true);
    try {
      const res = await authFetch(`${API_URL}/playlists`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const data = await res.json();
      setPlaylists(Array.isArray(data) ? data : []);
      loadedRef.current = true;
      
      console.log('✅ Плейлисты загружены:', data);
    } catch (error) {
      console.error('Error loading playlists:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить плейлисты",
        variant: "destructive",
      });
      setPlaylists([]);
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, isOpen, toast]);

  // ✅ Загружаем плейлисты при открытии диалога
  useEffect(() => {
    if (isOpen) {
      loadPlaylists();
    }
  }, [isOpen, loadPlaylists]);

  // Фильтруем плейлисты по поиску
  const filteredPlaylists = playlists.filter(pl =>
    pl.name.toLowerCase().includes(search.toLowerCase())
  );

  // ✅ Добавляем трек в плейлист
  const handleAddToPlaylist = async (playlistId: string) => {
    setIsAdding(playlistId);
    try {
      const res = await authFetch(`${API_URL}/playlists/${playlistId}/tracks`, {
        method: 'POST',
        body: JSON.stringify({ trackId }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to add track');
      }

      toast({
        title: "Успех",
        description: `"${trackTitle}" добавлен в плейлист`,
      });

      // Обновляем список плейлистов (перезагружаем)
      loadedRef.current = false;
      await loadPlaylists();
    } catch (error) {
      console.error('Error adding track to playlist:', error);
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось добавить трек",
        variant: "destructive",
      });
    } finally {
      setIsAdding(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="bg-card border-border/50">
        <DialogHeader>
          <DialogTitle>Добавить в плейлист</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Поиск */}
          <div className="relative">
            <Input
              placeholder="Поиск плейлиста..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-secondary border-border/50"
            />
          </div>

          {/* Список плейлистов */}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : filteredPlaylists.length === 0 ? (
              <div className="text-center py-8">
                <ListMusic className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  {playlists.length === 0 ? 'Нет плейлистов' : 'Плейлисты не найдены'}
                </p>
              </div>
            ) : (
              filteredPlaylists.map((playlist) => (
                <button
                  key={playlist.id}
                  onClick={() => handleAddToPlaylist(playlist.id)}
                  disabled={isAdding === playlist.id}
                  className="w-full text-left p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <ListMusic className="w-4 h-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{playlist.name}</div>
                        {playlist.description && (
                          <div className="text-xs text-muted-foreground truncate">
                            {playlist.description}
                          </div>
                        )}
                      </div>
                    </div>
                    {isAdding === playlist.id && (
                      <Loader2 className="w-4 h-4 animate-spin text-primary ml-2" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Создать новый плейлист (опционально) */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setIsOpen(false);
              // Перенаправляем в плейлисты если нужно создать новый
              window.location.href = '/playlists';
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Создать новый плейлист
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}