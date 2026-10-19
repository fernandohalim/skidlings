import type { TrackTheme } from '../engine/track/TrackDefinition';

// Saturated, sunny palettes per theme (owner: "too pale").

export const FOREST_THEME: TrackTheme = {
  kind: 'forest',
  ground: '#62C94A',
  groundB: '#45B23F',
  rock: '#8E93A6',
  sand: '#EBD79A',
  water: '#27B4EE',
  road: '#53586E',
  curbA: '#FF4B33',
  curbB: '#FFFFFF',
  bumperA: '#2EC4F1',
  bumperB: '#FFC933',
  skyTop: '#4FB8FF',
  skyHorizon: '#D8F3FF',
};

export const SEASIDE_THEME: TrackTheme = {
  kind: 'seaside',
  ground: '#74D64F',
  groundB: '#55C246',
  rock: '#D6BF97',
  sand: '#F6DF9A',
  water: '#139FE0',
  road: '#585C72',
  curbA: '#2E8BF1',
  curbB: '#FFFFFF',
  bumperA: '#FF5A3C',
  bumperB: '#FFFFFF',
  skyTop: '#3FB0FF',
  skyHorizon: '#E3F7FF',
};

export const CANYON_THEME: TrackTheme = {
  kind: 'canyon',
  ground: '#EFA45C',
  groundB: '#DD8744',
  rock: '#B9502C',
  sand: '#F5C77C',
  water: '#2FB2E8',
  road: '#685A61',
  curbA: '#FFC933',
  curbB: '#2B2340',
  bumperA: '#FF9F1C',
  bumperB: '#9B5CFF',
  skyTop: '#42A8FF',
  skyHorizon: '#FFE3BE',
};
