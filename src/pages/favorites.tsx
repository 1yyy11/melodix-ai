// import { Layout } from "@/components/layout";
// import { useGetFavorites } from "@workspace/api-client-react";
// import { TrackCard } from "@/components/tracks/track-card";
// import { Heart } from "lucide-react";
// import { useAuth } from "@/contexts/AuthContext";
// import { Link } from "wouter";
// import { Button } from "@/components/ui/button";

// export default function Favorites() {
//   const { isAuthenticated, login } = useAuth();
//   const { data, isLoading } = useGetFavorites({
//     query: { enabled: isAuthenticated }
//   });

//   if (!isAuthenticated) {
//     return (
//       <Layout>
//         <div className="h-[80vh] flex flex-col items-center justify-center text-center max-w-md mx-auto">
//           <Heart className="w-24 h-24 text-muted-foreground/30 mb-6" />
//           <h1 className="text-3xl font-display font-bold mb-4">Your Favorites</h1>
//           <p className="text-muted-foreground mb-8">Sign in to see the tracks you've loved.</p>
//           <Button onClick={() => login()} size="lg" className="rounded-full px-8">Sign In</Button>
//         </div>
//       </Layout>
//     );
//   }

//   return (
//     <Layout>
//       <div className="space-y-8 pb-20">
//         <div className="flex items-end gap-6 bg-gradient-to-r from-primary/20 to-transparent p-8 rounded-3xl border border-primary/20">
//           <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-2xl shadow-primary/30 shrink-0">
//             <Heart className="w-12 h-12 text-white" fill="currentColor" />
//           </div>
//           <div className="pb-2">
//             <p className="text-primary font-semibold uppercase tracking-wider text-sm mb-1">Playlist</p>
//             <h1 className="text-5xl font-display font-bold mb-2 text-foreground">Liked Tracks</h1>
//             <p className="text-muted-foreground font-medium">{data?.tracks.length || 0} songs</p>
//           </div>
//         </div>

//         {isLoading ? (
//           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
//             {[1,2,3,4].map(i => (
//               <div key={i} className="bg-card rounded-2xl p-4 animate-pulse h-64 border border-border/50"></div>
//             ))}
//           </div>
//         ) : data?.tracks.length === 0 ? (
//           <div className="flex flex-col items-center justify-center py-20 text-center glass-card rounded-3xl">
//             <Heart className="w-16 h-16 text-muted-foreground/30 mb-6" />
//             <h3 className="text-2xl font-bold mb-2">No favorites yet</h3>
//             <p className="text-muted-foreground max-w-md mx-auto mb-8">Find tracks you like in your library and click the heart icon to add them here.</p>
//             <Link href="/library">
//               <Button size="lg" className="rounded-full shadow-lg">Browse Library</Button>
//             </Link>
//           </div>
//         ) : (
//           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
//             {data?.tracks.map(track => (
//               <TrackCard key={track.id} track={track} queueContext={data.tracks} />
//             ))}
//           </div>
//         )}
//       </div>
//     </Layout>
//   );
// }


import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Heart, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Track {
  id: string;
  title: string;
  artist?: string;
  artist_name?: string;
  audio_url?: string;
  cover_url?: string;
  duration?: number;
}

export default function Favorites() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [favorites, setFavorites] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchFavorites();
  }, [token]);

  const fetchFavorites = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/favorites', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setFavorites(data);
      } else {
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить избранное",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error fetching favorites:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить избранное",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveFavorite = async (trackId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/favorites/${trackId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setFavorites(favorites.filter(track => track.id !== trackId));
        toast({
          title: "Успех",
          description: "Трек удален из избранного",
        });
      } else {
        throw new Error('Failed to remove favorite');
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить трек из избранного",
        variant: "destructive",
      });
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Избранное</h1>
          <p className="text-gray-400 mt-1">
            {favorites.length} {favorites.length === 1 ? 'трек' : 'треков'}
          </p>
        </div>

        {favorites.length === 0 ? (
          <div className="text-center py-12 bg-gray-800/30 rounded-lg border border-gray-700">
            <Heart className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">Нет избранных треков</h3>
            <p className="text-gray-400 mb-4">Добавьте треки в избранное, чтобы они появились здесь</p>
            <Link href="/">
              <Button variant="outline" className="border-gray-600 text-white hover:bg-gray-700">
                Найти музыку
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {favorites.map((track) => (
              <div key={track.id} className="bg-gray-800/50 rounded-lg border border-gray-700 p-4 hover:bg-gray-800 transition group">
                <div className="flex gap-4">
                  {/* Обложка */}
                  <div className="relative w-16 h-16 bg-gray-700 rounded-md overflow-hidden flex-shrink-0">
                    {track.cover_url ? (
                      <img 
                        src={track.cover_url} 
                        alt={track.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                        <span className="text-2xl">🎵</span>
                      </div>
                    )}
                  </div>

                  {/* Информация о треке */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium truncate">{track.title}</h3>
                    <p className="text-gray-400 text-sm truncate">{track.artist_name || track.artist || "Unknown Artist"}</p>
                    <p className="text-gray-500 text-xs mt-1">{formatDuration(track.duration)}</p>
                  </div>

                  {/* Кнопка удаления из избранного */}
                  <button
                    onClick={() => handleRemoveFavorite(track.id)}
                    className="p-2 rounded-full hover:bg-gray-700 transition"
                  >
                    <Heart className="w-5 h-5 fill-red-500 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}