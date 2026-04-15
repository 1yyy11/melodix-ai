import { Search, Bell, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useAuth } from "@/contexts/AuthContext";
export function Topbar() {
  const { isAuthenticated, login } = useAuth();

  return (
    <header className="h-20 flex items-center justify-between px-6 lg:px-10 sticky top-0 z-30 glass">
      <div className="flex items-center gap-4 flex-1">
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="w-5 h-5" />
        </Button>
        
        <div className="relative w-full max-w-md hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search tracks, artists, or moods..." 
            className="w-full pl-10 bg-secondary/50 border-transparent focus:bg-secondary focus:border-primary/50 rounded-full h-11 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        {isAuthenticated ? (
          <Button variant="ghost" size="icon" className="rounded-full relative">
            <Bell className="w-5 h-5 text-muted-foreground" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-background"></span>
          </Button>
        ) : (
          <Button variant="outline" className="rounded-full hidden sm:flex" onClick={() => login()}>
            Sign In
          </Button>
        )}
      </div>
    </header>
  );
}
