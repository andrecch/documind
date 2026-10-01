import { create } from "zustand";

export type ActiveDoc = {
  docId: string;
  name: string;
  mime: string;
  size: number;
};

type ActiveDocState = {
  doc: ActiveDoc | null;
  set: (doc: ActiveDoc) => void;
  clear: () => void;
};

export const useActiveDoc = create<ActiveDocState>((set) => ({
  doc: null,
  set: (doc) => set({ doc }),
  clear: () => set({ doc: null }),
}));
