export interface Point {
  x: number;
  y: number;
}

export interface Boat {
  id: 'X' | 'Y';
  position: Point; // World coordinates
  tack: 'port' | 'stbd';
  visible: boolean;
}

export interface CourseConfig {
  windDirection: number; // Degrees, 0 is North (Top) (FROM)
  windSpeed: number; // Knots
  currentDirection: number; // Degrees, 0 is North (Top) (TO)
  currentSpeed: number; // Knots
  courseAxis: number; // Degrees, direction from Start to Mark
  courseLength: number; // Meters
  startLineLength: number; // Meters
  startLineBias: number; // Degrees, rotation of start line
  markShift: number; // Meters, horizontal shift of mark
  showLadderRungs: boolean;
  showLaylines: boolean;
  showWindLine: boolean;
  showZones: boolean;
}

export const DEFAULT_CONFIG: CourseConfig = {
  windDirection: 0,
  windSpeed: 12,
  currentDirection: 90,
  currentSpeed: 0,
  courseAxis: 0,
  courseLength: 1000,
  startLineLength: 200,
  startLineBias: 0,
  markShift: 0,
  showLadderRungs: true,
  showLaylines: true,
  showWindLine: true,
  showZones: false,
};