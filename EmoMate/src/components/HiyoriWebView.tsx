import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';

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
      console.log(`Executing ${pendingMessages.current.length} pending messages`);
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
        console.error('Model readiness timeout');
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
      console.log('Queuing JavaScript execution:', messageId);
      return;
    }

    try {
      webViewRef.current.injectJavaScript(jsCode);
      callback?.(true);
    } catch (error) {
      console.error('JavaScript execution failed:', error);
      callback?.(false);
    }
  }, [state.isWebViewReady]);

  // Check if model is loaded
  const checkModelLoaded = useCallback(() => {
    if (checkingModel.current) {
      console.log('Model check already in progress, skipping...');
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
      console.log('Received message from WebView:', message);

      switch (message.type) {
        case 'webViewReady':
          console.log('WebView is ready for communication');
          setState(prev => ({ ...prev, isWebViewReady: true }));
          // No need to check model status - new system will send modelReady when ready
          break;

        case 'domReady':
          console.log('DOM ready in WebView', message.data);
          break;

        case 'readinessUpdate':
          console.log('Readiness state update:', message.data?.state);
          if (message.data?.state) {
            const readiness = message.data.state;
            setState(prev => ({
              ...prev,
              isWebViewReady: readiness.domReady,
            }));
          }
          break;

        case 'modelReady':
          console.log('Hiyori model is fully ready!', message.data);
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
          console.log('Received heartbeat from WebView');
          // Reset timeout on successful heartbeat
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            startReadinessTimeout();
          }
          break;

        case 'userInteraction':
          console.log('User interaction:', message.data);
          break;

        case 'initError':
          console.error('Initialization error:', message.data?.error);
          setState(prev => ({
            ...prev,
            error: message.data?.error || 'Initialization failed',
            isLoading: false,
          }));
          break;

        case 'modelStatus':
          // Legacy modelStatus messages - ignore them in favor of the new system
          console.log('Received legacy modelStatus:', message.ready);
          break;

        case 'bridgeStatus':
          if (message.available) {
            console.log('HiyoriBridge is available');
            // New system will automatically send modelReady when fully initialized
          } else {
            console.warn('HiyoriBridge not available');
          }
          break;

        case 'motionResult':
          console.log(
            `Motion ${message.data?.motion}:`,
            message.data?.success ? 'Success' : message.data?.error
          );
          onMotionResult?.(message.data?.motion, message.data?.success, message.data?.error);
          break;

        case 'availableMotions':
          console.log('Available motions:', message.data?.motions);
          break;

        case 'cleanup':
          console.log('WebView cleanup completed');
          break;

        case 'error':
          console.error('WebView reported error:', message.error);
          setState(prev => ({
            ...prev,
            error: message.error,
            isLoading: false,
          }));
          break;

        default:
          console.log('Unknown message from WebView:', message);
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  }, [state.isModelReady, onModelReady, onMotionResult, checkModelLoaded]);

  // WebView lifecycle handlers
  const handleLoadStart = useCallback(() => {
    console.log('WebView load started');
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
    console.log('WebView load completed');
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
          console.log('Injecting readiness detection script...');
          webViewRef.current.injectJavaScript(readinessScript);
          startReadinessTimeout();
        }
      }, 500);
    }
  }, [state.isWebViewReady, startReadinessTimeout]);

  const handleError = useCallback((syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('WebView error:', nativeEvent);
    
    setState(prev => ({
      ...prev,
      error: `连接失败: ${nativeEvent.description || '网络错误'}`,
      isLoading: false,
    }));
  }, []);

  // Reload functionality
  const reload = useCallback(() => {
    console.log('Reloading WebView...');
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
      console.log(`🚀 [RN->WebView] Requesting motion: "${motionName}"`);
      console.log(`🚀 [RN->WebView] Current state:`, {
        isModelReady: state.isModelReady,
        isWebViewReady: state.isWebViewReady,
        isLoading: state.isLoading,
        error: state.error
      });

      if (!state.isModelReady) {
        console.warn(`❌ [RN->WebView] Cannot play "${motionName}" - Hiyori model not ready yet`);
        onMotionResult?.(motionName, false, 'Model not ready');
        return;
      }

      console.log(`📤 [RN->WebView] Injecting JavaScript to play motion: "${motionName}"`);

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
      <View style={[styles.container, style]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>连接失败</Text>
          <Text style={styles.errorMessage}>{state.error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={reload}>
            <Text style={styles.retryButtonText}>重试 ({state.loadAttempts}/{MAX_LOAD_ATTEMPTS})</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Render fallback if max attempts reached
  if (state.error && state.loadAttempts >= MAX_LOAD_ATTEMPTS) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.fallbackContainer}>
          <Text style={styles.fallbackTitle}>无法连接到Hiyori</Text>
          <Text style={styles.fallbackMessage}>
            请检查网络连接和服务器状态
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={reload}>
            <Text style={styles.retryButtonText}>重新开始</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
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
        style={styles.webview}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading Hiyori...</Text>
            <Text style={styles.loadingSubtext}>
              {state.isWebViewReady ? '等待模型加载...' : '连接中...'}
            </Text>
          </View>
        )}
      />
      
      {/* Enhanced Status Indicator */}
      <View style={styles.statusContainer}>
        <View
          style={[
            styles.statusIndicator,
            { 
              backgroundColor: state.isModelReady 
                ? '#10B981' 
                : state.isWebViewReady 
                  ? '#F59E0B' 
                  : '#EF4444' 
            },
          ]}
        />
        <Text style={styles.statusText}>
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
          <View style={styles.pendingIndicator}>
            <Text style={styles.pendingText}>
              {pendingMessages.current.length}
            </Text>
          </View>
        )}
      </View>

      {/* Debug info (development only) */}
      {__DEV__ && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugText}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F3F4F6',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#EF4444',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F3F4F6',
  },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  fallbackMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  statusContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  pendingIndicator: {
    backgroundColor: '#F59E0B',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  pendingText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  debugContainer: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 8,
    borderRadius: 6,
  },
  debugText: {
    color: 'white',
    fontSize: 10,
    fontFamily: 'monospace',
  },
});

export default HiyoriWebView;

// Export bridge interface for TypeScript
export type { HiyoriBridge };