import React, { useMemo, useState, useRef } from 'react';
import { CourseConfig, Point, Boat, DEFAULT_CONFIG } from '../types';
import { projectPoint, intersectLines, toRadians, toDegrees, getGroundVector, getTackingAngles, rotatePoint } from '../utils/sailingMath';
import { Flag } from 'lucide-react';

interface Props {
  config: CourseConfig;
  comparisonConfig?: CourseConfig | null;
  width: number;
  height: number;
  onConfigChange?: (config: CourseConfig) => void;
  boats?: Boat[];
  onBoatsChange?: (boats: Boat[]) => void;
}

interface CalculatedLayer {
    ladderRungs: Array<{ p1: Point, p2: Point, labelPos: Point, rotation: number, id: number, label: number }>;
    laylines: {
        leftCorner: Point | null;
        rightCorner: Point | null;
        pinLoc: Point;
        rcLoc: Point;
        markLoc: Point;
    } | null;
    polyPath?: string;
    // Ground COGs for boats to use
    boatVectors: {
        portCOG: number;
        stbdCOG: number;
    };
    windLine: { p1: Point, p2: Point } | null;
    zones?: {
        green: string;
        redLeft: string;
        redRight: string;
        blueBottom: string;
        blueTop: string;
    };
    // Include rotation for rendering Static elements correctly aligned
    rotation: {
        pinRotation: number;
        rcRotation: number;
    }
}

