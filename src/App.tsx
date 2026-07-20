import { Scene } from './scene/Scene';
import { Hud } from './ui/Hud';

function App() {
  return (
    <main id="main-content" className="app-shell">
      <div className="scene-layer">
        <Scene />
      </div>
      <Hud />
    </main>
  );
}

export default App;
