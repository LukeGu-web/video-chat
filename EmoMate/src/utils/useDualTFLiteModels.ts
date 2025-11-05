import { useState, useEffect, useCallback } from 'react';
import { useTensorflowModel } from 'react-native-fast-tflite';

// =============================
// Types
// =============================
type DualTFLiteOptions = {
  sceneModelPath: string;
  objectModelPath: string;
  useGPU?: boolean;
  objectDetectionThreshold?: number;
};

type SceneResult = {
  label: string;
  confidence: number;
};

type DetectionBox = {
  class: string;
  confidence: number;
  box: [number, number, number, number]; // [x, y, w, h]
};

type DualResult = {
  scene?: SceneResult;
  detections?: DetectionBox[];
};

// =============================
// Hook Implementation
// =============================
export function useDualTFLiteModels({
  sceneModelPath,
  objectModelPath,
  useGPU = true,
  objectDetectionThreshold = 0.5,
}: DualTFLiteOptions) {
  const [sceneModel, setSceneModel] = useState<any>(null);
  const [objectModel, setObjectModel] = useState<any>(null);
  const [ready, setReady] = useState(false);

  // 1️⃣ 加载场景模型（立即加载）
  const scene = useTensorflowModel(sceneModelPath, {
    delegates: useGPU ? ['gpu'] : ['cpu'],
  });

  // 2️⃣ 延迟加载物体检测模型
  useEffect(() => {
    let mounted = true;
    async function loadObjectModel() {
      const model = await useTensorflowModel(objectModelPath, {
        delegates: useGPU ? ['gpu'] : ['cpu'],
      });
      if (mounted) setObjectModel(model);
    }
    loadObjectModel();
    return () => {
      mounted = false;
    };
  }, [objectModelPath, useGPU]);

  // 3️⃣ 检查加载状态
  useEffect(() => {
    if (scene && objectModel) setReady(true);
  }, [scene, objectModel]);

  // 4️⃣ 主推理函数
  const analyzeFrame = useCallback(
    async (frame: any, needObjects = false): Promise<DualResult | null> => {
      if (!scene) return null;

      const results: DualResult = {};

      // --- Scene classification ---
      try {
        const sceneOutput = await scene.run(frame);
        const [labelIndex, confidence] = getTopClass(sceneOutput);
        const label = getLabelFromIndex(labelIndex);
        results.scene = { label, confidence };
      } catch (e) {
        console.warn('Scene model inference failed', e);
      }

      // --- Object detection (optional) ---
      if (needObjects && objectModel) {
        try {
          const detectionOutput = await objectModel.run(frame);
          results.detections = parseDetections(
            detectionOutput,
            objectDetectionThreshold
          );
        } catch (e) {
          console.warn('Object detection failed', e);
        }
      }

      return results;
    },
    [scene, objectModel, objectDetectionThreshold]
  );

  return { ready, analyzeFrame };
}

// =============================
// Helper functions
// =============================

function getTopClass(output: Float32Array): [number, number] {
  let maxIndex = 0;
  let maxValue = -Infinity;
  for (let i = 0; i < output.length; i++) {
    if (output[i] > maxValue) {
      maxValue = output[i];
      maxIndex = i;
    }
  }
  return [maxIndex, maxValue];
}

// 这里你可以替换成 imagenet_labels 或自定义映射
function getLabelFromIndex(index: number): string {
  const labels = [
    'background',
    'person',
    'bicycle',
    'car',
    'motorcycle',
    'airplane',
    'bus',
    'train',
    'truck',
    'boat',
    'traffic light',
    'fire hydrant',
    'stop sign',
    'bench',
    'bird',
    'cat',
    'dog',
    'horse',
    'sheep',
    'cow',
    'elephant',
    'bear',
    'zebra',
    'giraffe',
    'backpack',
    'umbrella',
    'handbag',
    'tie',
    'suitcase',
  ];
  return labels[index] || 'unknown';
}

// 解析检测输出（示例，需按模型结构调整）
function parseDetections(output: any, threshold = 0.5): DetectionBox[] {
  if (!Array.isArray(output) || output.length < 4) return [];
  const [boxes, classes, scores] = output;
  const results: DetectionBox[] = [];

  for (let i = 0; i < scores.length; i++) {
    if (scores[i] >= threshold) {
      results.push({
        class: getLabelFromIndex(classes[i]),
        confidence: scores[i],
        box: boxes[i],
      });
    }
  }
  return results;
}
