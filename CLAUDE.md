# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Regatta Tactician is a React/TypeScript sailing regatta visualization tool that demonstrates how wind shifts, current, and course geometry affect the race course. It renders laylines, ladder rungs, and allows comparing two scenarios (A/B comparison).

## Commands

```bash
bun install          # Install dependencies
bun run dev          # Start dev server on port 3000
bun run build        # Production build to dist/
bun run preview      # Preview production build
```

## Architecture

```
├── App.tsx              # Main app component, state management for config/boats
├── index.tsx            # React entry point
├── types.ts             # TypeScript interfaces (Point, Boat, CourseConfig)
├── components/
│   ├── RegattaMap.tsx   # SVG-based map rendering, drag interactions for wind/current/boats
│   └── Controls.tsx     # Sidebar controls, polar diagram, sliders
├── utils/
│   └── sailingMath.ts   # Sailing calculations (TWA, tacking angles, boat speed, COG/SOG)
├── vite.config.ts       # Vite config with path alias @/* -> ./
└── index.html           # Entry HTML with Tailwind CDN and importmap for ESM
```

## Key Concepts

**Coordinate System**: World coordinates use meters with Y pointing up (North=0°, East=90°). Screen coordinates are standard SVG (Y down). `toScreen()` and `toWorld()` functions in RegattaMap.tsx handle conversion.

**CourseConfig**: Central state object containing wind direction/speed, current direction/speed, course geometry (start line length/bias, mark shift), and visual toggles.

**Laylines**: Calculated from ground velocity vectors (combining boat through-water velocity with current). Port laylines are green, starboard are red.

**Scenario Comparison**: When comparison mode is enabled, `comparisonConfig` stores frozen Scenario A (dashed lines), while current `config` represents editable Scenario B (solid lines).

## Styling

Uses Tailwind CSS via CDN with custom `ocean` color palette defined in index.html. No build-time Tailwind processing.
