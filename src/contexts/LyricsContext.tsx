import React, { createContext, useContext, useState } from 'react';
import { LyricsPanel } from "@/components/player/lyrics-panel";
interface LyricsContextType {
  isOpen: boolean;
  openLyrics: () => void;
  closeLyrics: () => void;
  toggleLyrics: () => void;
}

const LyricsContext = createContext<LyricsContextType | undefined>(undefined);

export const useLyrics = () => {
  const context = useContext(LyricsContext);
  if (!context) {
    throw new Error('useLyrics must be used within LyricsProvider');
  }
  return context;
};

export const LyricsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <LyricsContext.Provider
      value={{
        isOpen,
        openLyrics: () => setIsOpen(true),
        closeLyrics: () => setIsOpen(false),
        toggleLyrics: () => setIsOpen(prev => !prev),
      }}
    >
      {children}
    </LyricsContext.Provider>
  );
};