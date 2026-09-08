import { create } from 'zustand';

const STORAGE_KEY = 'ticker-tape-ui';

export interface ModuleContainer {
  id: string;
  name: string;
  moduleRoute: string;
  icon: string;
  createdAt?: number;
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
  renameContainer: (id: string, name: string) => void;
  updateContainerIcon: (id: string, icon: string) => void;
  updateContainerModule: (id: string, moduleRoute: string) => void;
  setActiveContainer: (id: string | null) => void;
}

interface PersistedState {
  theme?: 'light' | 'dark';
  sidebarCollapsed?: boolean;
  activeRoute?: string;
  containers?: ModuleContainer[];
  activeContainerId?: string | null;
}

function loadPersisted(): Partial<UIState> {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data: PersistedState = JSON.parse(raw);
        return {
          theme: data.theme === 'light' ? 'light' : 'dark',
          sidebarCollapsed: typeof data.sidebarCollapsed === 'boolean' ? data.sidebarCollapsed : false,
          activeRoute: typeof data.activeRoute === 'string' ? data.activeRoute : '/',
          containers: Array.isArray(data.containers) ? data.containers : [],
          activeContainerId: data.activeContainerId ?? null,
        };
      }
    }
  } catch {
    // Ignore parse errors — fallback to defaults
  }
  return {
    theme: 'dark',
    sidebarCollapsed: false,
    activeRoute: '/',
    containers: [],
    activeContainerId: null,
  };
}

function persist(state: Partial<UIState>): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const dataToSave: PersistedState = {
        theme: state.theme ?? 'dark',
        sidebarCollapsed: state.sidebarCollapsed ?? false,
        activeRoute: state.activeRoute ?? '/',
        containers: state.containers ?? [],
        activeContainerId: state.activeContainerId ?? null,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    }
  } catch {
    // Storage full or unavailable — degrade gracefully
  }
}

export const useUIStore = create<UIState>((set, get) => {
  const initial = loadPersisted();

  return {
    theme: initial.theme ?? 'dark',
    sidebarCollapsed: initial.sidebarCollapsed ?? false,
    activeRoute: initial.activeRoute ?? '/',
    containers: initial.containers ?? [],
    activeContainerId: initial.activeContainerId ?? null,

    toggleSidebar: () =>
      set((prev) => {
        const sidebarCollapsed = !prev.sidebarCollapsed;
        persist({ ...prev, sidebarCollapsed });
        return { sidebarCollapsed };
      }),

    setTheme: (theme) =>
      set((prev) => {
        persist({ ...prev, theme });
        return { theme };
      }),

    setActiveRoute: (activeRoute) =>
      set((prev) => {
        const next = { activeRoute, activeContainerId: null };
        persist({ ...prev, ...next });
        return next;
      }),

    addContainer: (moduleRoute: string, name?: string, icon: string = '💻') => {
      const id = `container-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const count = get().containers.filter((c) => c.moduleRoute === moduleRoute).length;
      const defaultName = name || (count > 0 ? `Vista ${count + 1}` : 'Vista Personalizada');
      const newContainer: ModuleContainer = {
        id,
        name: defaultName,
        moduleRoute,
        icon,
        createdAt: Date.now(),
      };

      set((state) => {
        const nextContainers = [...state.containers, newContainer];
        const nextState = {
          containers: nextContainers,
          activeContainerId: id,
        };
        persist({ ...state, ...nextState });
        return nextState;
      });

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

        const nextState = {
          containers: nextContainers,
          activeContainerId: nextActiveId,
        };
        persist({ ...state, ...nextState });
        return nextState;
      });
    },

    renameContainer: (id: string, name: string) => {
      set((state) => {
        const nextContainers = state.containers.map((c) =>
          c.id === id ? { ...c, name: name.trim() || c.name } : c
        );
        persist({ ...state, containers: nextContainers });
        return { containers: nextContainers };
      });
    },

    updateContainerIcon: (id: string, icon: string) => {
      set((state) => {
        const nextContainers = state.containers.map((c) =>
          c.id === id ? { ...c, icon } : c
        );
        persist({ ...state, containers: nextContainers });
        return { containers: nextContainers };
      });
    },

    setActiveContainer: (id: string | null) => {
      set((prev) => {
        persist({ ...prev, activeContainerId: id });
        return { activeContainerId: id };
      });
    },

    updateContainerModule: (id: string, moduleRoute: string) => {
      set((state) => {
        const nextContainers = state.containers.map((c) =>
          c.id === id ? { ...c, moduleRoute } : c
        );
        persist({ ...state, containers: nextContainers });
        return { containers: nextContainers };
      });
    },
  };
});
