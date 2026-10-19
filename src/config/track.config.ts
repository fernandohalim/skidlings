// Track builder tuning (§8.2).
export const TRACK_CONFIG = {
  /** Centerline sample spacing (m). */
  sampleSpacing: 1,
  curbWidth: 1.2,
  curbStripeLength: 2.5,
  /** Grass gap between curb and the wall collision line. */
  wallGap: 1.5,
  /** Wall polyline uses every Nth centerline sample. */
  wallStride: 2,
  bumperHeight: 0.9,
  bumperThickness: 0.9,
  /** Start grid: first row distance behind the line, row spacing, lateral offset. */
  gridFirstRow: 8,
  gridRowSpacing: 7,
  gridLateral: 3,
  decorationCount: 260,
  /** Small grass tufts scattered near the road to break up flat ground. */
  tuftCount: 700,
  tuftMaxDistance: 45,
  /** Min distance from a decoration to the wall line. */
  decorationClearance: 4,
  /** Scatter area padding around the track bounds. */
  decorationPadding: 45,
  /** Relative odds per decoration kind, per theme. */
  decorationWeights: {
    forest: { pine: 0.32, tree: 0.24, bush: 0.16, mushroom: 0.1, flower: 0.1, rock: 0.08 },
    seaside: { palm: 0.22, tree: 0.18, bush: 0.2, flower: 0.18, rock: 0.14, block: 0.08 },
    canyon: { cactus: 0.36, rock: 0.38, bush: 0.12, block: 0.04, flower: 0.1 },
  } as Record<string, Partial<Record<string, number>>>,
  groundPatchCount: 140,
  /** Legacy dome mounds; terrain hills replace them. */
  moundCount: 0,
  /** Extra clearance beyond the walls for big mounds. */
  moundClearance: 18,
  /** Tire stacks line the outside of corners tighter than this radius (m). */
  tireCornerRadius: 40,
  tireSpacing: 8,
  flagSpacing: 34,
  grandstandLength: 34,
  grandstandDepth: 9,
  /** Center-line dash pattern on the road (m). */
  dashLength: 3,
  dashGap: 5,
};
