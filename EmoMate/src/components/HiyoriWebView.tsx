import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { isDebugMode, debugLog, debugError, debugWarn, DebugTimer } from '../utils/debug';

interface HiyoriWebViewProps {
  style?: any;
  onModelReady?: () => void;
  onMotionResult?: (motion: string, success: boolean, error?: string) => void;
}

interface HiyoriBridge {
  playMotion: (motionName: string) => void;
  getAvailableMotions: () => void;
  checkModelStatus: () => void;
  reload: () => void;
}

interface PendingMessage {
  id: string;
  jsCode: string;
  callback?: (result: any) => void;
}

interface WebViewState {
  isWebViewReady: boolean;
  isModelReady: boolean;
  isLoading: boolean;
  error: string | null;
  loadAttempts: number;
}

const TIMEOUT_MS = 10000; // 10 seconds timeout
const MAX_LOAD_ATTEMPTS = 3;

const HiyoriWebView = React.forwardRef<any, HiyoriWebViewProps>(({
  style,
  onModelReady,
  onMotionResult,
}, ref) => {
  const webViewRef = useRef<WebView>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingMessages = useRef<PendingMessage[]>([]);
  const checkingModel = useRef<boolean>(false);
  
  // State management
  const [state, setState] = useState<WebViewState>({
    isWebViewReady: false,
    isModelReady: false,
    isLoading: true,
    error: null,
    loadAttempts: 0,
  });


  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Execute pending messages when WebView becomes ready
  useEffect(() => {
    if (state.isWebViewReady && pendingMessages.current.length > 0) {
      debugLog('HiyoriWebView', `Executing ${pendingMessages.current.length} pending messages`);
      const messages = pendingMessages.current.splice(0);
      messages.forEach(({ jsCode, callback }) => {
        executeJavaScript(jsCode, callback);
      });
    }
  }, [state.isWebViewReady]);

  // Set up timeout for model readiness
  const startReadinessTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      if (!state.isModelReady) {
        debugError('HiyoriWebView', 'Model readiness timeout');
        setState(prev => ({
          ...prev,
          error: '模型加载超时，请检查网络连接',
          isLoading: false,
        }));
      }
    }, TIMEOUT_MS);
  }, [state.isModelReady]);

  // Execute JavaScript with proper error handling
  const executeJavaScript = useCallback((jsCode: string, callback?: (result: any) => void) => {
    if (!state.isWebViewReady || !webViewRef.current) {
      // Queue the message for later execution
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      pendingMessages.current.push({ id: messageId, jsCode, callback });
      debugLog('HiyoriWebView', 'Queuing JavaScript execution:', messageId);
      return;
    }

    try {
      webViewRef.current.injectJavaScript(jsCode);
      callback?.(true);
    } catch (error) {
      debugError('HiyoriWebView', 'JavaScript execution failed:', error);
      callback?.(false);
    }
  }, [state.isWebViewReady]);

  // Check if model is loaded
  const checkModelLoaded = useCallback(() => {
    if (checkingModel.current) {
      debugLog('HiyoriWebView', 'Model check already in progress, skipping...');
      return;
    }
    
    checkingModel.current = true;
    
    const jsCode = `
      (function checkModel() {
        try {
          if (window.HiyoriBridge && typeof window.HiyoriBridge.isModelLoaded === 'function') {
            const isReady = window.HiyoriBridge.isModelLoaded();
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'modelStatus',
              ready: isReady,
              timestamp: Date.now()
            }));
          } else {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'bridgeStatus',
              available: false,
              timestamp: Date.now()
            }));
          }
        } catch (error) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'error',
            error: 'Failed to check model status: ' + error.message,
            timestamp: Date.now()
          }));
        }
      })();
    `;
    
    executeJavaScript(jsCode);
    
    // Reset checking flag after a delay
    setTimeout(() => {
      checkingModel.current = false;
    }, 1000);
  }, [executeJavaScript]);

  // Handle messages from WebView
  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      debugLog('HiyoriWebView', 'Received message from WebView:', message);

      switch (message.type) {
        case 'webViewReady':
          debugLog('HiyoriWebView', 'WebView is ready for communication');
          setState(prev => ({ ...prev, isWebViewReady: true }));
          // No need to check model status - new system will send modelReady when ready
          break;

        case 'domReady':
          debugLog('HiyoriWebView', 'DOM ready in WebView', message.data);
          break;

        case 'readinessUpdate':
          debugLog('HiyoriWebView', 'Readiness state update:', message.data?.state);
          if (message.data?.state) {
            const readiness = message.data.state;
            setState(prev => ({
              ...prev,
              isWebViewReady: readiness.domReady,
            }));
          }
          break;

        case 'modelReady':
          debugLog('HiyoriWebView', 'Hiyori model is fully ready!', message.data);
          setState(prev => ({
            ...prev,
            isModelReady: true,
            isLoading: false,
            error: null,
          }));
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          onModelReady?.();
          break;

        case 'heartbeat':
          debugLog('HiyoriWebView', 'Received heartbeat from WebView');
          // Reset timeout on successful heartbeat
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            startReadinessTimeout();
          }
          break;

        case 'userInteraction':
          debugLog('HiyoriWebView', 'User interaction:', message.data);
          break;

        case 'initError':
          debugError('HiyoriWebView', 'Initialization error:', message.data?.error);
          setState(prev => ({
            ...prev,
            error: message.data?.error || 'Initialization failed',
            isLoading: false,
          }));
          break;

        case 'modelStatus':
          // Legacy modelStatus messages - ignore them in favor of the new system
          debugLog('HiyoriWebView', 'Received legacy modelStatus:', message.ready);
          break;

        case 'bridgeStatus':
          if (message.available) {
            debugLog('HiyoriWebView', 'HiyoriBridge is available');
            // New system will automatically send modelReady when fully initialized
          } else {
            debugWarn('HiyoriWebView', 'HiyoriBridge not available');
          }
          break;

        case 'motionResult':
          debugLog('HiyoriWebView', 
            `Motion ${message.data?.motion}:`,
            message.data?.success ? 'Success' : message.data?.error
          );
          onMotionResult?.(message.data?.motion, message.data?.success, message.data?.error);
          break;

        case 'availableMotions':
          debugLog('HiyoriWebView', 'Available motions:', message.data?.motions);
          break;

        case 'cleanup':
          debugLog('HiyoriWebView', 'WebView cleanup completed');
          break;

        case 'error':
          debugError('HiyoriWebView', 'WebView reported error:', message.error);
          setState(prev => ({
            ...prev,
            error: message.error,
            isLoading: false,
          }));
          break;

        default:
          debugLog('HiyoriWebView', 'Unknown message from WebView:', message);
      }
    } catch (error) {
      debugError('HiyoriWebView', 'Error parsing WebView message:', error);
    }
  }, [state.isModelReady, onModelReady, onMotionResult, checkModelLoaded]);

  // WebView lifecycle handlers
  const handleLoadStart = useCallback(() => {
    debugLog('HiyoriWebView', 'WebView load started');
    setState(prev => ({
      ...prev,
      isLoading: true,
      isWebViewReady: false,
      isModelReady: false,
      error: null,
      loadAttempts: prev.loadAttempts + 1,
    }));
  }, []);

  const handleLoadEnd = useCallback(() => {
    debugLog('HiyoriWebView', 'WebView load completed');
    setState(prev => ({ ...prev, isLoading: false }));
    
    // Only inject script if WebView is not already ready (prevent duplicate injection)
    if (!state.isWebViewReady) {
      // Inject readiness detection script directly
      const readinessScript = `
        (function setupReadinessDetection() {
          // Signal that WebView is ready for communication
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'webViewReady',
              timestamp: Date.now()
            }));
          }
          
          // New system: Live2D component will handle all status reporting via sendMessage
          console.log('[WebView] Readiness detection script injected');
        })();
      `;
      
      // Inject directly using webViewRef
      setTimeout(() => {
        if (webViewRef.current && webViewRef.current.injectJavaScript) {
          debugLog('HiyoriWebView', 'Injecting readiness detection script...');
          webViewRef.current.injectJavaScript(readinessScript);
          startReadinessTimeout();
        }
      }, 500);
    }
  }, [state.isWebViewReady, startReadinessTimeout]);

  const handleError = useCallback((syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    debugError('HiyoriWebView', 'WebView error:', nativeEvent);
    
    setState(prev => ({
      ...prev,
      error: `连接失败: ${nativeEvent.description || '网络错误'}`,
      isLoading: false,
    }));
  }, []);

  // Reload functionality
  const reload = useCallback(() => {
    debugLog('HiyoriWebView', 'Reloading WebView...');
    setState({
      isWebViewReady: false,
      isModelReady: false,
      isLoading: true,
      error: null,
      loadAttempts: 0,
    });
    pendingMessages.current = [];
    checkingModel.current = false;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    webViewRef.current?.reload();
  }, []);

  // Bridge interface for external use
  const bridge: HiyoriBridge = {
    playMotion: (motionName: string) => {
      debugLog('HiyoriWebView', `🚀 [RN->WebView] Requesting motion: "${motionName}"`);
      debugLog('HiyoriWebView', `🚀 [RN->WebView] Current state:`, {
        isModelReady: state.isModelReady,
        isWebViewReady: state.isWebViewReady,
        isLoading: state.isLoading,
        error: state.error
      });

      if (!state.isModelReady) {
        debugWarn('HiyoriWebView', `❌ [RN->WebView] Cannot play "${motionName}" - Hiyori model not ready yet`);
        onMotionResult?.(motionName, false, 'Model not ready');
        return;
      }

      debugLog('HiyoriWebView', `📤 [RN->WebView] Injecting JavaScript to play motion: "${motionName}"`);

      const jsCode = `
        (function() {
          console.log('📨 [WebView] Received motion request for: "${motionName}"');
          try {
            if (window.HiyoriBridge) {
              console.log('📨 [WebView] HiyoriBridge exists, checking if model is loaded...');
              const isLoaded = window.HiyoriBridge.isModelLoaded();
              console.log('📨 [WebView] Model loaded status:', isLoaded);
              
              if (isLoaded) {
                console.log('📨 [WebView] Calling HiyoriBridge.playMotion("${motionName}")...');
                const result = window.HiyoriBridge.playMotion('${motionName}');
                console.log('📨 [WebView] Motion call result:', result);
                
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'motionResult',
                  motion: '${motionName}',
                  success: true,
                  result: result,
                  timestamp: Date.now()
                }));
              } else {
                console.error('📨 [WebView] Model not loaded, cannot play motion');
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'motionResult',
                  motion: '${motionName}',
                  success: false,
                  error: 'Bridge reports model not loaded',
                  timestamp: Date.now()
                }));
              }
            } else {
              console.error('📨 [WebView] HiyoriBridge not available');
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'motionResult',
                motion: '${motionName}',
                success: false,
                error: 'HiyoriBridge not available',
                timestamp: Date.now()
              }));
            }
          } catch (error) {
            console.error('📨 [WebView] Error in motion execution:', error);
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'motionResult',
              motion: '${motionName}',
              success: false,
              error: error.message,
              timestamp: Date.now()
            }));
          }
        })();
      `;
      executeJavaScript(jsCode);
    },

    getAvailableMotions: () => {
      const jsCode = `
        (function() {
          try {
            if (window.HiyoriBridge) {
              const motions = window.HiyoriBridge.getAvailableMotions();
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'availableMotions',
                data: motions,
                timestamp: Date.now()
              }));
            }
          } catch (error) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'error',
              error: 'Failed to get available motions: ' + error.message,
              timestamp: Date.now()
            }));
          }
        })();
      `;
      executeJavaScript(jsCode);
    },

    checkModelStatus: () => {
      checkModelLoaded();
    },

    reload: reload,
  };

  // Expose bridge methods via the ref passed from parent
  React.useImperativeHandle(
    ref,
    () => ({
      hiyoriBridge: bridge,
      reload: reload,
      webView: webViewRef.current,
    }),
    [bridge, reload]
  );

  // Render error state with retry option
  if (state.error && state.loadAttempts < MAX_LOAD_ATTEMPTS) {
    return (
      <View className="flex-1" style={style}>
        <View className="flex-1 justify-center items-center p-5">
          <Text className="text-lg font-bold text-red-500 mb-2">连接失败</Text>
          <Text className="text-sm text-gray-500 text-center mb-5">{state.error}</Text>
          <TouchableOpacity className="bg-blue-500 px-5 py-2.5 rounded-lg" onPress={reload}>
            <Text className="text-white text-sm font-medium">重试 ({state.loadAttempts}/{MAX_LOAD_ATTEMPTS})</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Render fallback if max attempts reached
  if (state.error && state.loadAttempts >= MAX_LOAD_ATTEMPTS) {
    return (
      <View className="flex-1" style={style}>
        <View className="flex-1 justify-center items-center p-5">
          <Text className="text-lg font-bold text-gray-700 mb-2">无法连接到Hiyori</Text>
          <Text className="text-sm text-gray-500 text-center mb-5">
            请检查网络连接和服务器状态
          </Text>
          <TouchableOpacity className="bg-blue-500 px-5 py-2.5 rounded-lg" onPress={reload}>
            <Text className="text-white text-sm font-medium">重新开始</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1" style={style}>
      <WebView
        ref={webViewRef}
        source={{ uri: 'http://192.168.31.28:5174/' }}
        onMessage={handleWebViewMessage}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mixedContentMode="compatibility"
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        startInLoadingState={true}
        originWhitelist={['*']}
        allowsFullscreenVideo={true}
        allowsBackForwardNavigationGestures={false}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        renderLoading={() => (
          <View className="flex-1 justify-center items-center">
            <Text className="text-base text-gray-500 mb-2">Loading Hiyori...</Text>
            <Text className="text-sm text-gray-400">
              {state.isWebViewReady ? '等待模型加载...' : '连接中...'}
            </Text>
          </View>
        )}
      />
      
      {/* Enhanced Status Indicator (debug mode only) */}
      {isDebugMode() && (
        <View 
          className="absolute top-2.5 right-2.5 flex-row items-center bg-white/95 px-3 py-1.5 rounded-2xl"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <View
            className="w-2 h-2 rounded-full mr-2"
            style={{
              backgroundColor: state.isModelReady 
                ? '#10B981' 
                : state.isWebViewReady 
                  ? '#F59E0B' 
                  : '#EF4444' 
            }}
          />
          <Text className="text-xs text-gray-700 font-medium">
            {state.isModelReady 
              ? 'Hiyori Ready' 
              : state.isWebViewReady 
                ? 'Loading Model...'
                : state.isLoading 
                  ? 'Connecting...'
                  : 'Error'
            }
          </Text>
          
          {/* Pending messages indicator */}
          {pendingMessages.current.length > 0 && (
            <View className="ml-2 bg-red-500 w-5 h-5 rounded-full items-center justify-center">
              <Text className="text-white text-xs font-bold">
                {pendingMessages.current.length}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Debug info (debug mode only) */}
      {isDebugMode() && (
        <View className="absolute bottom-2 left-2 bg-black/80 px-2 py-1 rounded">
          <Text className="text-white text-xs font-mono">
            WebView: {state.isWebViewReady ? '✓' : '✗'} | 
            Model: {state.isModelReady ? '✓' : '✗'} | 
            Queue: {pendingMessages.current.length}
          </Text>
        </View>
      )}
    </View>
  );
});

HiyoriWebView.displayName = 'HiyoriWebView';

export default HiyoriWebView;

// Export bridge interface for TypeScript
export type { HiyoriBridge };