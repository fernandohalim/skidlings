import { create } from 'zustand';
import type { CarId } from '../config/car.config';
import type { TrackId } from '../tracks';

export type SceneId = 'title' | 'lobby' | 'race';

/** At most one modal at a time; settings/controls remember where they were opened from. */
export type ModalId = 'trackSelect' | 'garage' | 'pause' | 'settings' | 'controls';

interface GameState {
  scene: SceneId;
  /** Track loaded in the race scene. */
  trackId: TrackId;
  /** Track preselected when the Track Select modal opens (the pad you drove onto). */
  padTrackId: TrackId;
  modal: ModalId | null;
  /** Modal to return to when a nested modal (settings/controls) closes. */
  modalBack: ModalId | null;
  selectedCar: CarId;
  /** Monotonic counter: lets the scene know a new run of a scene started. */
  sceneRun: number;

  goTitle: () => void;
  goLobby: () => void;
  startRace: (trackId: TrackId) => void;
  openModal: (modal: ModalId, opts?: { padTrackId?: TrackId }) => void;
  /** Opens settings/controls on top of the current modal; closing returns to it. */
  openNested: (modal: 'settings' | 'controls') => void;
  closeModal: () => void;
  selectCar: (car: CarId) => void;
}

const CAR_KEY = 'skidlings.car.v1';

/** Last car picked in the Garage (storage may be unavailable → default). */
function loadCar(): CarId {
  try {
    const v = localStorage.getItem(CAR_KEY);
    if (v === 'balanced' || v === 'drifter' || v === 'speedster') return v;
  } catch {
    // ignore
  }
  return 'balanced';
}

export const useGameStore = create<GameState>()((set, get) => ({
  scene: 'title',
  trackId: 'pineHills',
  padTrackId: 'pineHills',
  modal: null,
  modalBack: null,
  selectedCar: loadCar(),
  sceneRun: 0,

  goTitle: () =>
    set((s) => ({ scene: 'title', modal: null, modalBack: null, sceneRun: s.sceneRun + 1 })),
  goLobby: () =>
    set((s) => ({ scene: 'lobby', modal: null, modalBack: null, sceneRun: s.sceneRun + 1 })),
  startRace: (trackId) =>
    set((s) => ({
      scene: 'race',
      trackId,
      modal: null,
      modalBack: null,
      sceneRun: s.sceneRun + 1,
    })),
  openModal: (modal, opts) =>
    set({ modal, modalBack: null, ...(opts?.padTrackId ? { padTrackId: opts.padTrackId } : {}) }),
  openNested: (modal) => set({ modal, modalBack: get().modal }),
  closeModal: () => set((s) => ({ modal: s.modalBack, modalBack: null })),
  selectCar: (selectedCar) => {
    set({ selectedCar });
    try {
      localStorage.setItem(CAR_KEY, selectedCar);
    } catch {
      // ignore: choice lasts for this session only
    }
  },
}));

/** The sim is frozen whenever any modal is open (pause, track select, garage, …). */
export function isSimPaused(): boolean {
  return useGameStore.getState().modal !== null;
}
