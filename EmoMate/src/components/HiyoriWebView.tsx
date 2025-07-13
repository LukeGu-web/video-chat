import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Alert, Text } from 'react-native';
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
}

const HiyoriWebView: React.FC<HiyoriWebViewProps> = ({
  style,
  onModelReady,
  onMotionResult,
}) => {
  const webViewRef = useRef<WebView>(null);
  const [isModelReady, setIsModelReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Available motions for Hiyori
  const availableMotions = [
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

  // Check if model is loaded periodically
  const checkModelLoaded = useCallback(() => {
    if (!webViewRef.current || !webViewRef.current.injectJavaScript) {
      console.warn('WebView not ready for JavaScript injection');
      return;
    }
    
    const jsCode = `
      (function checkModel() {
        if (window.HiyoriBridge && window.HiyoriBridge.isModelLoaded()) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'modelReady',
            ready: true
          }));
        } else {
          setTimeout(() => {
            if (window.HiyoriBridge && window.HiyoriBridge.isModelLoaded()) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'modelReady',
                ready: true
              }));
            } else {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'modelStatus',
                ready: false
              }));
            }
          }, 1000);
        }
      })();
    `;
    webViewRef.current.injectJavaScript(jsCode);
  }, []);

  // Start checking for model after WebView loads
  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => {
        checkModelLoaded();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, checkModelLoaded]);

  // Handle messages from WebView
  const handleWebViewMessage = useCallback(
    (event: any) => {
      try {
        const message = JSON.parse(event.nativeEvent.data);

        switch (message.type) {
          case 'modelReady':
            console.log('Hiyori model is ready!');
            setIsModelReady(true);
            onModelReady?.();
            break;

          case 'modelStatus':
            if (!message.ready && !isModelReady) {
              // Keep checking if model is not ready
              setTimeout(checkModelLoaded, 1000);
            }
            break;

          case 'motionResult':
            console.log(
              `Motion ${message.motion}:`,
              message.success ? 'Success' : message.error
            );
            onMotionResult?.(message.motion, message.success, message.error);
            break;

          case 'availableMotions':
            console.log('Available motions:', message.data);
            break;

          case 'error':
            console.error('WebView error:', message.error);
            Alert.alert('Error', message.error);
            break;

          default:
            console.log('Unknown message from WebView:', message);
        }
      } catch (error) {
        console.error('Error parsing WebView message:', error);
      }
    },
    [isModelReady, onModelReady, onMotionResult, checkModelLoaded]
  );

  // Bridge interface for external use
  const bridge: HiyoriBridge = {
    playMotion: (motionName: string) => {
      if (!isModelReady) {
        console.warn('Hiyori model not ready yet');
        onMotionResult?.(motionName, false, 'Model not ready');
        return;
      }

      if (!webViewRef.current || !webViewRef.current.injectJavaScript) {
        console.warn('WebView not ready for JavaScript injection');
        onMotionResult?.(motionName, false, 'WebView not ready');
        return;
      }

      const jsCode = `
        (function() {
          try {
            if (window.HiyoriBridge && window.HiyoriBridge.isModelLoaded()) {
              const result = window.HiyoriBridge.playMotion('${motionName}');
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'motionResult',
                motion: '${motionName}',
                success: true,
                result: result
              }));
            } else {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'motionResult',
                motion: '${motionName}',
                success: false,
                error: 'Bridge or model not available'
              }));
            }
          } catch (error) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'motionResult',
              motion: '${motionName}',
              success: false,
              error: error.message
            }));
          }
        })();
      `;
      webViewRef.current.injectJavaScript(jsCode);
    },

    getAvailableMotions: () => {
      if (!webViewRef.current || !webViewRef.current.injectJavaScript) {
        console.warn('WebView not ready for JavaScript injection');
        return;
      }
      
      const jsCode = `
        if (window.HiyoriBridge) {
          const motions = window.HiyoriBridge.getAvailableMotions();
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'availableMotions',
            data: motions
          }));
        }
      `;
      webViewRef.current.injectJavaScript(jsCode);
    },

    checkModelStatus: () => {
      checkModelLoaded();
    },
  };

  // Expose bridge methods via ref
  React.useImperativeHandle(
    webViewRef,
    () => ({
      ...webViewRef.current,
      hiyoriBridge: bridge,
    }),
    [bridge]
  );

  const handleLoadEnd = () => {
    setIsLoading(false);
    console.log('WebView loaded, starting model check...');
  };

  const handleError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('WebView error:', nativeEvent);
    Alert.alert('WebView Error', 'Failed to load Hiyori. Please check your connection.');
  };

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ uri: 'http://192.168.31.28:5174/' }}
        onMessage={handleWebViewMessage}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mixedContentMode="compatibility"
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        startInLoadingState={true}
        style={styles.webview}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading Hiyori...</Text>
          </View>
        )}
      />
      
      {/* Model Status Indicator */}
      <View style={styles.statusContainer}>
        <View
          style={[
            styles.statusIndicator,
            { backgroundColor: isModelReady ? '#10B981' : '#EF4444' },
          ]}
        />
        <Text style={styles.statusText}>
          {isModelReady ? 'Hiyori Ready' : 'Loading...'}
        </Text>
      </View>
    </View>
  );
};

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
    marginTop: 10,
  },
  statusContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
});

export default HiyoriWebView;

// Export bridge interface for TypeScript
export type { HiyoriBridge };