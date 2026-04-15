import { Link, useLocation } from "wouter";
import { 
  Music2, 
  Home, 
  Sparkles, 
  Library, 
  Heart, 
  ListMusic, 
  User, 
  LogOut,
  Settings
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const [location] = useLocation();
  const { user, isAuthenticated, login, logout } = useAuth();

  const navItems = [
    { icon: Home, label: "Главная", href: "/" },
    { icon: Sparkles, label: "Создать", href: "/generate" },
    { icon: Library, label: "Медиатека", href: "/library", requiresAuth: true },
    { icon: Heart, label: "Избранное", href: "/favorites", requiresAuth: true },
    { icon: ListMusic, label: "Плейлисты", href: "/playlists", requiresAuth: true },
  ];

  return (
    <aside className={cn("w-64 bg-card border-r border-border/50 h-screen flex flex-col fixed left-0 top-0 z-40 transition-transform md:translate-x-0 -translate-x-full", className)}>
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
          <Music2 className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-display font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
          Melodix<span className="text-primary">AI</span>
        </h1>
      </div>

      <div className="px-4 py-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-2">Меню</p>
        <nav className="space-y-1">
          {navItems.map((item) => {
            if (item.requiresAuth && !isAuthenticated) return null;
            
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            
            return (
              <Link key={item.href} href={item.href} className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group font-medium",
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}>
                <item.icon className={cn(
                  "w-5 h-5 transition-transform duration-200 group-hover:scale-110",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-4 border-t border-border/50">
        {isAuthenticated ? (
          <div className="space-y-2">
            <Link href="/profile" className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group font-medium",
              location === "/profile" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}>
              <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                {user?.profileImageUrl ? (
                  <img src={user.profileImageUrl} alt="Аватар" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-4 h-4" />
                )}
              </div>
              <span className="truncate flex-1">{user?.firstName || user?.email?.split('@')[0] || "Профиль"}</span>
            </Link>
            <button 
              onClick={() => logout()}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group font-medium"
            >
              <LogOut className="w-5 h-5 transition-transform duration-200 group-hover:-translate-x-1" />
              Выйти
            </button>
          </div>
        ) : (
          <div className="space-y-3 bg-secondary/50 p-4 rounded-2xl border border-border/50">
            <h4 className="font-semibold text-sm">Войдите, чтобы сохранять</h4>
            <p className="text-xs text-muted-foreground">Войдите, чтобы создавать и сохранять свои треки.</p>
            <Button onClick={() => login()} className="w-full shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all hover:-translate-y-0.5">
              Войти
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}