import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { ListMusic, Plus, Music, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface Playlist {
  id: string;
  name: string;
  description?: string;
  cover_url?: string;
  tracks_count?: number;
  created_at: string;
}

const API_URL = "http://localhost:3001/api";

export default function Playlists() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newPlaylistDescription, setNewPlaylistDescription] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // =========================================================
  // SAFE FETCH (session-based)
  // =========================================================
  const api = async (url: string, options: RequestInit = {}) => {
    const res = await fetch(url, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    let data: any = null;
    const text = await res.text();

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      const msg = data?.error || "Request failed";
      if (res.status === 401) {
        throw new Error("UNAUTHORIZED");
      }
      throw new Error(msg);
    }

    return data;
  };

  // =========================================================
  // LOAD PLAYLISTS
  // =========================================================
  const fetchPlaylists = async () => {
    setIsLoading(true);
    try {
      const data = await api(`${API_URL}/playlists`);
      setPlaylists(data || []);
    } catch (error: any) {
      if (error.message === "UNAUTHORIZED") {
        console.warn("⚠️ Не авторизован");
        setPlaylists([]);
      } else {
        console.error('Error fetching playlists:', error);
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить плейлисты",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // =========================================================
  // CREATE PLAYLIST
  // =========================================================
  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите название плейлиста",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const newPlaylist = await api(`${API_URL}/playlists`, {
        method: 'POST',
        body: JSON.stringify({
          name: newPlaylistName,
          description: newPlaylistDescription,
        }),
      });

      setPlaylists([newPlaylist, ...playlists]);
      setNewPlaylistName("");
      setNewPlaylistDescription("");
      setIsDialogOpen(false);
      toast({
        title: "Успех",
        description: "Плейлист создан",
      });
    } catch (error) {
      console.error('Error creating playlist:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось создать плейлист",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  // =========================================================
  // INIT
  // =========================================================
  useEffect(() => {
    if (!authLoading && user) {
      fetchPlaylists();
    } else if (!authLoading && !user) {
      setIsLoading(false);
    }
  }, [authLoading, user]);

  // =========================================================
  // LOADING STATE
  // =========================================================
  if (authLoading || isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
          <ListMusic className="w-24 h-24 text-gray-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Войдите в аккаунт</h2>
          <p className="text-gray-400 mb-6">Чтобы управлять плейлистами</p>
        </div>
      </Layout>
    );
  }

  // =========================================================
  // UI
  // =========================================================
  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Плейлисты</h1>
            <p className="text-gray-400 mt-1">Управляйте своими плейлистами</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" />
                Создать плейлист
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-900 border-gray-700" aria-describedby="playlist-dialog-description">
              <DialogHeader>
                <DialogTitle className="text-white">Создать плейлист</DialogTitle>
                <div id="playlist-dialog-description" className="sr-only">
                  Заполните форму для создания нового плейлиста
                </div>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="text-sm text-gray-300 block mb-2">Название</label>
                  <Input
                    placeholder="Название плейлиста"
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-300 block mb-2">Описание (необязательно)</label>
                  <Textarea
                    placeholder="Описание плейлиста"
                    value={newPlaylistDescription}
                    onChange={(e) => setNewPlaylistDescription(e.target.value)}
                    className="bg-gray-800 border-gray-700 text-white"
                    rows={3}
                  />
                </div>
                <Button 
                  onClick={handleCreatePlaylist} 
                  disabled={isCreating}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Создание...
                    </>
                  ) : (
                    'Создать'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {playlists.length === 0 ? (
          <div className="text-center py-12 bg-gray-800/30 rounded-lg border border-gray-700">
            <ListMusic className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">Нет плейлистов</h3>
            <p className="text-gray-400 mb-4">Создайте свой первый плейлист</p>
            <Button 
              onClick={() => setIsDialogOpen(true)}
              variant="outline"
              className="border-gray-600 text-white hover:bg-gray-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Создать плейлист
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {playlists.map((playlist) => (
              <div
                key={playlist.id}
                className="bg-gray-800/50 rounded-lg border border-gray-700 p-4 hover:bg-gray-800 transition cursor-pointer"
                onClick={() => setLocation(`/playlist/${playlist.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="bg-primary/20 p-3 rounded-lg">
                    <ListMusic className="w-8 h-8 text-primary" />
                  </div>
                  <span className="text-xs text-gray-400">
                    {playlist.tracks_count || 0} треков
                  </span>
                </div>
                <h3 className="text-white font-medium mb-1">{playlist.name}</h3>
                {playlist.description && (
                  <p className="text-gray-400 text-sm line-clamp-2">{playlist.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}