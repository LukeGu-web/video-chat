/**
 * FunctionMonitor Component
 * Unified collapsible debug panel for monitoring all app systems
 * Features: Draggable, Collapsible, Real-time monitoring
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { useMonitorContext } from '../contexts/MonitorContext';
import { isDebugMode } from '../utils/debug';
import { useSimpleDraggable } from '../hooks/useSimpleDraggable';

// ============================================
// Props Interface
// ============================================

export interface FunctionMonitorProps {
  /** Handler for manual scene analysis test */
  onTestSceneAnalysis?: () => void;
  /** Is scene analysis currently running */
  isAnalyzing?: boolean;
}

// ============================================
// Collapsible Section Component
// ============================================

interface CollapsibleSectionProps {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  statusColor: string; // green, yellow, red, blue
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  isExpanded,
  onToggle,
  statusColor,
  children,
}) => {
  const colorMap: Record<string, string> = {
    green: '#10B981',
    yellow: '#F59E0B',
    red: '#EF4444',
    blue: '#3B82F6',
    gray: '#9CA3AF',
  };

  return (
    <View className='mb-2'>
      {/* Section Header */}
      <TouchableOpacity
        onPress={onToggle}
        className='flex-row items-center justify-between p-2 bg-gray-800 rounded-lg'
        activeOpacity={0.7}
      >
        <View className='flex-row items-center flex-1'>
          {/* Status Indicator */}
          <View
            className='w-2 h-2 mr-2 rounded-full'
            style={{ backgroundColor: colorMap[statusColor] || colorMap.gray }}
          />
          {/* Title */}
          <Text className='flex-1 text-xs font-bold text-white'>{title}</Text>
        </View>
        {/* Expand/Collapse Icon */}
        <Text className='text-white text-xs font-bold'>
          {isExpanded ? '▼' : '▶'}
        </Text>
      </TouchableOpacity>

      {/* Section Content */}
      {isExpanded && (
        <View className='mt-1 p-2 bg-gray-900/90 rounded-lg'>{children}</View>
      )}
    </View>
  );
};

// ============================================
// Info Row Component
// ============================================

interface InfoRowProps {
  label: string;
  value: string | number | boolean;
  valueColor?: string; // green, yellow, red, blue, white
}

const InfoRow: React.FC<InfoRowProps> = ({
  label,
  value,
  valueColor = 'white',
}) => {
  const colorClassMap: Record<string, string> = {
    green: 'text-green-300',
    yellow: 'text-yellow-300',
    red: 'text-red-300',
    blue: 'text-blue-300',
    purple: 'text-purple-300',
    white: 'text-gray-100',
    gray: 'text-gray-400',
  };

  const displayValue =
    typeof value === 'boolean' ? (value ? '✓' : '✗') : String(value);

  return (
    <View className='flex-row items-center mb-0.5'>
      <Text className='font-mono text-xs text-gray-400 min-w-[80px]'>
        {label}:
      </Text>
      <Text
        className={`flex-1 font-mono text-xs font-bold ${
          colorClassMap[valueColor] || colorClassMap.white
        }`}
      >
        {displayValue}
      </Text>
    </View>
  );
};

// ============================================
// Main FunctionMonitor Component
// ============================================

