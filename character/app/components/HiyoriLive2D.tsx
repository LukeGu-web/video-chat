import {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  useState,
} from 'react';

// Enhanced readiness states
interface ReadinessState {
  domReady: boolean;
  live2dReady: boolean;
  modelReady: boolean;
  bridgeReady: boolean;
  allReady: boolean;
}

// Message protocol interface
interface BridgeMessage {
  id: string;
  type: string;
  timestamp: number;
  data?: any;
  error?: string;
}

// Performance metrics
interface PerformanceMetrics {
  domLoadTime: number;
  live2dLoadTime: number;
  modelLoadTime: number;
  totalLoadTime: number;
}

// Global bridge interface declaration
declare global {
  interface Window {
    HiyoriBridge?: {
      playMotion: (motionName: string) => any;
      getAvailableMotions: () => string[];
      isModelLoaded: () => boolean;
      getReadinessState: () => ReadinessState;
      getPerformanceMetrics: () => PerformanceMetrics;
      sendHeartbeat: () => void;
    };
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
}

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
    const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);

    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isLoadedRef = useRef<boolean>(false);
    const [readinessState, setReadinessState] = useState<ReadinessState>({
      domReady: false,
      live2dReady: false,
      modelReady: false,
      bridgeReady: false,
      allReady: false,
    });

    const readinessStateRef = useRef<ReadinessState>(readinessState);

    const performanceMetrics = useRef<PerformanceMetrics>({
      domLoadTime: 0,
      live2dLoadTime: 0,
      modelLoadTime: 0,
      totalLoadTime: 0,
    });

    const startTime = useRef<number>(Date.now());

    // Sync state with refs
    useEffect(() => {
      readinessStateRef.current = readinessState;
    }, [readinessState]);

    useEffect(() => {
      isLoadedRef.current = isLoaded;
    }, [isLoaded]);

    // Debug logging utility
    const isDebugMode = process.env.SHOW_TEST_COMPONENTS === 'true';
    const debugLog = (stage: string, message: string, data?: any) => {
      if (!isDebugMode) return;
      const timestamp = Date.now() - startTime.current;
      console.log(`[Hiyori ${stage}][${timestamp}ms] ${message}`, data || '');
    };
    // Send message to React Native WebView
    const sendMessage = (type: string, data?: any, error?: string) => {
      if (typeof window !== 'undefined' && window.ReactNativeWebView) {
        const message: BridgeMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          type,
          timestamp: Date.now(),
          data,
          error,
        };

        try {
          window.ReactNativeWebView.postMessage(JSON.stringify(message));
          debugLog('Bridge', `Sent message: ${type}`, message);
        } catch (err) {
          console.error('[Bridge] Failed to send message:', err);
        }
      }
    };

    // Update readiness state and notify
    const updateReadinessState = (updates: Partial<ReadinessState>) => {
      setReadinessState((prev) => {
        const newState = { ...prev, ...updates };

        // Check if all components are ready
        newState.allReady =
          newState.domReady &&
          newState.live2dReady &&
          newState.modelReady &&
          newState.bridgeReady;

        // Update ref with latest state
        readinessStateRef.current = newState;

        debugLog('State', 'Readiness state updated', newState);

        // Send readiness update to React Native
        sendMessage('readinessUpdate', {
          state: newState,
          metrics: performanceMetrics.current,
        });

        // Send final ready signal when all components are ready
        if (newState.allReady && !prev.allReady) {
          performanceMetrics.current.totalLoadTime =
            Date.now() - startTime.current;
          debugLog(
            'Init',
            'All components ready! Total load time:',
            performanceMetrics.current.totalLoadTime + 'ms'
          );

          sendMessage('modelReady', {
            state: newState,
            metrics: performanceMetrics.current,
          });

          // Start heartbeat
          startHeartbeat();
        }

        return newState;
      });
    };

    // Heartbeat mechanism
    const startHeartbeat = () => {
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }

      heartbeatInterval.current = setInterval(() => {
        const modelLoaded = !!modelRef.current && isLoadedRef.current;
        if (isDebugMode) {
          console.log('💓 [Heartbeat] Sending status update:', {
            modelRef: !!modelRef.current,
            isLoaded: isLoadedRef.current,
            modelLoaded,
            allReady: readinessStateRef.current.allReady,
            bridgeAvailable: !!window.HiyoriBridge,
          });
        }

        debugLog('Heartbeat', 'Sending heartbeat', {
          modelRef: !!modelRef.current,
          isLoaded: isLoadedRef.current,
          modelLoaded,
          state: readinessStateRef.current,
        });

        sendMessage('heartbeat', {
          timestamp: Date.now(),
          modelLoaded,
          state: readinessStateRef.current,
        });
      }, 5000); // Send heartbeat every 5 seconds

      debugLog('Bridge', 'Heartbeat started');
    };

    // Set up JavaScript Bridge
    const setupJavaScriptBridge = () => {
      debugLog('Bridge', 'Setting up JavaScript Bridge...');

      if (typeof window !== 'undefined') {
        window.HiyoriBridge = {
          playMotion: (motionName: string) => {
            if (isDebugMode)
              console.log(
                `🎭 [HiyoriBridge] playMotion called with: "${motionName}"`
              );
            if (isDebugMode) {
              console.log(`🎭 [HiyoriBridge] Current state:`, {
                modelRef: !!modelRef.current,
                isLoaded: isLoadedRef.current,
                allReady: readinessStateRef.current.allReady,
                timestamp: new Date().toISOString(),
              });
            }

            try {
              if (modelRef.current && isLoadedRef.current) {
                if (isDebugMode)
                  console.log(
                    `🎭 [HiyoriBridge] Attempting to play motion "${motionName}"...`
                  );
                const result = modelRef.current.motion(motionName);

                if (isDebugMode)
                  console.log(
                    `✅ [HiyoriBridge] Motion "${motionName}" executed successfully!`,
                    result
                  );
                debugLog('Motion', `Playing motion "${motionName}"`, {
                  success: true,
                  result,
                });

                sendMessage('motionResult', {
                  motion: motionName,
                  success: true,
                  result,
                });

                return result;
              } else {
                const errorMsg = `Model not ready - modelRef: ${!!modelRef.current}, isLoaded: ${
                  isLoadedRef.current
                }`;
                console.error(
                  `❌ [HiyoriBridge] Cannot play motion "${motionName}" - ${errorMsg}`
                );
                debugLog(
                  'Motion',
                  `Cannot play motion "${motionName}" - model not ready`
                );

                sendMessage('motionResult', {
                  motion: motionName,
                  success: false,
                  error: 'Model not loaded',
                });

                return false;
              }
            } catch (error) {
              console.error(
                `💥 [HiyoriBridge] Error playing motion "${motionName}":`,
                error
              );
              debugLog('Motion', `Error playing motion "${motionName}"`, error);

              sendMessage('motionResult', {
                motion: motionName,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
              });

              return false;
            }
          },

          getAvailableMotions: () => {
            const motions = [
              'Idle',
              'Happy',
              'Surprised',
              'Shy',
              'Wave',
              'Dance',
              'Laugh',
              'Thinking',
              'Speaking',
              'Excited',
              'Sleepy',
            ];

            if (isDebugMode)
              console.log(
                `📋 [HiyoriBridge] getAvailableMotions called, returning:`,
                motions
              );
            debugLog('Bridge', 'Available motions requested', motions);
            sendMessage('availableMotions', { motions });

            return motions;
          },

          isModelLoaded: () => {
            const loaded =
              !!modelRef.current &&
              isLoadedRef.current &&
              readinessStateRef.current.allReady;
            if (isDebugMode) {
              console.log(
                `🔍 [HiyoriBridge] isModelLoaded called, checking status:`,
                {
                  modelRef: !!modelRef.current,
                  isLoaded: isLoadedRef.current,
                  allReady: readinessStateRef.current.allReady,
                  result: loaded,
                }
              );
            }
            debugLog('Bridge', 'Model loaded status checked', {
              modelRef: !!modelRef.current,
              isLoaded: isLoadedRef.current,
              allReady: readinessStateRef.current.allReady,
              loaded,
            });
            return loaded;
          },

          getReadinessState: () => {
            debugLog(
              'Bridge',
              'Readiness state requested',
              readinessStateRef.current
            );
            return readinessStateRef.current;
          },

          getPerformanceMetrics: () => {
            debugLog(
              'Bridge',
              'Performance metrics requested',
              performanceMetrics.current
            );
            return performanceMetrics.current;
          },

          sendHeartbeat: () => {
            const modelLoaded = !!modelRef.current && isLoadedRef.current;
            sendMessage('heartbeat', {
              timestamp: Date.now(),
              modelLoaded,
              state: readinessStateRef.current,
              metrics: performanceMetrics.current,
            });
          },
        };

        updateReadinessState({ bridgeReady: true });
        debugLog('Bridge', 'HiyoriBridge initialized successfully');

        if (isDebugMode) {
          console.log(
            '🌟 [HiyoriBridge] JavaScript Bridge fully initialized and ready for motion requests!'
          );
          console.log(
            '🌟 [HiyoriBridge] Available methods:',
            Object.keys(window.HiyoriBridge)
          );
        }
      }
    };

    useEffect(() => {
      if (!canvasRef.current) return;

      const domReadyTime = Date.now();
      performanceMetrics.current.domLoadTime = domReadyTime - startTime.current;

      debugLog('Init', 'DOM ready, starting Live2D initialization');
      updateReadinessState({ domReady: true });

      const initializeLive2D = async () => {
        try {
          debugLog('Init', 'Loading Live2D core libraries...');

          // Wait for both Live2D and Cubism Core to be available
          let attempts = 0;
          const maxAttempts = 100; // 10 seconds max wait

          while (
            typeof window !== 'undefined' &&
            (!window.Live2DCubismCore || !window.Live2D)
          ) {
            if (attempts >= maxAttempts) {
              throw new Error('Timeout waiting for Live2D libraries');
            }

            debugLog(
              'Init',
              `Waiting for Live2D libraries... (attempt ${
                attempts + 1
              }/${maxAttempts})`
            );
            await new Promise((resolve) => setTimeout(resolve, 100));
            attempts++;
          }

          const live2dReadyTime = Date.now();
          performanceMetrics.current.live2dLoadTime =
            live2dReadyTime - startTime.current;

          debugLog('Init', 'Live2D core libraries loaded successfully');
          updateReadinessState({ live2dReady: true });

          debugLog('Init', 'Loading PIXI and Live2D modules...');
          const PIXI = await import('pixi.js');
          const Live2DModule = await import('pixi-live2d-display-mulmotion');
          const { Live2DModel } = Live2DModule;

          debugLog('Init', 'PIXI and Live2D modules loaded', {
            PIXI: !!PIXI,
            Live2DModule: !!Live2DModule,
          });

          debugLog('Init', 'Creating PIXI Application...');
          const app = new PIXI.Application({
            view: canvasRef.current!,
            width,
            height,
            backgroundAlpha: 0,
            antialias: true,
          });

          appRef.current = app;
          debugLog('Init', 'PIXI Application created successfully');

          const modelPath = '/assets/live2d/hiyori_vts/hiyori.model3.json';
          debugLog('Init', 'Loading Hiyori model from:', modelPath);

          const model = await Live2DModel.from(modelPath, {
            autoFocus: false,
            autoHitTest: true,
            ticker: app.ticker,
          });

          const modelReadyTime = Date.now();
          performanceMetrics.current.modelLoadTime =
            modelReadyTime - startTime.current;

          debugLog('Init', 'Hiyori model loaded successfully', model);

          if (model) {
            // Log model dimensions for debugging
            debugLog('Init', 'Model dimensions', {
              original: { width: model.width, height: model.height },
              canvas: { width, height },
            });

            // Position and scale the model
            model.scale.set(0.12);
            model.anchor.set(0.5, 0.5);
            model.x = width / 2;
            model.y = height / 2 - 10; // Adjust Y position for better centering

            app.stage.addChild(model);
            modelRef.current = model;

            debugLog('Init', 'Model positioned and scaled', {
              position: { x: model.x, y: model.y },
              scale: model.scale.x,
              size: { width: model.width, height: model.height },
            });

            // Make the model interactive
            model.interactive = true;
            model.cursor = 'pointer';

            // Set up click interaction
            model.on('pointerdown', () => {
              debugLog('Interaction', 'Model clicked');
              const motions = ['Happy', 'Surprised', 'Shy'];
              const randomMotion =
                motions[Math.floor(Math.random() * motions.length)];
              model.motion(randomMotion);
              debugLog('Interaction', 'Playing click motion:', randomMotion);

              sendMessage('userInteraction', {
                type: 'click',
                motion: randomMotion,
              });
            });

            // Set up hit event
            model.on('hit', (hitAreas: string[]) => {
              debugLog('Interaction', 'Hit areas triggered:', hitAreas);
              if (hitAreas.length > 0) {
                const motions = ['Happy', 'Surprised', 'Shy'];
                const randomMotion =
                  motions[Math.floor(Math.random() * motions.length)];
                model.motion(randomMotion);
                debugLog('Interaction', 'Playing hit motion:', randomMotion);

                sendMessage('userInteraction', {
                  type: 'hit',
                  areas: hitAreas,
                  motion: randomMotion,
                });
              }
            });

            // Set initial part visibility to fix multiple arms issue
            try {
              if (model.internalModel?.coreModel) {
                const coreModel = model.internalModel.coreModel as any;
                const armBOpacityIndex = coreModel.getPartIndex?.('PartArmB');
                if (armBOpacityIndex >= 0) {
                  coreModel.setPartOpacityById?.('PartArmB', 0);
                  debugLog('Init', 'Hidden PartArmB to avoid duplicate arms');
                }

                const armAOpacityIndex = coreModel.getPartIndex?.('PartArmA');
                if (armAOpacityIndex >= 0) {
                  coreModel.setPartOpacityById?.('PartArmA', 1);
                  debugLog('Init', 'Set PartArmA visible');
                }
              }
            } catch (error) {
              debugLog('Init', 'Could not set initial part visibility:', error);
            }

            debugLog('Init', 'Model setup completed successfully');
            setIsLoaded(true);
            isLoadedRef.current = true; // Immediately update ref to avoid timing issues
            updateReadinessState({ modelReady: true });

            // Initialize JavaScript Bridge after model is ready
            setupJavaScriptBridge();
          } else {
            throw new Error('Failed to load Hiyori model - model is null');
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          debugLog('Error', 'Failed to initialize Live2D:', errorMessage);
          console.error('Failed to load Hiyori Live2D model:', error);

          setError(errorMessage);
          sendMessage('initError', {
            error: errorMessage,
            stage: 'initialization',
          });
        }
      };

      initializeLive2D();

      // Send initial DOM ready signal
      sendMessage('domReady', {
        timestamp: Date.now(),
        domLoadTime: performanceMetrics.current.domLoadTime,
      });

      return () => {
        debugLog('Cleanup', 'Cleaning up Live2D component');

        // Clear heartbeat
        if (heartbeatInterval.current) {
          clearInterval(heartbeatInterval.current);
          heartbeatInterval.current = null;
        }

        // Destroy PIXI app
        if (appRef.current) {
          appRef.current.destroy(true);
          appRef.current = null;
        }

        // Clean up model reference
        modelRef.current = null;

        // Clean up JavaScript Bridge
        if (typeof window !== 'undefined' && window.HiyoriBridge) {
          delete window.HiyoriBridge;
          debugLog('Cleanup', 'HiyoriBridge cleaned up');
        }

        sendMessage('cleanup', {
          timestamp: Date.now(),
        });
      };
    }, [width, height]);

    // Expose ref methods
    useImperativeHandle(ref, () => ({
      playMotion: (motionName: string) => {
        if (modelRef.current && isLoaded) {
          modelRef.current.motion(motionName);
        }
      },
      stopMotion: () => {
        if (modelRef.current) {
          // Stop current motion if possible
          debugLog('Motion', 'Stop motion requested');
        }
      },
      setParameter: (paramId: string, value: number) => {
        if (modelRef.current?.internalModel?.coreModel) {
          modelRef.current.internalModel.coreModel.setParameterValueById(
            paramId,
            value
          );
          debugLog('Parameter', `Set parameter ${paramId} to ${value}`);
        }
      },
      getParameter: (paramId: string) => {
        if (modelRef.current?.internalModel?.coreModel) {
          const value =
            modelRef.current.internalModel.coreModel.getParameterValueById(
              paramId
            );
          debugLog('Parameter', `Get parameter ${paramId}: ${value}`);
          return value;
        }
        return 0;
      },
      startRandomMotion: (group: string) => {
        if (modelRef.current) {
          // This would need to be implemented based on the motion groups available
          debugLog('Motion', `Start random motion in group: ${group}`);
        }
      },
    }));

    // Render the component
    return (
      <div className={`relative ${className}`} style={{ width, height }}>
        <canvas
          ref={canvasRef}
          className='w-full h-full'
          style={{ display: error ? 'none' : 'block' }}
        />

        {error && (
          <div className='absolute inset-0 flex items-center justify-center border border-red-200 rounded bg-red-50'>
            <div className='p-4 text-center'>
              <div className='mb-2 font-semibold text-red-600'>
                Live2D Error
              </div>
              <div className='text-sm text-red-500'>{error}</div>
            </div>
          </div>
        )}

        {/* Debug Status Panel (only in development) */}
        {isDebugMode && (
          <div className='absolute p-2 font-mono text-xs text-white bg-black bg-opacity-75 rounded top-2 left-2'>
            <div>DOM: {readinessState.domReady ? '✓' : '⧗'}</div>
            <div>Live2D: {readinessState.live2dReady ? '✓' : '⧗'}</div>
            <div>Model: {readinessState.modelReady ? '✓' : '⧗'}</div>
            <div>Bridge: {readinessState.bridgeReady ? '✓' : '⧗'}</div>
            <div>All Ready: {readinessState.allReady ? '✓' : '⧗'}</div>
            <div>Loaded: {isLoaded ? '✓' : '⧗'}</div>
            <div className='pt-1 mt-1 border-t border-gray-600'>
              <div>Load: {performanceMetrics.current.totalLoadTime}ms</div>
              <div>Model: {performanceMetrics.current.modelLoadTime}ms</div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

HiyoriLive2D.displayName = 'HiyoriLive2D';

export default HiyoriLive2D;
