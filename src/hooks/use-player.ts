import { create } from 'zustand';
import type { Track } from '@workspace/api-client-react';

interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  queue: Track[];
  queueIndex: number;
  volume: number;
  progress: number;
  duration: number;
  isMuted: boolean;
  isShuffled: boolean;
  isRepeating: boolean;
  
  // Actions
  playTrack: (track: Track, newQueue?: Track[]) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setVolume: (vol: number) => void;
  setProgress: (prog: number) => void;
  setDuration: (dur: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (trackId: string) => void;
  clearQueue: () => void;
}

export const usePlayer = create<PlayerState>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  queue: [],
  queueIndex: -1,
  volume: 0.8,
  progress: 0,
  duration: 0,
  isMuted: false,
  isShuffled: false,
  isRepeating: false,

  playTrack: (track, newQueue) => {
    const queue = newQueue || get().queue;
    const index = queue.findIndex(t => t.id === track.id);
    
    set({
      currentTrack: track,
      isPlaying: true,
      progress: 0,
      queue: queue.length > 0 ? queue : [track],
      queueIndex: index >= 0 ? index : 0
    });
  },

  togglePlay: () => {
    set((state) => ({ isPlaying: !state.isPlaying }));
  },

  nextTrack: () => {
    const { queue, queueIndex, isShuffled, isRepeating } = get();
    if (queue.length === 0) return;

    if (isRepeating) {
      set({ progress: 0, isPlaying: true });
      return;
    }

    let nextIndex;
    if (isShuffled) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else {
      nextIndex = queueIndex + 1 >= queue.length ? 0 : queueIndex + 1;
    }

    set({
      currentTrack: queue[nextIndex],
      queueIndex: nextIndex,
      progress: 0,
      isPlaying: true
    });
  },

  prevTrack: () => {
    const { queue, queueIndex, progress } = get();
    if (queue.length === 0) return;

    // If we're more than 3 seconds in, just restart current track
    if (progress > 3) {
      set({ progress: 0, isPlaying: true });
      return;
    }

    const prevIndex = queueIndex - 1 < 0 ? queue.length - 1 : queueIndex - 1;
    
    set({
      currentTrack: queue[prevIndex],
      queueIndex: prevIndex,
      progress: 0,
      isPlaying: true
    });
  },

  setVolume: (vol) => set({ volume: vol, isMuted: vol === 0 }),
  setProgress: (prog) => set({ progress: prog }),
  setDuration: (dur) => set({ duration: dur }),
  
  toggleMute: () => set((state) => ({ 
    isMuted: !state.isMuted, 
    volume: state.isMuted ? 0.8 : 0 
  })),
  
  toggleShuffle: () => set((state) => ({ isShuffled: !state.isShuffled })),
  toggleRepeat: () => set((state) => ({ isRepeating: !state.isRepeating })),
  
  addToQueue: (track) => set((state) => {
    const isAlreadyInQueue = state.queue.some(t => t.id === track.id);
    if (isAlreadyInQueue) return state;
    
    return {
      queue: [...state.queue, track],
      // If nothing is playing, play this track
      currentTrack: state.currentTrack || track,
      isPlaying: state.currentTrack ? state.isPlaying : true,
      queueIndex: state.currentTrack ? state.queueIndex : 0
    };
  }),

  removeFromQueue: (trackId) => set((state) => {
    const newQueue = state.queue.filter(t => t.id !== trackId);
    return { queue: newQueue };
  }),

  clearQueue: () => set({ queue: [], queueIndex: -1, currentTrack: null, isPlaying: false }),
}));
