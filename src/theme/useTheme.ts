import { useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';

export function useTheme() {
  const { theme, setTheme } = useUIStore();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return {
    theme,
    toggleTheme: () => setTheme(theme === 'light' ? 'dark' : 'light'),
  };
}
