import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from './uiStore';

// Simple mock storage for Node test environment
const mockStorage: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => mockStorage[k] || null,
  setItem: (k: string, v: string) => { mockStorage[k] = v; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
};

describe('useUIStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useUIStore.setState({
      theme: 'light',
      sidebarCollapsed: false,
      activeRoute: '/',
      containers: [],
      activeContainerId: null,
    });
  });

  it('should initialize with default state', () => {
    const state = useUIStore.getState();
    expect(state.theme).toBe('light');
    expect(state.sidebarCollapsed).toBe(false);
    expect(state.activeRoute).toBe('/');
    expect(state.containers).toEqual([]);
    expect(state.activeContainerId).toBeNull();
  });

  it('should toggle sidebar collapse state', () => {
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);

    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
  });

  it('should set active route', () => {
    useUIStore.getState().setActiveRoute('/backtesting');
    expect(useUIStore.getState().activeRoute).toBe('/backtesting');
  });

  it('should set theme and persist', () => {
    useUIStore.getState().setTheme('dark');
    expect(useUIStore.getState().theme).toBe('dark');
  });

  it('should add, switch, and remove containers dynamically', () => {
    const c1Id = useUIStore.getState().addContainer('/elliott', 'Ondas Custom');
    expect(useUIStore.getState().containers).toHaveLength(1);
    expect(useUIStore.getState().activeContainerId).toBe(c1Id);

    const c2Id = useUIStore.getState().addContainer('/monitor', 'Monitor Secundario');
    expect(useUIStore.getState().containers).toHaveLength(2);
    expect(useUIStore.getState().activeContainerId).toBe(c2Id);

    useUIStore.getState().setActiveContainer(c1Id);
    expect(useUIStore.getState().activeContainerId).toBe(c1Id);

    useUIStore.getState().removeContainer(c1Id);
    expect(useUIStore.getState().containers).toHaveLength(1);
    expect(useUIStore.getState().activeContainerId).toBe(c2Id);
  });

  it('should rename and update icon of containers', () => {
    const cId = useUIStore.getState().addContainer('/cartera', 'Mi Cartera');
    expect(useUIStore.getState().containers[0].name).toBe('Mi Cartera');

    useUIStore.getState().renameContainer(cId, 'Setup Cripto Alfa');
    expect(useUIStore.getState().containers[0].name).toBe('Setup Cripto Alfa');

    useUIStore.getState().updateContainerIcon(cId, '💎');
    expect(useUIStore.getState().containers[0].icon).toBe('💎');

    useUIStore.getState().updateContainerModule(cId, '/cartera-iol');
    expect(useUIStore.getState().containers[0].moduleRoute).toBe('/cartera-iol');
  });

  it('should persist containers and active container to localStorage', () => {
    const cId = useUIStore.getState().addContainer('/chart', 'Grafico Principal', '📈');
    expect(mockStorage['ticker-tape-ui']).toBeDefined();
    
    const parsed = JSON.parse(mockStorage['ticker-tape-ui']);
    expect(parsed.containers).toHaveLength(1);
    expect(parsed.containers[0].id).toBe(cId);
    expect(parsed.containers[0].name).toBe('Grafico Principal');
    expect(parsed.activeContainerId).toBe(cId);
  });
});
