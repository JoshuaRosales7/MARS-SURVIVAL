"use client";
import { create } from "zustand";
import { DEFAULT_CONFIG, type Coordinate, type MissionConfig, type Strategy } from "./mars";

type ViewMode = "globe" | "map";
type Store = {
  view: ViewMode; base: Coordinate; destination: Coordinate; cursor: Coordinate;
  strategy: Strategy; config: MissionConfig; selection: "base" | "destination";
  layers: Record<string, boolean>; running: boolean; progress: number; simSpeed: number;
  setView: (view: ViewMode) => void; setCursor: (p: Coordinate) => void;
  setPoint: (p: Coordinate) => void; setSelection: (v: "base" | "destination") => void;
  setStrategy: (s: Strategy) => void; setConfig: (p: Partial<MissionConfig>) => void;
  toggleLayer: (key: string) => void; setRunning: (v: boolean) => void;
  setProgress: (v: number) => void; setSimSpeed: (v: number) => void; reset: () => void;
};

export const useMissionStore = create<Store>((set) => ({
  view: "globe", base: { lat: 18.38, lon: 77.58, name: "Jezero Base" }, destination: { lat: 18.65, lon: 78.15, name: "Science target" },
  cursor: { lat: 18.38, lon: 77.58 }, strategy: "direct", config: DEFAULT_CONFIG, selection: "destination",
  layers: { imagery: true, routes: true, landmarks: true, grid: false }, running: false, progress: 0, simSpeed: 1,
  setView: (view) => set({ view }), setCursor: (cursor) => set({ cursor }),
  setPoint: (p) => set((s) => s.selection === "base" ? { base: p, progress: 0 } : { destination: p, progress: 0 }),
  setSelection: (selection) => set({ selection }), setStrategy: (strategy) => set({ strategy, progress: 0 }),
  setConfig: (p) => set((s) => ({ config: { ...s.config, ...p }, progress: 0 })),
  toggleLayer: (key) => set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } })),
  setRunning: (running) => set({ running }), setProgress: (progress) => set({ progress }), setSimSpeed: (simSpeed) => set({ simSpeed }),
  reset: () => set({ running: false, progress: 0 }),
}));