const RegattaMap: React.FC<Props> = ({ config, comparisonConfig, width, height, onConfigChange, boats = [], onBoatsChange }) => {
  // 1. Setup Scaling
  const margin = 50;
  const plotWidth = width - margin * 2;
  const plotHeight = height - margin * 2;
  
  const maxDimension = config.courseLength * 1.4; 
  
  const scale = Math.min(plotWidth, plotHeight) / maxDimension;
  const centerX = width / 2;
  const centerY = height * 0.85; 

  const toScreen = (p: Point): Point => ({
    x: centerX + p.x * scale,
    y: centerY - p.y * scale 
  });
  
  const toWorld = (p: Point): Point => ({
      x: (p.x - centerX) / scale,
      y: (centerY - p.y) / scale
  });

  // --- CALCULATION LOGIC ---
  const calculateLayerData = (cfg: CourseConfig): CalculatedLayer => {
    // 2. Define Course Objects (World Coords) Dynamic per config
    const halfStart = cfg.startLineLength / 2;
    // Base positions before rotation
    const pinBase = { x: -halfStart, y: 0 };
    const rcBase = { x: halfStart, y: 0 };
    
    // Rotate Start Line around center (0,0) based on Bias
    const pinLocWorld = rotatePoint(pinBase, { x: 0, y: 0 }, cfg.startLineBias);
    const rcLocWorld = rotatePoint(rcBase, { x: 0, y: 0 }, cfg.startLineBias);
    
    // Mark position with Shift
    const markLocWorld = { x: cfg.markShift, y: cfg.courseLength };

    // Convert to Screen for Rendering
    const pinLoc = toScreen(pinLocWorld);
    const rcLoc = toScreen(rcLocWorld);
    const markLoc = toScreen(markLocWorld);

    // A. Laylines
    const portData = getGroundVector(cfg.windDirection, cfg.windSpeed, cfg.currentDirection, cfg.currentSpeed, 'port');
    const stbdData = getGroundVector(cfg.windDirection, cfg.windSpeed, cfg.currentDirection, cfg.currentSpeed, 'stbd');

    const markPortLaylineAngle = (portData.cog + 180) % 360;
    const markStbdLaylineAngle = (stbdData.cog + 180) % 360;
    const startPortCOGAngle = portData.cog;
    const startStbdCOGAngle = stbdData.cog;

    let leftCornerWorld = intersectLines(pinLocWorld, startStbdCOGAngle, markLocWorld, markPortLaylineAngle);
    let rightCornerWorld = intersectLines(rcLocWorld, startPortCOGAngle, markLocWorld, markStbdLaylineAngle);
    
    // Clamp logic for visualization (don't draw infinity)
    const getXAtY0 = (angle: number, startY: number) => {
        const rad = toRadians(angle);
        if (Math.abs(Math.cos(rad)) < 0.001) return angle > 180 ? -Infinity : Infinity; 
        return -startY * Math.tan(rad);
    };

    const portLaylineX = getXAtY0(markPortLaylineAngle, cfg.courseLength); 
    const stbdLaylineX = getXAtY0(markStbdLaylineAngle, cfg.courseLength); 

    if (portLaylineX > pinLocWorld.x) leftCornerWorld = pinLocWorld;
    if (stbdLaylineX < rcLocWorld.x) rightCornerWorld = rcLocWorld;
    
    if (leftCornerWorld && leftCornerWorld.y < 0) leftCornerWorld = pinLocWorld;
    if (rightCornerWorld && rightCornerWorld.y < 0) rightCornerWorld = rcLocWorld;

    const leftCorner = leftCornerWorld ? toScreen(leftCornerWorld) : null;
    const rightCorner = rightCornerWorld ? toScreen(rightCornerWorld) : null;

    let polyPath = "";
    if (leftCorner && rightCorner) {
        polyPath = `M ${pinLoc.x} ${pinLoc.y} L ${leftCorner.x} ${leftCorner.y} L ${markLoc.x} ${markLoc.y} L ${rightCorner.x} ${rightCorner.y} L ${rcLoc.x} ${rcLoc.y} Z`;
    }

    // B. Ladder Rungs
    const rungs = [];
    if (cfg.showLadderRungs) {
        const step = 100; 
        const numRungs = Math.ceil((cfg.courseLength * 1.1) / step); 
        const rungWidth = cfg.courseLength * 4; 
        const rungAngle = cfg.windDirection + 90;
        const pad = 20;
        const bounds = { minX: pad, maxX: width - pad, minY: pad, maxY: height - pad };

        for (let i = 0; i <= numRungs; i++) {
            const dist = i * step;
            // Rungs originate from Mark and go downwind
            const centerWorld = projectPoint(markLocWorld, cfg.windDirection + 180, dist);
            
            const p1 = toScreen(projectPoint(centerWorld, rungAngle, rungWidth / 2));
            const p2 = toScreen(projectPoint(centerWorld, rungAngle + 180, rungWidth / 2));
            
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            
            // Intersection with bounds
            const intersections: { x: number, y: number }[] = [];
            const check = (t: number) => t >= 0 && t <= 1;

            if (Math.abs(dx) > 0.01) {
                const tLeft = (bounds.minX - p1.x) / dx;
                if (check(tLeft)) {
                    const y = p1.y + tLeft * dy;
                    if (y >= bounds.minY && y <= bounds.maxY) intersections.push({ x: bounds.minX, y });
                }
                const tRight = (bounds.maxX - p1.x) / dx;
                if (check(tRight)) {
                    const y = p1.y + tRight * dy;
                    if (y >= bounds.minY && y <= bounds.maxY) intersections.push({ x: bounds.maxX, y });
                }
            }
            if (Math.abs(dy) > 0.01) {
                const tTop = (bounds.minY - p1.y) / dy;
                if (check(tTop)) {
                    const x = p1.x + tTop * dx;
                    if (x >= bounds.minX && x <= bounds.maxX) intersections.push({ x, y: bounds.minY });
                }
                const tBottom = (bounds.maxY - p1.y) / dy;
                if (check(tBottom)) {
                    const x = p1.x + tBottom * dx;
                    if (x >= bounds.minX && x <= bounds.maxX) intersections.push({ x, y: bounds.maxY });
                }
            }
            intersections.sort((a, b) => {
                if (Math.abs(a.x - b.x) > 1) return a.x - b.x;
                return a.y - b.y;
            });

            const best = intersections[0];

            if (best) {
                let angleDeg = toDegrees(Math.atan2(dy, dx));
                if (angleDeg > 90) angleDeg -= 180;
                if (angleDeg < -90) angleDeg += 180;

                rungs.push({ 
                    p1, p2, labelPos: { x: best.x, y: best.y }, rotation: angleDeg, id: i, label: dist 
                });
            }
        }
    }
    
    // C. Middle Wind Line (clipped to stay within laylines polygon)
    let windLine = null;
    if (cfg.showWindLine && leftCornerWorld && rightCornerWorld) {
        const windAngle = (cfg.windDirection + 180) % 360;

        // Find intersection with polygon edges (laylines and start line)
        // Polygon: Pin -> leftCorner -> Mark -> rightCorner -> RC -> Pin
        // Wind line from Mark going downwind - check intersections with:
        // 1. Left layline segment: leftCorner -> Pin
        // 2. Start line segment: Pin -> RC
        // 3. Right layline segment: RC -> rightCorner

        const candidates: Point[] = [];

        // Helper to check line segment intersection
        const segmentIntersect = (p1: Point, p2: Point, lineStart: Point, lineAngle: number): Point | null => {
            // Get angle of segment p1->p2
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const segAngle = toDegrees(Math.atan2(dx, dy));
            const intersection = intersectLines(p1, segAngle, lineStart, lineAngle);
            if (!intersection) return null;

            // Check if intersection is within segment bounds
            const minX = Math.min(p1.x, p2.x) - 0.1;
            const maxX = Math.max(p1.x, p2.x) + 0.1;
            const minY = Math.min(p1.y, p2.y) - 0.1;
            const maxY = Math.max(p1.y, p2.y) + 0.1;

            if (intersection.x >= minX && intersection.x <= maxX &&
                intersection.y >= minY && intersection.y <= maxY) {
                return intersection;
            }
            return null;
        };

        // Check left layline (leftCorner -> Pin)
        const leftInt = segmentIntersect(leftCornerWorld, pinLocWorld, markLocWorld, windAngle);
        if (leftInt && leftInt.y < markLocWorld.y) candidates.push(leftInt);

        // Check start line (Pin -> RC)
        const startInt = segmentIntersect(pinLocWorld, rcLocWorld, markLocWorld, windAngle);
        if (startInt && startInt.y < markLocWorld.y) candidates.push(startInt);

        // Check right layline (RC -> rightCorner)
        const rightInt = segmentIntersect(rcLocWorld, rightCornerWorld, markLocWorld, windAngle);
        if (rightInt && rightInt.y < markLocWorld.y) candidates.push(rightInt);

        // Pick the closest intersection point
        let windLineEndWorld = markLocWorld;
        let minDist = Infinity;
        for (const pt of candidates) {
            const d = Math.sqrt((pt.x - markLocWorld.x) ** 2 + (pt.y - markLocWorld.y) ** 2);
            if (d < minDist && d > 1) { // d > 1 to avoid mark itself
                minDist = d;
                windLineEndWorld = pt;
            }
        }

        // Fallback if no intersection found
        if (minDist === Infinity) {
            windLineEndWorld = projectPoint(markLocWorld, windAngle, cfg.courseLength);
        }

        const windLineEnd = toScreen(windLineEndWorld);
        windLine = { p1: markLoc, p2: windLineEnd };
    }

    // D. Zones
    let zones = undefined;
    if (cfg.showZones && leftCornerWorld && rightCornerWorld) {
        const yBot = cfg.courseLength * 0.15;
        const yTop = cfg.courseLength * 0.85;

        // Determine Angles relative to Mark for Bisectors
        // 1. Wind Line Angle from Mark
        const angleWind = (cfg.windDirection + 180) % 360;

        // 2. Left/Right Layline Angles from Mark (Geometry based)
        // Vector Mark -> LeftCorner
        const dxL = leftCornerWorld.x - markLocWorld.x;
        const dyL = leftCornerWorld.y - markLocWorld.y;
        let angleL = toDegrees(Math.atan2(dxL, dyL)); // 0 is +Y
        if (angleL < 0) angleL += 360; // 0..360, 0=N, 90=E

        // Vector Mark -> RightCorner
        const dxR = rightCornerWorld.x - markLocWorld.x;
        const dyR = rightCornerWorld.y - markLocWorld.y;
        let angleR = toDegrees(Math.atan2(dxR, dyR));
        if (angleR < 0) angleR += 360;

        // 3. Bisectors
        // Careful with angle wrapping.
        // Left side is usually < angleWind (e.g. 220 vs 180). Right is > (140 vs 180)?
        // Coordinate system: 0=N (+Y), 180=S (-Y).
        // Wind 0 -> WindLine 180.
        // Laylines might be e.g. 135 (Right/SE) and 225 (Left/SW).
        
        // Helper for bisecting
        const bisect = (a1: number, a2: number) => {
             // Vector sum or simple average if close
             // Using vector sum is safer
             const r1 = toRadians(a1);
             const r2 = toRadians(a2);
             const x = Math.sin(r1) + Math.sin(r2);
             const y = Math.cos(r1) + Math.cos(r2);
             let b = toDegrees(Math.atan2(x, y));
             if (b < 0) b += 360;
             return b;
        };

        const angleWarnL = bisect(angleWind, angleL);
        const angleWarnR = bisect(angleWind, angleR);

        // Helper to get X on boundary (Playing Field Polygon)
        const getXOnPoly = (isLeft: boolean, targetY: number) => {
            const corner = isLeft ? leftCornerWorld : rightCornerWorld;
            const start = isLeft ? pinLocWorld : rcLocWorld;
            if (!corner) return 0;
            
            // If the corner is below targetY, we intersect the upper segment (Layline)
            // Note: Coordinate Y is Up. Corner is usually "lower" than mark.
            // Mark Y = Length (e.g. 1000). Start Y ~ 0.
            // If targetY > corner.y, we are on the Layline segment.
            
            if (targetY > corner.y) {
                 // Segment: Corner -> Mark
                 const fraction = (targetY - corner.y) / (markLocWorld.y - corner.y);
                 return corner.x + (markLocWorld.x - corner.x) * fraction;
            } else {
                 // Segment: Start -> Corner
                 const fraction = (targetY - start.y) / (corner.y - start.y);
                 return start.x + (corner.x - start.x) * fraction;
            }
        };
        
        // Helper to get X on a specific line from Mark
        const getXOnLine = (angle: number, targetY: number) => {
             const rad = toRadians(angle);
             const tan = Math.tan(rad);
             const dy = targetY - markLocWorld.y;
             return markLocWorld.x + dy * tan;
        };

        // Points for Zones
        // Levels: Top (Mark), High (yTop), Low (yBot), Bottom (Start)

        // Top Blue Zone
        // Mark -> Layline Intersects @ yTop -> Mark
        // Bounded by Laylines
        const pL_Top = { x: getXOnPoly(true, yTop), y: yTop };
        const pR_Top = { x: getXOnPoly(false, yTop), y: yTop };
        
        const blueTop = `M ${markLoc.x} ${markLoc.y} L ${toScreen(pR_Top).x} ${toScreen(pR_Top).y} L ${toScreen(pL_Top).x} ${toScreen(pL_Top).y} Z`;

        // Bottom Blue Zone
        // Start -> Layline Intersects @ yBot -> Start
        const pL_Bot = { x: getXOnPoly(true, yBot), y: yBot };
        const pR_Bot = { x: getXOnPoly(false, yBot), y: yBot };
        
        // Need to traverse the bottom boundary of the polygon
        // Path: pL_Bot -> LeftCorner (if below yBot) -> Pin -> RC -> RightCorner (if below yBot) -> pR_Bot
        
        let pathBot = `M ${toScreen(pL_Bot).x} ${toScreen(pL_Bot).y}`;
        if (leftCornerWorld && leftCornerWorld.y < yBot) {
            pathBot += ` L ${leftCorner.x} ${leftCorner.y}`;
        }
        pathBot += ` L ${pinLoc.x} ${pinLoc.y} L ${rcLoc.x} ${rcLoc.y}`;
        if (rightCornerWorld && rightCornerWorld.y < yBot) {
             pathBot += ` L ${rightCorner.x} ${rightCorner.y}`;
        }
        pathBot += ` L ${toScreen(pR_Bot).x} ${toScreen(pR_Bot).y} Z`;

        const blueBottom = pathBot;

        // Middle Zones (Between yBot and yTop)
        // Green: Between Warning Lines
        
        // Calculate Raw Intersections
        const xWL_Top_Raw = getXOnLine(angleWarnL, yTop);
        const xWL_Bot_Raw = getXOnLine(angleWarnL, yBot);
        const xWR_Top_Raw = getXOnLine(angleWarnR, yTop);
        const xWR_Bot_Raw = getXOnLine(angleWarnR, yBot);

        // Clamp Warning Lines to be within Laylines/Poly boundaries.
        // We assume pL (Left Poly) has smaller X than pR (Right Poly).
        // Since bisectors are "inside", pWL should be >= pL and pWR should be <= pR.
        // If the bisector projects outside (e.g. below the corner where poly tapers), we clamp it.
        
        const pWL_Top = { x: Math.max(xWL_Top_Raw, pL_Top.x), y: yTop };
        const pWL_Bot = { x: Math.max(xWL_Bot_Raw, pL_Bot.x), y: yBot };
        const pWR_Top = { x: Math.min(xWR_Top_Raw, pR_Top.x), y: yTop };
        const pWR_Bot = { x: Math.min(xWR_Bot_Raw, pR_Bot.x), y: yBot };

        // Handle crossover (if field is very narrow or distorted) by merging to center
        if (pWL_Top.x > pWR_Top.x) {
            const mid = (pWL_Top.x + pWR_Top.x) / 2;
            pWL_Top.x = mid; pWR_Top.x = mid;
        }
        if (pWL_Bot.x > pWR_Bot.x) {
            const mid = (pWL_Bot.x + pWR_Bot.x) / 2;
            pWL_Bot.x = mid; pWR_Bot.x = mid;
        }

        const green = `M ${toScreen(pWL_Top).x} ${toScreen(pWL_Top).y} L ${toScreen(pWR_Top).x} ${toScreen(pWR_Top).y} L ${toScreen(pWR_Bot).x} ${toScreen(pWR_Bot).y} L ${toScreen(pWL_Bot).x} ${toScreen(pWL_Bot).y} Z`;

        // Red Left: Between Left Poly Boundary and Left Warning Line
        // Polygon: pL_Top -> pWL_Top -> pWL_Bot -> pL_Bot -> (trace boundary if corner is here) -> pL_Top
        let redL = `M ${toScreen(pL_Top).x} ${toScreen(pL_Top).y} L ${toScreen(pWL_Top).x} ${toScreen(pWL_Top).y} L ${toScreen(pWL_Bot).x} ${toScreen(pWL_Bot).y} L ${toScreen(pL_Bot).x} ${toScreen(pL_Bot).y}`;
        // If Corner is between yBot and yTop
        if (leftCornerWorld && leftCornerWorld.y > yBot && leftCornerWorld.y < yTop) {
             redL += ` L ${leftCorner.x} ${leftCorner.y}`;
        }
        redL += ` Z`;

        // Red Right
        let redR = `M ${toScreen(pWR_Top).x} ${toScreen(pWR_Top).y} L ${toScreen(pR_Top).x} ${toScreen(pR_Top).y}`;
        if (rightCornerWorld && rightCornerWorld.y > yBot && rightCornerWorld.y < yTop) {
             redR += ` L ${rightCorner.x} ${rightCorner.y}`;
        }
        redR += ` L ${toScreen(pR_Bot).x} ${toScreen(pR_Bot).y} L ${toScreen(pWR_Bot).x} ${toScreen(pWR_Bot).y} Z`;

        zones = { green, redLeft: redL, redRight: redR, blueBottom, blueTop };
    }

    return {
        ladderRungs: rungs,
        laylines: { leftCorner, rightCorner, pinLoc, rcLoc, markLoc },
        polyPath,
        boatVectors: {
            portCOG: portData.cog,
            stbdCOG: stbdData.cog
        },
        windLine,
        zones,
        rotation: {
            pinRotation: -cfg.startLineBias, // SVG rotation is clockwise, math is usually CCW, but let's visually sync
            rcRotation: cfg.windDirection
        }
    };
  };

  const currentLayer = useMemo(() => calculateLayerData(config), [config, width, height]);
  const comparisonLayer = useMemo(() => comparisonConfig ? calculateLayerData(comparisonConfig) : null, [comparisonConfig, width, height]);


  // --- INTERACTION LOGIC ---
  const [dragging, setDragging] = useState<'wind' | 'current' | 'boatX' | 'boatY' | null>(null);
  const dragStartRef = useRef<Point | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Constants
  const CONTROL_RADIUS = 50;
  const WIND_MAX_SPEED = 30; 
  const CURRENT_MAX_SPEED = 6;

  // Positioning: Current Top-Left, Wind Top-Right
  const currentCenter = { x: 80, y: 100 };
  const windCenter = { x: width - 80, y: 100 };

  // Helper for arrow calculation
  const getArrowPoints = (center: Point, rad: number, radius: number) => {
     const dx = Math.sin(rad) * radius;
     const dy = -Math.cos(rad) * radius;
     return {
        start: { x: center.x - dx, y: center.y - dy },
        end: { x: center.x + dx, y: center.y + dy }
     };
  };

  // Specific calculation for wind (60% to 100% scale)
  const getWindArrow = (center: Point, flowDir: number, speed: number) => {
     const rad = toRadians(flowDir);
     
     // Map speed (1..30) to t (0..1)
     const minSpeed = 1;
     const maxSpeed = 30;
     let t = (Math.max(minSpeed, Math.min(speed, maxSpeed)) - minSpeed) / (maxSpeed - minSpeed);
     
     // Map t to Radius (30px .. 50px) which is 60% .. 100% of diameter (100px)
     const minR = 30;
     const maxR = 50;
     const r = minR + t * (maxR - minR);
     
     return getArrowPoints(center, rad, r);
  };

  // Specific calculation for current (Linear 0..6 scale)
  const getCurrentArrow = (center: Point, flowDir: number, speed: number) => {
     const rad = toRadians(flowDir);
     const maxR = CONTROL_RADIUS;
     const r = Math.min((speed / CURRENT_MAX_SPEED) * maxR, maxR);
     return getArrowPoints(center, rad, r);
  };
  
  const getWavyPath = (p1: Point, p2: Point) => {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 2) return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
      
      const angle = Math.atan2(dy, dx);
      // Less wavy: larger wavelength, smaller amplitude
      const wavelength = 25; 
      const cycles = Math.max(1, Math.round(dist / wavelength)); 
      const amp = 2.5;
      
      let path = `M ${p1.x} ${p1.y}`;
      // Increase steps for smoothness
      const steps = 15 * cycles; 
      
      for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const x = t * dist;
          // Sine wave
          const y = amp * Math.sin(t * Math.PI * 2 * cycles);
          
          // Rotation transform
          const rx = x * Math.cos(angle) - y * Math.sin(angle);
          const ry = x * Math.sin(angle) + y * Math.cos(angle);
          path += ` L ${p1.x + rx} ${p1.y + ry}`;
      }
      return path;
  };

  // Wind Arrow: Points with Flow. If Source Direction=0 (North), Flow is South (180).
  const windCoords = getWindArrow(windCenter, config.windDirection + 180, config.windSpeed);
  
  // Current Arrow: Points to Direction.
  const currentCoords = getCurrentArrow(currentCenter, config.currentDirection, config.currentSpeed);
  const currentPath = getWavyPath(currentCoords.start, currentCoords.end);

  const handlePointerDown = (type: 'wind' | 'current' | 'boatX' | 'boatY') => (e: React.PointerEvent) => {
    setDragging(type);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  
  const handlePointerUp = (e: React.PointerEvent) => {
    // Handle Click vs Drag for Boats
    if ((dragging === 'boatX' || dragging === 'boatY') && dragStartRef.current && onBoatsChange) {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        // If movement is small, treat as click to toggle tack
        if (Math.sqrt(dx*dx + dy*dy) < 5) {
            const boatId = dragging === 'boatX' ? 'X' : 'Y';
            const newBoats = boats.map(b => 
                b.id === boatId ? { ...b, tack: (b.tack === 'port' ? 'stbd' : 'port') as 'port' | 'stbd' } : b
            );
            onBoatsChange(newBoats);
        }
    }

    setDragging(null);
    dragStartRef.current = null;
    (e.target as Element).releasePointerCapture(e.pointerId);
  };
  
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || !onConfigChange) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    // Boat Dragging
    if ((dragging === 'boatX' || dragging === 'boatY') && onBoatsChange) {
         const worldPos = toWorld({ x: mx, y: my });
         const boatId = dragging === 'boatX' ? 'X' : 'Y';
         const newBoats = boats.map(b => b.id === boatId ? { ...b, position: worldPos } : b);
         onBoatsChange(newBoats);
         return;
    }

    // Wind/Current Dragging
    const center = dragging === 'wind' ? windCenter : currentCenter;
    const maxSpeed = dragging === 'wind' ? WIND_MAX_SPEED : CURRENT_MAX_SPEED;
    
    const dx = mx - center.x;
    const dy = my - center.y;
    
    let angle = toDegrees(Math.atan2(dx, -dy));
    if (angle < 0) angle += 360;
    
    const dist = Math.sqrt(dx*dx + dy*dy);
    
    // Reverse calculation to get speed from distance, but clamped for radius behavior logic
    // For Wind, we just want to set speed based on drag distance relative to control radius
    let newSpeed = (dist / CONTROL_RADIUS) * maxSpeed;
    
    if (dragging === 'wind') {
       // Drag Direction is Flow Direction. Wind Source is opposite.
       let sourceDir = (angle + 180) % 360;
       
       newSpeed = Math.min(Math.max(newSpeed, 1), 30); 
       onConfigChange({ ...config, windDirection: Math.round(sourceDir), windSpeed: Math.round(newSpeed) });
    } else {
       // Current Drag Direction is Flow Direction (To).
       newSpeed = Math.min(Math.max(newSpeed, 0), 6);
       onConfigChange({ ...config, currentDirection: Math.round(angle), currentSpeed: parseFloat(newSpeed.toFixed(1)) });
    }
  };

  // Helper to render a layer
  const renderLayer = (layer: CalculatedLayer, isScenarioA: boolean) => {
     // Config A (Frozen): Dashed, Less Transparent (More Prominent), Thinner
     // Config B (Active): Solid, Thick, Fully Opaque
     
     const opacity = isScenarioA ? 0.6 : 1.0; 
     const laylineDash = isScenarioA ? "6 4" : "none"; 
     const ladderDash = isScenarioA ? "4 4" : "none"; 
     const strokeWidth = isScenarioA ? 1.5 : 3;
     const rungStrokeWidth = 1;
     
     // Zone Colors with transparency
     const cBlue = "rgba(59, 130, 246, 0.25)"; // blue-500
     const cGreen = "rgba(34, 197, 94, 0.25)"; // green-500
     const cRed = "rgba(239, 68, 68, 0.25)";   // red-500

     return (
         <g className={isScenarioA ? "scenario-a pointer-events-none" : "scenario-b"}>
             
             {/* Zones (Only active for current scenario) */}
             {layer.zones && !isScenarioA && (
                 <g>
                     <path d={layer.zones.green} fill={cGreen} stroke="none" />
                     <path d={layer.zones.redLeft} fill={cRed} stroke="none" />
                     <path d={layer.zones.redRight} fill={cRed} stroke="none" />
                     <path d={layer.zones.blueBottom} fill={cBlue} stroke="none" />
                     <path d={layer.zones.blueTop} fill={cBlue} stroke="none" />
                 </g>
             )}

             {/* Middle Wind Line */}
             {layer.windLine && (
                 <line 
                    x1={layer.windLine.p1.x} y1={layer.windLine.p1.y} 
                    x2={layer.windLine.p2.x} y2={layer.windLine.p2.y} 
                    stroke="#0ea5e9" 
                    strokeWidth={isScenarioA ? 1 : 1.5}
                    strokeDasharray={isScenarioA ? "6 4" : "none"}
                    opacity={isScenarioA ? 0.6 : 1}
                 />
             )}

             {/* Ladder Rungs */}
             {layer.ladderRungs.map((rung) => (
                <g key={rung.id} opacity={isScenarioA ? 0.7 : 1}>
                    <line 
                        x1={rung.p1.x} y1={rung.p1.y} x2={rung.p2.x} y2={rung.p2.y} 
                        stroke={isScenarioA ? "#94a3b8" : "rgba(0,0,0,0.25)"}
                        strokeWidth={rungStrokeWidth} 
                        strokeDasharray={ladderDash} 
                    />
                    <text 
                        x={rung.labelPos.x} y={rung.labelPos.y} 
                        transform={`rotate(${rung.rotation}, ${rung.labelPos.x}, ${rung.labelPos.y})`}
                        fill="#94a3b8" fontSize="10" textAnchor="middle" dy="-0.3em"
                        fontWeight={rung.label === 0 ? "bold" : "normal"}
                        className="select-none"
                    >
                        {rung.label}m
                    </text>
                </g>
             ))}

            {/* Field Poly */}
            {layer.polyPath && config.showLaylines && (
                 <path d={layer.polyPath} fill={isScenarioA ? "rgba(203, 213, 225, 0.15)" : "rgba(255, 255, 255, 0.4)"} stroke="none" />
            )}

            {/* Laylines */}
            {layer.laylines && layer.laylines.leftCorner && layer.laylines.rightCorner && config.showLaylines && (
                <>
                    <line x1={layer.laylines.pinLoc.x} y1={layer.laylines.pinLoc.y} x2={layer.laylines.leftCorner.x} y2={layer.laylines.leftCorner.y} 
                        stroke="#22c55e" strokeWidth={strokeWidth} strokeDasharray={laylineDash} opacity={opacity} />
                    <line x1={layer.laylines.rcLoc.x} y1={layer.laylines.rcLoc.y} x2={layer.laylines.rightCorner.x} y2={layer.laylines.rightCorner.y} 
                        stroke="#ef4444" strokeWidth={strokeWidth} strokeDasharray={laylineDash} opacity={opacity} />
                    
                    <line x1={layer.laylines.leftCorner.x} y1={layer.laylines.leftCorner.y} x2={layer.laylines.markLoc.x} y2={layer.laylines.markLoc.y} 
                        stroke="#ef4444" strokeWidth={strokeWidth} strokeDasharray={laylineDash} opacity={opacity} />
                    <line x1={layer.laylines.rightCorner.x} y1={layer.laylines.rightCorner.y} x2={layer.laylines.markLoc.x} y2={layer.laylines.markLoc.y} 
                        stroke="#22c55e" strokeWidth={strokeWidth} strokeDasharray={laylineDash} opacity={opacity} />
                </>
            )}

            {/* --- Static Elements Rendered PER Layer (Start Line & Mark) --- */}
            {/* Start Line */}
            {layer.laylines && layer.laylines.pinLoc && layer.laylines.rcLoc && (
                <line 
                    x1={layer.laylines.pinLoc.x} y1={layer.laylines.pinLoc.y} 
                    x2={layer.laylines.rcLoc.x} y2={layer.laylines.rcLoc.y} 
                    stroke={isScenarioA ? "#94a3b8" : "#0f172a"} 
                    strokeWidth="3" 
                    strokeLinecap="round" 
                    strokeDasharray={isScenarioA ? "4 4" : "none"}
                    opacity={isScenarioA ? 0.7 : 1}
                />
            )}
            
            {/* Pin */}
            {layer.laylines && layer.laylines.pinLoc && (
                <g transform={`translate(${layer.laylines.pinLoc.x}, ${layer.laylines.pinLoc.y})`} opacity={opacity}>
                    <circle r="6" fill={isScenarioA ? "#d1d5db" : "#f59e0b"} stroke="#fff" strokeWidth="2" />
                    {!isScenarioA && <text y="20" x="-10" fontSize="12" fontWeight="bold" fill="#0f172a">Pin</text>}
                </g>
            )}

            {/* RC Boat */}
            {layer.laylines && layer.laylines.rcLoc && (
                <g transform={`translate(${layer.laylines.rcLoc.x}, ${layer.laylines.rcLoc.y}) rotate(${layer.rotation.rcRotation})`} opacity={opacity}>
                    <path d="M0,-15 L7,5 L5,8 L-5,8 L-7,5 Z" fill={isScenarioA ? "#e2e8f0" : "#fff"} stroke="#0f172a" strokeWidth="2" />
                    <rect x="-4" y="0" width="8" height="6" fill={isScenarioA ? "#cbd5e1" : "#cbd5e1"} />
                    <g transform="translate(0, 8)">
                        <Flag size={14} className={isScenarioA ? "text-slate-400" : "text-red-600"} style={{ transform: 'rotate(90deg)' }} /> 
                    </g>
                    {!isScenarioA && <text x="0" y="45" transform={`rotate(${-layer.rotation.rcRotation})`} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#0f172a">RC</text>}
                </g>
            )}

            {/* Mark */}
            {layer.laylines && layer.laylines.markLoc && (
                <g transform={`translate(${layer.laylines.markLoc.x}, ${layer.laylines.markLoc.y})`} opacity={opacity}>
                    <circle r="8" fill={isScenarioA ? "#e2e8f0" : "#fbbf24"} stroke={isScenarioA ? "#94a3b8" : "#d97706"} strokeWidth="2" />
                    {!isScenarioA && <text y="-15" x="-15" fontSize="12" fontWeight="bold" fill="#0f172a">Mark 1</text>}
                </g>
            )}

         </g>
     )
  }

  return (
    <div className="relative w-full h-full bg-ocean-100 overflow-hidden rounded-xl shadow-inner border border-ocean-200">
      <svg 
        width={width} 
        height={height} 
        className="absolute top-0 left-0 touch-none"
        ref={svgRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <defs>
          {/* Pointier Wind Arrow */}
          <marker id="windArrowHead" markerWidth="25" markerHeight="16" refX="25" refY="8" orient="auto" markerUnits="userSpaceOnUse">
             <polygon points="0 0, 25 8, 0 16" fill="#0ea5e9" />
          </marker>
        </defs>

        {/* --- SCENARIO A --- */}
        {comparisonLayer && renderLayer(comparisonLayer, true)}

        {/* --- SCENARIO B --- */}
        {renderLayer(currentLayer, false)}

        {/* --- BOATS --- */}
        {boats.filter(b => b.visible).map(boat => {
            const screenPos = toScreen(boat.position);
            const rotation = boat.tack === 'port' ? currentLayer.boatVectors.portCOG : currentLayer.boatVectors.stbdCOG;
            const color = boat.id === 'X' ? '#f43f5e' : '#6366f1'; // Rose for X, Indigo for Y

            return (
                <g 
                    key={boat.id} 
                    transform={`translate(${screenPos.x}, ${screenPos.y}) rotate(${rotation})`}
                    className="cursor-move hover:brightness-110"
                    onPointerDown={handlePointerDown(boat.id === 'X' ? 'boatX' : 'boatY')}
                >
                    {/* Hull */}
                    <ellipse cx="0" cy="0" rx="6" ry="18" fill={color} stroke="white" strokeWidth="2" />
                    {/* Sail (approximate) */}
                    <line x1="0" y1="5" x2="0" y2="-15" stroke="white" strokeWidth="2" />
                    <path d="M0,-15 Q8,0 0,15" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
                    {/* Label */}
                    <text transform={`rotate(${-rotation})`} y="-25" textAnchor="middle" fontSize="14" fontWeight="bold" fill={color} style={{ textShadow: '0 1px 2px white' }}>
                        {boat.id}
                    </text>
                </g>
            );
        })}

        {/* --- Interactive Current Control (Top Left) --- */}
        <g>
             <circle cx={currentCenter.x} cy={currentCenter.y} r={CONTROL_RADIUS} fill="rgba(255,255,255,0.6)" stroke="#cbd5e1" strokeWidth="1"/>
             
             {/* Title inside circle, shifted up slightly */}
             <text x={currentCenter.x} y={currentCenter.y - 12} textAnchor="middle" fontSize="14" fontWeight="bold" fill="#64748b" className="select-none pointer-events-none" style={{textShadow: '0 0 4px white'}}>Current</text>
             
             <g 
                className="cursor-pointer hover:opacity-80"
                onPointerDown={handlePointerDown('current')}
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    onConfigChange?.({
                        ...config,
                        currentDirection: DEFAULT_CONFIG.currentDirection,
                        currentSpeed: DEFAULT_CONFIG.currentSpeed
                    });
                }}
             >
                {/* Hit area */}
                <circle cx={currentCenter.x} cy={currentCenter.y} r={CONTROL_RADIUS} fill="transparent" />
                {config.currentSpeed > 0 && (
                    <>
                        <path 
                            d={currentPath}
                            fill="none"
                            stroke="#0d9488" 
                            strokeWidth="3" 
                        />
                        {/* Manual Arrow Head at the Tip */}
                        <g transform={`translate(${currentCoords.end.x}, ${currentCoords.end.y}) rotate(${config.currentDirection})`}>
                             {/* Shape pointing Up (North/0deg) */}
                             <polygon points="0,0 -5,12 5,12" fill="#0d9488" />
                        </g>
                    </>
                )}
             </g>
             
             {/* Labels */}
             <text x={currentCenter.x} y={currentCenter.y + CONTROL_RADIUS + 15} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#0d9488" className="pointer-events-none select-none" style={{textShadow: '0 0 3px white'}}>
                    {config.currentSpeed}kn {config.currentDirection}°
             </text>
        </g>

        {/* --- Interactive Wind Control (Top Right) --- */}
        <g>
             <circle cx={windCenter.x} cy={windCenter.y} r={CONTROL_RADIUS} fill="rgba(255,255,255,0.6)" stroke="#cbd5e1" strokeWidth="1"/>
             
             {/* Title inside circle, shifted up slightly */}
             <text x={windCenter.x} y={windCenter.y - 12} textAnchor="middle" fontSize="14" fontWeight="bold" fill="#64748b" className="select-none pointer-events-none" style={{textShadow: '0 0 4px white'}}>Wind</text>

             <g 
                className="cursor-pointer hover:opacity-80"
                onPointerDown={handlePointerDown('wind')}
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    onConfigChange?.({
                        ...config,
                        windDirection: DEFAULT_CONFIG.windDirection,
                        windSpeed: DEFAULT_CONFIG.windSpeed
                    });
                }}
             >
                {/* Hit area */}
                <circle cx={windCenter.x} cy={windCenter.y} r={CONTROL_RADIUS} fill="transparent" />
                <line 
                    x1={windCoords.start.x} y1={windCoords.start.y} 
                    x2={windCoords.end.x} y2={windCoords.end.y} 
                    stroke="#0ea5e9" strokeWidth="5" markerEnd="url(#windArrowHead)" 
                />
             </g>
             
             {/* Labels */}
             <text x={windCenter.x} y={windCenter.y + CONTROL_RADIUS + 15} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#0369a1" className="pointer-events-none select-none" style={{textShadow: '0 0 3px white'}}>
                {config.windSpeed}kn {config.windDirection}°
             </text>
        </g>
        
        {/* Comparison Legend */}
        {comparisonConfig && (
            <text x={20} y={height - 20} fontSize="12" fill="#64748b" className="select-none font-medium">
               Dashed: Scenario A | Solid: Scenario B
            </text>
        )}

      </svg>
    </div>
  );
};

export default RegattaMap;