import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
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

  const sceneUnderstanding = useSceneUnderstanding(apiKey || '', {
    enabled: false, // Only used for reading cached scenes
  });

  const objectRecognition = useObjectRecognition(apiKey || '');

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
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹ 返回</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>视觉记录</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'scene' && styles.tabActive]}
          onPress={() => setActiveTab('scene')}
        >
          <Text style={[styles.tabText, activeTab === 'scene' && styles.tabTextActive]}>
            场景历史
          </Text>
          {sceneUnderstanding.cachedScenes.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{sceneUnderstanding.cachedScenes.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'object' && styles.tabActive]}
          onPress={() => setActiveTab('object')}
        >
          <Text style={[styles.tabText, activeTab === 'object' && styles.tabTextActive]}>
            物品识别
          </Text>
          {objectRecognition.records.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{objectRecognition.records.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {activeTab === 'scene' ? (
          <>
            {/* Scene History Stats */}
            <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{sceneUnderstanding.cachedScenes.length}</Text>
            <Text style={styles.statLabel}>总场景数</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {sceneUnderstanding.cachedScenes.filter(
                (entry) => entry.expiresAt > Date.now()
              ).length}
            </Text>
            <Text style={styles.statLabel}>活跃场景</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {sceneUnderstanding.cachedScenes.filter(
                (entry) => entry.expiresAt <= Date.now()
              ).length}
            </Text>
            <Text style={styles.statLabel}>已过期</Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.clearExpiredButton,
              sceneUnderstanding.cachedScenes.filter(
                (entry) => entry.expiresAt <= Date.now()
              ).length === 0 && styles.actionButtonDisabled,
            ]}
            onPress={handleClearExpired}
            disabled={
              sceneUnderstanding.cachedScenes.filter(
                (entry) => entry.expiresAt <= Date.now()
              ).length === 0
            }
          >
            <Text style={styles.actionButtonText}>🗑️ 清理过期场景</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.clearAllButton,
              sceneUnderstanding.cachedScenes.length === 0 && styles.actionButtonDisabled,
            ]}
            onPress={handleClearAll}
            disabled={sceneUnderstanding.cachedScenes.length === 0}
          >
            <Text style={styles.actionButtonText}>🚮 清空所有场景</Text>
          </TouchableOpacity>
        </View>

        {/* Scene history list */}
        <View style={styles.sceneListContainer}>
          <Text style={styles.sceneListTitle}>历史记录</Text>

          {sceneUnderstanding.cachedScenes.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>暂无缓存场景</Text>
              <Text style={styles.emptyHint}>
                使用视觉问答功能后,场景分析结果会自动保存在这里
              </Text>
            </View>
          ) : (
            sceneUnderstanding.cachedScenes.map((entry, index) => {
              const now = Date.now();
              const ageMinutes = Math.floor((now - entry.cachedAt) / 60000);
              const expiresInMinutes = Math.floor((entry.expiresAt - now) / 60000);
              const isExpired = entry.expiresAt <= now;
              const isActive = expiresInMinutes > 0;

              return (
                <View
                  key={`${entry.cachedAt}-${index}`}
                  style={[
                    styles.sceneCard,
                    isExpired && styles.sceneCardExpired,
                  ]}
                >
                  {/* Header */}
                  <View style={styles.sceneCardHeader}>
                    <View style={styles.sceneCardTitleContainer}>
                      <Text style={styles.sceneCardIndex}>#{index + 1}</Text>
                      <Text style={styles.sceneCardLocation}>
                        {entry.scene.location}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.sceneCardStatus,
                        isActive ? styles.statusActive : styles.statusExpired,
                      ]}
                    >
                      <Text
                        style={[
                          styles.sceneCardStatusText,
                          isActive ? styles.statusActiveText : styles.statusExpiredText,
                        ]}
                      >
                        {isActive ? '✓ 活跃' : '✗ 已过期'}
                      </Text>
                    </View>
                  </View>

                  {/* Time info */}
                  <View style={styles.sceneCardTimeContainer}>
                    <View style={styles.sceneCardTimeItem}>
                      <Text style={styles.sceneCardTimeLabel}>缓存于</Text>
                      <Text style={styles.sceneCardTimeValue}>
                        {ageMinutes < 1 ? '刚刚' : `${ageMinutes} 分钟前`}
                      </Text>
                    </View>
                    <View style={styles.sceneCardTimeItem}>
                      <Text style={styles.sceneCardTimeLabel}>过期</Text>
                      <Text
                        style={[
                          styles.sceneCardTimeValue,
                          isExpired && styles.sceneCardTimeValueExpired,
                        ]}
                      >
                        {isExpired ? '已过期' : `${expiresInMinutes} 分钟后`}
                      </Text>
                    </View>
                  </View>

                  {/* Objects */}
                  {entry.scene.objects.length > 0 && (
                    <View style={styles.sceneCardObjectsContainer}>
                      <Text style={styles.sceneCardObjectsLabel}>
                        检测到的物品 ({entry.scene.objects.length})
                      </Text>
                      <View style={styles.sceneCardObjectsList}>
                        {entry.scene.objects.slice(0, 6).map((obj, objIdx) => (
                          <View key={objIdx} style={styles.objectTag}>
                            <Text style={styles.objectTagText}>{obj}</Text>
                          </View>
                        ))}
                        {entry.scene.objects.length > 6 && (
                          <View style={styles.objectTag}>
                            <Text style={styles.objectTagText}>
                              +{entry.scene.objects.length - 6}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Atmosphere */}
                  {entry.scene.atmosphere && (
                    <View style={styles.sceneCardDescriptionContainer}>
                      <Text style={styles.sceneCardDescriptionLabel}>氛围</Text>
                      <Text
                        style={styles.sceneCardDescriptionText}
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
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{objectRecognition.records.length}</Text>
                <Text style={styles.statLabel}>识别记录</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{objectStats.categories.length}</Text>
                <Text style={styles.statLabel}>物品类别</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {objectStats.latestRecord
                    ? Math.floor((Date.now() - objectStats.latestRecord.createdAt) / 60000) < 1
                      ? '刚刚'
                      : `${Math.floor((Date.now() - objectStats.latestRecord.createdAt) / 60000)}分钟前`
                    : '-'}
                </Text>
                <Text style={styles.statLabel}>最近识别</Text>
              </View>
            </View>

            {/* Action buttons */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.clearAllButton,
                  objectRecognition.records.length === 0 && styles.actionButtonDisabled,
                ]}
                onPress={() => objectRecognition.clearAllRecords()}
                disabled={objectRecognition.records.length === 0}
              >
                <Text style={styles.actionButtonText}>🚮 清空所有记录</Text>
              </TouchableOpacity>
            </View>

            {/* Object recognition records list */}
            <View style={styles.sceneListContainer}>
              <Text style={styles.sceneListTitle}>识别记录</Text>

              {objectRecognition.records.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyIcon}>📦</Text>
                  <Text style={styles.emptyText}>暂无识别记录</Text>
                  <Text style={styles.emptyHint}>
                    在主界面使用物品识别功能后，记录会显示在这里
                  </Text>
                </View>
              ) : (
                objectRecognition.records.map((record, index) => {
                  const ageMinutes = Math.floor((Date.now() - record.createdAt) / 60000);
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

                  return (
                    <View key={record.id} style={styles.objectCard}>
                      {/* Header with image and basic info */}
                      <View style={styles.objectCardHeader}>
                        {/* Thumbnail */}
                        <View style={styles.objectThumbnailContainer}>
                          <Image
                            source={{ uri: imageUri }}
                            style={styles.objectThumbnail}
                            resizeMode="cover"
                            onError={(error) => {
                              console.error('[SceneHistory] Image load error:', error.nativeEvent);
                            }}
                          />
                          {/* Fallback placeholder overlay (shows while loading) */}
                          <View style={styles.objectThumbnailPlaceholder}>
                            <Text style={styles.objectThumbnailPlaceholderText}>📷</Text>
                          </View>
                        </View>

                        {/* Basic info */}
                        <View style={styles.objectCardInfo}>
                          <Text style={styles.objectCardName} numberOfLines={2}>
                            {record.data.objectName}
                          </Text>
                          <View style={styles.objectCardMeta}>
                            <View style={styles.objectCategoryTag}>
                              <Text style={styles.objectCategoryTagText}>
                                {record.data.category}
                              </Text>
                            </View>
                            <Text style={styles.objectCardTime}>{ageText}</Text>
                          </View>
                        </View>

                        {/* Delete button */}
                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={() => objectRecognition.deleteRecord(record.id)}
                        >
                          <Text style={styles.deleteButtonText}>✕</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Description */}
                      <Text style={styles.objectCardDescription} numberOfLines={3}>
                        {record.data.description}
                      </Text>

                      {/* Details */}
                      <View style={styles.objectCardDetails}>
                        {record.data.brand && (
                          <View style={styles.objectDetailItem}>
                            <Text style={styles.objectDetailLabel}>品牌</Text>
                            <Text style={styles.objectDetailValue}>{record.data.brand}</Text>
                          </View>
                        )}
                        {record.data.model && (
                          <View style={styles.objectDetailItem}>
                            <Text style={styles.objectDetailLabel}>型号</Text>
                            <Text style={styles.objectDetailValue}>{record.data.model}</Text>
                          </View>
                        )}
                        {record.data.color && (
                          <View style={styles.objectDetailItem}>
                            <Text style={styles.objectDetailLabel}>颜色</Text>
                            <Text style={styles.objectDetailValue}>{record.data.color}</Text>
                          </View>
                        )}
                        {record.data.priceRange && (
                          <View style={styles.objectDetailItem}>
                            <Text style={styles.objectDetailLabel}>参考价格</Text>
                            <Text style={styles.objectDetailValue}>{record.data.priceRange}</Text>
                          </View>
                        )}
                      </View>

                      {/* Confidence badge */}
                      <View style={styles.objectCardFooter}>
                        {record.data.userPrompt && (
                          <Text style={styles.objectUserPrompt} numberOfLines={1}>
                            "{record.data.userPrompt}"
                          </Text>
                        )}
                        <View style={styles.confidenceBadge}>
                          <Text style={styles.confidenceBadgeText}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backButtonText: {
    fontSize: 24,
    color: '#3B82F6',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#3B82F6',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  clearExpiredButton: {
    backgroundColor: '#f59e0b',
  },
  clearAllButton: {
    backgroundColor: '#ef4444',
  },
  actionButtonDisabled: {
    backgroundColor: '#d1d5db',
    opacity: 0.5,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  sceneListContainer: {
    marginTop: 8,
  },
  sceneListTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
  },
  emptyContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 18,
  },
  sceneCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  sceneCardExpired: {
    borderLeftColor: '#9ca3af',
    opacity: 0.7,
  },
  sceneCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sceneCardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sceneCardIndex: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6b7280',
    marginRight: 8,
  },
  sceneCardLocation: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  sceneCardStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: '#d1fae5',
  },
  statusExpired: {
    backgroundColor: '#fee2e2',
  },
  sceneCardStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusActiveText: {
    color: '#065f46',
  },
  statusExpiredText: {
    color: '#991b1b',
  },
  sceneCardTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sceneCardTimeItem: {
    flex: 1,
  },
  sceneCardTimeLabel: {
    fontSize: 11,
    color: '#9ca3af',
    marginBottom: 2,
  },
  sceneCardTimeValue: {
    fontSize: 13,
    color: '#4b5563',
    fontWeight: '500',
  },
  sceneCardTimeValueExpired: {
    color: '#dc2626',
  },
  sceneCardTypeContainer: {
    marginBottom: 12,
  },
  sceneCardTypeLabel: {
    fontSize: 11,
    color: '#9ca3af',
    marginBottom: 4,
  },
  sceneCardTypeValue: {
    fontSize: 14,
    color: '#4b5563',
    fontWeight: '500',
  },
  sceneCardObjectsContainer: {
    marginBottom: 12,
  },
  sceneCardObjectsLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 8,
  },
  sceneCardObjectsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  objectTag: {
    backgroundColor: '#eff6ff',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 6,
  },
  objectTagText: {
    fontSize: 12,
    color: '#1e40af',
    fontWeight: '500',
  },
  sceneCardDescriptionContainer: {
    marginTop: 8,
  },
  sceneCardDescriptionLabel: {
    fontSize: 11,
    color: '#9ca3af',
    marginBottom: 4,
  },
  sceneCardDescriptionText: {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
  },
  // Tabs styles
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#3B82F6',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#3B82F6',
  },
  tabBadge: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  // Object recognition record styles
  objectCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  objectCardHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  objectThumbnailContainer: {
    position: 'relative',
    width: 80,
    height: 80,
  },
  objectThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  objectThumbnailPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: -1, // Behind the actual image
  },
  objectThumbnailPlaceholderText: {
    fontSize: 32,
    opacity: 0.5,
  },
  objectCardInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  objectCardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 6,
  },
  objectCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  objectCategoryTag: {
    backgroundColor: '#d1fae5',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 8,
  },
  objectCategoryTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#065f46',
  },
  objectCardTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    fontSize: 18,
    color: '#dc2626',
    fontWeight: '600',
  },
  objectCardDescription: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    marginBottom: 12,
  },
  objectCardDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  objectDetailItem: {
    flexDirection: 'row',
    marginRight: 16,
    marginBottom: 6,
  },
  objectDetailLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginRight: 4,
  },
  objectDetailValue: {
    fontSize: 12,
    color: '#4b5563',
    fontWeight: '500',
  },
  objectCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  objectUserPrompt: {
    flex: 1,
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    marginRight: 8,
  },
  confidenceBadge: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  confidenceBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1e40af',
  },
});

export default SceneHistoryScreen;
