import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Sparkles, ArrowRight, PlayCircle, Headphones, Waves, Music2 } from "lucide-react";
import { motion } from "framer-motion";

import { useState, useEffect } from "react";
import { TrackCard } from "@/components/tracks/track-card";
import { useAuth } from "@/contexts/AuthContext";
export default function Home() {
  const { isAuthenticated } = useAuth();
  const [tracks, setTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Загружаем треки
  useEffect(() => {
    fetch('/api/tracks')
      .then(res => res.json())
      .then(data => {
        console.log('Tracks loaded:', data);
        setTracks(Array.isArray(data) ? data : []);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Error loading tracks:', err);
        setIsLoading(false);
      });
  }, []);

  // Последние 4 трека для главной страницы
  const recentTracks = tracks.slice(0, 4);

  return (
    <Layout>
      <div className="flex flex-col gap-16 pb-10">
        
        {/* Hero Section */}
        <section className="relative rounded-3xl overflow-hidden min-h-[400px] flex items-center p-8 md:p-16 border border-border/30 shadow-2xl">
          <div className="absolute inset-0 z-0">
            <img 
              src={`${import.meta.env.BASE_URL}images/hero-bg.png`} 
              alt="Hero abstract background" 
              className="w-full h-full object-cover opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
          </div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative z-10 max-w-2xl space-y-6"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium backdrop-blur-md">
              <Sparkles className="w-4 h-4" />
              <span>Next-Gen Music Engine</span>
            </div>
            
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-display font-extrabold leading-[1.1] tracking-tight">
              Create <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Music</span> With Your Imagination
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl">
              Describe your vibe, choose a genre, and let our AI generate professional-quality tracks in seconds.
            </p>
            
            <div className="flex flex-wrap items-center gap-4 pt-4">
              {isAuthenticated ? (
                <Link href="/generate" className="inline-block">
                  <Button size="lg" className="h-14 px-8 rounded-full text-lg shadow-lg shadow-primary/25 hover:shadow-xl transition-all hover:-translate-y-1">
                    Start Generating
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              ) : (
                <Link href="/login">
                  <Button size="lg" className="h-14 px-8 rounded-full text-lg shadow-lg shadow-primary/25 hover:shadow-xl transition-all hover:-translate-y-1">
                    Sign in to Create
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              )}
              <Button size="lg" variant="outline" className="h-14 px-8 rounded-full text-lg backdrop-blur-sm bg-background/50">
                <PlayCircle className="w-5 h-5 mr-2" />
                Listen to Examples
              </Button>
            </div>
          </motion.div>
        </section>

        {/* Stats/Features Banner */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card rounded-2xl p-6 flex items-start gap-4 hover:-translate-y-1 transition-transform">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Waves className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Studio Quality</h3>
              <p className="text-muted-foreground text-sm mt-1">Export in WAV or high-bitrate MP3 for professional use.</p>
            </div>
          </div>
          <div className="glass-card rounded-2xl p-6 flex items-start gap-4 hover:-translate-y-1 transition-transform">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Infinite Stems</h3>
              <p className="text-muted-foreground text-sm mt-1">Generate complete tracks or isolated stems for mixing.</p>
            </div>
          </div>
          <div className="glass-card rounded-2xl p-6 flex items-start gap-4 hover:-translate-y-1 transition-transform">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
              <Headphones className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Royalty Free</h3>
              <p className="text-muted-foreground text-sm mt-1">Use your generated tracks anywhere, 100% royalty-free.</p>
            </div>
          </div>
        </section>

        {/* Recent/Featured Tracks */}
        <section className="space-y-6">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-display font-bold">Recent Tracks</h2>
              <p className="text-muted-foreground mt-1">Recently added tracks</p>
            </div>
            {isAuthenticated && (
              <Link href="/library" className="text-primary hover:underline font-medium text-sm">
                View all library
              </Link>
            )}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1,2,3,4].map(i => (
                <div key={i} className="bg-card rounded-2xl p-4 animate-pulse h-64 border border-border/50"></div>
              ))}
            </div>
          ) : recentTracks.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {recentTracks.map((track: any) => (
                <TrackCard key={track.id} track={track} queueContext={recentTracks} />
              ))}
            </div>
          ) : (
            <div className="bg-secondary/20 border border-border border-dashed rounded-3xl p-12 text-center flex flex-col items-center justify-center">
              <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mb-4">
                <Music2 className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-2">No tracks yet</h3>
              <p className="text-muted-foreground mb-6">Generate your first track to start building your library.</p>
              <Link href="/generate">
                <Button>Go to Generator</Button>
              </Link>
            </div>
          )}
        </section>

      </div>
    </Layout>
  );
}