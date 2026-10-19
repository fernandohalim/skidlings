import { create } from 'zustand';
import type { RacePhase } from '../engine/race/RaceController';

// Low-frequency race state for the HUD (§4.1). Timers live in `telemetry`.

export type ToastKind = 'go' | 'lap' | 'finalLap' | 'perfect' | 'record' | 'finish';

export interface Toast {
  id: number;
  text: string;
  kind: ToastKind;
}

export interface StandingRow {
  name: string;
  isPlayer: boolean;
  /** Finish time, or null if still racing when results were shown. */
  time: number | null;
}

export interface RaceResults {
  position: number;
  standings: StandingRow[];
  totalTime: number;
  bestLap: number;
  lapTimes: number[];
  driftScore: number;
  newBestLap: boolean;
  newBestTotal: boolean;
}

interface RaceStoreState {
  active: boolean;
  trackName: string;
  phase: RacePhase;
  countdown: number;
  lap: number;
  totalLaps: number;
  bestLap: number;
  /** Stored record for this track (best lap), for the HUD "Best" line. */
  recordLap: number;
  wrongWay: boolean;
  /** Player's race position (1 = leading) and number of racers. */
  position: number;
  racers: number;
  toast: Toast | null;
  results: RaceResults | null;
  /** Incremented to ask the scene to restart the race. */
  restartToken: number;
  set: (patch: Partial<RaceStoreState>) => void;
  showToast: (text: string, kind: ToastKind) => void;
  requestRestart: () => void;
}

let toastId = 0;

export const useRaceStore = create<RaceStoreState>()((set) => ({
  active: false,
  trackName: '',
  phase: 'intro',
  countdown: 3,
  lap: 0,
  totalLaps: 3,
  bestLap: Infinity,
  recordLap: Infinity,
  wrongWay: false,
  position: 1,
  racers: 1,
  toast: null,
  results: null,
  restartToken: 0,
  set: (patch) => set(patch),
  showToast: (text, kind) => set({ toast: { id: ++toastId, text, kind } }),
  requestRestart: () => set((s) => ({ restartToken: s.restartToken + 1 })),
}));
