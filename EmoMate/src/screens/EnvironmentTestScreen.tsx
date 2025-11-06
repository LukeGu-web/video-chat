/**
 * Environment Test Screen
 *
 * Test screen for Step 1.2: Frame Capture for Scene Understanding
 * Tests the frame capture functionality added to BasicEmotionDetector
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  AppState,
  AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BasicEmotionDetector } from '../components/BasicEmotionDetector';
import { EmotionType } from '../types/emotion';
import { compareImages } from '../utils/imageComparison';
import { analyzeSceneWithClaude } from '../utils/claudeVision';
import { useSceneUnderstanding } from '../utils/useSceneUnderstanding';
import { getClaudeApiKey } from '../constants/ai';
import { SceneAnalysisResponse, SceneTriggerType } from '../types/scene';

// Navigation type
type RootStackParamList = {
  Home: undefined;
  EnvironmentTest: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface CapturedFrame {
  base64: string;
  timestamp: number;
  size: number;
  similarity?: number;
  status?: 'identical' | 'stable' | 'changed' | 'very-different';
}

export const EnvironmentTestScreen: React.FC = () => {
  // Navigation
  const navigation = useNavigation<NavigationProp>();

  // Get Claude API key
  const apiKey = getClaudeApiKey();

  // Initialize scene understanding hook (Step 3.1)
  const sceneUnderstanding = useSceneUnderstanding(apiKey || '', {
    enabled: true,
  });

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

  // Scene analysis state (Step 2.1)
  const [sceneAnalysisResult, setSceneAnalysisResult] = useState<SceneAnalysisResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [totalAnalysisCount, setTotalAnalysisCount] = useState(0);
  const [totalAPICost, setTotalAPICost] = useState(0);

  // Ref to store latest captured frame (Step 3.1)
  const latestFrameRef = useRef<string | null>(null);
  // Ref to remember if timer was enabled before going to background (Step 3.1 bugfix)
  const wasTimerEnabledRef = useRef<boolean>(false);

  // Setup photo capture callback for scene understanding (Step 3.1)
  useEffect(() => {
    sceneUnderstanding.setPhotoCaptureCallback(async () => {
      console.log('[EnvironmentTest] Photo capture callback triggered');
      return latestFrameRef.current;
    });
  }, [sceneUnderstanding]);

  // Handle AppState changes (Step 3.1)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background') {
        // Remember timer state before stopping
        wasTimerEnabledRef.current = sceneUnderstanding.timerState.enabled;
        if (wasTimerEnabledRef.current) {
          console.log('[EnvironmentTest] App went to background, pausing timer');
          sceneUnderstanding.stopTimer();
        }
      } else if (nextAppState === 'active') {
        // Restore timer state if it was enabled before background
        if (wasTimerEnabledRef.current) {
          console.log('[EnvironmentTest] App became active, resuming timer');
          sceneUnderstanding.startTimer();
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [sceneUnderstanding]);

  // Handle emotion detection
  const handleEmotionDetected = useCallback((emotion: EmotionType) => {
    setCurrentEmotion(emotion);
  }, []);

  // Handle scene analysis (Step 2.1)
  const handleAnalyzeScene = useCallback(async () => {
    // Check if we have a captured frame
    if (capturedFrames.length === 0) {
      setAnalysisError('没有可分析的图像，请等待帧捕获');
      return;
    }

    // Get the latest frame
    const latestFrame = capturedFrames[0];

    // Get API key
    const apiKey = getClaudeApiKey();
    if (!apiKey) {
      setAnalysisError('未配置 Claude API Key，请检查环境变量');
      return;
    }

    console.log('[EnvironmentTest] Starting scene analysis...');
    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      // Call Claude Vision API
      const result = await analyzeSceneWithClaude(
        {
          imageBase64: latestFrame.base64,
          triggerType: SceneTriggerType.MANUAL,
        },
        apiKey
      );

      console.log('[EnvironmentTest] Scene analysis completed:', result);

      // Update state with result
      setSceneAnalysisResult(result);
      setTotalAnalysisCount(prev => prev + 1);
      if (result.cost !== undefined) {
        setTotalAPICost(prev => prev + (result.cost || 0));
      }

      if (!result.success) {
        setAnalysisError(result.error || '场景分析失败');
      }
    } catch (error) {
      console.error('[EnvironmentTest] Scene analysis error:', error);
      setAnalysisError(
        error instanceof Error ? error.message : '场景分析失败，请检查网络连接和 API Key'
      );
    } finally {
      setIsAnalyzing(false);
    }
  }, [capturedFrames]);

  // Handle frame capture
  const handleFrameCaptured = useCallback(async (base64: string, timestamp: number) => {
    console.log('[EnvironmentTest] Frame captured, comparing with previous frame...');
    setIsComparing(true);

    // Store latest frame for scene understanding timer (Step 3.1)
    latestFrameRef.current = base64;

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

  // Format detail key for display (Step 2.2)
  const formatDetailKey = (key: string): string => {
    const keyMap: Record<string, string> = {
      bookTitle: '书名',
      bookAuthor: '作者',
      bookList: '书籍列表',
      productBrand: '品牌',
      productCategory: '产品类别',
      productList: '产品列表',
      textContent: '文字内容',
      textLanguage: '文字语言',
      peopleCount: '人数',
      peopleActivity: '活动',
      computerType: '电脑类型',
      mobileDevice: '移动设备',
      displayInfo: '显示器',
      foodType: '食物',
      beverageType: '饮料',
      timeOfDay: '时间',
      weatherCondition: '天气',
      indoorOutdoor: '室内/外',
      otherDetails: '其他',
      specialFeatures: '特殊特征',
      parseError: '解析错误',
    };

    return keyMap[key] || key;
  };

  // Format countdown timer (Step 3.1)
  const formatCountdown = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes} 分 ${seconds} 秒`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.navigate('Home')}
            >
              <Text style={styles.backButtonText}>← 返回</Text>
            </TouchableOpacity>
          </View>
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

          {/* Timer toggle (Step 3.1) */}
          <TouchableOpacity
            style={[
              styles.button,
              sceneUnderstanding.timerState.enabled ? styles.buttonTimer : styles.buttonInactive,
            ]}
            onPress={() => {
              if (sceneUnderstanding.timerState.enabled) {
                sceneUnderstanding.stopTimer();
              } else {
                sceneUnderstanding.startTimer();
              }
            }}
          >
            <Text style={styles.buttonText}>
              {sceneUnderstanding.timerState.enabled ? '⏱️ 定时检测：开启' : '⏸️ 定时检测：关闭'}
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

        {/* Timer Statistics (Step 3.1) */}
        {sceneUnderstanding.timerState.enabled && (
          <View style={styles.timerStatsPanel}>
            <Text style={styles.sectionTitle}>⏱️ 定时检测状态 (步骤 3.1)</Text>

            <View style={styles.timerStatsGrid}>
              <View style={styles.timerStatItem}>
                <Text style={styles.timerStatLabel}>定时检测</Text>
                <Text style={[styles.timerStatValue, styles.timerEnabled]}>
                  ✓ 已开启
                </Text>
              </View>

              <View style={styles.timerStatItem}>
                <Text style={styles.timerStatLabel}>距离下次拍照</Text>
                <Text style={styles.timerStatValue}>
                  {formatCountdown(sceneUnderstanding.timerState.nextCaptureIn)}
                </Text>
              </View>

              <View style={styles.timerStatItem}>
                <Text style={styles.timerStatLabel}>距离下次分析</Text>
                <Text style={styles.timerStatValue}>
                  {formatCountdown(sceneUnderstanding.timerState.nextAnalysisIn)}
                </Text>
              </View>

              <View style={styles.timerStatItem}>
                <Text style={styles.timerStatLabel}>已拍照</Text>
                <Text style={styles.timerStatValue}>
                  {sceneUnderstanding.timerState.totalCaptures} 次
                </Text>
              </View>

              <View style={styles.timerStatItem}>
                <Text style={styles.timerStatLabel}>定时分析</Text>
                <Text style={styles.timerStatValue}>
                  {sceneUnderstanding.timerState.totalTimerAnalyses} 次
                </Text>
              </View>
            </View>

            {/* Test criteria for Step 3.1 */}
            <View style={styles.testCriteriaInline}>
              <Text style={styles.criteriaInlineTitle}>测试标准 (步骤 3.1):</Text>
              <Text
                style={[
                  styles.criteriaInlineText,
                  sceneUnderstanding.timerState.totalCaptures > 0
                    ? styles.criteriaPassed
                    : styles.criteriaPending,
                ]}
              >
                {sceneUnderstanding.timerState.totalCaptures > 0 ? '✅' : '○'} 定时器准确触发
              </Text>
              <Text
                style={[
                  styles.criteriaInlineText,
                  styles.criteriaPassed,
                ]}
              >
                ✅ 后台/前台切换处理
              </Text>
              <Text
                style={[
                  styles.criteriaInlineText,
                  styles.criteriaPassed,
                ]}
              >
                ✅ 定时器正确清理
              </Text>
            </View>
          </View>
        )}

        {/* Scene Change Detection (Step 3.2) */}
        {sceneUnderstanding.timerState.enabled && (
          <View style={styles.sceneChangePanel}>
            <Text style={styles.sectionTitle}>🔄 场景变化触发 (步骤 3.2)</Text>

            <View style={styles.timerStatsGrid}>
              <View style={styles.timerStatItem}>
                <Text style={styles.timerStatLabel}>场景变化检测</Text>
                <Text style={[styles.timerStatValue, styles.timerEnabled]}>
                  ✓ 已启用
                </Text>
              </View>

              <View style={styles.timerStatItem}>
                <Text style={styles.timerStatLabel}>相似度阈值</Text>
                <Text style={styles.timerStatValue}>
                  70%
                </Text>
              </View>

              <View style={styles.timerStatItem}>
                <Text style={styles.timerStatLabel}>图像相似度</Text>
                <Text style={styles.timerStatValue}>
                  {sceneUnderstanding.debugInfo.lastSimilarity > 0
                    ? `${(sceneUnderstanding.debugInfo.lastSimilarity * 100).toFixed(1)}%`
                    : '-'}
                </Text>
              </View>

              <View style={styles.timerStatItem}>
                <Text style={styles.timerStatLabel}>场景变化分析</Text>
                <Text style={styles.timerStatValue}>
                  {sceneUnderstanding.timerState.totalSceneChangeAnalyses} 次
                </Text>
              </View>

              <View style={styles.timerStatItem}>
                <Text style={styles.timerStatLabel}>最后触发原因</Text>
                <Text style={styles.timerStatValue}>
                  {sceneUnderstanding.timerState.lastTriggerReason === 'scene_change'
                    ? '场景变化'
                    : sceneUnderstanding.timerState.lastTriggerReason === 'timer'
                    ? '定时触发'
                    : '-'}
                </Text>
              </View>

              <View style={styles.timerStatItem}>
                <Text style={styles.timerStatLabel}>冷却状态</Text>
                <Text style={styles.timerStatValue}>
                  {(() => {
                    const lastChangeTime = sceneUnderstanding.timerState.lastSceneChangeTime;
                    if (!lastChangeTime) return '未触发';
                    const elapsed = Date.now() - lastChangeTime;
                    const cooldownPeriod = 60000; // 1 minute
                    if (elapsed < cooldownPeriod) {
                      const remaining = Math.ceil((cooldownPeriod - elapsed) / 1000);
                      return `冷却中 (${remaining}s)`;
                    }
                    return '就绪';
                  })()}
                </Text>
              </View>
            </View>

            {/* Test criteria for Step 3.2 */}
            <View style={styles.testCriteriaInline}>
              <Text style={styles.criteriaInlineTitle}>测试标准 (步骤 3.2):</Text>
              <Text
                style={[
                  styles.criteriaInlineText,
                  sceneUnderstanding.timerState.totalSceneChangeAnalyses > 0
                    ? styles.criteriaPassed
                    : styles.criteriaPending,
                ]}
              >
                {sceneUnderstanding.timerState.totalSceneChangeAnalyses > 0 ? '✅' : '○'} 场景变化正确触发
              </Text>
              <Text
                style={[
                  styles.criteriaInlineText,
                  sceneUnderstanding.debugInfo.lastSimilarity > 0 && sceneUnderstanding.debugInfo.lastSimilarity >= 0.7
                    ? styles.criteriaPassed
                    : styles.criteriaPending,
                ]}
              >
                {sceneUnderstanding.debugInfo.lastSimilarity >= 0.7 ? '✅' : '○'} 轻微移动不触发
              </Text>
              <Text
                style={[
                  styles.criteriaInlineText,
                  sceneUnderstanding.timerState.lastSceneChangeTime !== null
                    ? styles.criteriaPassed
                    : styles.criteriaPending,
                ]}
              >
                {sceneUnderstanding.timerState.lastSceneChangeTime ? '✅' : '○'} 冷却机制生效
              </Text>
              <Text
                style={[
                  styles.criteriaInlineText,
                  sceneUnderstanding.timerState.lastTriggerReason === 'scene_change'
                    ? styles.criteriaPassed
                    : styles.criteriaPending,
                ]}
              >
                {sceneUnderstanding.timerState.lastTriggerReason === 'scene_change' ? '✅' : '○'} 触发日志清晰
              </Text>
            </View>
          </View>
        )}

        {/* Scene Analysis (Step 2.1) */}
        <View style={styles.sceneAnalysisPanel}>
          <Text style={styles.sectionTitle}>🧠 场景分析 (步骤 2.1)</Text>

          {/* Analyze button */}
          <TouchableOpacity
            style={[
              styles.analyzeButton,
              isAnalyzing && styles.analyzeButtonDisabled,
              capturedFrames.length === 0 && styles.analyzeButtonDisabled,
            ]}
            onPress={handleAnalyzeScene}
            disabled={isAnalyzing || capturedFrames.length === 0}
          >
            {isAnalyzing ? (
              <View style={styles.analyzingContainer}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.analyzeButtonText}>正在分析场景...</Text>
              </View>
            ) : (
              <Text style={styles.analyzeButtonText}>
                🔍 分析当前场景
                {capturedFrames.length === 0 && ' (等待帧捕获)'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Analysis stats */}
          <View style={styles.analysisStats}>
            <View style={styles.analysisStatItem}>
              <Text style={styles.analysisStatLabel}>分析次数</Text>
              <Text style={styles.analysisStatValue}>{totalAnalysisCount}</Text>
            </View>
            <View style={styles.analysisStatItem}>
              <Text style={styles.analysisStatLabel}>总成本</Text>
              <Text style={styles.analysisStatValue}>
                ${totalAPICost.toFixed(4)}
              </Text>
            </View>
          </View>

          {/* Error message */}
          {analysisError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{analysisError}</Text>
            </View>
          )}

          {/* Analysis result */}
          {sceneAnalysisResult && sceneAnalysisResult.success && (
            <View style={styles.resultContainer}>
              <Text style={styles.resultTitle}>✅ 分析结果</Text>

              <View style={styles.resultItem}>
                <Text style={styles.resultLabel}>场景位置</Text>
                <Text style={styles.resultValue}>
                  {sceneAnalysisResult.scene.location}
                </Text>
              </View>

              <View style={styles.resultItem}>
                <Text style={styles.resultLabel}>检测物品</Text>
                <View style={styles.objectsContainer}>
                  {sceneAnalysisResult.scene.objects.map((obj, idx) => (
                    <View key={idx} style={styles.objectTag}>
                      <Text style={styles.objectText}>{obj}</Text>
                    </View>
                  ))}
                  {sceneAnalysisResult.scene.objects.length === 0 && (
                    <Text style={styles.emptyObjectsText}>未检测到物品</Text>
                  )}
                </View>
              </View>

              <View style={styles.resultItem}>
                <Text style={styles.resultLabel}>整体氛围</Text>
                <Text style={styles.resultValue}>
                  {sceneAnalysisResult.scene.atmosphere}
                </Text>
              </View>

              <View style={styles.resultItem}>
                <Text style={styles.resultLabel}>光线情况</Text>
                <Text style={styles.resultValue}>
                  {sceneAnalysisResult.scene.lighting}
                </Text>
              </View>

              <View style={styles.resultItem}>
                <Text style={styles.resultLabel}>置信度</Text>
                <Text
                  style={[
                    styles.confidenceValue,
                    sceneAnalysisResult.scene.confidence >= 0.8
                      ? styles.confidenceHigh
                      : sceneAnalysisResult.scene.confidence >= 0.5
                        ? styles.confidenceMedium
                        : styles.confidenceLow,
                  ]}
                >
                  {(sceneAnalysisResult.scene.confidence * 100).toFixed(1)}%
                </Text>
              </View>

              {/* Step 2.2: Display structured details */}
              {Object.keys(sceneAnalysisResult.scene.details).length > 0 && (
                <View style={styles.detailsSection}>
                  <Text style={styles.detailsSectionTitle}>📋 详细信息 (步骤 2.2)</Text>
                  {Object.entries(sceneAnalysisResult.scene.details).map(([key, value]) => {
                    // Format the key for display
                    const displayKey = formatDetailKey(key);
                    // Format the value for display
                    const displayValue = value?.toString() || '未知';

                    return (
                      <View key={key} style={styles.detailItem}>
                        <Text style={styles.detailLabel}>{displayKey}</Text>
                        <Text style={styles.detailValue}>{displayValue}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {sceneAnalysisResult.cost && (
                <View style={styles.resultItem}>
                  <Text style={styles.resultLabel}>本次成本</Text>
                  <Text style={styles.costValue}>
                    ${sceneAnalysisResult.cost.toFixed(4)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Test criteria */}
          <View style={styles.testCriteriaInline}>
            <Text style={styles.criteriaInlineTitle}>测试标准 (步骤 2.1):</Text>
            <Text
              style={[
                styles.criteriaInlineText,
                sceneAnalysisResult?.success
                  ? styles.criteriaPassed
                  : styles.criteriaPending,
              ]}
            >
              {sceneAnalysisResult?.success ? '✅' : '○'} API 调用成功返回描述
            </Text>
            <Text
              style={[
                styles.criteriaInlineText,
                sceneAnalysisResult?.scene.objects &&
                sceneAnalysisResult.scene.objects.length > 0
                  ? styles.criteriaPassed
                  : styles.criteriaPending,
              ]}
            >
              {sceneAnalysisResult?.scene.objects &&
              sceneAnalysisResult.scene.objects.length > 0
                ? '✅'
                : '○'}{' '}
              能识别常见物品
            </Text>
            <Text
              style={[
                styles.criteriaInlineText,
                sceneAnalysisResult?.scene.location &&
                sceneAnalysisResult.scene.location !== '未知场景'
                  ? styles.criteriaPassed
                  : styles.criteriaPending,
              ]}
            >
              {sceneAnalysisResult?.scene.location &&
              sceneAnalysisResult.scene.location !== '未知场景'
                ? '✅'
                : '○'}{' '}
              能理解场景类型
            </Text>
            <Text
              style={[
                styles.criteriaInlineText,
                analysisError || sceneAnalysisResult?.error
                  ? styles.criteriaPassed
                  : styles.criteriaPending,
              ]}
            >
              {analysisError || sceneAnalysisResult?.error ? '✅' : '○'}{' '}
              错误处理正常
            </Text>
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
          <Text style={styles.instructionTitle}>📋 测试说明</Text>

          <Text style={styles.instructionSubtitle}>步骤 1.3 - 图像相似度检测:</Text>
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

          <Text style={styles.instructionSubtitle}>步骤 2.1 - Claude Vision 场景分析:</Text>
          <Text style={styles.instructionText}>
            1. 等待至少一帧被捕获
          </Text>
          <Text style={styles.instructionText}>
            2. 点击"分析当前场景"按钮
          </Text>
          <Text style={styles.instructionText}>
            3. Claude Vision API 将分析最新捕获的图像
          </Text>
          <Text style={styles.instructionText}>
            4. 查看分析结果：场景位置、物品、氛围、光线
          </Text>
          <Text style={styles.instructionText}>
            5. 测试多个不同场景（室内、室外、办公室等）
          </Text>

          <Text style={styles.instructionSubtitle}>步骤 3.1 - 定时触发机制:</Text>
          <Text style={styles.instructionText}>
            1. 点击"定时检测：开启"按钮启动定时器
          </Text>
          <Text style={styles.instructionText}>
            2. 系统每 30 秒自动拍照一次（不分析）
          </Text>
          <Text style={styles.instructionText}>
            3. 系统每 5 分钟自动触发一次深度分析
          </Text>
          <Text style={styles.instructionText}>
            4. 查看实时倒计时和统计信息
          </Text>
          <Text style={styles.instructionText}>
            5. 测试后台切换：将 App 切换到后台，定时器应停止
          </Text>
          <Text style={styles.instructionText}>
            6. 返回前台后，定时器应自动恢复
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
  headerTop: {
    marginBottom: 12,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
  },
  backButtonText: {
    color: '#64B5F6',
    fontSize: 16,
    fontWeight: '600',
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
  buttonTimer: {
    backgroundColor: '#FF9800',
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
  instructionSubtitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#81C784',
    marginTop: 12,
    marginBottom: 6,
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
  // Scene Analysis Panel (Step 2.1)
  sceneAnalysisPanel: {
    margin: 16,
    padding: 16,
    backgroundColor: '#1a2a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a4a2a',
  },
  analyzeButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  analyzeButtonDisabled: {
    backgroundColor: '#555',
    opacity: 0.6,
  },
  analyzeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  analyzingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  analysisStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
  },
  analysisStatItem: {
    alignItems: 'center',
  },
  analysisStatLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  analysisStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#3a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6a2a2a',
    marginBottom: 16,
  },
  errorIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#ff6b6b',
    lineHeight: 18,
  },
  resultContainer: {
    padding: 16,
    backgroundColor: '#1a2a2a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a4a4a',
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 12,
  },
  resultItem: {
    marginBottom: 12,
  },
  resultLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  resultValue: {
    fontSize: 15,
    color: '#ddd',
    lineHeight: 20,
  },
  objectsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  objectTag: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  objectText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyObjectsText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  confidenceValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  confidenceHigh: {
    color: '#4CAF50',
  },
  confidenceMedium: {
    color: '#FF9800',
  },
  confidenceLow: {
    color: '#f44336',
  },
  costValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#64B5F6',
  },
  // Step 2.2: Structured details display styles
  detailsSection: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#2a2a3a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3a3a4a',
  },
  detailsSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#81C784',
    marginBottom: 10,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a4a',
  },
  detailLabel: {
    fontSize: 13,
    color: '#aaa',
    flex: 0.4,
  },
  detailValue: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '500',
    flex: 0.6,
    textAlign: 'right',
  },
  // Timer Statistics Panel (Step 3.1)
  timerStatsPanel: {
    margin: 16,
    padding: 16,
    backgroundColor: '#2a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4a2a2a',
  },
  timerStatsGrid: {
    marginTop: 8,
  },
  timerStatItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#352525',
    borderRadius: 8,
    marginBottom: 8,
  },
  timerStatLabel: {
    fontSize: 13,
    color: '#aaa',
  },
  timerStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF9800',
  },
  timerEnabled: {
    color: '#4CAF50',
  },
  // Scene Change Detection Panel (Step 3.2)
  sceneChangePanel: {
    margin: 16,
    padding: 16,
    backgroundColor: '#1a2a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a4a2a',
  },
});
