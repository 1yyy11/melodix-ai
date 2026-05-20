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
  lastVolume: number;
  
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
  lastVolume: 0.8,

  // ✅ ИСПРАВЛЕНО: не сбрасываем progress если это уже текущий трек
  playTrack: (track, newQueue) => {
    const state = get();
    const isNewTrack = state.currentTrack?.id !== track.id;
    const queue = newQueue || state.queue;
    const index = queue.findIndex(t => t.id === track.id);
    
    set({
      currentTrack: track,
      isPlaying: true,
      // ✅ Сбрасываем progress ТОЛЬКО если это новый трек
      ...(isNewTrack && { progress: 0 }),
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

  setVolume: (vol) => {
    set((state) => ({
      volume: vol,
      lastVolume: vol > 0 ? vol : state.lastVolume,
      isMuted: false
    }));
  },

  setProgress: (prog) => set({ progress: prog }),
  setDuration: (dur) => set({ duration: dur }),
  
  toggleMute: () => {
    set((state) => {
      if (state.isMuted) {
        return {
          isMuted: false,
          volume: state.lastVolume || 0.8
        };
      } else {
        return {
          isMuted: true,
          volume: 0,
          lastVolume: state.volume
        };
      }
    });
  },
  
  toggleShuffle: () => set((state) => ({ isShuffled: !state.isShuffled })),
  toggleRepeat: () => set((state) => ({ isRepeating: !state.isRepeating })),
  
  addToQueue: (track) => set((state) => {
    const isAlreadyInQueue = state.queue.some(t => t.id === track.id);
    if (isAlreadyInQueue) return state;
    
    return {
      queue: [...state.queue, track],
      currentTrack: state.currentTrack || track,
      isPlaying: state.currentTrack ? state.isPlaying : true,
      queueIndex: state.currentTrack ? state.queueIndex : 0
    };
  }),

  removeFromQueue: (trackId) => set((state) => {
    const newQueue = state.queue.filter(t => t.id !== trackId);
    const wasCurrentTrack = state.currentTrack?.id === trackId;
    
    if (wasCurrentTrack) {
      const nextIndex = Math.min(state.queueIndex, newQueue.length - 1);
      return {
        queue: newQueue,
        currentTrack: nextIndex >= 0 ? newQueue[nextIndex] : null,
        queueIndex: nextIndex >= 0 ? nextIndex : -1,
        isPlaying: nextIndex >= 0 && state.isPlaying
      };
    }
    
    const deletedIndex = state.queue.findIndex(t => t.id === trackId);
    const shouldShiftIndex = deletedIndex < state.queueIndex;
    
    return {
      queue: newQueue,
      queueIndex: shouldShiftIndex ? state.queueIndex - 1 : state.queueIndex
    };
  }),

  clearQueue: () => set({ queue: [], queueIndex: -1, currentTrack: null, isPlaying: false }),
}));