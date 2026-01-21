import React, { useMemo, useState } from 'react';
import { CourseConfig, Boat } from '../types';
import { Wind, Ruler, AlignJustify, Sailboat, CornerUpRight, RotateCcw, Waves, GitCompare, XCircle, ArrowDown, PaintBucket, RefreshCw, ChevronUp, ChevronDown, Paperclip } from 'lucide-react';
import { getUpwindTWA, calculateBoatSpeed, toRadians } from '../utils/sailingMath';

interface Props {
  config: CourseConfig;
  onChange: (newConfig: CourseConfig) => void;
  isComparing: boolean;
  onToggleComparison: () => void;
  onReset: () => void;
  boats: Boat[];
  onBoatsChange: (boats: Boat[]) => void;
}

interface ControlSliderProps {
    label: React.ReactNode;
    value: number; // The actual value in config
    displayValue?: React.ReactNode; // What to show (e.g. "12 kn")
    min: number; // Min valid value
    max: number; // Max valid value
    step?: number;
    defaultValue: number;
    onChange: (val: number) => void; // Called with new valid value
    
    // Slider specifics if they differ from value
    sliderValue?: number;
    sliderMin?: number;
    sliderMax?: number;
    onSliderChange?: (val: number) => void; // If slider maps differently
    
    accentColorClass?: string; // e.g. "ocean", "violet" -> produces text-ocean-700 accent-ocean-600
    bottomLabels?: React.ReactNode;
    children?: React.ReactNode;
}

