import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Check, Loader2, ListMusic } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Playlist {
  id: string;
  name: string;
  description?: string;
}

interface AddToPlaylistDialogProps {
  trackId: string;
  trackTitle: string;
  trigger?: React.ReactNode;
}

export function AddToPlaylistDialog({ trackId, trackTitle, trigger }: AddToPlaylistDialogProps) {
  const { token } = useAuth();
  const { toast } = useToast();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [addingTo, setAddingTo] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchPlaylists();
    }
  }, [isOpen]);

  const fetchPlaylists = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/playlists', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setPlaylists(data);
      }
    } catch (error) {
      console.error('Error fetching playlists:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addToPlaylist = async (playlistId: string) => {
    setAddingTo(playlistId);
    try {
      const response = await fetch(`http://localhost:3001/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ trackId }),
      });

      if (response.ok) {
        toast({
          title: "Успех!",
          description: `"${trackTitle}" добавлен в плейлист`,
        });
        setIsOpen(false);
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add');
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось добавить трек в плейлист",
        variant: "destructive",
      });
    } finally {
      setAddingTo(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
            <Plus className="w-4 h-4 mr-1" />
            В плейлист
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-gray-900 border-gray-700 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white text-xl">Добавить в плейлист</DialogTitle>
        </DialogHeader>
        
        <div className="mt-2">
          <p className="text-gray-400 text-sm mb-4">
            Добавить трек <span className="text-white font-medium">"{trackTitle}"</span> в плейлист:
          </p>
          
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : playlists.length === 0 ? (
            <div className="text-center py-8">
              <ListMusic className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400 mb-4">У вас нет плейлистов</p>
              <Button onClick={() => {
                setIsOpen(false);
                window.location.href = '/playlists';
              }}>
                Создать плейлист
              </Button>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {playlists.map((playlist) => (
                <button
                  key={playlist.id}
                  onClick={() => addToPlaylist(playlist.id)}
                  disabled={addingTo === playlist.id}
                  className="w-full text-left p-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition-all flex items-center justify-between group"
                >
                  <div className="flex-1">
                    <p className="text-white font-medium">{playlist.name}</p>
                    {playlist.description && (
                      <p className="text-gray-400 text-sm line-clamp-1">{playlist.description}</p>
                    )}
                  </div>
                  {addingTo === playlist.id ? (
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  ) : (
                    <Plus className="w-5 h-5 text-gray-500 group-hover:text-primary transition-colors" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}