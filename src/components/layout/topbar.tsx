import { Bell, Menu, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "next-themes";

export function Topbar() {
  const { theme, setTheme } = useTheme();
  const { isAuthenticated, login } = useAuth();

  return (
    <header className="h-20 flex items-center justify-between px-6 lg:px-10 sticky top-0 z-30 glass">
      <div className="flex items-center gap-4 flex-1">
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex items-center gap-4">
        {/* Кнопка переключения темы */}
       <Button
  variant="ghost"
  size="icon"
  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
  className="rounded-full hover:bg-primary/10"
>
  {theme === "dark" ? (
    <Sun className="w-5 h-5 text-yellow-500" />
  ) : (
    <Moon className="w-5 h-5 text-slate-700" />
  )}
</Button>

        {isAuthenticated ? (
          <Button variant="ghost" size="icon" className="rounded-full relative">
            <Bell className="w-5 h-5 text-muted-foreground" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-background"></span>
          </Button>
        ) : (
          <Button variant="outline" className="rounded-full hidden sm:flex" onClick={() => login()}>
            Войти
          </Button>
        )}
      </div>
    </header>
  );
}