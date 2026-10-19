import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { audio } from '../audio/AudioManager';
import { RACE_CONFIG } from '../config/race.config';
import type { Bot } from '../engine/ai/AIDriver';
import type { CarSimulation } from '../engine/car/CarSimulation';
import { rankStandings, type StandingEntry } from '../engine/race/LapTracker';
import type { RaceController, RaceEvent } from '../engine/race/RaceController';
import { useRaceStore } from '../stores/raceStore';
import { getRecord, submitResult } from '../stores/records';
import { telemetry } from '../stores/telemetry';
import { ordinal } from '../ui/format';

interface Props {
  race: RaceController;
  sim: CarSimulation;
  bots: Bot[];
  /** Puts the bots back on their grid slots. */
  resetBots: () => void;
}

interface Racer extends StandingEntry {
  name: string;
  isPlayer: boolean;
}

/** Live standings: player + bots, finished first by time, then by progress. */
function standings(race: RaceController, bots: Bot[]): Racer[] {
  const playerDone = race.phase === 'finished';
  return rankStandings<Racer>([
    {
      id: 'player',
      name: 'You',
      isPlayer: true,
      progress: race.progress,
      finished: playerDone,
      finishTime: playerDone ? race.raceTime : Infinity,
    },
    ...bots.map((b) => ({
      id: b.id,
      name: b.profile.name,
      isPlayer: false,
      progress: b.tracker.progress,
      finished: b.tracker.finished,
      finishTime: b.tracker.finishTime,
    })),
  ]);
}

/**
 * Bridges the pure RaceController to the UI: pushes low-frequency changes into
 * raceStore (only when they change), turns race events into toasts, saves
 * records on finish, and handles restart requests.
 */
export function RaceDirector({ race, sim, bots, resetBots }: Props) {
  const events = useMemo<RaceEvent[]>(() => [], []);
  const posTimer = useRef(0);

  // (Re)start: fresh controller state, car on the grid, race nitro.
  const restart = useMemo(
    () => () => {
      race.restart();
      const g = race.track.startGrid[race.gridSlot]!;
      sim.resetForRace(g.x, g.z, g.heading, RACE_CONFIG.startNitroRace);
      resetBots();
      const record = getRecord(race.track.def.id);
      useRaceStore.getState().set({
        active: true,
        trackName: race.track.def.name,
        phase: race.phase,
        countdown: race.countdown,
        lap: 0,
        totalLaps: race.totalLaps,
        bestLap: Infinity,
        recordLap: record?.bestLap ?? Infinity,
        wrongWay: false,
        toast: null,
        results: null,
        position: bots.length + 1,
        racers: bots.length + 1,
      });
    },
    [race, sim, bots, resetBots],
  );

  useEffect(() => {
    restart();
    const unsub = useRaceStore.subscribe((s, prev) => {
      if (s.restartToken !== prev.restartToken) restart();
    });
    return () => {
      unsub();
      useRaceStore.getState().set({ active: false });
      telemetry.raceTime = 0;
      telemetry.lapTime = 0;
    };
  }, [restart]);

  useFrame((_, dt) => {
    const store = useRaceStore.getState();
    telemetry.raceTime = race.raceTime;
    telemetry.lapTime = race.lapTime;

    // Race position at ~10 Hz (sorting every frame isn't needed).
    posTimer.current -= dt;
    if (posTimer.current <= 0 && race.phase === 'racing') {
      posTimer.current = 0.1;
      const pos = standings(race, bots).findIndex((r) => r.isPlayer) + 1;
      if (pos !== store.position) store.set({ position: pos });
    }

    if (
      store.phase !== race.phase ||
      store.countdown !== race.countdown ||
      store.lap !== race.lap ||
      store.bestLap !== race.bestLap ||
      store.wrongWay !== race.wrongWay
    ) {
      store.set({
        phase: race.phase,
        countdown: race.countdown,
        lap: race.lap,
        bestLap: race.bestLap,
        wrongWay: race.wrongWay,
      });
    }

    race.drainEvents(events);
    for (const e of events) {
      switch (e.type) {
        case 'countdown':
          audio.countdownTick();
          break;
        case 'go':
          store.showToast('GO!', 'go');
          audio.go();
          break;
        case 'perfectStart':
          store.showToast('Perfect start!', 'perfect');
          audio.tierUp(3);
          break;
        case 'lap':
          // The last lap gets its own "Final lap!" toast instead.
          if (e.lap < race.totalLaps - 1) store.showToast(`Lap ${e.lap + 1}!`, 'lap');
          if (e.lap < race.totalLaps) audio.lap();
          break;
        case 'finalLap':
          store.showToast('Final lap!', 'finalLap');
          break;
        case 'finish': {
          const res = submitResult(race.track.def.id, e.bestLap, e.totalTime);
          const finalPos = standings(race, bots).findIndex((r) => r.isPlayer) + 1;
          store.set({ position: finalPos });
          audio.finish(res.newBestTotal);
          const ord = ordinal(finalPos);
          store.showToast(
            res.newBestTotal ? `${ord} · New record!` : `${ord} place!`,
            res.newBestTotal || finalPos === 1 ? 'record' : 'finish',
          );
          // Results card appears after the slow-mo moment.
          window.setTimeout(() => {
            if (race.phase !== 'finished') return; // restarted meanwhile
            useRaceStore.getState().set({
              results: {
                position: finalPos,
                standings: standings(race, bots).map((r) => ({
                  name: r.name,
                  isPlayer: r.isPlayer,
                  time: r.finished ? r.finishTime : null,
                })),
                totalTime: e.totalTime,
                bestLap: e.bestLap,
                lapTimes: [...race.lapTimes],
                driftScore: sim.drift.score,
                newBestLap: res.newBestLap,
                newBestTotal: res.newBestTotal,
              },
              recordLap: res.record.bestLap,
            });
          }, RACE_CONFIG.finishSlowMoDuration * 1000);
          break;
        }
        default:
          break;
      }
    }
    events.length = 0;
  }, -1);

  return null;
}
