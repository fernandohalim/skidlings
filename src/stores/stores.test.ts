import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS } from '../config/input.config';
import { isSimPaused, useGameStore } from './gameStore';
import { useSettingsStore } from './settingsStore';

describe('gameStore scene flow', () => {
  beforeEach(() => {
    useGameStore.setState({ scene: 'title', modal: null, modalBack: null, sceneRun: 0 });
  });

  it('title → lobby → pad opens track select (sim paused) → race → back to lobby', () => {
    const g = () => useGameStore.getState();
    g().goLobby();
    expect(g().scene).toBe('lobby');
    expect(isSimPaused()).toBe(false);

    g().openModal('trackSelect', { padTrackId: 'redCanyon' });
    expect(g().modal).toBe('trackSelect');
    expect(g().padTrackId).toBe('redCanyon');
    expect(isSimPaused()).toBe(true);

    const runBefore = g().sceneRun;
    g().startRace('redCanyon');
    expect(g().scene).toBe('race');
    expect(g().trackId).toBe('redCanyon');
    expect(g().modal).toBeNull();
    expect(g().sceneRun).toBe(runBefore + 1); // forces a clean remount

    g().goLobby();
    expect(g().scene).toBe('lobby');
  });

  it('settings opened from pause returns to pause when closed', () => {
    const g = () => useGameStore.getState();
    g().goLobby();
    g().openModal('pause');
    g().openNested('settings');
    expect(g().modal).toBe('settings');
    g().closeModal();
    expect(g().modal).toBe('pause');
    g().closeModal();
    expect(g().modal).toBeNull();
  });
});

describe('settingsStore', () => {
  beforeEach(() => useSettingsStore.getState().resetAll());

  it('remapping a key moves it off any other action', () => {
    const s = () => useSettingsStore.getState();
    s().setBinding('drift', 0, 'KeyW');
    expect(s().bindings.drift[0]).toBe('KeyW');
    expect(s().bindings.throttle).not.toContain('KeyW');
    expect(s().bindings.throttle).toContain('ArrowUp');
  });

  it('reset restores default bindings', () => {
    const s = () => useSettingsStore.getState();
    s().setBinding('nitro', 0, 'KeyN');
    s().resetBindings();
    expect(s().bindings).toEqual(DEFAULT_BINDINGS);
  });
});
