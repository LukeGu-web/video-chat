import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';

interface ShizukuLive2DProps {
  width?: number;
  height?: number;
  className?: string;
}

export interface ShizukuLive2DRef {
  playMotion: (motionName: string) => void;
  setParameter: (paramName: string, value: number) => void;
  stopMotion: () => void;
}

const ShizukuLive2D = forwardRef<ShizukuLive2DRef, ShizukuLive2DProps>(({ 
  width = 400, 
  height = 600, 
  className = '' 
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<any | null>(null);
  const modelRef = useRef<any | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    playMotion: (motionName: string) => {
      if (modelRef.current) {
        modelRef.current.motion(motionName);
        console.log('Playing motion:', motionName);
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
            // Method 3: List available methods
            else {
              console.log('Available motionManager methods:', Object.getOwnPropertyNames(modelRef.current.internalModel.motionManager).filter(name => typeof modelRef.current.internalModel.motionManager[name] === 'function'));
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
    setParameter: (paramName: string, value: number) => {
      if (modelRef.current?.internalModel?.coreModel) {
        try {
          console.log('Attempting to set parameter:', paramName, '=', value);
          
          // Set the parameter directly
          modelRef.current.internalModel.coreModel.setParameterValueById(paramName, value);
          console.log('Successfully set parameter:', paramName, '=', value);
          
        } catch (error) {
          console.error('Failed to set parameter:', paramName, error);
          console.log('Available methods:', Object.getOwnPropertyNames(modelRef.current.internalModel.coreModel).filter(name => typeof modelRef.current.internalModel.coreModel[name] === 'function'));
        }
      } else {
        console.error('Model or coreModel not available');
      }
    }
  }));

  useEffect(() => {
    if (!canvasRef.current) return;

    const initializeLive2D = async () => {
      try {
        console.log('Initializing Live2D...');
        
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

        const modelPath = '/assets/live2d/shizuku/runtime/shizuku.model3.json';
        console.log('Loading model from:', modelPath);
        
        const model = await Live2DModel.from(modelPath, {
          autoFocus: false,
          autoHitTest: true,
          ticker: app.ticker,
        });
        console.log('Model loaded:', model);
        
        if (model) {
          // Log model dimensions for debugging
          console.log('Model original size:', model.width, model.height);
          console.log('Canvas size:', width, height);
          
          // Position and scale the model
          model.scale.set(0.25);
          
          // Center the model
          model.anchor.set(0.5, 0.5);
          model.x = width / 2;
          model.y = height / 2;
          
          app.stage.addChild(model);
          modelRef.current = model;
          console.log('Model positioned at:', model.x, model.y);
          console.log('Model scaled size:', model.width, model.height);
          
          // Make the entire model interactive
          model.interactive = true;
          model.cursor = 'pointer';
          
          // Set up click interaction
          model.on('pointerdown', () => {
            console.log('Model clicked!');
            // Randomly select a motion for variety
            const motions = ['Tap', 'FlickUp', 'Flick3'];
            const randomMotion = motions[Math.floor(Math.random() * motions.length)];
            model.motion(randomMotion);
            console.log('Playing motion:', randomMotion);
          });
          
          // Also set up the hit event if it exists
          model.on('hit', (hitAreas: string[]) => {
            console.log('Hit areas:', hitAreas);
            if (hitAreas.length > 0) {
              // Randomly select a motion for variety
              const motions = ['Tap', 'FlickUp', 'Flick3'];
              const randomMotion = motions[Math.floor(Math.random() * motions.length)];
              model.motion(randomMotion);
              console.log('Playing motion:', randomMotion);
            }
          });
          
          // Debug: Log available parameters and methods
          if (model.internalModel?.coreModel) {
            console.log('CoreModel object:', model.internalModel.coreModel);
            console.log('CoreModel methods:', Object.getOwnPropertyNames(model.internalModel.coreModel).filter(name => typeof model.internalModel.coreModel[name] === 'function'));
            
            // Try different ways to get parameter info
            try {
              const parameterCount = model.internalModel.coreModel.getParameterCount();
              console.log('Available parameters count:', parameterCount);
              
              // Try different method names
              for (let i = 0; i < Math.min(parameterCount, 10); i++) {
                try {
                  let paramId = '';
                  if (typeof model.internalModel.coreModel.getParameterId === 'function') {
                    paramId = model.internalModel.coreModel.getParameterId(i);
                  } else if (typeof model.internalModel.coreModel.getParameterIds === 'function') {
                    const ids = model.internalModel.coreModel.getParameterIds();
                    paramId = ids[i];
                  }
                  
                  if (paramId) {
                    const paramValue = model.internalModel.coreModel.getParameterValueById(paramId);
                    console.log(`Parameter ${i}: ${paramId} = ${paramValue}`);
                  }
                } catch (paramError) {
                  console.log(`Error getting parameter ${i}:`, paramError);
                }
              }
            } catch (error) {
              console.error('Error getting parameter count:', error);
            }
          }
          
          // Don't start idle animation automatically - let user control manually
          console.log('Model loaded successfully, ready for manual control');
          
          setIsLoaded(true);
        } else {
          setError('Failed to load model');
        }
      } catch (error) {
        console.error('Failed to load Live2D model:', error);
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Loading Shizuku...</p>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 dark:bg-red-900 rounded-lg">
          <div className="text-center">
            <p className="text-red-600 dark:text-red-400 font-semibold mb-2">Error loading model</p>
            <p className="text-sm text-red-500 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
});

ShizukuLive2D.displayName = 'ShizukuLive2D';

export default ShizukuLive2D;