import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  useSceneUnderstanding,
  useObjectRecognition,
} from '../capabilities/vision';
import { getClaudeApiKey } from '../constants/ai';
import StatsCard from '../components/StatsCard';
import TabButton from '../components/TabButton';
import EmptyState from '../components/EmptyState';
import ActionButton from '../components/ActionButton';
import SceneHistoryCard from '../components/scene-history/SceneHistoryCard';
import ObjectRecognitionCard from '../components/object-recognition/ObjectRecognitionCard';

type RootStackParamList = {
  Welcome: undefined;
  Home: undefined;
  ChatHistory: undefined;
  Hiyori: undefined;
  SceneHistory: undefined;
};

type SceneHistoryScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'SceneHistory'
>;

interface Props {
  navigation: SceneHistoryScreenNavigationProp;
}

/**
 * Tab type
 */
type TabType = 'scene' | 'object';

/**
 * Scene History Screen
 *
 * Displays two tabs:
 * 1. Scene History - Cached scene analysis results
 * 2. Object Recognition - User-initiated object recognition records
 */
const SceneHistoryScreen: React.FC<Props> = ({ navigation }) => {
  const apiKey = getClaudeApiKey();
  const [activeTab, setActiveTab] = useState<TabType>('scene');

  // Track expanded descriptions by record ID
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(
    new Set()
  );

  const sceneUnderstanding = useSceneUnderstanding(apiKey || '', {
    enabled: false, // Only used for reading cached scenes
  });

  const objectRecognition = useObjectRecognition(apiKey || '');

  // Toggle description expansion
  const toggleDescription = useCallback((recordId: string) => {
    setExpandedDescriptions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(recordId)) {
        newSet.delete(recordId);
      } else {
        newSet.add(recordId);
      }
      return newSet;
    });
  }, []);

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleClearExpired = useCallback(() => {
    const removedCount = sceneUnderstanding.clearExpiredScenes();
    console.log(`[SceneHistory] Cleared ${removedCount} expired scenes`);
  }, [sceneUnderstanding]);

  const handleClearAll = useCallback(() => {
    sceneUnderstanding.clearCache();
    console.log('[SceneHistory] Cleared all scenes');
  }, [sceneUnderstanding]);

  // Memoized calculations for scene statistics
  const sceneStats = useMemo(() => {
    const now = Date.now();
    const activeScenes = sceneUnderstanding.cachedScenes.filter(
      (entry) => entry.expiresAt > now
    );
    const expiredScenes = sceneUnderstanding.cachedScenes.filter(
      (entry) => entry.expiresAt <= now
    );
    return {
      total: sceneUnderstanding.cachedScenes.length,
      active: activeScenes.length,
      expired: expiredScenes.length,
    };
  }, [sceneUnderstanding.cachedScenes]);

  const objectStats = objectRecognition.getStats();

  // Memoized calculation for latest recognition time
  const latestRecognitionTime = useMemo(() => {
    if (!objectStats.latestRecord) return '-';
    const minutesAgo = Math.floor(
      (Date.now() - objectStats.latestRecord.createdAt) / 60000
    );
    return minutesAgo < 1 ? '刚刚' : `${minutesAgo}分`;
  }, [objectStats.latestRecord]);

  return (
    <SafeAreaView className='flex-1 bg-gray-50'>
      {/* Header */}
      <View className='flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-200'>
        <TouchableOpacity onPress={handleGoBack} className='px-1 py-2'>
          <Text className='font-medium text-blue-500 text-16'>← 返回</Text>
        </TouchableOpacity>
        <Text className='text-lg font-bold text-gray-800'>视觉记录</Text>
        <View className='w-10' />
      </View>

      {/* Tabs */}
      <View className='flex-row px-4 bg-white border-b border-gray-200'>
        <TabButton
          label='场景历史'
          isActive={activeTab === 'scene'}
          count={sceneUnderstanding.cachedScenes.length}
          onPress={() => setActiveTab('scene')}
        />
        <TabButton
          label='物品识别'
          isActive={activeTab === 'object'}
          count={objectRecognition.records.length}
          onPress={() => setActiveTab('object')}
        />
      </View>

      {/* Content */}
      <ScrollView className='flex-1' contentContainerClassName='p-4'>
        {activeTab === 'scene' ? (
          <>
            {/* Scene History Stats */}
            <View className='flex-row justify-between mb-4'>
              <StatsCard value={sceneStats.total} label='总场景数' />
              <StatsCard value={sceneStats.active} label='活跃场景' />
              <StatsCard value={sceneStats.expired} label='已过期' />
            </View>

            {/* Action buttons */}
            <View className='flex-row justify-between mb-5'>
              <ActionButton
                label='清理过期场景'
                icon='🗑️'
                variant='warning'
                onPress={handleClearExpired}
                disabled={sceneStats.expired === 0}
              />
              <ActionButton
                label='清空所有场景'
                icon='🚮'
                variant='danger'
                onPress={handleClearAll}
                disabled={sceneStats.total === 0}
              />
            </View>

            {/* Scene history list */}
            <View className='mt-2'>
              <Text className='mb-3 text-lg font-bold text-gray-800'>
                历史记录
              </Text>

              {sceneUnderstanding.cachedScenes.length === 0 ? (
                <EmptyState
                  icon='📭'
                  title='暂无缓存场景'
                  description='使用视觉问答功能后,场景分析结果会自动保存在这里'
                />
              ) : (
                sceneUnderstanding.cachedScenes.map((entry, index) => (
                  <SceneHistoryCard
                    key={`${entry.cachedAt}-${index}`}
                    entry={entry}
                    index={index}
                  />
                ))
              )}
            </View>
          </>
        ) : (
          <>
            {/* Object Recognition Stats */}
            <View className='flex-row justify-between mb-4'>
              <StatsCard
                value={objectRecognition.records.length}
                label='识别记录'
                color='green'
              />
              <StatsCard
                value={objectStats.categories.length}
                label='物品类别'
                color='green'
              />
              <StatsCard
                value={latestRecognitionTime}
                label='最近识别'
                color='green'
              />
            </View>

            {/* Action buttons */}
            <View className='flex-row justify-between mb-5'>
              <ActionButton
                label='清空所有记录'
                icon='🚮'
                variant='danger'
                onPress={() => objectRecognition.clearAllRecords()}
                disabled={objectRecognition.records.length === 0}
              />
            </View>

            {/* Object recognition records list */}
            <View className='mt-2'>
              <Text className='mb-3 text-lg font-bold text-gray-800'>
                识别记录
              </Text>

              {objectRecognition.records.length === 0 ? (
                <EmptyState
                  icon='📦'
                  title='暂无识别记录'
                  description='在主界面使用物品识别功能后，记录会显示在这里'
                />
              ) : (
                objectRecognition.records.map((record) => (
                  <ObjectRecognitionCard
                    key={record.id}
                    record={record}
                    onDelete={objectRecognition.deleteRecord}
                    isExpanded={expandedDescriptions.has(record.id)}
                    onToggleExpand={toggleDescription}
                  />
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default SceneHistoryScreen;
