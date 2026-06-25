import { create } from "zustand";

export type AppTab = "home" | "plan" | "transactions" | "cards" | "profile";

type AppShellState = {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
};

export const useAppShellStore = create<AppShellState>((set) => ({
  activeTab: "home",
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
