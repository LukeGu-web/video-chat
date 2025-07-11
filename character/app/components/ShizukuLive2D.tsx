import { useEffect, useRef, useState } from 'react';

interface ShizukuLive2DProps {
  width?: number;
  height?: number;
  className?: string;
}

export default function ShizukuLive2D({ 
  width = 400, 
  height = 600, 
  className = '' 
}: ShizukuLive2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<any | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          console.log('Model positioned at:', model.x, model.y);
          console.log('Model scaled size:', model.width, model.height);
          
          // Set up interaction
          model.on('hit', (hitAreas: string[]) => {
            console.log('Hit areas:', hitAreas);
            if (hitAreas.length > 0) {
              model.motion('Tap');
            }
          });
          
          // Start idle animation
          setTimeout(() => {
            model.motion('Idle');
            console.log('Idle motion started');
          }, 1000);
          
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
}