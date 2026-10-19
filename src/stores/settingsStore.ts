import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { QualityLevel } from '../config/graphics.config';
import { DEFAULT_BINDINGS, type InputAction, type KeyBindings } from '../config/input.config';

// Player settings (§10.7), persisted to localStorage. Falls back to in-memory
// defaults when storage is unavailable.

export interface Settings {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  bindings: KeyBindings;
  quality: QualityLevel;
  postProcessing: boolean;
  cameraShake: boolean;
  reduceMotion: boolean;
  uiScale: number;
  showFps: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  masterVolume: 0.8,
  sfxVolume: 0.8,
  musicVolume: 0.5,
  bindings: DEFAULT_BINDINGS,
  quality: 'medium',
  postProcessing: true,
  cameraShake: true,
  reduceMotion: false,
  uiScale: 1,
  showFps: false,
};

interface SettingsState extends Settings {
  update: (patch: Partial<Settings>) => void;
  /** Binds `code` to `action` at slot `slot` (0 primary, 1 alt). A key used elsewhere moves here. */
  setBinding: (action: InputAction, slot: number, code: string) => void;
  resetBindings: () => void;
  resetAll: () => void;
}

const safeStorage = createJSONStorage(() => {
  try {
    const t = '__skidlings_test__';
    localStorage.setItem(t, t);
    localStorage.removeItem(t);
    return localStorage;
  } catch {
    const mem = new Map<string, string>();
    return {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    };
  }
});

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,
      update: (patch) => set(patch),
      setBinding: (action, slot, code) => {
        const next: KeyBindings = { ...get().bindings };
        // Steal the key from any other action so one key never does two things.
        for (const a of Object.keys(next) as InputAction[]) {
          if (a !== action) next[a] = next[a].filter((c) => c !== code);
        }
        const list = [...next[action]];
        list[slot] = code;
        next[action] = list.filter((c, i, arr) => c && arr.indexOf(c) === i);
        set({ bindings: next });
      },
      resetBindings: () => set({ bindings: DEFAULT_BINDINGS }),
      resetAll: () => set({ ...DEFAULT_SETTINGS }),
    }),
    {
      name: 'skidlings.settings.v1',
      storage: safeStorage,
      // Don't persist the action functions; merge saved values over defaults so
      // new settings added later get their default.
      partialize: (s) => {
        const { update: _u, setBinding: _b, resetBindings: _r, resetAll: _a, ...rest } = s;
        return rest;
      },
      merge: (saved, current) => ({
        ...current,
        ...(saved as Partial<Settings>),
        bindings: { ...DEFAULT_BINDINGS, ...((saved as Partial<Settings>)?.bindings ?? {}) },
      }),
    },
  ),
);
