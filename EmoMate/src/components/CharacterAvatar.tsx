import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View } from 'react-native';
import CharacterWebView, { AvatarBridge } from './CharacterWebView';
import { debugLog } from '../utils/debug';
import { useMonitorStore } from '../store/monitorStore';
import { motionCoordinator } from '../capabilities/motion';

interface CharacterAvatarProps {
  size?: number;
  onMotionComplete?: (motion: string, success: boolean) => void;
}

interface WebViewRef {
  avatarBridge: AvatarBridge;
  reload: () => void;
  webView: any;
}

const CharacterAvatar: React.FC<CharacterAvatarProps> = ({
  size = 240,
  onMotionComplete,
}) => {
  const webViewRef = useRef<WebViewRef>(null);
  const [isModelReady, setIsModelReady] = useState(false);

  const updateAvatarStatus = useMonitorStore((state) => state.updateAvatarStatus);

  useEffect(() => {
    updateAvatarStatus({ currentMotion: 'Idle', isModelReady, isPlaying: false, shouldLoop: false });
  }, [isModelReady, updateAvatarStatus]);

  const handleModelReady = useCallback(() => {
    debugLog('CharacterAvatar', 'Model ready');
    setIsModelReady(true);
  }, []);

  const handleMotionResult = useCallback(
    (motion: string, success: boolean, error?: string) => {
      debugLog('CharacterAvatar', `Motion result — ${motion}: ${success ? 'ok' : error}`);
      onMotionComplete?.(motion, success);
    },
    [onMotionComplete],
  );

  useEffect(() => {
    if (!isModelReady) return;
    motionCoordinator.register((cmd) => {
      webViewRef.current?.avatarBridge.sendVRMCommand(cmd);
    });
    return () => {
      motionCoordinator.unregister();
    };
  }, [isModelReady]);

  return (
    <View style={{ width: size, height: size * 1.6 }}>
      <CharacterWebView
        ref={webViewRef}
        style={{ width: '100%', height: '100%' }}
        onModelReady={handleModelReady}
        onMotionResult={handleMotionResult}
      />
    </View>
  );
};

export default CharacterAvatar;
export type { CharacterAvatarProps };
