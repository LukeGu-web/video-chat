import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';

export interface HiyoriLive2DRef {
  playMotion: (motionName: string) => void;
  stopMotion: () => void;
  setParameter: (paramId: string, value: number) => void;
  getParameter: (paramId: string) => number;
  startRandomMotion: (group: string) => void;
}

interface HiyoriLive2DProps {
  width?: number;
  height?: number;
  className?: string;
}

const HiyoriLive2D = forwardRef<HiyoriLive2DRef, HiyoriLive2DProps>(
  ({ width = 500, height = 700, className = '' }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const modelRef = useRef<any>(null);
    const appRef = useRef<any>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      if (!canvasRef.current) return;

      const initializeLive2D = async () => {
        try {
          console.log('Initializing Hiyori Live2D...');
          
          // Wait for both Live2D and Cubism Core to be available
          while (typeof window !== 'undefined' && (!window.Live2DCubismCore || !window.Live2D)) {
            console.log('Waiting for Live2D and Cubism Core...');
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          console.log('Live2D and Cubism Core loaded successfully');
          
          const PIXI = await import('pixi.js');
          const Live2DModule = await import('pixi-live2d-display-mulmotion');
          const { Live2DModel } = Live2DModule;

          console.log('PIXI and Live2D modules loaded', { PIXI, Live2DModule });

          const app = new PIXI.Application({
            view: canvasRef.current!,
            width,
            height,
            backgroundAlpha: 0,
            antialias: true,
          });

          appRef.current = app;
          console.log('PIXI Application created');

          const modelPath = '/assets/live2d/hiyori_vts/hiyori.model3.json';
          console.log('Loading Hiyori model from:', modelPath);
          
          const model = await Live2DModel.from(modelPath, {
            autoFocus: false,
            autoHitTest: true,
            ticker: app.ticker,
          });
          console.log('Hiyori model loaded:', model);
          
          if (model) {
            // Log model dimensions for debugging
            console.log('Model original size:', model.width, model.height);
            console.log('Canvas size:', width, height);
            
            // Position and scale the model - make it much smaller to fit in canvas
            model.scale.set(0.12);
            
            // Center the model
            model.anchor.set(0.5, 0.5);
            model.x = width / 2;
            model.y = height / 2 + 50; // Move down slightly to better center the character
            
            app.stage.addChild(model);
            modelRef.current = model;
            console.log('Model positioned at:', model.x, model.y);
            console.log('Model scaled size:', model.width, model.height);
            
            // Make the entire model interactive
            model.interactive = true;
            model.cursor = 'pointer';
            
            // Set up click interaction
            model.on('pointerdown', () => {
              console.log('Hiyori clicked!');
              // Randomly select a motion for variety
              const motions = ['Happy', 'Surprised', 'Shy'];
              const randomMotion = motions[Math.floor(Math.random() * motions.length)];
              model.motion(randomMotion);
              console.log('Playing click motion:', randomMotion);
            });
            
            // Also set up the hit event if it exists
            model.on('hit', (hitAreas: string[]) => {
              console.log('Hit areas:', hitAreas);
              if (hitAreas.length > 0) {
                // Randomly select a motion for variety
                const motions = ['Happy', 'Surprised', 'Shy'];
                const randomMotion = motions[Math.floor(Math.random() * motions.length)];
                model.motion(randomMotion);
                console.log('Playing hit motion:', randomMotion);
              }
            });
            
            // Set initial part visibility to fix multiple arms issue
            try {
              if (model.internalModel?.coreModel) {
                // Hide alternative arm set (PartArmB) to avoid duplicate arms
                const armBOpacityIndex = model.internalModel.coreModel.getPartIndex('PartArmB');
                if (armBOpacityIndex >= 0) {
                  model.internalModel.coreModel.setPartOpacityById('PartArmB', 0);
                  console.log('Hidden PartArmB to avoid duplicate arms');
                }
                
                // Ensure PartArmA is visible
                const armAOpacityIndex = model.internalModel.coreModel.getPartIndex('PartArmA');
                if (armAOpacityIndex >= 0) {
                  model.internalModel.coreModel.setPartOpacityById('PartArmA', 1);
                  console.log('Set PartArmA visible');
                }
              }
            } catch (error) {
              console.warn('Could not set initial part visibility:', error);
            }
            
            console.log('Hiyori model loaded successfully, ready for manual control');
            
            setIsLoaded(true);
          } else {
            setError('Failed to load Hiyori model');
          }
        } catch (error) {
          console.error('Failed to load Hiyori Live2D model:', error);
          setError(error instanceof Error ? error.message : 'Unknown error');
        }
      };

      initializeLive2D();

      return () => {
        if (appRef.current) {
          appRef.current.destroy(true);
          appRef.current = null;
        }
      };
    }, [width, height]);

    useImperativeHandle(ref, () => ({
      playMotion: (motionName: string) => {
        if (modelRef.current) {
          // Use the same simple approach as Shizuku
          const result = modelRef.current.motion(motionName);
          console.log(`Playing motion "${motionName}", result:`, result);
        }
      },

      stopMotion: () => {
        if (modelRef.current?.internalModel) {
          try {
            console.log('Attempting to stop motions...');
            console.log('MotionManager available:', !!modelRef.current.internalModel.motionManager);
            
            // Try multiple methods to stop motions
            if (modelRef.current.internalModel.motionManager) {
              // Method 1: Try stopAllMotions
              if (typeof modelRef.current.internalModel.motionManager.stopAllMotions === 'function') {
                modelRef.current.internalModel.motionManager.stopAllMotions();
                console.log('Stopped all motions via stopAllMotions');
              }
              // Method 2: Try stop
              else if (typeof modelRef.current.internalModel.motionManager.stop === 'function') {
                modelRef.current.internalModel.motionManager.stop();
                console.log('Stopped motions via stop');
              }
            }
            
            // Alternative: Try to stop motion directly on the model
            if (typeof modelRef.current.stopMotion === 'function') {
              modelRef.current.stopMotion();
              console.log('Stopped motion via model.stopMotion');
            }
            
          } catch (error) {
            console.error('Failed to stop motions:', error);
          }
        }
      },

      setParameter: (paramId: string, value: number) => {
        if (modelRef.current?.internalModel?.coreModel) {
          try {
            console.log('Attempting to set parameter:', paramId, '=', value);
            
            // Set the parameter directly
            modelRef.current.internalModel.coreModel.setParameterValueById(paramId, value);
            console.log('Successfully set parameter:', paramId, '=', value);
            
          } catch (error) {
            console.error('Failed to set parameter:', paramId, error);
            console.log('Available methods:', Object.getOwnPropertyNames(modelRef.current.internalModel.coreModel).filter(name => typeof modelRef.current.internalModel.coreModel[name] === 'function'));
          }
        } else {
          console.error('Model or coreModel not available');
        }
      },

      getParameter: (paramId: string): number => {
        if (modelRef.current?.internalModel?.coreModel) {
          try {
            return modelRef.current.internalModel.coreModel.getParameterValueById(paramId);
          } catch (error) {
            console.error(`Failed to get parameter ${paramId}:`, error);
          }
        }
        return 0;
      },

      startRandomMotion: (group: string) => {
        if (modelRef.current) {
          const motionNames = ['Happy', 'Surprised', 'Shy', 'Wave', 'Dance', 'Laugh', 'Thinking'];
          const randomMotion = motionNames[Math.floor(Math.random() * motionNames.length)];
          
          const result = modelRef.current.motion(randomMotion);
          console.log(`Playing random motion: ${randomMotion}, result:`, result);
        }
      },
    }));

    return (
      <div className={`live2d-container ${className} relative`}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{ width: '100%', height: '100%' }}
        />
        {!isLoaded && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Loading Hiyori...</p>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-50 dark:bg-red-900 rounded-lg">
            <div className="text-center">
              <p className="text-red-600 dark:text-red-400 font-semibold mb-2">Error loading Hiyori model</p>
              <p className="text-sm text-red-500 dark:text-red-300">{error}</p>
            </div>
          </div>
        )}
      </div>
    );
  }
);

HiyoriLive2D.displayName = 'HiyoriLive2D';

export default HiyoriLive2D;