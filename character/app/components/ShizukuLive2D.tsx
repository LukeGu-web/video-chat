import { useEffect, useRef } from 'react';

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

  useEffect(() => {
    if (!canvasRef.current) return;

    const initializeLive2D = async () => {
      try {
        const [{ Application }, { Live2DModel }] = await Promise.all([
          import('pixi.js'),
          import('pixi-live2d-display-mulmotion')
        ]);

        const app = new Application({
          view: canvasRef.current!,
          width,
          height,
          backgroundAlpha: 0,
          antialias: true,
        });

        appRef.current = app;

        const model = await Live2DModel.from('/assets/live2d/shizuku/runtime/shizuku.model3.json');
        
        if (model) {
          model.scale.set(0.3);
          model.x = width / 2;
          model.y = height;
          
          app.stage.addChild(model);
          
          model.on('hit', (hitAreas: string[]) => {
            console.log('Hit areas:', hitAreas);
            if (hitAreas.length > 0) {
              model.motion('Tap');
            }
          });
          
          model.motion('Idle');
          
          const ticker = app.ticker;
          ticker.add(() => {
            model.update(ticker.deltaMS);
          });
        }
      } catch (error) {
        console.error('Failed to load Live2D model:', error);
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
    <div className={`live2d-container ${className}`}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}