export const FunctionMonitor: React.FC<FunctionMonitorProps> = ({
  onTestSceneAnalysis,
  isAnalyzing = false,
}) => {
  const { data } = useMonitorContext();
  const [expandedSections, setExpandedSections] = useState({
    live2d: true,
    emotion: true,
    scene: false,
  });

  // Use simple draggable hook
  const { panHandlers, isDragging, animatedStyle } = useSimpleDraggable({
    initialX: 0,
    initialY: 0,
  });

  // Don't render if not in debug mode
  if (!isDebugMode()) {
    return null;
  }

  // Toggle section expansion
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Determine Live2D system status color
  const live2dStatusColor = data.live2d.isModelReady
    ? 'green'
    : data.webView.isWebViewReady
    ? 'yellow'
    : data.webView.error
    ? 'red'
    : 'gray';

  // Determine Emotion system status color
  const emotionStatusColor =
    data.emotion.combinedEmotion !== 'neutral' ? 'green' : 'blue';

  // Determine Scene system status color
  const sceneStatusColor = data.sceneUnderstanding.isAnalyzing
    ? 'yellow'
    : data.sceneUnderstanding.currentLocation
    ? 'green'
    : 'gray';

  return (
    <Animated.View
      {...panHandlers}
      style={[
        {
          position: 'absolute',
          top: 64,
          right: 16,
          width: 280,
          maxHeight: 500,
          backgroundColor: 'rgba(0, 0, 0, 0.8)', // 80% opacity
          borderRadius: 12,
          padding: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 10,
        },
        animatedStyle,
        isDragging && { opacity: 0.9 },
      ]}
    >
      {/* Header with drag hint */}
      <View className='mb-3 pb-2 border-b border-gray-700'>
        <View className='flex-row items-center justify-center'>
          <Text className='text-xs text-gray-500 mr-1'>⋮⋮</Text>
          <Text className='text-sm font-bold text-white text-center'>
            🔍 Function Monitor
          </Text>
          <Text className='text-xs text-gray-500 ml-1'>⋮⋮</Text>
        </View>
        <Text className='text-xs text-gray-500 text-center mt-0.5'>
          Drag to move
        </Text>
      </View>

      {/* Scrollable Content */}
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Live2D System Section */}
        <CollapsibleSection
          title='Live2D System'
          isExpanded={expandedSections.live2d}
          onToggle={() => toggleSection('live2d')}
          statusColor={live2dStatusColor}
        >
          <Text className='mb-1 text-xs font-semibold text-gray-300'>
            WebView Status
          </Text>
          <InfoRow
            label='WebView'
            value={data.webView.isWebViewReady}
            valueColor={data.webView.isWebViewReady ? 'green' : 'red'}
          />
          <InfoRow
            label='Model'
            value={data.webView.isModelReady}
            valueColor={data.webView.isModelReady ? 'green' : 'red'}
          />
          <InfoRow
            label='Queue'
            value={data.webView.pendingMessagesCount}
            valueColor={
              data.webView.pendingMessagesCount > 0 ? 'yellow' : 'white'
            }
          />
          {data.webView.error && (
            <InfoRow label='Error' value={data.webView.error} valueColor='red' />
          )}

          <View className='my-1 border-t border-gray-700' />

          <Text className='mb-1 text-xs font-semibold text-gray-300'>
            Playback Status
          </Text>
          <InfoRow
            label='Motion'
            value={data.live2d.currentMotion}
            valueColor='yellow'
          />
          <InfoRow
            label='Ready'
            value={data.live2d.isModelReady}
            valueColor={data.live2d.isModelReady ? 'green' : 'red'}
          />
          <InfoRow
            label='Playing'
            value={data.live2d.isPlaying ? '▶' : '⏸'}
            valueColor={data.live2d.isPlaying ? 'green' : 'gray'}
          />
          <InfoRow
            label='Loop'
            value={data.live2d.shouldLoop}
            valueColor={data.live2d.shouldLoop ? 'blue' : 'gray'}
          />
        </CollapsibleSection>

        {/* Emotion System Section */}
        <CollapsibleSection
          title='Emotion System'
          isExpanded={expandedSections.emotion}
          onToggle={() => toggleSection('emotion')}
          statusColor={emotionStatusColor}
        >
          <InfoRow
            label='Facial'
            value={data.emotion.facialEmotion || 'none'}
            valueColor='white'
          />
          <InfoRow
            label='Text'
            value={data.emotion.textEmotion || 'none'}
            valueColor='white'
          />
          <InfoRow
            label='Combined'
            value={data.emotion.combinedEmotion}
            valueColor='green'
          />
          <InfoRow
            label='AI Status'
            value={data.emotion.aiStatus || 'none'}
            valueColor='blue'
          />

          <View className='my-1 border-t border-gray-700' />

          <Text className='mb-1 text-xs font-semibold text-gray-300'>
            Motion Mapping
          </Text>
          <InfoRow
            label='Motion'
            value={data.emotion.selectedMotion}
            valueColor='yellow'
          />
          <InfoRow
            label='Priority'
            value={data.emotion.motionPriority}
            valueColor='purple'
          />
          {data.emotion.motionReason && (
            <View className='mt-1'>
              <Text className='mb-0.5 font-mono text-xs text-gray-400'>
                Reason:
              </Text>
              <Text className='font-mono text-xs text-gray-100'>
                {data.emotion.motionReason}
              </Text>
            </View>
          )}
          <InfoRow
            label='Mapping'
            value={data.emotion.mappingEnabled ? 'ON' : 'OFF'}
            valueColor={data.emotion.mappingEnabled ? 'green' : 'gray'}
          />
        </CollapsibleSection>

        {/* Scene Understanding Section */}
        <CollapsibleSection
          title='Scene Understanding'
          isExpanded={expandedSections.scene}
          onToggle={() => toggleSection('scene')}
          statusColor={sceneStatusColor}
        >
          {data.backgroundScene ? (
            <>
              <Text className='mb-1 text-xs font-semibold text-gray-300'>
                Background Scene
              </Text>
              <InfoRow label='Scene ID' value={data.backgroundScene.sceneId} />
              <InfoRow
                label='Type'
                value={`${data.backgroundScene.dayType} - ${data.backgroundScene.timePeriod}`}
              />
              <InfoRow label='Location' value={data.backgroundScene.location} />
              <InfoRow label='Weather' value={data.backgroundScene.weather} />
              <View className='mt-1'>
                <Text className='mb-0.5 font-mono text-xs text-gray-400'>
                  Story:
                </Text>
                <Text className='font-mono text-xs text-gray-100'>
                  {data.backgroundScene.storyPreview}...
                </Text>
              </View>

              <View className='my-1 border-t border-gray-700' />
            </>
          ) : (
            <Text className='mb-2 font-mono text-xs text-gray-400'>
              No scene data available
            </Text>
          )}

          <Text className='mb-1 text-xs font-semibold text-gray-300'>
            Analysis Status
          </Text>
          <InfoRow
            label='Analyzing'
            value={data.sceneUnderstanding.isAnalyzing}
            valueColor={data.sceneUnderstanding.isAnalyzing ? 'yellow' : 'gray'}
          />
          <InfoRow
            label='API Calls'
            value={data.sceneUnderstanding.totalAPICalls}
          />
          <InfoRow
            label='Location'
            value={data.sceneUnderstanding.currentLocation || 'none'}
          />
          <InfoRow
            label='Timer'
            value={data.sceneUnderstanding.timerEnabled ? 'ON' : 'OFF'}
            valueColor={data.sceneUnderstanding.timerEnabled ? 'green' : 'gray'}
          />
          <InfoRow
            label='Next'
            value={`${data.sceneUnderstanding.nextCaptureInSeconds}s`}
          />

          {/* Manual Test Button */}
          {onTestSceneAnalysis && (
            <View className='mt-2'>
              <TouchableOpacity
                onPress={onTestSceneAnalysis}
                disabled={isAnalyzing}
                className={`px-3 py-2 rounded ${
                  isAnalyzing ? 'bg-gray-600' : 'bg-blue-600'
                }`}
                activeOpacity={0.7}
              >
                <Text className='text-xs font-semibold text-white text-center'>
                  {isAnalyzing ? '分析中...' : '🧪 手动测试场景分析'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </CollapsibleSection>
      </ScrollView>
    </Animated.View>
  );
};

export default FunctionMonitor;
