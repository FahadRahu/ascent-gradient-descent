import {
  Component,
  Suspense,
  lazy,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { Hud } from './ui/Hud';
import { GraphicsState, type GraphicsStatus } from './ui/GraphicsState';
import { supportsWebGL } from './quality/webgl';

const LazyScene = lazy(async () => {
  const module = await import('./scene/Scene');
  return { default: module.Scene };
});

interface SceneErrorBoundaryProps {
  children: ReactNode;
  onError: () => void;
}

interface SceneErrorBoundaryState {
  failed: boolean;
}

class SceneErrorBoundary extends Component<
  SceneErrorBoundaryProps,
  SceneErrorBoundaryState
> {
  state: SceneErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): SceneErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function App() {
  const [graphicsStatus, setGraphicsStatus] = useState<GraphicsStatus>(() =>
    supportsWebGL() ? 'loading' : 'unavailable',
  );
  const [sceneRevision, setSceneRevision] = useState(0);

  const retryGraphics = () => {
    if (!supportsWebGL()) {
      setGraphicsStatus('unavailable');
      return;
    }
    setGraphicsStatus('loading');
    setSceneRevision((revision) => revision + 1);
  };

  return (
    <main
      id="main-content"
      className="app-shell"
      data-release-revision={import.meta.env.VITE_RELEASE_SHA}
    >
      <div className="scene-layer">
        {graphicsStatus === 'unavailable' ? (
          <GraphicsState status="unavailable" onRetry={retryGraphics} />
        ) : (
          <SceneErrorBoundary
            key={sceneRevision}
            onError={() => setGraphicsStatus('unavailable')}
          >
            <Suspense fallback={<GraphicsState status="loading" />}>
              <LazyScene
                onReady={() => setGraphicsStatus('ready')}
                onFailure={() => setGraphicsStatus('unavailable')}
              />
            </Suspense>
          </SceneErrorBoundary>
        )}
      </div>
      <Hud graphicsStatus={graphicsStatus} />
    </main>
  );
}

export default App;
