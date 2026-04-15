import { Layout } from "@/components/layout";
import { useGetProfile } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { User, Activity, Music2, ListMusic, Heart } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

export default function Profile() {
  const { user, isAuthenticated, login, logout } = useAuth();
  const { data: profile, isLoading } = useGetProfile({
    query: { enabled: isAuthenticated }
  });

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="h-[80vh] flex flex-col items-center justify-center text-center max-w-md mx-auto">
          <User className="w-24 h-24 text-muted-foreground/30 mb-6" />
          <h1 className="text-3xl font-display font-bold mb-4">Your Profile</h1>
          <p className="text-muted-foreground mb-8">Sign in to view your creator stats.</p>
          <Button onClick={() => login()} size="lg" className="rounded-full px-8">Sign In</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-10 pb-20">
        
        {/* Header */}
        <div className="glass-card rounded-3xl p-8 md:p-12 flex flex-col md:flex-row items-center md:items-start gap-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-primary/20 via-accent/10 to-background z-0"></div>
          
          <div className="relative z-10 w-32 h-32 md:w-40 md:h-40 rounded-full bg-secondary border-4 border-background overflow-hidden shrink-0 shadow-2xl">
            {user?.profileImageUrl ? (
              <img src={user.profileImageUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/40 to-accent/40">
                <User className="w-16 h-16 text-white/80" />
              </div>
            )}
          </div>
          
          <div className="relative z-10 text-center md:text-left flex-1 mt-2">
            <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-2">{user?.name || 'Creator'}</h1>
            <p className="text-muted-foreground text-lg mb-6">{user?.email}</p>
            <div className="flex flex-wrap justify-center md:justify-start gap-3">
              <Button variant="outline" className="rounded-full border-border/50 bg-background/50 backdrop-blur-sm">Edit Profile</Button>
              <Button variant="destructive" onClick={() => logout()} className="rounded-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-white border-none shadow-none">Sign Out</Button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div>
          <h2 className="text-2xl font-display font-bold mb-6">Your Stats</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <StatCard icon={<Music2 className="text-primary" />} label="Generated Tracks" value={profile?.totalTracks || 0} loading={isLoading} />
            <StatCard icon={<Heart className="text-accent" />} label="Favorites" value={profile?.totalFavorites || 0} loading={isLoading} />
            <StatCard icon={<ListMusic className="text-blue-400" />} label="Playlists" value={profile?.totalPlaylists || 0} loading={isLoading} />
            <StatCard icon={<Activity className="text-emerald-400" />} label="Total Plays" value={profile?.totalPlays || 0} loading={isLoading} />
          </div>
        </div>

        {/* Insights */}
        {profile && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-secondary/30 rounded-3xl p-8 border border-border/50">
              <h3 className="text-xl font-bold mb-6">Top Preferences</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-background rounded-2xl border border-border/50">
                  <span className="text-muted-foreground">Favorite Genre</span>
                  <span className="font-bold text-primary">{profile.favoriteGenre || 'Electronic'}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-background rounded-2xl border border-border/50">
                  <span className="text-muted-foreground">Favorite Mood</span>
                  <span className="font-bold text-accent">{profile.favoriteMood || 'Energetic'}</span>
                </div>
              </div>
            </div>
            
            <div className="bg-secondary/30 rounded-3xl p-8 border border-border/50">
              <h3 className="text-xl font-bold mb-6">Account Info</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-background rounded-2xl border border-border/50">
                  <span className="text-muted-foreground">Member Since</span>
                  <span className="font-medium text-foreground">
                    {profile.memberSince ? format(new Date(profile.memberSince), 'MMMM yyyy') : 'Recently'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 bg-background rounded-2xl border border-border/50">
                  <span className="text-muted-foreground">Subscription</span>
                  <span className="font-bold bg-primary/20 text-primary px-3 py-1 rounded-full text-xs">Pro Creator</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

function StatCard({ icon, label, value, loading }: { icon: React.ReactNode, label: string, value: number, loading: boolean }) {
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
