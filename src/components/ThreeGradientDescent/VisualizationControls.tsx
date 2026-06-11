/**
 * VisualizationControls Component
 * 
 * Floating control panel for toggling visual features and adjusting settings.
 * Provides a user-friendly interface for customizing the 3D visualization.
 * 
 * Features:
 * - Toggle switches for visual elements (particles, contours, arrows, etc.)
 * - Animation speed control
 * - Learning rate presets
 * - Collapsible for minimal visual obstruction
 */

import { useState, useCallback } from 'react';
import { 
  Settings, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  Layers, 
  ArrowRight, 
  Tag, 
  Box,
  Gauge,
  Zap,
  // X - removed, not used
} from 'lucide-react';
import { cn } from '@/utils/cn';

export interface VisualizationSettings {
  showContours: boolean;
  showParticles: boolean;
  showGradientArrow: boolean;
  showCostLabel: boolean;
  showAxisLabels: boolean;
  animationSpeed: number; // 0.5 = slow, 1 = normal, 2 = fast
}

interface VisualizationControlsProps {
  settings: VisualizationSettings;
  onSettingsChange: (settings: VisualizationSettings) => void;
  learningRate: number;
  onLearningRateChange: (rate: number) => void;
  isDark: boolean;
  isPlaying: boolean;
}

// Learning rate presets with descriptions
const LEARNING_RATE_PRESETS = [
  { value: 0.05, label: 'Slow', description: 'Safe but slow convergence', icon: '🐢' },
  { value: 0.1, label: 'Moderate', description: 'Balanced approach', icon: '🚶' },
  { value: 0.2, label: 'Fast', description: 'Quick convergence', icon: '🏃' },
  { value: 0.35, label: 'Risky', description: 'May oscillate', icon: '⚡' },
  { value: 0.5, label: 'Unstable', description: 'Will likely diverge', icon: '💥' },
];

// Animation speed options
const SPEED_OPTIONS = [
  { value: 0.5, label: 'Slow' },
  { value: 1, label: 'Normal' },
  { value: 1.5, label: 'Fast' },
  { value: 2, label: '2x' },
];

