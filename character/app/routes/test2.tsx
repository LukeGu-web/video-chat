import type { MetaFunction } from "@remix-run/node";
import { ClientOnly } from "remix-utils/client-only";
import { useRef } from "react";
import HiyoriLive2D, { type HiyoriLive2DRef } from "~/components/HiyoriLive2D";

// Global bridge interface declaration
declare global {
  interface Window {
    HiyoriBridge?: {
      playMotion: (motionName: string) => any;
      getAvailableMotions: () => string[];
      isModelLoaded: () => boolean;
    };
  }
}

export const meta: MetaFunction = () => {
  return [
    { title: "Hiyori Character App" },
    { name: "description", content: "Live2D Hiyori Character Display" },
  ];
};

export default function Index() {
  const hiyoriRef = useRef<HiyoriLive2DRef>(null);

  const motions = [
    { name: 'Idle', label: '🌸 Idle', description: 'Default peaceful state' },
    { name: 'Happy', label: '😊 Happy', description: 'Cheerful and joyful' },
    { name: 'Surprised', label: '😮 Surprised', description: 'Surprised reaction' },
    { name: 'Shy', label: '😳 Shy', description: 'Shy/embarrassed response' },
    { name: 'Wave', label: '👋 Wave', description: 'Friendly greeting wave' },
    { name: 'Dance', label: '💃 Dance', description: 'Dancing motion' },
    { name: 'Laugh', label: '😄 Laugh', description: 'Laughing animation' },
    { name: 'Thinking', label: '🤔 Thinking', description: 'Thoughtful pose' },
    { name: 'Speaking', label: '🗣️ Speaking', description: 'Speaking animation' },
  ];

  const expressions = [
    { param: 'ParamCheek', label: '😊 Blush', min: 0, max: 1, step: 0.1 },
    { param: 'ParamEyeBallX', label: '👁️ Eye X', min: -1, max: 1, step: 0.1 },
    { param: 'ParamEyeBallY', label: '👁️ Eye Y', min: -1, max: 1, step: 0.1 },
    { param: 'ParamAngleX', label: '🎭 Head X', min: -30, max: 30, step: 1 },
    { param: 'ParamAngleY', label: '🎭 Head Y', min: -30, max: 30, step: 1 },
    { param: 'ParamMouthForm', label: '😊 Smile', min: -1, max: 1, step: 0.1 },
    { param: 'ParamMouthOpenY', label: '👄 Mouth Open', min: 0, max: 2.3, step: 0.1 },
    { param: 'ParamBodyAngleX', label: '👤 Body X', min: -10, max: 10, step: 1 },
  ];

  return (
    <div className="flex h-screen">
      {/* Control Panel */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6">
            🎮 Hiyori Controls
          </h2>
          
          {/* Motion Controls */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
              🎭 Motions
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {motions.map((motion) => (
                <button
                  key={motion.name}
                  onClick={() => hiyoriRef.current?.playMotion(motion.name)}
                  className="px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors"
                  title={motion.description}
                >
                  {motion.label}
                </button>
              ))}
            </div>
          </div>

          {/* Expression Controls */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
              🎨 Expressions
            </h3>
            <div className="space-y-4">
              {expressions.map((expr) => (
                <div key={expr.param} className="space-y-2">
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {expr.label}
                  </label>
                  <input
                    type="range"
                    min={expr.min}
                    max={expr.max}
                    step={expr.step}
                    defaultValue={0}
                    onChange={(e) => hiyoriRef.current?.setParameter(expr.param, parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* JavaScript Bridge Demo */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
              🌉 JavaScript Bridge
            </h3>
            <div className="space-y-3">
              <button
                onClick={() => {
                  if (window.HiyoriBridge) {
                    console.log('Available motions:', window.HiyoriBridge.getAvailableMotions());
                    console.log('Model loaded:', window.HiyoriBridge.isModelLoaded());
                  } else {
                    console.warn('HiyoriBridge not available');
                  }
                }}
                className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
              >
                📋 Log Bridge Info
              </button>
              
              <button
                onClick={() => {
                  if (window.HiyoriBridge) {
                    window.HiyoriBridge.playMotion('Happy');
                  } else {
                    console.warn('HiyoriBridge not available');
                  }
                }}
                className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
              >
                🌉 Bridge: Play Happy
              </button>
              
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Open console to see bridge commands. Use window.HiyoriBridge in browser console.
              </div>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
            <button
              onClick={() => {
                hiyoriRef.current?.stopMotion();
                console.log('Stopped motion for manual control');
              }}
              className="w-full px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
            >
              ⏸️ Stop Motion
            </button>
            
            <button
              onClick={() => {
                hiyoriRef.current?.playMotion('Idle');
                // Reset all parameters
                expressions.forEach(expr => {
                  hiyoriRef.current?.setParameter(expr.param, 0);
                });
                // Reset sliders
                document.querySelectorAll('input[type="range"]').forEach(slider => {
                  (slider as HTMLInputElement).value = '0';
                });
              }}
              className="w-full px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
            >
              🔄 Reset All
            </button>
            
            <button
              onClick={() => hiyoriRef.current?.startRandomMotion('random')}
              className="w-full px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-medium transition-colors"
            >
              🎲 Random Motion
            </button>
          </div>
        </div>
      </div>

      {/* Character Display */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100 mb-4">
            Meet Hiyori
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
            Your Charming Live2D VTuber Companion
          </p>
          <div className="flex flex-col items-center gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
              <ClientOnly fallback={<div className="w-96 h-96 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">Loading Hiyori...</div>}>
                {() => <HiyoriLive2D ref={hiyoriRef} width={500} height={700} className="rounded-lg" />}
              </ClientOnly>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Click on Hiyori or use the control panel to interact!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
