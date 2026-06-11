import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { GradientDescentVisualization } from './components/GradientDescentVisualization';
import { cn } from './utils/cn';

function App() {
  const [isDark, setIsDark] = useState(true);

  // Sync dark mode class on <html>
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <div className={cn(
      'min-h-screen transition-colors duration-300',
      isDark ? 'bg-dark-900 text-white' : 'bg-slate-50 text-slate-900'
    )}>
      {/* Header */}
      <header className={cn(
        'sticky top-0 z-50 border-b backdrop-blur-sm',
        isDark ? 'bg-dark-900/80 border-dark-700' : 'bg-white/80 border-slate-200'
      )}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold font-display">
            Gradient Descent Visualization
          </h1>
          <button
            onClick={() => setIsDark(!isDark)}
            className={cn(
              'p-2 rounded-lg transition-colors',
              isDark
                ? 'hover:bg-dark-700 text-dark-300'
                : 'hover:bg-slate-200 text-slate-600'
            )}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <GradientDescentVisualization isDark={isDark} />
      </main>
    </div>
  );
}

export default App;
