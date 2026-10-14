// Geography for the landing page's clay map of Jordan. Coordinates are [longitude, latitude].
// The scene uses 1 unit = 1 km with Amman at the origin (east = +x, north = -z).

export type LonLat = [number, number];

export const AMMAN: LonLat = [35.9106, 31.9539];
const KM_PER_LON = 94.4; // at Amman's latitude
const KM_PER_LAT = 110.57;

/** Map a [lon, lat] to scene x/z (km from Amman). */
export const toKm = ([lon, lat]: LonLat) => ({
  x: (lon - AMMAN[0]) * KM_PER_LON,
  z: -(lat - AMMAN[1]) * KM_PER_LAT,
});

/** A simplified outline of the border. */
export const BORDER: LonLat[] = [
  [35.5457, 32.394], [35.7199, 32.7092], [36.8341, 32.3129], [38.7923, 33.3787], [39.1955, 32.161], [39.0049, 32.0102],
  [37.0022, 31.5084], [37.9988, 30.5085], [37.6681, 30.3387], [37.5036, 30.0038], [36.7405, 29.8653], [36.5012, 29.5053],
  [36.0689, 29.1975], [34.956, 29.3566], [34.9226, 29.5013], [35.4209, 31.1001], [35.3976, 31.4891], [35.5453, 31.7825],
];

/** The Dead Sea, on the western border. */
export const DEAD_SEA: LonLat[] = [[35.395, 31.1], [35.47, 31.03], [35.585, 31.45], [35.575, 31.76], [35.5, 31.77], [35.4, 31.45]];
export const DEAD_SEA_LABEL: LonLat = [35.49, 31.45];

export interface City {
  /** Dictionary key suffix: landing.city.<id>. */
  id: string;
  at: LonLat;
  /** Example number of free pallet spaces (drives tower height). */
  free: number;
  /** Nudge in km, so Amman's tower stands beside the shrunken warehouse instead of inside it. */
  offset?: [number, number];
}

export const CITIES: City[] = [
  { id: 'Amman', at: AMMAN, free: 1240, offset: [-11, -9] },
  { id: 'Zarqa', at: [36.088, 32.0728], free: 860 },
  { id: 'Aqaba', at: [35.0078, 29.5267], free: 520 },
  { id: 'Irbid', at: [35.85, 32.5556], free: 410 },
  { id: 'Mafraq', at: [36.2081, 32.3434], free: 190 },
  { id: 'Karak', at: [35.7048, 31.1853], free: 120 },
  { id: 'Maan', at: [35.7341, 30.1962], free: 90 },
];
export const MAX_FREE = 1240;

/** Main roads, roughly: the Desert Highway, Amman–Zarqa–Mafraq, Amman–Irbid, and the King's Highway. */
export const ROADS: LonLat[][] = [
  [[35.0078, 29.5267], [35.42, 29.85], [35.7341, 30.1962], [35.95, 30.75], [36.03, 31.25], [35.95, 31.75], AMMAN],
  [AMMAN, [36.088, 32.0728], [36.2081, 32.3434]],
  [AMMAN, [35.89, 32.28], [35.85, 32.5556]],
  [[35.7048, 31.1853], [35.8, 31.72], AMMAN],
];
