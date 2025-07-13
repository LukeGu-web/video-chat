import type { MetaFunction } from "@remix-run/node";
import { ClientOnly } from "remix-utils/client-only";
import { useRef } from "react";
import ShizukuLive2D, { type ShizukuLive2DRef } from "~/components/ShizukuLive2D";

export const meta: MetaFunction = () => {
  return [
    { title: "Shizuku Character App" },
    { name: "description", content: "Live2D Shizuku Character Display" },
  ];
};

export default function Index() {
  const shizukuRef = useRef<ShizukuLive2DRef>(null);

  const motions = [
    { name: 'Idle', label: '🌸 Idle', description: 'Default peaceful state' },
    { name: 'Tap', label: '😊 Happy', description: 'Cheerful tap response' },
    { name: 'FlickUp', label: '😮 Surprised', description: 'Surprised reaction' },
    { name: 'Flick3', label: '😳 Shy', description: 'Shy/embarrassed response' },
  ];

  const expressions = [
    { param: 'PARAM_TERE', label: '😊 Blush', min: 0, max: 1, step: 0.1 },
    { param: 'PARAM_EYE_BALL_X', label: '👁️ Eye X', min: -1, max: 1, step: 0.1 },
    { param: 'PARAM_EYE_BALL_Y', label: '👁️ Eye Y', min: -1, max: 1, step: 0.1 },
    { param: 'PARAM_ANGLE_X', label: '🎭 Head X', min: -30, max: 30, step: 1 },
    { param: 'PARAM_ANGLE_Y', label: '🎭 Head Y', min: -30, max: 30, step: 1 },
  ];

  return (
    <div className="flex h-screen">
      {/* Control Panel */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6">
            🎮 Shizuku Controls
          </h2>
          
          {/* Motion Controls */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
              🎭 Motions
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {motions.map((motion) => (
                <button
                  key={motion.name}
                  onClick={() => shizukuRef.current?.playMotion(motion.name)}
                  className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
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
                    onChange={(e) => shizukuRef.current?.setParameter(expr.param, parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Control Buttons */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
            <button
              onClick={() => {
                shizukuRef.current?.stopMotion();
                console.log('Stopped motion for manual control');
              }}
              className="w-full px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
            >
              ⏸️ Stop Motion
            </button>
            
            <button
              onClick={() => {
                shizukuRef.current?.playMotion('Idle');
                // Reset all parameters
                expressions.forEach(expr => {
                  shizukuRef.current?.setParameter(expr.param, 0);
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
          </div>
        </div>
      </div>

      {/* Character Display */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100 mb-4">
            Meet Shizuku
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
            Your Live2D Character Companion
          </p>
          <div className="flex flex-col items-center gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
              <ClientOnly fallback={<div className="w-96 h-96 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">Loading Shizuku...</div>}>
                {() => <ShizukuLive2D ref={shizukuRef} width={400} height={600} className="rounded-lg" />}
              </ClientOnly>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Click on Shizuku or use the control panel to interact!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
