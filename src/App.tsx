import { Shell } from './shell/layout';
import { useTheme } from './theme/useTheme';

function App() {
  useTheme(); // Apply theme on mount and react to changes

  return <Shell />;
}

export default App;
