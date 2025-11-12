import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSceneUnderstanding } from '../utils/useSceneUnderstanding';
import { useObjectRecognition } from '../utils/useObjectRecognition';
import { getClaudeApiKey } from '../constants/ai';

type RootStackParamList = {
  Welcome: undefined;
  Home: undefined;
  ChatHistory: undefined;
  Hiyori: undefined;
  EmotionTest: undefined;
  EnvironmentTest: undefined;
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
  const toggleDescription = (recordId: string) => {
    setExpandedDescriptions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(recordId)) {
        newSet.delete(recordId);
      } else {
        newSet.add(recordId);
      }
      return newSet;
    });
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  const handleClearExpired = () => {
    const removedCount = sceneUnderstanding.clearExpiredScenes();
    console.log(`[SceneHistory] Cleared ${removedCount} expired scenes`);
  };

  const handleClearAll = () => {
    sceneUnderstanding.clearCache();
    console.log('[SceneHistory] Cleared all scenes');
  };

  const objectStats = objectRecognition.getStats();

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
        <TouchableOpacity
          className={`flex-1 py-4 items-center justify-center flex-row border-b-2 ${
            activeTab === 'scene' ? 'border-blue-500' : 'border-transparent'
          }`}
          onPress={() => setActiveTab('scene')}
          activeOpacity={0.9}
        >
          <Text
            className={`text-base font-semibold ${
              activeTab === 'scene' ? 'text-blue-500' : 'text-gray-400'
            }`}
          >
            场景历史
          </Text>
          {sceneUnderstanding.cachedScenes.length > 0 && (
            <View className='bg-blue-500 rounded-full px-2 py-0.5 ml-2 min-w-[20px] items-center'>
              <Text className='text-xs font-bold text-white'>
                {sceneUnderstanding.cachedScenes.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className={`flex-1 py-4 items-center justify-center flex-row border-b-2 ${
            activeTab === 'object' ? 'border-blue-500' : 'border-transparent'
          }`}
          onPress={() => setActiveTab('object')}
          activeOpacity={0.9}
        >
          <Text
            className={`text-base font-semibold ${
              activeTab === 'object' ? 'text-blue-500' : 'text-gray-400'
            }`}
          >
            物品识别
          </Text>
          {objectRecognition.records.length > 0 && (
            <View className='bg-blue-500 rounded-full px-2 py-0.5 ml-2 min-w-[20px] items-center'>
              <Text className='text-xs font-bold text-white'>
                {objectRecognition.records.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView className='flex-1' contentContainerClassName='p-4'>
        {activeTab === 'scene' ? (
          <>
            {/* Scene History Stats */}
            <View className='flex-row justify-between mb-4'>
              <View className='items-center flex-1 p-4 mx-1 bg-white shadow-sm rounded-xl'>
                <Text className='mb-1 text-xl font-bold text-blue-500'>
                  {sceneUnderstanding.cachedScenes.length}
                </Text>
                <Text className='text-xs font-medium text-gray-600'>
                  总场景数
                </Text>
              </View>
              <View className='items-center flex-1 p-4 mx-1 bg-white shadow-sm rounded-xl'>
                <Text className='mb-1 text-xl font-bold text-blue-500'>
                  {
                    sceneUnderstanding.cachedScenes.filter(
                      (entry) => entry.expiresAt > Date.now()
                    ).length
                  }
                </Text>
                <Text className='text-xs font-medium text-gray-600'>
                  活跃场景
                </Text>
              </View>
              <View className='items-center flex-1 p-4 mx-1 bg-white shadow-sm rounded-xl'>
                <Text className='mb-1 text-xl font-bold text-blue-500'>
                  {
                    sceneUnderstanding.cachedScenes.filter(
                      (entry) => entry.expiresAt <= Date.now()
                    ).length
                  }
                </Text>
                <Text className='text-xs font-medium text-gray-600'>
                  已过期
                </Text>
              </View>
            </View>

            {/* Action buttons */}
            <View className='flex-row justify-between mb-5'>
              <TouchableOpacity
                className={`flex-1 py-3 px-4 rounded-xl mx-1 items-center ${
                  sceneUnderstanding.cachedScenes.filter(
                    (entry) => entry.expiresAt <= Date.now()
                  ).length === 0
                    ? 'bg-gray-300 opacity-50'
                    : 'bg-amber-500'
                }`}
                onPress={handleClearExpired}
                disabled={
                  sceneUnderstanding.cachedScenes.filter(
                    (entry) => entry.expiresAt <= Date.now()
                  ).length === 0
                }
              >
                <Text className='text-sm font-semibold text-white'>
                  🗑️ 清理过期场景
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={`flex-1 py-3 px-4 rounded-xl mx-1 items-center ${
                  sceneUnderstanding.cachedScenes.length === 0
                    ? 'bg-gray-300 opacity-50'
                    : 'bg-red-500'
                }`}
                onPress={handleClearAll}
                disabled={sceneUnderstanding.cachedScenes.length === 0}
              >
                <Text className='text-sm font-semibold text-white'>
                  🚮 清空所有场景
                </Text>
              </TouchableOpacity>
            </View>

            {/* Scene history list */}
            <View className='mt-2'>
              <Text className='mb-3 text-lg font-bold text-gray-800'>
                历史记录
              </Text>

              {sceneUnderstanding.cachedScenes.length === 0 ? (
                <View className='items-center p-10 bg-white shadow-sm rounded-2xl'>
                  <Text className='mb-3 text-6xl'>📭</Text>
                  <Text className='mb-2 text-base font-semibold text-gray-600'>
                    暂无缓存场景
                  </Text>
                  <Text className='text-sm leading-5 text-center text-gray-400'>
                    使用视觉问答功能后,场景分析结果会自动保存在这里
                  </Text>
                </View>
              ) : (
                sceneUnderstanding.cachedScenes.map((entry, index) => {
                  const now = Date.now();
                  const ageMinutes = Math.floor((now - entry.cachedAt) / 60000);
                  const expiresInMinutes = Math.floor(
                    (entry.expiresAt - now) / 60000
                  );
                  const isExpired = entry.expiresAt <= now;
                  const isActive = expiresInMinutes > 0;

                  return (
                    <View
                      key={`${entry.cachedAt}-${index}`}
                      className={`bg-white rounded-xl p-4 mb-3 shadow-sm border-l-4 ${
                        isExpired
                          ? 'border-gray-400 opacity-70'
                          : 'border-blue-500'
                      }`}
                    >
                      {/* Header */}
                      <View className='flex-row items-center justify-between mb-3'>
                        <View className='flex-row items-center flex-1'>
                          <Text className='mr-2 text-sm font-bold text-gray-600'>
                            #{index + 1}
                          </Text>
                          <Text className='flex-1 text-base font-semibold text-gray-800'>
                            {entry.scene.location}
                          </Text>
                        </View>
                        <View
                          className={`px-3 py-1 rounded-xl ${
                            isActive ? 'bg-green-100' : 'bg-red-100'
                          }`}
                        >
                          <Text
                            className={`text-xs font-semibold ${
                              isActive ? 'text-green-800' : 'text-red-800'
                            }`}
                          >
                            {isActive ? '✓ 活跃' : '✗ 已过期'}
                          </Text>
                        </View>
                      </View>

                      {/* Time info */}
                      <View className='flex-row justify-between pb-3 mb-3 border-b border-gray-100'>
                        <View className='flex-1'>
                          <Text className='text-xs text-gray-400 mb-0.5'>
                            缓存于
                          </Text>
                          <Text className='text-sm font-medium text-gray-700'>
                            {ageMinutes < 1 ? '刚刚' : `${ageMinutes} 分钟前`}
                          </Text>
                        </View>
                        <View className='flex-1'>
                          <Text className='text-xs text-gray-400 mb-0.5'>
                            过期
                          </Text>
                          <Text
                            className={`text-sm font-medium ${
                              isExpired ? 'text-red-600' : 'text-gray-700'
                            }`}
                          >
                            {isExpired
                              ? '已过期'
                              : `${expiresInMinutes} 分钟后`}
                          </Text>
                        </View>
                      </View>

                      {/* Objects */}
                      {entry.scene.objects.length > 0 && (
                        <View className='mb-3'>
                          <Text className='mb-2 text-xs font-semibold text-gray-600'>
                            检测到的物品 ({entry.scene.objects.length})
                          </Text>
                          <View className='flex-row flex-wrap'>
                            {entry.scene.objects
                              .slice(0, 6)
                              .map((obj, objIdx) => (
                                <View
                                  key={objIdx}
                                  className='bg-blue-50 rounded-md px-3 py-1 mr-1.5 mb-1.5'
                                >
                                  <Text className='text-xs font-medium text-blue-900'>
                                    {obj}
                                  </Text>
                                </View>
                              ))}
                            {entry.scene.objects.length > 6 && (
                              <View className='bg-blue-50 rounded-md px-3 py-1 mr-1.5 mb-1.5'>
                                <Text className='text-xs font-medium text-blue-900'>
                                  +{entry.scene.objects.length - 6}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      )}

                      {/* Atmosphere */}
                      {entry.scene.atmosphere && (
                        <View className='mt-2'>
                          <Text className='mb-1 text-xs text-gray-400'>
                            氛围
                          </Text>
                          <Text
                            className='text-sm leading-5 text-gray-700'
                            numberOfLines={2}
                          >
                            {entry.scene.atmosphere}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          </>
        ) : (
          <>
            {/* Object Recognition Stats */}
            <View className='flex-row justify-between mb-4'>
              <View className='items-center flex-1 p-4 mx-1 bg-white shadow-sm rounded-xl'>
                <Text className='mb-1 text-xl font-bold text-green-500'>
                  {objectRecognition.records.length}
                </Text>
                <Text className='text-xs font-medium text-gray-600'>
                  识别记录
                </Text>
              </View>
              <View className='items-center flex-1 p-4 mx-1 bg-white shadow-sm rounded-xl'>
                <Text className='mb-1 text-xl font-bold text-green-500'>
                  {objectStats.categories.length}
                </Text>
                <Text className='text-xs font-medium text-gray-600'>
                  物品类别
                </Text>
              </View>
              <View className='items-center flex-1 p-4 mx-1 bg-white shadow-sm rounded-xl'>
                <Text className='mb-1 text-xl font-bold text-green-500'>
                  {objectStats.latestRecord
                    ? Math.floor(
                        (Date.now() - objectStats.latestRecord.createdAt) /
                          60000
                      ) < 1
                      ? '刚刚'
                      : `${Math.floor(
                          (Date.now() - objectStats.latestRecord.createdAt) /
                            60000
                        )}分`
                    : '-'}
                </Text>
                <Text className='text-xs font-medium text-gray-600'>
                  最近识别
                </Text>
              </View>
            </View>

            {/* Action buttons */}
            <View className='flex-row justify-between mb-5'>
              <TouchableOpacity
                className={`flex-1 py-3 px-4 rounded-xl mx-1 items-center ${
                  objectRecognition.records.length === 0
                    ? 'bg-gray-300 opacity-50'
                    : 'bg-red-500'
                }`}
                onPress={() => objectRecognition.clearAllRecords()}
                disabled={objectRecognition.records.length === 0}
              >
                <Text className='text-sm font-semibold text-white'>
                  🚮 清空所有记录
                </Text>
              </TouchableOpacity>
            </View>

            {/* Object recognition records list */}
            <View className='mt-2'>
              <Text className='mb-3 text-lg font-bold text-gray-800'>
                识别记录
              </Text>

              {objectRecognition.records.length === 0 ? (
                <View className='items-center p-10 bg-white shadow-sm rounded-2xl'>
                  <Text className='mb-3 text-6xl'>📦</Text>
                  <Text className='mb-2 text-base font-semibold text-gray-600'>
                    暂无识别记录
                  </Text>
                  <Text className='text-sm leading-5 text-center text-gray-400'>
                    在主界面使用物品识别功能后，记录会显示在这里
                  </Text>
                </View>
              ) : (
                objectRecognition.records.map((record, index) => {
                  const ageMinutes = Math.floor(
                    (Date.now() - record.createdAt) / 60000
                  );
                  const ageHours = Math.floor(ageMinutes / 60);
                  const ageDays = Math.floor(ageHours / 24);

                  const ageText =
                    ageDays > 0
                      ? `${ageDays}天前`
                      : ageHours > 0
                      ? `${ageHours}小时前`
                      : ageMinutes < 1
                      ? '刚刚'
                      : `${ageMinutes}分钟前`;

                  // Ensure imageBase64 has proper data URI format
                  const imageUri = record.imageBase64.startsWith('data:')
                    ? record.imageBase64
                    : `data:image/jpeg;base64,${record.imageBase64}`;

                  const isExpanded = expandedDescriptions.has(record.id);
                  const descriptionLength = record.data.description.length;
                  const needsToggle = descriptionLength > 100;

                  return (
                    <View
                      key={record.id}
                      className='p-4 mb-3 bg-white border-l-4 border-green-500 shadow-sm rounded-xl'
                    >
                      {/* Header with image and basic info */}
                      <View className='flex-row mb-3'>
                        {/* Thumbnail */}
                        <View className='relative w-20 h-20'>
                          <Image
                            source={{ uri: imageUri }}
                            className='w-20 h-20 bg-gray-100 rounded-lg'
                            resizeMode='cover'
                            onError={(error) => {
                              console.error(
                                '[SceneHistory] Image load error:',
                                error.nativeEvent
                              );
                            }}
                          />
                          {/* Fallback placeholder overlay */}
                          <View className='absolute top-0 bottom-0 left-0 right-0 items-center justify-center bg-gray-200 rounded-lg -z-10'>
                            <Text className='text-3xl opacity-50'>📷</Text>
                          </View>
                        </View>

                        {/* Basic info */}
                        <View className='justify-center flex-1 ml-3'>
                          <Text
                            className='text-base font-bold text-gray-800 mb-1.5'
                            numberOfLines={2}
                          >
                            {record.data.objectName}
                          </Text>
                          <View className='flex-row items-center'>
                            <View className='bg-green-100 rounded-md px-2 py-0.5 mr-2'>
                              <Text className='text-xs font-semibold text-green-800'>
                                {record.data.category}
                              </Text>
                            </View>
                            <Text className='text-xs text-gray-400'>
                              {ageText}
                            </Text>
                          </View>
                        </View>

                        {/* Delete button */}
                        <TouchableOpacity
                          className='items-center justify-center w-8 h-8 bg-red-100 rounded-full'
                          onPress={() =>
                            objectRecognition.deleteRecord(record.id)
                          }
                        >
                          <Text className='text-lg font-semibold text-red-600'>
                            ✕
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Description with expand/collapse */}
                      <View className='mb-3'>
                        <Text
                          className='text-sm leading-5 text-gray-700'
                          numberOfLines={isExpanded ? undefined : 3}
                        >
                          {record.data.description}
                        </Text>
                        {needsToggle && (
                          <TouchableOpacity
                            onPress={() => toggleDescription(record.id)}
                            className='mt-1'
                          >
                            <Text className='text-xs font-semibold text-blue-500'>
                              {isExpanded ? '收起 ▲' : '展开 ▼'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Details */}
                      {(record.data.brand ||
                        record.data.model ||
                        record.data.color ||
                        record.data.priceRange) && (
                        <View className='flex-row flex-wrap mb-3'>
                          {record.data.brand && (
                            <View className='flex-row mr-4 mb-1.5'>
                              <Text className='mr-1 text-xs text-gray-400'>
                                品牌
                              </Text>
                              <Text className='text-xs font-medium text-gray-700'>
                                {record.data.brand}
                              </Text>
                            </View>
                          )}
                          {record.data.model && (
                            <View className='flex-row mr-4 mb-1.5'>
                              <Text className='mr-1 text-xs text-gray-400'>
                                型号
                              </Text>
                              <Text className='text-xs font-medium text-gray-700'>
                                {record.data.model}
                              </Text>
                            </View>
                          )}
                          {record.data.color && (
                            <View className='flex-row mr-4 mb-1.5'>
                              <Text className='mr-1 text-xs text-gray-400'>
                                颜色
                              </Text>
                              <Text className='text-xs font-medium text-gray-700'>
                                {record.data.color}
                              </Text>
                            </View>
                          )}
                          {record.data.priceRange && (
                            <View className='flex-row mr-4 mb-1.5'>
                              <Text className='mr-1 text-xs text-gray-400'>
                                参考价格
                              </Text>
                              <Text className='text-xs font-medium text-gray-700'>
                                {record.data.priceRange}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}

                      {/* Footer with user prompt and confidence */}
                      <View className='flex-row items-center justify-between pt-3 border-t border-gray-100'>
                        {record.data.userPrompt && (
                          <Text
                            className='flex-1 mr-2 text-xs italic text-gray-600'
                            numberOfLines={1}
                          >
                            "{record.data.userPrompt}"
                          </Text>
                        )}
                        <View className='px-3 py-1 bg-blue-50 rounded-xl'>
                          <Text className='text-xs font-semibold text-blue-900'>
                            置信度 {(record.data.confidence * 100).toFixed(0)}%
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default SceneHistoryScreen;
