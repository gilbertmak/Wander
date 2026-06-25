import { create } from "zustand";

export type ProductSurface = "home" | "cards" | "desktop";

type AppShellState = {
  activeSurface: ProductSurface;
  setActiveSurface: (surface: ProductSurface) => void;
};

export const useAppShellStore = create<AppShellState>((set) => ({
  activeSurface: "home",
  setActiveSurface: (surface) => set({ activeSurface: surface }),
}));
