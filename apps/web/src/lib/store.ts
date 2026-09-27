import { create } from "zustand";

export type ActiveDoc = {
  name: string;
  mime: string;
  size: number;
  objectUrl: string;
};

type ActiveDocState = {
  doc: ActiveDoc | null;
  set: (doc: ActiveDoc) => void;
  clear: () => void;
};

export const useActiveDoc = create<ActiveDocState>((set) => ({
  doc: null,
  // Revoca el blob anterior al reemplazarlo (máximo 1 objectUrl vivo por sesión)
  set: (doc) =>
    set((s) => {
      if (s.doc) URL.revokeObjectURL(s.doc.objectUrl);
      return { doc };
    }),
  clear: () => set({ doc: null }),
}));
