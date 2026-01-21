import { Point } from '../types';

export const toRadians = (deg: number) => (deg * Math.PI) / 180;
export const toDegrees = (rad: number) => (rad * 180) / Math.PI;

// Rotate a point around a center
export const rotatePoint = (point: Point, center: Point, angleDeg: number): Point => {
  const rad = toRadians(angleDeg);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;

  // Standard 2D rotation matrix
  // x' = x cos - y sin
  // y' = x sin + y cos
  return {
    x: center.x + (dx * cos - dy * sin), 
    y: center.y + (dx * sin + dy * cos)
  };
};

// Project a point: 0 deg = +Y, 90 deg = +X
export const projectPoint = (start: Point, angle: number, dist: number): Point => {
  const rad = toRadians(angle);
  return {
    x: start.x + dist * Math.sin(rad),
    y: start.y + dist * Math.cos(rad)
  };
};

// Intersection of two lines defined by point and compass angle
export const intersectLines = (p1: Point, angle1: number, p2: Point, angle2: number): Point | null => {
  const rad1 = toRadians(angle1);
  const rad2 = toRadians(angle2);

  // Direction vectors (Compass: 0=N(+y), 90=E(+x))
  const v1 = { x: Math.sin(rad1), y: Math.cos(rad1) };
  const v2 = { x: Math.sin(rad2), y: Math.cos(rad2) };

  // P1 + t * v1 = P2 + u * v2
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  
  const det = v1.x * (-v2.y) - v1.y * (-v2.x); 
  
  if (Math.abs(det) < 0.0001) return null; // Parallel

  const t = (dx * (-v2.y) - dy * (-v2.x)) / det;
  
  return {
    x: p1.x + t * v1.x,
    y: p1.y + t * v1.y
  };
};

/**
 * Calculates the True Wind Angle (TWA) for beating upwind based on wind speed.
 */
export const getUpwindTWA = (windSpeed: number): number => {
  if (windSpeed <= 4) return 50; // Very light, hard to point
  if (windSpeed >= 20) return 38; // Heavy mode, pointing high but not pinching
  
  // Linear interpolation between ranges for smoothness
  if (windSpeed < 10) {
    // 4 kts -> 50 deg
    // 10 kts -> 42 deg
    const ratio = (windSpeed - 4) / 6;
    return 50 - ratio * 8;
  }
  
  // 10 kts -> 42 deg
  // 20 kts -> 38 deg
  const ratio = (windSpeed - 10) / 10;
  return 42 - ratio * 4;
};

export const getTackingAngles = (windDir: number, windSpeed: number) => {
  const twa = getUpwindTWA(windSpeed);
  
  // Port Tack: Wind on Port (Left), heading is Wind + TWA
  // Starboard Tack: Wind on Starboard (Right), heading is Wind - TWA
  const portTack = (windDir + twa + 360) % 360;
  const starboardTack = (windDir - twa + 360) % 360;
  
  return { portTack, starboardTack, twa };
};

/**
 * Approximates Boat speed based on TWA and Wind Speed with smoother transitions
 */
export const calculateBoatSpeed = (twa: number, windSpeed: number): number => {
    // Normalize TWA to 0-180
    const angle = Math.abs(twa > 180 ? 360 - twa : twa);
    
    // 1. No Go Zone (Hard limit for visual clarity, usually 30-35)
    if (angle < 30) {
        return 0;
    }

    // Determine target speeds based on wind (Approx displacement hull speed logic)
    // J/70-ish speeds:
    // 6kts wind -> ~5.0kts upwind
    // 12kts wind -> ~6.2kts upwind
    // 20kts wind -> ~7.0kts upwind
    
    let baseMaxSpeed = 0;
    if (windSpeed < 10) {
        // Ramp up quickly in light air
        baseMaxSpeed = windSpeed * 0.7; 
        if (baseMaxSpeed < 3) baseMaxSpeed = 3 + (windSpeed/10); // Floor for visualization
    } else {
        // Diminishing returns in heavy air (hull speed limit)
        baseMaxSpeed = 6.2 + (windSpeed - 10) * 0.1;
    }
    
    // Cap at reasonable max for this boat type
    baseMaxSpeed = Math.min(baseMaxSpeed, 8.5);

    const optTWA = getUpwindTWA(windSpeed);

    // 2. Upwind Ramp (30 to optTWA)
    // We want to reach baseMaxSpeed exactly at optTWA to ensure VMG is optimized there
    if (angle < optTWA) {
        // Smooth sine ramp from 0 speed at 30deg to Max at optTWA
        const range = optTWA - 30;
        const progress = (angle - 30) / range;
        // Ease out sine
        return baseMaxSpeed * Math.sin(progress * Math.PI / 2);
    }

    // 3. Reaching & Downwind (optTWA to 180)
    // Beam reach (90) is typically faster (1.1x - 1.2x upwind speed)
    // Downwind (180) depends heavily on planing
    
    const reachSpeed = baseMaxSpeed * 1.15;
    
    // Heavy air planing bonus for downwind
    let downwindSpeed = baseMaxSpeed * 0.95; 
    if (windSpeed > 14) {
        downwindSpeed = baseMaxSpeed * 1.3; // Planing
    }

    // Smoothstep interpolation helper
    const smoothStep = (t: number) => t * t * (3 - 2 * t);

    if (angle <= 90) {
        // Interpolate optTWA -> 90
        const t = (angle - optTWA) / (90 - optTWA);
        return baseMaxSpeed + (reachSpeed - baseMaxSpeed) * smoothStep(t);
    } else {
        // Interpolate 90 -> 180
        const t = (angle - 90) / 90;
        return reachSpeed + (downwindSpeed - reachSpeed) * smoothStep(t);
    }
};

export const getGroundVector = (
    windDir: number,
    windSpeed: number,
    currentDir: number,
    currentSpeed: number,
    tack: 'port' | 'stbd'
  ) => {
    const { twa } = getTackingAngles(windDir, windSpeed);
    const boatSpeed = calculateBoatSpeed(twa, windSpeed);
    
    // Determine Heading (Water)
    // Port Tack (Wind on left) -> Heading = WindDir + TWA
    // Stbd Tack (Wind on right) -> Heading = WindDir - TWA
    const heading = tack === 'port' 
      ? (windDir + twa) % 360 
      : (windDir - twa + 360) % 360;
  
    // Compass to Math angle: Math = 90 - Compass (Clockwise vs Counter, rotated 90)
    // Or just manually map: N(0) -> +Y, E(90) -> +X
    // boatVel x = speed * sin(heading), y = speed * cos(heading)
    const hRad = toRadians(heading);
    const boatVel = {
      x: boatSpeed * Math.sin(hRad),
      y: boatSpeed * Math.cos(hRad)
    };
  
    const tRad = toRadians(currentDir);
    const currentVel = {
      x: currentSpeed * Math.sin(tRad),
      y: currentSpeed * Math.cos(tRad)
    };
  
    const groundVel = {
      x: boatVel.x + currentVel.x,
      y: boatVel.y + currentVel.y
    };
  
    // Calculate COG (Direction of Ground Velocity)
    // atan2(x, y) gives angle from Y axis for (x,y) point in this coordinate system
    let cog = toDegrees(Math.atan2(groundVel.x, groundVel.y));
    if (cog < 0) cog += 360;
  
    const sog = Math.sqrt(groundVel.x**2 + groundVel.y**2);
  
    return { cog, sog, heading };
  };