export function VisualizationControls({
  settings,
  onSettingsChange,
  learningRate,
  onLearningRateChange,
  isDark,
  isPlaying,
}: VisualizationControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'visuals' | 'speed' | 'presets'>('visuals');
  
  const toggleSetting = useCallback((key: keyof VisualizationSettings) => {
    if (typeof settings[key] === 'boolean') {
      onSettingsChange({
        ...settings,
        [key]: !settings[key],
      });
    }
  }, [settings, onSettingsChange]);
  
  const setAnimationSpeed = useCallback((speed: number) => {
    onSettingsChange({
      ...settings,
      animationSpeed: speed,
    });
  }, [settings, onSettingsChange]);
  
  // Toggle button component
  const ToggleSwitch = ({ 
    enabled, 
    onChange, 
    label, 
    icon: Icon 
  }: { 
    enabled: boolean; 
    onChange: () => void; 
    label: string; 
    icon: typeof Sparkles;
  }) => (
    <button
      onClick={onChange}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm w-full',
        'transition-all duration-200',
        enabled
          ? isDark
            ? 'bg-primary-600/30 text-primary-300 border border-primary-500/50'
            : 'bg-primary-100 text-primary-700 border border-primary-300'
          : isDark
            ? 'bg-dark-700/50 text-dark-400 border border-dark-600'
            : 'bg-slate-100 text-slate-500 border border-slate-200'
      )}
    >
      <Icon size={16} />
      <span className="flex-1 text-left">{label}</span>
      <div className={cn(
        'w-8 h-4 rounded-full relative transition-colors',
        enabled
          ? isDark ? 'bg-primary-500' : 'bg-primary-500'
          : isDark ? 'bg-dark-600' : 'bg-slate-300'
      )}>
        <div className={cn(
          'absolute top-0.5 w-3 h-3 rounded-full transition-transform bg-white',
          enabled ? 'left-4' : 'left-0.5'
        )} />
      </div>
    </button>
  );

  return (
    <div className={cn(
      'absolute top-3 right-3 z-10',
      'rounded-xl shadow-lg overflow-hidden',
      'transition-all duration-300',
      isDark
        ? 'bg-dark-800/95 border border-dark-600 backdrop-blur-sm'
        : 'bg-white/95 border border-slate-200 backdrop-blur-sm',
      isExpanded ? 'w-64' : 'w-auto'
    )}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 w-full',
          'transition-colors',
          isDark
            ? 'hover:bg-dark-700'
            : 'hover:bg-slate-50'
        )}
      >
        <Settings size={16} className={isDark ? 'text-primary-400' : 'text-primary-600'} />
        {isExpanded && (
          <span className={cn(
            'flex-1 text-left text-sm font-medium',
            isDark ? 'text-white' : 'text-slate-800'
          )}>
            Visualization Settings
          </span>
        )}
        {isExpanded ? (
          <ChevronUp size={16} className={isDark ? 'text-dark-400' : 'text-slate-400'} />
        ) : (
          <ChevronDown size={16} className={isDark ? 'text-dark-400' : 'text-slate-400'} />
        )}
      </button>
      
      {/* Expanded Content */}
      {isExpanded && (
        <div className={cn(
          'border-t',
          isDark ? 'border-dark-600' : 'border-slate-200'
        )}>
          {/* Tab Navigation */}
          <div className={cn(
            'flex border-b',
            isDark ? 'border-dark-600' : 'border-slate-200'
          )}>
            {[
              { key: 'visuals', label: 'Visuals', icon: Box },
              { key: 'speed', label: 'Speed', icon: Gauge },
              { key: 'presets', label: 'Presets', icon: Zap },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as typeof activeTab)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1 px-2 py-2 text-xs font-medium',
                  'transition-colors',
                  activeTab === key
                    ? isDark
                      ? 'bg-dark-700 text-primary-400 border-b-2 border-primary-500'
                      : 'bg-slate-50 text-primary-600 border-b-2 border-primary-500'
                    : isDark
                      ? 'text-dark-400 hover:text-dark-200'
                      : 'text-slate-500 hover:text-slate-700'
                )}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>
          
          {/* Tab Content */}
          <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
            {activeTab === 'visuals' && (
              <>
                <ToggleSwitch
                  enabled={settings.showParticles}
                  onChange={() => toggleSetting('showParticles')}
                  label="Flow Particles"
                  icon={Sparkles}
                />
                <ToggleSwitch
                  enabled={settings.showContours}
                  onChange={() => toggleSetting('showContours')}
                  label="Contour Lines"
                  icon={Layers}
                />
                <ToggleSwitch
                  enabled={settings.showGradientArrow}
                  onChange={() => toggleSetting('showGradientArrow')}
                  label="Gradient Arrow"
                  icon={ArrowRight}
                />
                <ToggleSwitch
                  enabled={settings.showCostLabel}
                  onChange={() => toggleSetting('showCostLabel')}
                  label="Cost Label"
                  icon={Tag}
                />
                <ToggleSwitch
                  enabled={settings.showAxisLabels}
                  onChange={() => toggleSetting('showAxisLabels')}
                  label="Axis Labels"
                  icon={Box}
                />
              </>
            )}
            
            {activeTab === 'speed' && (
              <div className="space-y-3">
                <p className={cn(
                  'text-xs',
                  isDark ? 'text-dark-400' : 'text-slate-500'
                )}>
                  Animation Speed
                </p>
                <div className="grid grid-cols-4 gap-1">
                  {SPEED_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setAnimationSpeed(value)}
                      disabled={isPlaying}
                      className={cn(
                        'px-2 py-1.5 rounded text-xs font-medium',
                        'transition-all duration-200',
                        settings.animationSpeed === value
                          ? isDark
                            ? 'bg-primary-600 text-white'
                            : 'bg-primary-500 text-white'
                          : isDark
                            ? 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                        isPlaying && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {isPlaying && (
                  <p className={cn(
                    'text-xs italic',
                    isDark ? 'text-amber-400' : 'text-amber-600'
                  )}>
                    Pause to change speed
                  </p>
                )}
              </div>
            )}
            
            {activeTab === 'presets' && (
              <div className="space-y-2">
                <p className={cn(
                  'text-xs',
                  isDark ? 'text-dark-400' : 'text-slate-500'
                )}>
                  Learning Rate Presets (α)
                </p>
                {LEARNING_RATE_PRESETS.map(({ value, label, description, icon }) => (
                  <button
                    key={value}
                    onClick={() => onLearningRateChange(value)}
                    disabled={isPlaying}
                    className={cn(
                      'w-full px-3 py-2 rounded-lg text-left',
                      'transition-all duration-200',
                      'border',
                      learningRate === value
                        ? isDark
                          ? 'bg-primary-600/30 border-primary-500/50 text-white'
                          : 'bg-primary-50 border-primary-300 text-primary-900'
                        : isDark
                          ? 'bg-dark-700/50 border-dark-600 text-dark-300 hover:bg-dark-700'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100',
                      isPlaying && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span>{icon}</span>
                      <span className="font-medium text-sm">{label}</span>
                      <span className={cn(
                        'ml-auto text-xs font-mono',
                        isDark ? 'text-dark-400' : 'text-slate-500'
                      )}>
                        α={value}
                      </span>
                    </div>
                    <p className={cn(
                      'text-xs mt-0.5 ml-6',
                      isDark ? 'text-dark-500' : 'text-slate-400'
                    )}>
                      {description}
                    </p>
                  </button>
                ))}
                {isPlaying && (
                  <p className={cn(
                    'text-xs italic',
                    isDark ? 'text-amber-400' : 'text-amber-600'
                  )}>
                    Pause to change learning rate
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default VisualizationControls;