const ControlSlider: React.FC<ControlSliderProps> = ({
    label, value, displayValue, min, max, step = 1, defaultValue, onChange,
    sliderValue, sliderMin, sliderMax, onSliderChange,
    accentColorClass = "slate", bottomLabels, children
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editVal, setEditVal] = useState("");

    const handleStartEdit = () => {
        setEditVal(String(value));
        setIsEditing(true);
    };

    const handleCommit = () => {
        let val = parseFloat(editVal);
        if (isNaN(val)) {
             setIsEditing(false);
             return;
        }
        // Clamp
        if (val < min) val = min;
        if (val > max) val = max;
        
        onChange(val);
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleCommit();
        if (e.key === 'Escape') setIsEditing(false);
    };
    
    const handleIncrement = (delta: number) => {
        let val = parseFloat(editVal);
        if (isNaN(val)) val = value;
        let next = val + delta * step;
        
        // Clamp
        if (next < min) next = min;
        if (next > max) next = max;
        
        // Precision fix
        const precision = step.toString().split('.')[1]?.length || 0;
        next = parseFloat(next.toFixed(precision));
        
        setEditVal(String(next));
    };

    // Derived slider props
    const sVal = sliderValue ?? value;
    const sMin = sliderMin ?? min;
    const sMax = sliderMax ?? max;
    const sChange = onSliderChange ?? onChange;

    // Tailwind dynamic classes
    const valueColorClass = `text-${accentColorClass}-700`;
    const borderColorClass = `border-${accentColorClass}-700`;
    const sliderAccentClass = `accent-${accentColorClass}-600`;

    return (
        <div className="space-y-1">
             <div className="flex justify-between items-center text-sm font-medium text-slate-600">
                <span>{label}</span>
                {isEditing ? (
                    <div className="flex items-center gap-2">
                         {/* Arrow Buttons (Spinner) on the Left */}
                         <div className="flex flex-col">
                            <button 
                                onMouseDown={(e) => { e.preventDefault(); handleIncrement(1); }}
                                className={`flex items-center justify-center ${valueColorClass} hover:bg-slate-100 rounded active:scale-95`}
                                style={{ height: '10px' }}
                            >
                                <ChevronUp size={12} strokeWidth={3} />
                            </button>
                            <button 
                                onMouseDown={(e) => { e.preventDefault(); handleIncrement(-1); }}
                                className={`flex items-center justify-center ${valueColorClass} hover:bg-slate-100 rounded active:scale-95`}
                                style={{ height: '10px' }}
                            >
                                <ChevronDown size={12} strokeWidth={3} />
                            </button>
                         </div>
                        
                        <input 
                            autoFocus
                            type="number"
                            value={editVal}
                            onChange={e => setEditVal(e.target.value)}
                            onBlur={handleCommit}
                            onKeyDown={handleKeyDown}
                            className={`w-16 text-right bg-transparent border ${borderColorClass} rounded px-1 text-xs font-bold ${valueColorClass} outline-none focus:ring-0 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                        />
                    </div>
                ) : (
                    <span 
                        onClick={handleStartEdit}
                        className={`font-bold ${valueColorClass} cursor-pointer hover:bg-slate-100 px-1 rounded transition-colors select-none`}
                        title="Click to edit"
                    >
                        {displayValue ?? value}
                    </span>
                )}
             </div>
             
             <div className="relative pt-1">
                <input
                    type="range"
                    min={sMin}
                    max={sMax}
                    step={step}
                    value={sVal}
                    onChange={(e) => sChange(parseFloat(e.target.value))}
                    onDoubleClick={() => onChange(defaultValue)}
                    className={`w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer ${sliderAccentClass} z-10 relative`}
                />
                 {sMin < 0 && sMax > 0 && (
                    <div className="absolute top-1 left-1/2 w-0.5 h-2 bg-slate-300 -translate-x-1/2 -z-0"></div>
                )}
             </div>
             
             {bottomLabels && (
                 <div className="flex justify-between text-[10px] text-slate-400 px-1">
                    {bottomLabels}
                 </div>
             )}
             
             {children}
        </div>
    );
}

const PolarDiagram = ({ windSpeed }: { windSpeed: number }) => {
  // Generate path data for the polar curve
  // Using 'polarCalculations' var name to avoid any potential shadowing of 'pathData' if it were used inside
  const polarCalculations = useMemo(() => {
    const points: [number, number][] = [];
    let maxS = 0;

    // Calculate one side (0 to 180)
    for (let angle = 0; angle <= 180; angle += 2) {
        const speed = calculateBoatSpeed(angle, windSpeed);
        if (speed > maxS) maxS = speed;
        points.push([angle, speed]);
    }

    const scaleMax = Math.max(Math.ceil(maxS / 2) * 2 + 2, 10);
    const radius = 90; 
    const center = 100;
    
    const toXY = (a: number, s: number) => {
        const r = (s / scaleMax) * radius;
        const rad = (a * Math.PI) / 180;
        return {
            x: center + r * Math.sin(rad),
            y: center - r * Math.cos(rad)
        };
    };

    let d = "";
    if (points.length > 0) {
        // Right side
        points.forEach(([a, s], i) => {
            const p = toXY(a, s);
            if (i === 0) d = `M ${p.x} ${p.y} `;
            else d += `L ${p.x} ${p.y} `;
        });
        
        // Left side (mirror)
        for (let i = points.length - 1; i >= 0; i--) {
            const [a, s] = points[i];
            const p = toXY(-a, s);
            d += `L ${p.x} ${p.y} `;
        }
        d += "Z";
    }

    // Generate rings
    const rings = [];
    for (let s = 2; s < scaleMax; s += 2) {
        const r = (s / scaleMax) * radius;
        rings.push({ r, label: s });
    }

    return { pathData: d, maxSpeed: scaleMax, speedRings: rings };
  }, [windSpeed]);

  const { pathData, maxSpeed, speedRings } = polarCalculations;

  return (
    <div className="flex flex-col items-center mt-2 w-full">
      <div className="relative w-full aspect-square max-w-[200px]">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          {/* Background Circles */}
          {speedRings.map((ring) => (
            <g key={ring.label}>
                <circle cx="100" cy="100" r={ring.r} fill="none" stroke="#e2e8f0" strokeDasharray="2 2" />
                <text x="100" y={100 - ring.r + 2} fontSize="8" fill="#cbd5e1" textAnchor="middle" dy="-1">{ring.label}</text>
            </g>
          ))}
          
          {/* Axis Lines */}
          <line x1="100" y1="10" x2="100" y2="190" stroke="#f1f5f9" strokeWidth="1" />
          <line x1="10" y1="100" x2="190" y2="100" stroke="#f1f5f9" strokeWidth="1" />

          {/* Single Polar Path */}
          <path 
            d={pathData}
            fill="rgba(14, 165, 233, 0.2)"
            stroke="#0ea5e9"
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {/* Wind Arrow */}
          <line x1="100" y1="5" x2="100" y2="30" stroke="#0f172a" strokeWidth="2" markerEnd="url(#windArrowPolar)" />
          
          <defs>
            <marker id="windArrowPolar" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#0f172a" />
            </marker>
          </defs>

          {/* Labels */}
          <text x="100" y="100" dy="12" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#475569">Boat</text>
        </svg>
      </div>
      
      <div className="text-xs text-slate-400 mt-1 text-center w-full">
        <p>Outer Ring: {maxSpeed} kn</p>
      </div>
    </div>
  );
};

const Controls: React.FC<Props> = ({ config, onChange, isComparing, onToggleComparison, onReset, boats, onBoatsChange }) => {
  const handleChange = (key: keyof CourseConfig, value: number | boolean) => {
    onChange({ ...config, [key]: value });
  };

  const adjustWind = (delta: number) => {
    let newDir = (config.windDirection + delta) % 360;
    if (newDir < 0) newDir += 360;
    handleChange('windDirection', newDir);
  };

  const setWind = (dir: number) => {
    handleChange('windDirection', dir);
  };

  const currentTWA = Math.round(getUpwindTWA(config.windSpeed));

  // Wind Slider Logic
  // Mapped from 0-360 range to -180 to 180 for slider ease of use around North
  const windSliderValue = config.windDirection > 180 
    ? config.windDirection - 360 
    : config.windDirection;

  const handleWindSliderChange = (val: number) => {
    const newDir = (val + 360) % 360;
    handleChange('windDirection', newDir);
  };

  // Current Slider Logic
  const currentSliderValue = config.currentDirection > 180
    ? config.currentDirection - 360
    : config.currentDirection;

  const handleCurrentSliderChange = (val: number) => {
    const newDir = (val + 360) % 360;
    handleChange('currentDirection', newDir);
  };

  const toggleBoat = (id: 'X' | 'Y') => {
      const newBoats = boats.map(b => b.id === id ? { ...b, visible: !b.visible } : b);
      onBoatsChange(newBoats);
  };

  const biasHeight = Math.abs(config.startLineLength * Math.sin(toRadians(config.startLineBias))).toFixed(1);

  return (
    <div className={`backdrop-blur-md p-6 rounded-2xl shadow-xl border w-full max-w-sm flex flex-col gap-5 overflow-y-auto max-h-full transition-colors duration-300 ${isComparing ? 'bg-orange-50/90 border-orange-200' : 'bg-white/90 border-white/50'}`}>
      
      <div className="flex flex-col gap-2 mb-2">
          {/* Comparison Toggle */}
          <button 
            onClick={onToggleComparison}
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold transition-all shadow-sm ${isComparing ? 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
          >
            {isComparing ? (
                <>
                  <XCircle size={18} /> Exit Comparison Mode
                </>
            ) : (
                <>
                  <GitCompare size={18} /> Compare
                </>
            )}
          </button>
          
          {/* Reset Button */}
          <button 
            onClick={onReset}
            className="w-full py-2 px-4 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 text-sm"
          >
             <RefreshCw size={16} /> Reset to defaults
          </button>
      </div>

      {isComparing && (
          <div className="text-xs text-orange-800 bg-orange-100 p-2 rounded-lg text-center font-medium">
             Editing Scenario B (Solid Lines). <br/> Scenario A is frozen (Dashed Lines).
          </div>
      )}

      {/* Boat Controls */}
      <div className="flex items-center gap-2 mb-1">
        <Sailboat className="text-rose-600" />
        <h2 className="text-xl font-bold text-slate-800">Yachts</h2>
      </div>
      <div className="flex gap-3">
          <button 
            onClick={() => toggleBoat('X')}
            className={`flex-1 py-2 px-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${boats.find(b => b.id === 'X')?.visible ? 'bg-rose-500 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}
          >
            Yacht X
          </button>
          <button 
            onClick={() => toggleBoat('Y')}
            className={`flex-1 py-2 px-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${boats.find(b => b.id === 'Y')?.visible ? 'bg-indigo-500 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}
          >
            Yacht Y
          </button>
      </div>

      <hr className="border-slate-100" />
      
      {/* Course Geometry */}
      <div className="flex items-center gap-2 mb-1">
        <Paperclip className="text-violet-600" />
        <h2 className="text-xl font-bold text-slate-800">Course</h2>
      </div>

      <div className="space-y-4">
        {/* Start Line Length */}
        <ControlSlider
            label="Start Line Length"
            value={config.startLineLength}
            displayValue={`${config.startLineLength}m`}
            min={50}
            max={500}
            step={10}
            defaultValue={200}
            onChange={(val) => handleChange('startLineLength', val)}
            accentColorClass="violet"
        />

        {/* Start Line Bias */}
        <ControlSlider
            label={
              <div className="flex items-center gap-2">
                <span>Start Bias (Rotation)</span>
                <span className="text-xs font-normal text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">H: {biasHeight}m</span>
              </div>
            }
            value={config.startLineBias}
            displayValue={`${config.startLineBias}°`}
            min={-30}
            max={30}
            defaultValue={0}
            onChange={(val) => handleChange('startLineBias', val)}
            accentColorClass="violet"
            bottomLabels={<><span>Pin</span><span>0</span><span>RC</span></>}
        />

        {/* Mark Shift */}
        <ControlSlider
            label="Mark Shift (Left/Right)"
            value={config.markShift}
            displayValue={`${config.markShift}m`}
            min={-300}
            max={300}
            step={10}
            defaultValue={0}
            onChange={(val) => handleChange('markShift', val)}
            accentColorClass="violet"
            bottomLabels={<><span>-300m</span><span>0</span><span>+300m</span></>}
        />
      </div>

      <hr className="border-slate-100" />

      <div className="flex items-center gap-2 mb-1">
        <Wind className="text-ocean-600" />
        <h2 className="text-xl font-bold text-slate-800">Wind</h2>
      </div>

      {/* Wind Direction Control */}
      <ControlSlider
        label="Direction"
        value={config.windDirection}
        displayValue={`${config.windDirection}°`}
        min={0}
        max={360} // For manual entry
        defaultValue={0}
        onChange={(val) => handleChange('windDirection', val % 360)} // Ensure 0-359
        sliderValue={windSliderValue}
        sliderMin={-180}
        sliderMax={180}
        onSliderChange={handleWindSliderChange}
        accentColorClass="ocean"
        bottomLabels={<><span>-180</span><span>0</span><span>180</span></>}
      >
        <div className="grid grid-cols-5 gap-1 bg-slate-100 p-1 rounded-lg mt-2">
          <button onClick={() => adjustWind(-5)} className="py-2 px-1 hover:bg-white hover:shadow-sm rounded-md text-slate-600 text-xs font-medium active:scale-95">-5°</button>
          <button onClick={() => adjustWind(-1)} className="py-2 px-1 hover:bg-white hover:shadow-sm rounded-md text-slate-600 text-xs font-medium active:scale-95">-1°</button>
          <button onClick={() => setWind(0)} className="py-2 px-1 bg-white shadow-sm border border-slate-200 rounded-md text-ocean-600 text-xs font-bold active:scale-95 flex justify-center items-center" title="0°">0°</button>
          <button onClick={() => adjustWind(1)} className="py-2 px-1 hover:bg-white hover:shadow-sm rounded-md text-slate-600 text-xs font-medium active:scale-95">+1°</button>
          <button onClick={() => adjustWind(5)} className="py-2 px-1 hover:bg-white hover:shadow-sm rounded-md text-slate-600 text-xs font-medium active:scale-95">+5°</button>
        </div>
      </ControlSlider>

      {/* Wind Speed */}
      <ControlSlider
        label="Speed"
        value={config.windSpeed}
        displayValue={`${config.windSpeed} kn`}
        min={1}
        max={30}
        defaultValue={12}
        onChange={(val) => handleChange('windSpeed', val)}
        accentColorClass="ocean"
        bottomLabels={<span className="w-full text-right">TWA: {currentTWA}°</span>}
      />
      
      <hr className="border-slate-100" />
      
      {/* Current Controls */}
      <div className="flex items-center gap-2 mb-1">
        <Waves className="text-teal-600" />
        <h2 className="text-xl font-bold text-slate-800">Current</h2>
      </div>

      <ControlSlider
        label="Direction (To)"
        value={config.currentDirection}
        displayValue={`${config.currentDirection}°`}
        min={0}
        max={360}
        defaultValue={90}
        onChange={(val) => handleChange('currentDirection', val % 360)}
        sliderValue={currentSliderValue}
        sliderMin={-180}
        sliderMax={180}
        onSliderChange={handleCurrentSliderChange}
        accentColorClass="teal"
      />

      <ControlSlider
        label="Speed"
        value={config.currentSpeed}
        displayValue={`${config.currentSpeed} kn`}
        min={0}
        max={6}
        step={0.1}
        defaultValue={0}
        onChange={(val) => handleChange('currentSpeed', val)}
        accentColorClass="teal"
      />

      <hr className="border-slate-100" />
      
      <div className="flex items-center gap-2 mb-1">
        <Ruler className="text-ocean-600" size={20} />
        <h3 className="text-lg font-bold text-slate-800">Visuals</h3>
      </div>

      <div className="space-y-2">
          <label className="flex items-center justify-between cursor-pointer p-2 hover:bg-slate-50 rounded-lg transition-colors">
            <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <AlignJustify size={18} className="rotate-90" /> Ladder Rungs
            </span>
            <input 
                type="checkbox" 
                checked={config.showLadderRungs} 
                onChange={(e) => handleChange('showLadderRungs', e.target.checked)}
                className="w-5 h-5 text-ocean-600 rounded focus:ring-ocean-500"
            />
          </label>
          
           <label className="flex items-center justify-between cursor-pointer p-2 hover:bg-slate-50 rounded-lg transition-colors">
            <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <CornerUpRight size={18} /> Laylines
            </span>
            <input 
                type="checkbox" 
                checked={config.showLaylines} 
                onChange={(e) => handleChange('showLaylines', e.target.checked)}
                className="w-5 h-5 text-ocean-600 rounded focus:ring-ocean-500"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer p-2 hover:bg-slate-50 rounded-lg transition-colors">
            <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <ArrowDown size={18} /> Wind Line
            </span>
            <input 
                type="checkbox" 
                checked={config.showWindLine} 
                onChange={(e) => handleChange('showWindLine', e.target.checked)}
                className="w-5 h-5 text-ocean-600 rounded focus:ring-ocean-500"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer p-2 hover:bg-slate-50 rounded-lg transition-colors">
            <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <PaintBucket size={18} /> Zones
            </span>
            <input 
                type="checkbox" 
                checked={config.showZones} 
                onChange={(e) => handleChange('showZones', e.target.checked)}
                className="w-5 h-5 text-ocean-600 rounded focus:ring-ocean-500"
            />
          </label>
      </div>

      <hr className="border-slate-100" />

      {/* Polar Diagram Section */}
      <div className="flex items-center gap-2">
        <RotateCcw className="text-ocean-600" size={20} />
        <h3 className="text-lg font-bold text-slate-800">Polar Diagram</h3>
      </div>
      <PolarDiagram windSpeed={config.windSpeed} />

    </div>
  );
};

export default Controls;