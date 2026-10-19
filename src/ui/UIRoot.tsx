import { useCallback, useState, type CSSProperties } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useRaceStore } from '../stores/raceStore';
import { useSettingsStore } from '../stores/settingsStore';
import { LobbyHUD } from './hud/LobbyHUD';
import { RaceHUD } from './hud/RaceHUD';
import { SpeedLines } from './hud/SpeedLines';
import { SpeedNitroGauge } from './hud/SpeedNitroGauge';
import { useKeyboardShortcuts } from './KeyboardShortcuts';
import { useAudioDirector } from './useAudioDirector';
import { ControlsOverlay } from './screens/ControlsOverlay';
import { Garage } from './screens/Garage';
import { PauseMenu } from './screens/PauseMenu';
import { SettingsScreen } from './screens/SettingsScreen';
import { TitleScreen } from './screens/TitleScreen';
import { TrackSelect } from './screens/TrackSelect';

// DOM overlay root: HUDs per scene + the single active modal.
export function UIRoot() {
  const scene = useGameStore((s) => s.scene);
  const modal = useGameStore((s) => s.modal);
  const racing = useRaceStore((s) => s.active);
  const uiScale = useSettingsStore((s) => s.uiScale);
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);
  const [hintsSeq, setHintsSeq] = useState(0);
  const showHints = useCallback(() => setHintsSeq((n) => n + 1), []);
  useKeyboardShortcuts(showHints);
  useAudioDirector();

  return (
    <div
      className={`ui-root ${reduceMotion ? 'reduce-motion' : ''}`}
      style={{ '--ui-scale': uiScale } as CSSProperties}
    >
      {scene === 'title' && !modal && <TitleScreen />}
      {scene === 'lobby' && <LobbyHUD key={hintsSeq} hintsVisible />}
      {scene === 'race' && racing && <RaceHUD />}
      {scene !== 'title' && <SpeedLines />}
      {scene !== 'title' && <SpeedNitroGauge />}

      {modal === 'trackSelect' && <TrackSelect />}
      {modal === 'garage' && <Garage />}
      {modal === 'pause' && <PauseMenu />}
      {modal === 'settings' && <SettingsScreen />}
      {modal === 'controls' && <ControlsOverlay />}
    </div>
  );
}
