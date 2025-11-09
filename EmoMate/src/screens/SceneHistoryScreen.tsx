import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSceneUnderstanding } from '../utils/useSceneUnderstanding';
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
 * Scene History Screen
 *
 * Displays a list of all cached scene analysis results with:
 * - Scene location and type
 * - Detected objects
 * - Cache time and expiry status
 * - Visual indicators for active/expired scenes
 */
const SceneHistoryScreen: React.FC<Props> = ({ navigation }) => {
  const apiKey = getClaudeApiKey();
  const sceneUnderstanding = useSceneUnderstanding(apiKey || '', {
    enabled: false, // Only used for reading cached scenes
  });

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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹ 返回</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>场景历史</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Stats */}
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
});

export default SceneHistoryScreen;
