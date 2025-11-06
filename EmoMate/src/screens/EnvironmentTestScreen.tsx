/**
 * Environment Test Screen
 *
 * Test screen for Step 1.2: Frame Capture for Scene Understanding
 * Tests the frame capture functionality added to BasicEmotionDetector
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BasicEmotionDetector } from '../components/BasicEmotionDetector';
import { EmotionType } from '../types/emotion';
import { compareImages } from '../utils/imageComparison';

interface CapturedFrame {
  base64: string;
  timestamp: number;
  size: number;
  similarity?: number;
  status?: 'identical' | 'stable' | 'changed' | 'very-different';
}

export const EnvironmentTestScreen: React.FC = () => {
  // Frame capture state
  const [capturedFrames, setCapturedFrames] = useState<CapturedFrame[]>([]);
  const [captureCount, setCaptureCount] = useState(0);
  const [lastCaptureTime, setLastCaptureTime] = useState<number | null>(null);
  const [isDetectorActive, setIsDetectorActive] = useState(true);
  const [currentEmotion, setCurrentEmotion] = useState<EmotionType>('neutral');

  // Manual frame capture interval (for testing, 5 seconds instead of 30)
  const [captureInterval, setCaptureInterval] = useState(5000);

  // Image similarity state
  const [lastSimilarity, setLastSimilarity] = useState<number | null>(null);
  const [sceneStatus, setSceneStatus] = useState<string>('等待捕获');
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonCount, setComparisonCount] = useState(0);

  // Handle emotion detection
  const handleEmotionDetected = useCallback((emotion: EmotionType) => {
    setCurrentEmotion(emotion);
  }, []);

  // Handle frame capture
  const handleFrameCaptured = useCallback(async (base64: string, timestamp: number) => {
    console.log('[EnvironmentTest] Frame captured, comparing with previous frame...');
    setIsComparing(true);

    // Compare with previous frame if available
    let similarity: number | undefined;
    let status: 'identical' | 'stable' | 'changed' | 'very-different' | undefined;

    setCapturedFrames((prev) => {
      if (prev.length > 0) {
        const previousFrame = prev[0];

        // Perform comparison asynchronously
        compareImages(base64, previousFrame.base64, 0.7)
          .then((result) => {
            const sim = result.similarity;
            setLastSimilarity(sim);
            setComparisonCount((count) => count + 1);

            // Determine status based on similarity
            let newStatus: string;
            if (sim >= 0.95) {
              status = 'identical';
              newStatus = '场景完全相同';
            } else if (sim >= 0.85) {
              status = 'stable';
              newStatus = '场景稳定';
            } else if (sim >= 0.5) {
              status = 'changed';
              newStatus = '场景有变化';
            } else {
              status = 'very-different';
              newStatus = '场景完全不同';
            }

            setSceneStatus(newStatus);
            setIsComparing(false);

            console.log('[EnvironmentTest] Comparison result:', {
              similarity: sim.toFixed(3),
              status: newStatus,
            });
          })
          .catch((error) => {
            console.error('[EnvironmentTest] Comparison failed:', error);
            setSceneStatus('对比失败');
            setIsComparing(false);
          });
      } else {
        // First frame, no comparison
        setSceneStatus('首次捕获');
        setLastSimilarity(null);
        setIsComparing(false);
      }

      // Create new frame with similarity info
      const newFrame: CapturedFrame = {
        base64,
        timestamp,
        size: base64.length,
        similarity,
        status,
      };

      // Keep only the last 3 frames to avoid memory issues
      return [newFrame, ...prev].slice(0, 3);
    });

    setCaptureCount((prev) => prev + 1);
    setLastCaptureTime(timestamp);
  }, []);

  // Format timestamp
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN');
  };

  // Format time ago
  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diffSeconds = Math.floor((now - timestamp) / 1000);

    if (diffSeconds < 60) {
      return `${diffSeconds} 秒前`;
    } else if (diffSeconds < 3600) {
      return `${Math.floor(diffSeconds / 60)} 分钟前`;
    } else {
      return `${Math.floor(diffSeconds / 3600)} 小时前`;
    }
  };

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>步骤 1.2: 帧捕获测试</Text>
          <Text style={styles.subtitle}>
            测试 Frame Processor 场景帧捕获功能
          </Text>
        </View>

        {/* BasicEmotionDetector with frame capture */}
        <BasicEmotionDetector
          onEmotionDetected={handleEmotionDetected}
          isActive={isDetectorActive}
          detectionInterval={1000}
          onFrameCaptured={handleFrameCaptured}
          frameCaptureInterval={captureInterval}
        />

        {/* Controls */}
        <View style={styles.controlPanel}>
          <Text style={styles.sectionTitle}>控制面板</Text>

          {/* Active toggle */}
          <TouchableOpacity
            style={[
              styles.button,
              isDetectorActive ? styles.buttonActive : styles.buttonInactive,
            ]}
            onPress={() => setIsDetectorActive(!isDetectorActive)}
          >
            <Text style={styles.buttonText}>
              {isDetectorActive ? '✅ 检测激活' : '⏸️ 检测暂停'}
            </Text>
          </TouchableOpacity>

          {/* Capture interval controls */}
          <View style={styles.intervalControls}>
            <Text style={styles.label}>捕获间隔:</Text>
            <View style={styles.intervalButtons}>
              <TouchableOpacity
                style={[
                  styles.smallButton,
                  captureInterval === 5000 && styles.smallButtonActive,
                ]}
                onPress={() => setCaptureInterval(5000)}
              >
                <Text style={styles.smallButtonText}>5秒 (测试)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.smallButton,
                  captureInterval === 10000 && styles.smallButtonActive,
                ]}
                onPress={() => setCaptureInterval(10000)}
              >
                <Text style={styles.smallButtonText}>10秒</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.smallButton,
                  captureInterval === 30000 && styles.smallButtonActive,
                ]}
                onPress={() => setCaptureInterval(30000)}
              >
                <Text style={styles.smallButtonText}>30秒 (默认)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Statistics */}
        <View style={styles.statsPanel}>
          <Text style={styles.sectionTitle}>统计信息</Text>

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>当前情绪</Text>
              <Text style={styles.statValue}>{currentEmotion}</Text>
            </View>

            <View style={styles.statItem}>
              <Text style={styles.statLabel}>捕获次数</Text>
              <Text style={styles.statValue}>{captureCount}</Text>
            </View>

            <View style={styles.statItem}>
              <Text style={styles.statLabel}>上次捕获</Text>
              <Text style={styles.statValue}>
                {lastCaptureTime ? formatTimeAgo(lastCaptureTime) : '未捕获'}
              </Text>
            </View>

            <View style={styles.statItem}>
              <Text style={styles.statLabel}>帧缓存</Text>
              <Text style={styles.statValue}>{capturedFrames.length}/3</Text>
            </View>
          </View>
        </View>

        {/* Image Similarity (Step 1.3) */}
        <View style={styles.similarityPanel}>
          <Text style={styles.sectionTitle}>📊 图像相似度检测 (步骤 1.3)</Text>

          <View style={styles.similarityStats}>
            <View style={styles.similarityItem}>
              <Text style={styles.similarityLabel}>图像相似度</Text>
              {isComparing ? (
                <View style={styles.comparingContainer}>
                  <ActivityIndicator size="small" color="#2196F3" />
                  <Text style={styles.comparingText}>对比中...</Text>
                </View>
              ) : (
                <Text
                  style={[
                    styles.similarityValue,
                    lastSimilarity !== null && lastSimilarity >= 0.9
                      ? styles.similarityHigh
                      : lastSimilarity !== null && lastSimilarity >= 0.7
                        ? styles.similarityMedium
                        : styles.similarityLow,
                  ]}
                >
                  {lastSimilarity !== null
                    ? `${(lastSimilarity * 100).toFixed(1)}%`
                    : '等待对比'}
                </Text>
              )}
            </View>

            <View style={styles.similarityItem}>
              <Text style={styles.similarityLabel}>场景状态</Text>
              <Text
                style={[
                  styles.statusValue,
                  sceneStatus.includes('稳定') || sceneStatus.includes('相同')
                    ? styles.statusStable
                    : sceneStatus.includes('变化')
                      ? styles.statusChanged
                      : styles.statusDefault,
                ]}
              >
                {sceneStatus}
              </Text>
            </View>

            <View style={styles.similarityItem}>
              <Text style={styles.similarityLabel}>对比次数</Text>
              <Text style={styles.comparisonCount}>{comparisonCount}</Text>
            </View>
          </View>

          {/* Test criteria for Step 1.3 */}
          <View style={styles.testCriteriaInline}>
            <Text style={styles.criteriaInlineTitle}>测试标准:</Text>
            <Text
              style={[
                styles.criteriaInlineText,
                lastSimilarity !== null && lastSimilarity > 0.9
                  ? styles.criteriaPassed
                  : styles.criteriaPending,
              ]}
            >
              ✓ 相同场景 {'>'} 90%
              {lastSimilarity !== null && lastSimilarity > 0.9 && ' ✅'}
            </Text>
            <Text
              style={[
                styles.criteriaInlineText,
                lastSimilarity !== null &&
                lastSimilarity < 0.5 &&
                captureCount > 1
                  ? styles.criteriaPassed
                  : styles.criteriaPending,
              ]}
            >
              ✓ 完全不同 {'<'} 50%
            </Text>
            <Text style={styles.criteriaInlineText}>
              ✓ 轻微移动 70-85%
            </Text>
          </View>
        </View>

        {/* Captured frames */}
        <View style={styles.framesPanel}>
          <Text style={styles.sectionTitle}>捕获的帧 (最近3帧)</Text>

          {capturedFrames.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                等待帧捕获...
              </Text>
              <Text style={styles.emptySubtext}>
                每 {captureInterval / 1000} 秒自动捕获一帧
              </Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {capturedFrames.map((frame, index) => (
                <View key={frame.timestamp} style={styles.frameCard}>
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${frame.base64}` }}
                    style={styles.frameImage}
                    resizeMode="cover"
                  />
                  <View style={styles.frameInfo}>
                    <Text style={styles.frameIndex}>帧 #{captureCount - index}</Text>
                    <Text style={styles.frameTime}>
                      {formatTimestamp(frame.timestamp)}
                    </Text>
                    <Text style={styles.frameSize}>
                      {formatSize(frame.size)}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionTitle}>📋 测试说明 (步骤 1.3)</Text>
          <Text style={styles.instructionText}>
            1. BasicEmotionDetector 会每 {captureInterval / 1000} 秒自动捕获一帧
          </Text>
          <Text style={styles.instructionText}>
            2. 每次捕获会自动与上一帧进行相似度对比
          </Text>
          <Text style={styles.instructionText}>
            3. 相似度显示范围：0-100%（100% = 完全相同）
          </Text>
          <Text style={styles.instructionText}>
            4. 测试方法：保持静止、轻微移动、完全换场景
          </Text>
          <Text style={styles.instructionText}>
            5. 观察相似度和状态变化是否符合预期
          </Text>
        </View>

        {/* Test Criteria */}
        <View style={styles.testCriteria}>
          <Text style={styles.criteriaTitle}>✅ 测试标准</Text>
          <Text style={styles.criteriaText}>
            • Frame Processor 不影响现有情绪检测功能
          </Text>
          <Text style={styles.criteriaText}>
            • 每 {captureInterval / 1000} 秒成功捕获一帧
          </Text>
          <Text style={styles.criteriaText}>
            • 帧数据正确转换为 base64
          </Text>
          <Text style={styles.criteriaText}>
            • 性能无明显下降（仍保持 60fps）
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
  },
  controlPanel: {
    margin: 16,
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonActive: {
    backgroundColor: '#4CAF50',
  },
  buttonInactive: {
    backgroundColor: '#666',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  intervalControls: {
    marginTop: 8,
  },
  label: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 8,
  },
  intervalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  smallButton: {
    flex: 1,
    padding: 10,
    marginHorizontal: 4,
    backgroundColor: '#333',
    borderRadius: 6,
    alignItems: 'center',
  },
  smallButtonActive: {
    backgroundColor: '#2196F3',
  },
  smallButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  statsPanel: {
    margin: 16,
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    padding: 12,
    backgroundColor: '#252525',
    borderRadius: 8,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  framesPanel: {
    margin: 16,
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 12,
    color: '#444',
  },
  frameCard: {
    width: 200,
    marginRight: 12,
    backgroundColor: '#252525',
    borderRadius: 8,
    overflow: 'hidden',
  },
  frameImage: {
    width: 200,
    height: 150,
    backgroundColor: '#333',
  },
  frameInfo: {
    padding: 8,
  },
  frameIndex: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  frameTime: {
    fontSize: 11,
    color: '#888',
    marginBottom: 2,
  },
  frameSize: {
    fontSize: 10,
    color: '#666',
  },
  instructions: {
    margin: 16,
    padding: 16,
    backgroundColor: '#1a2a3a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a4a6a',
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#64B5F6',
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 13,
    color: '#aaa',
    marginBottom: 4,
    lineHeight: 20,
  },
  testCriteria: {
    margin: 16,
    padding: 16,
    backgroundColor: '#1a2a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a4a2a',
    marginBottom: 32,
  },
  criteriaTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 8,
  },
  criteriaText: {
    fontSize: 13,
    color: '#aaa',
    marginBottom: 4,
    lineHeight: 20,
  },
  similarityPanel: {
    margin: 16,
    padding: 16,
    backgroundColor: '#1a1a2a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  similarityStats: {
    marginTop: 8,
  },
  similarityItem: {
    marginBottom: 16,
  },
  similarityLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 6,
  },
  similarityValue: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  similarityHigh: {
    color: '#4CAF50',
  },
  similarityMedium: {
    color: '#FF9800',
  },
  similarityLow: {
    color: '#f44336',
  },
  statusValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statusStable: {
    color: '#4CAF50',
  },
  statusChanged: {
    color: '#FF9800',
  },
  statusDefault: {
    color: '#888',
  },
  comparisonCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  comparingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  comparingText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#2196F3',
  },
  testCriteriaInline: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#252535',
    borderRadius: 8,
  },
  criteriaInlineTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#64B5F6',
    marginBottom: 8,
  },
  criteriaInlineText: {
    fontSize: 12,
    marginBottom: 4,
    lineHeight: 18,
  },
  criteriaPassed: {
    color: '#4CAF50',
  },
  criteriaPending: {
    color: '#888',
  },
});
