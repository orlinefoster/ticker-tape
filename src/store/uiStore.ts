import { create } from 'zustand';

const STORAGE_KEY = 'ticker-tape-ui';

export interface UIState {
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  activeRoute: string;

  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setActiveRoute: (route: string) => void;
}

function loadPersisted(): Pick<UIState, 'theme' | 'sidebarCollapsed'> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return {
        theme: data.theme === 'dark' ? 'dark' : 'light',
        sidebarCollapsed:
          typeof data.sidebarCollapsed === 'boolean' ? data.sidebarCollapsed : false,
      };
    }
  } catch {
    // Ignore parse errors — use defaults
  }
  return { theme: 'light', sidebarCollapsed: false };
}

function persist(state: Pick<UIState, 'theme' | 'sidebarCollapsed'>): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ theme: state.theme, sidebarCollapsed: state.sidebarCollapsed }),
    );
  } catch {
    // Storage full or unavailable — degrade gracefully
  }
}

export const useUIStore = create<UIState>((set) => {
  const initial = loadPersisted();

  return {
    ...initial,
    activeRoute: '/',

    toggleSidebar: () =>
      set((prev) => {
        const sidebarCollapsed = !prev.sidebarCollapsed;
        persist({ theme: prev.theme, sidebarCollapsed });
        return { sidebarCollapsed };
      }),

    setTheme: (theme) =>
      set((prev) => {
        persist({ theme, sidebarCollapsed: prev.sidebarCollapsed });
        return { theme };
      }),

    setActiveRoute: (activeRoute) => set({ activeRoute }),
  };
});
