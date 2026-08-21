import { create } from 'zustand';

const STORAGE_KEY = 'ticker-tape-ui';

export interface ModuleContainer {
  id: string;
  name: string;
  moduleRoute: string;
  icon: string;
}

export interface UIState {
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  activeRoute: string;
  containers: ModuleContainer[];
  activeContainerId: string | null;

  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setActiveRoute: (route: string) => void;
  
  addContainer: (moduleRoute: string, name?: string, icon?: string) => string;
  removeContainer: (id: string) => void;
  setActiveContainer: (id: string | null) => void;
  updateContainerModule: (id: string, moduleRoute: string) => void;
}

function loadPersisted(): Pick<UIState, 'theme' | 'sidebarCollapsed'> {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        return {
          theme: data.theme === 'dark' ? 'dark' : 'light',
          sidebarCollapsed:
            typeof data.sidebarCollapsed === 'boolean' ? data.sidebarCollapsed : false,
        };
      }
    }
  } catch {
    // Ignore parse errors — use defaults
  }
  return { theme: 'light', sidebarCollapsed: false };
}

function persist(state: Pick<UIState, 'theme' | 'sidebarCollapsed'>): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ theme: state.theme, sidebarCollapsed: state.sidebarCollapsed }),
      );
    }
  } catch {
    // Storage full or unavailable — degrade gracefully
  }
}

export const useUIStore = create<UIState>((set, get) => {
  const initial = loadPersisted();

  return {
    ...initial,
    activeRoute: '/',
    containers: [],
    activeContainerId: null,

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

    setActiveRoute: (activeRoute) =>
      set({ activeRoute, activeContainerId: null }),

    addContainer: (moduleRoute: string, name?: string, icon: string = '💻') => {
      const id = `container-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const count = get().containers.filter((c) => c.moduleRoute === moduleRoute).length;
      const defaultName = name || (count > 0 ? `Vista ${count + 1}` : 'Vista Auxiliar');
      const newContainer: ModuleContainer = {
        id,
        name: defaultName,
        moduleRoute,
        icon,
      };

      set((state) => ({
        containers: [...state.containers, newContainer],
        activeContainerId: id,
      }));

      return id;
    },

    removeContainer: (id: string) => {
      set((state) => {
        const nextContainers = state.containers.filter((c) => c.id !== id);
        const nextActiveId =
          state.activeContainerId === id
            ? nextContainers.length > 0
              ? nextContainers[nextContainers.length - 1].id
              : null
            : state.activeContainerId;

        return {
          containers: nextContainers,
          activeContainerId: nextActiveId,
        };
      });
    },

    setActiveContainer: (id: string | null) => {
      set({ activeContainerId: id });
    },

    updateContainerModule: (id: string, moduleRoute: string) => {
      set((state) => ({
        containers: state.containers.map((c) =>
          c.id === id ? { ...c, moduleRoute } : c
        ),
      }));
    },
  };
});
