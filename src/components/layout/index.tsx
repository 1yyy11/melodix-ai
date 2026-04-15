import { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { AudioPlayer } from "../player/audio-player";
import { usePlayer } from "@/hooks/use-player";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useLyrics } from "@/contexts/LyricsContext";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { currentTrack } = usePlayer();
  const { isOpen: isLyricsOpen } = useLyrics();

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar className="hidden md:flex" />
      <div className={cn(
        "flex-1 flex flex-col transition-all duration-300 ease-out",
        "md:pl-64",
        currentTrack ? "pb-24" : "",
      isLyricsOpen && "sm:mb-[500px]"
      )}>
        <Topbar />
        <main className="flex-1 p-6 lg:p-10 w-full max-w-[1600px] mx-auto overflow-x-hidden">
          {children}
        </main>
      </div>
      {currentTrack && <AudioPlayer />}
    </div>
  );
}