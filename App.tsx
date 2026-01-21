import React, { useState, useEffect, useRef } from 'react';
import RegattaMap from './components/RegattaMap';
import Controls from './components/Controls';
import { CourseConfig, Boat, DEFAULT_CONFIG } from './types';

function App() {
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const containerRef = useRef<HTMLDivElement>(null);

  const [config, setConfig] = useState<CourseConfig>(DEFAULT_CONFIG);

  const [comparisonConfig, setComparisonConfig] = useState<CourseConfig | null>(null);

  const [boats, setBoats] = useState<Boat[]>([
    { id: 'X', position: { x: -50, y: 150 }, tack: 'stbd', visible: false },
    { id: 'Y', position: { x: 50, y: 150 }, tack: 'port', visible: false },
  ]);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Init
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleToggleComparison = () => {
    if (comparisonConfig) {
      // Clear comparison
      setComparisonConfig(null);
    } else {
      // Set current config as the baseline (Scenario A)
      setComparisonConfig({ ...config });
    }
  };

  const handleReset = () => {
    setConfig(DEFAULT_CONFIG);
    // Do not clear comparisonConfig to allow comparing defaults against custom scenario
  };

  return (
    <div className="w-screen h-screen flex flex-col md:flex-row bg-slate-50 relative overflow-hidden">
      
      {/* Sidebar Controls */}
      <div className="absolute top-4 left-4 z-20 md:relative md:top-0 md:left-0 md:w-96 md:h-full md:p-4 pointer-events-none md:pointer-events-auto flex items-start md:justify-center">
         <div className="pointer-events-auto w-full h-full flex flex-col">
            <Controls 
              config={config} 
              onChange={setConfig} 
              isComparing={!!comparisonConfig}
              onToggleComparison={handleToggleComparison}
              onReset={handleReset}
              boats={boats}
              onBoatsChange={setBoats}
            />
         </div>
      </div>

      {/* Main Map Area */}
      <div className="flex-1 h-full relative" ref={containerRef}>
        <RegattaMap
            config={config}
            comparisonConfig={comparisonConfig}
            width={dimensions.width}
            height={dimensions.height}
            onConfigChange={setConfig}
            boats={boats}
            onBoatsChange={setBoats}
        />

        {/* Title */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center pointer-events-none">
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">The Tactician</h1>
          <p className="text-sm text-slate-500 mt-1">visualizes the playing field of a sailing regatta course</p>
        </div>

        <div className="absolute bottom-6 right-6 bg-white/80 backdrop-blur px-4 py-2 rounded-lg text-xs text-slate-500 shadow-sm border border-white/50 pointer-events-none">
            v1.6
        </div>
      </div>
      
    </div>
  );
}

export default App;