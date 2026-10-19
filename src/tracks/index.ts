import type { TrackDefinition } from '../engine/track/TrackDefinition';
import { PINE_HILLS } from './pineHills';
import { RED_CANYON } from './redCanyon';
import { SEASIDE_CLIFFS } from './seasideCliffs';

export type TrackId = 'pineHills' | 'seasideCliffs' | 'redCanyon';

export const TRACKS: Record<TrackId, TrackDefinition> = {
  pineHills: PINE_HILLS,
  seasideCliffs: SEASIDE_CLIFFS,
  redCanyon: RED_CANYON,
};

/** Display order, easiest first. */
export const TRACK_ORDER: TrackId[] = ['pineHills', 'seasideCliffs', 'redCanyon'];
