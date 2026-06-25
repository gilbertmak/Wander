import { create } from "zustand";

export type ProductSurface = "home" | "cards" | "desktop";
export type MobileTab = "home" | "plan" | "transactions" | "cards" | "profile";

type AppShellState = {
  activeSurface: ProductSurface;
  activeTab: MobileTab;
  setActiveSurface: (surface: ProductSurface) => void;
  setActiveTab: (tab: MobileTab) => void;
};

export const useAppShellStore = create<AppShellState>((set) => ({
  activeSurface: "home",
  activeTab: "home",
  setActiveSurface: (surface) => set({ activeSurface: surface }),
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
