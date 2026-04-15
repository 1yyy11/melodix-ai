import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { TrackCard } from "@/components/tracks/track-card";
import { Library as LibraryIcon, Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function Library() {
  const { isAuthenticated } = useAuth();
  const [search, setSearch] = useState("");
  const [tracks, setTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      fetch('/api/tracks')
        .then(res => res.json())
        .then(data => {
          setTracks(Array.isArray(data) ? data : []);
          setIsLoading(false);
        })
        .catch(err => {
          console.error('Error loading tracks:', err);
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Фильтрация треков по поиску
  const filteredTracks = tracks.filter((track: any) =>
    track.title?.toLowerCase().includes(search.toLowerCase()) ||
    track.genre?.toLowerCase().includes(search.toLowerCase())
  );

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="h-[80vh] flex flex-col items-center justify-center text-center max-w-md mx-auto">
          <LibraryIcon className="w-24 h-24 text-muted-foreground/30 mb-6" />
          <h1 className="text-3xl font-display font-bold mb-4">Your Music Library</h1>
          <p className="text-muted-foreground mb-8">Sign in to access your generated tracks, organized exactly how you like them.</p>
          <Link href="/login">
            <Button size="lg" className="rounded-full px-8">Sign In</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8 pb-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-display font-bold flex items-center gap-3">
              <LibraryIcon className="w-8 h-8 text-primary" />
              Library
            </h1>
            <p className="text-muted-foreground mt-2">All your generated tracks in one place.</p>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search tracks..." 
                className="pl-9 bg-card border-border/50 focus:border-primary"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon" className="shrink-0 bg-card border-border/50">
              <SlidersHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {[1,2,3,4,5,6,7,8].map(i => (
              <div key={i} className="bg-card rounded-2xl p-4 animate-pulse h-64 border border-border/50"></div>
            ))}
          </div>
        ) : filteredTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center glass-card rounded-3xl">
            <h3 className="text-2xl font-bold mb-2">It's quiet in here</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-8">You haven't generated any tracks yet. Head over to the studio and let the AI do its magic.</p>
            <Link href="/generate">
              <Button size="lg" className="rounded-full shadow-lg shadow-primary/20">Go to Studio</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filteredTracks.map((track: any) => (
              <TrackCard key={track.id} track={track} queueContext={filteredTracks} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}