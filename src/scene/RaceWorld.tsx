import type { TrackData } from '../engine/track/TrackDefinition';
import { Decorations } from './Track/Decorations';
import { Landmarks } from './Track/Landmarks';
import { RoadFeatures } from './Track/RoadFeatures';
import { Scenery } from './Track/Scenery';
import { Terrain } from './Track/Terrain';
import { TrackMesh } from './Track/TrackMesh';
import { TrackWalls } from './Track/TrackWalls';

/** Static visuals of a generated race track (2.5D terrain, road, props). */
export function RaceWorld({ track, outlines }: { track: TrackData; outlines: boolean }) {
  return (
    <>
      <Terrain track={track} />
      <TrackMesh track={track} />
      <RoadFeatures track={track} outlines={outlines} />
      <TrackWalls track={track} outlines={outlines} />
      <Scenery track={track} outlines={outlines} />
      <Decorations items={track.decorations} outlines={outlines} ground={track.terrain.heightAt} />
      <Landmarks track={track} outlines={outlines} />
    </>
  );
}
