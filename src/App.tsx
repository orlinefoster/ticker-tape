import { Shell } from './shell/layout';
import { useTheme } from './theme/useTheme';
import { AuthGate } from './components/auth/AuthGate';

function App() {
  useTheme(); // Apply theme on mount and react to changes

  return (
    <AuthGate>
      <Shell />
    </AuthGate>
  );
}

export default App;
