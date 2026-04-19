import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { VRM, VRMExpressionPresetName } from '@pixiv/three-vrm';
import { VisemeFrame, VRMBridgeCommand } from '../types/vrm-bridge';

const SHAPE_TO_VRM: Record<VisemeFrame['shape'], string | null> = {
  aa:  VRMExpressionPresetName.Aa,
  ee:  VRMExpressionPresetName.Ee,
  ih:  VRMExpressionPresetName.Ih,
  oh:  VRMExpressionPresetName.Oh,
  ou:  VRMExpressionPresetName.Ou,
  sil: null,
};

const ALL_MOUTH_SHAPES = [
  VRMExpressionPresetName.Aa,
  VRMExpressionPresetName.Ee,
  VRMExpressionPresetName.Ih,
  VRMExpressionPresetName.Oh,
  VRMExpressionPresetName.Ou,
];

interface LipSyncState {
  visemes: VisemeFrame[];
  startTime: number | null;
  totalDuration: number;
  active: boolean;
  currentWeight: number;
  currentShape: string | null;
}

interface LipSyncControllerProps {
  vrm: VRM;
}

export function LipSyncController({ vrm }: LipSyncControllerProps) {
  const state = useRef<LipSyncState>({
    visemes: [],
    startTime: null,
    totalDuration: 0,
    active: false,
    currentWeight: 0,
    currentShape: null,
  });

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      let cmd: VRMBridgeCommand;
      try {
        cmd = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }

      if (cmd.type === 'prepareVisemes') {
        // Store sequence; timing starts when audio actually begins (lipSyncStart event)
        state.current.visemes = cmd.data.visemes;
        state.current.totalDuration = cmd.data.totalDuration;
        state.current.active = false;
        state.current.startTime = null;
      }

      if (cmd.type === 'playVisemes') {
        // Direct start (kept for browser console testing)
        state.current.visemes = cmd.data.visemes;
        state.current.totalDuration = cmd.data.totalDuration;
        state.current.startTime = performance.now();
        state.current.active = true;
      }

      if (cmd.type === 'stopVisemes') {
        state.current.active = false;
        state.current.startTime = null;
        state.current.visemes = [];
      }
    };

    const handleAudioStart = () => {
      if (state.current.visemes.length > 0) {
        state.current.startTime = performance.now();
        state.current.active = true;
      }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('lipSyncStart' as string, handleAudioStart as EventListener);
    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('lipSyncStart' as string, handleAudioStart as EventListener);
    };
  }, []);

  useFrame((_, delta) => {
    const em = vrm.expressionManager;
    if (!em) return;

    const s = state.current;

    if (!s.active || s.startTime === null) {
      // Smoothly close mouth when inactive
      if (s.currentWeight > 0.01) {
        s.currentWeight = Math.max(0, s.currentWeight - delta * 8);
        if (s.currentShape) {
          em.setValue(s.currentShape, s.currentWeight);
          em.update();
        }
      }
      return;
    }

    const elapsed = (performance.now() - s.startTime) / 1000;

    const frames = s.visemes;
    let targetShape: string | null = null;
    let targetWeight = 0;

    for (let i = frames.length - 1; i >= 0; i--) {
      if (elapsed >= frames[i].time) {
        targetShape = SHAPE_TO_VRM[frames[i].shape];
        targetWeight = frames[i].weight;
        break;
      }
    }

    const lerpSpeed = Math.min(delta * 40, 1);
    s.currentWeight += (targetWeight - s.currentWeight) * lerpSpeed;

    if (s.currentShape && s.currentShape !== targetShape) {
      em.setValue(s.currentShape, 0);
    }

    if (targetShape) {
      em.setValue(targetShape, Math.max(0, Math.min(1, s.currentWeight)));
    }
    s.currentShape = targetShape;
    em.update();

    // Auto-stop after totalDuration
    if (elapsed > s.totalDuration + 0.3) {
      s.active = false;
      s.startTime = null;
      ALL_MOUTH_SHAPES.forEach(shape => em.setValue(shape, 0));
      em.update();
    }
  });

  return null;
}
