import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native';
import Live2DCharacter, { AnimationState, stateMapping, extendedMapping } from './Live2DCharacter';
import AnimatedCharacter from './AnimatedCharacter';

const Live2DTest: React.FC = () => {
  const [currentState, setCurrentState] = useState<string>('idle');
  const [isLive2DMode, setIsLive2DMode] = useState(true);
  const [motionHistory, setMotionHistory] = useState<Array<{
    timestamp: Date;
    state: string;
    motion: string;
    success: boolean;
    error?: string;
  }>>([]);

  // 标准状态列表（对应lottie的8种状态）
  const standardStates: Array<{ state: AnimationState; label: string; color: string }> = [
    { state: 'idle', label: '空闲', color: '#64748B' },
    { state: 'speaking', label: '说话', color: '#3B82F6' },
    { state: 'listening', label: '聆听', color: '#10B981' },
    { state: 'thinking', label: '思考', color: '#F59E0B' },
    { state: 'happy', label: '开心', color: '#EF4444' },
    { state: 'angry', label: '愤怒', color: '#DC2626' },
    { state: 'love', label: '喜爱', color: '#EC4899' },
    { state: 'sad', label: '伤心', color: '#6366F1' },
  ];

  // 扩展状态列表（Live2D特有）
  const extendedStates: Array<{ state: string; label: string; color: string }> = [
    { state: 'greeting', label: '打招呼', color: '#8B5CF6' },
    { state: 'celebration', label: '庆祝', color: '#F97316' },
    { state: 'joy', label: '欢乐', color: '#06B6D4' },
    { state: 'surprise', label: '惊讶', color: '#84CC16' },
    { state: 'sleepy', label: '困倦', color: '#6B7280' },
  ];

  // 处理动作完成回调
  const handleMotionComplete = useCallback((motion: string, success: boolean, error?: string) => {
    const newEntry = {
      timestamp: new Date(),
      state: currentState,
      motion,
      success,
      error,
    };
    
    setMotionHistory(prev => [newEntry, ...prev.slice(0, 9)]); // 保留最近10条记录
    
    console.log(`Motion completed: ${motion} - ${success ? 'Success' : `Failed: ${error}`}`);
  }, [currentState]);

  // 渲染状态按钮
  const renderStateButton = (state: string, label: string, color: string) => (
    <TouchableOpacity
      key={state}
      style={[
        styles.stateButton,
        { backgroundColor: color },
        currentState === state && styles.activeButton,
      ]}
      onPress={() => setCurrentState(state)}
    >
      <Text style={styles.buttonText}>{label}</Text>
      <Text style={styles.buttonSubtext}>
        {isLive2DMode 
          ? (stateMapping[state as AnimationState] || extendedMapping[state] || 'Unknown')
          : state
        }
      </Text>
    </TouchableOpacity>
  );

  // 渲染动作历史记录
  const renderMotionHistory = () => (
    <View style={styles.historyContainer}>
      <Text style={styles.historyTitle}>动作历史</Text>
      <ScrollView style={styles.historyScroll} showsVerticalScrollIndicator={false}>
        {motionHistory.length === 0 ? (
          <Text style={styles.emptyHistory}>暂无动作记录</Text>
        ) : (
          motionHistory.map((entry, index) => (
            <View key={index} style={styles.historyItem}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyTime}>
                  {entry.timestamp.toLocaleTimeString()}
                </Text>
                <View style={[
                  styles.historyStatus,
                  { backgroundColor: entry.success ? '#10B981' : '#EF4444' }
                ]}>
                  <Text style={styles.historyStatusText}>
                    {entry.success ? '✓' : '✗'}
                  </Text>
                </View>
              </View>
              <Text style={styles.historyDetails}>
                状态: {entry.state} → 动作: {entry.motion}
              </Text>
              {entry.error && (
                <Text style={styles.historyError}>错误: {entry.error}</Text>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* 标题和模式切换 */}
      <View style={styles.header}>
        <Text style={styles.title}>Live2D 动画测试</Text>
        <View style={styles.modeSwitch}>
          <Text style={styles.modeLabel}>Lottie</Text>
          <Switch
            value={isLive2DMode}
            onValueChange={setIsLive2DMode}
            trackColor={{ false: '#767577', true: '#3B82F6' }}
            thumbColor={isLive2DMode ? '#ffffff' : '#f4f3f4'}
          />
          <Text style={styles.modeLabel}>Live2D</Text>
        </View>
      </View>

      {/* 当前状态显示 */}
      <View style={styles.statusDisplay}>
        <Text style={styles.statusTitle}>当前状态</Text>
        <Text style={styles.statusValue}>{currentState}</Text>
        <Text style={styles.statusMapping}>
          {isLive2DMode ? '→ ' : ''}
          {isLive2DMode 
            ? (stateMapping[currentState as AnimationState] || extendedMapping[currentState] || 'Unknown')
            : `lottie: ${currentState}`
          }
        </Text>
      </View>

      {/* 角色显示区域 */}
      <View style={styles.characterContainer}>
        <AnimatedCharacter
          status={currentState}
          size={240}
          mode={isLive2DMode ? 'live2d' : 'lottie'}
          onMotionComplete={handleMotionComplete}
        />
      </View>

      {/* 标准状态控制 */}
      <View style={styles.controlSection}>
        <Text style={styles.sectionTitle}>标准状态 (Lottie 兼容)</Text>
        <View style={styles.buttonGrid}>
          {standardStates.map(({ state, label, color }) =>
            renderStateButton(state, label, color)
          )}
        </View>
      </View>

      {/* 扩展状态控制（仅Live2D模式） */}
      {isLive2DMode && (
        <View style={styles.controlSection}>
          <Text style={styles.sectionTitle}>扩展状态 (Live2D 专用)</Text>
          <View style={styles.buttonGrid}>
            {extendedStates.map(({ state, label, color }) =>
              renderStateButton(state, label, color)
            )}
          </View>
        </View>
      )}

      {/* 动作历史记录 */}
      {isLive2DMode && renderMotionHistory()}

      {/* 状态映射说明 */}
      <View style={styles.mappingSection}>
        <Text style={styles.sectionTitle}>状态映射表</Text>
        <View style={styles.mappingTable}>
          {standardStates.map(({ state, label }) => (
            <View key={state} style={styles.mappingRow}>
              <Text style={styles.mappingLottie}>{label} ({state})</Text>
              <Text style={styles.mappingArrow}>→</Text>
              <Text style={styles.mappingLive2d}>
                {stateMapping[state] || 'Unknown'}
              </Text>
            </View>
          ))}
          
          {/* 显示特殊映射说明 */}
          <View style={styles.mappingNote}>
            <Text style={styles.mappingNoteText}>
              📝 说明: listening → Idle (Live2D没有listening动作)
            </Text>
            <Text style={styles.mappingNoteText}>
              📝 说明: angry → Surprised (Live2D用surprised代替angry)
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  modeSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  statusDisplay: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusTitle: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  statusMapping: {
    fontSize: 14,
    color: '#3B82F6',
    fontStyle: 'italic',
  },
  characterContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  controlSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 12,
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stateButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: '30%',
    alignItems: 'center',
    marginBottom: 4,
  },
  activeButton: {
    borderWidth: 2,
    borderColor: '#1E293B',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  buttonSubtext: {
    color: '#FFFFFF',
    fontSize: 10,
    opacity: 0.8,
    marginTop: 2,
  },
  historyContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    maxHeight: 200,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 12,
  },
  historyScroll: {
    flex: 1,
  },
  emptyHistory: {
    textAlign: 'center',
    color: '#64748B',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  historyItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 8,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  historyTime: {
    fontSize: 12,
    color: '#64748B',
  },
  historyStatus: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyStatusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  historyDetails: {
    fontSize: 14,
    color: '#374151',
  },
  historyError: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 2,
  },
  mappingSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mappingTable: {
    gap: 8,
  },
  mappingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  mappingLottie: {
    flex: 1,
    fontSize: 14,
    color: '#64748B',
  },
  mappingArrow: {
    fontSize: 14,
    color: '#3B82F6',
    marginHorizontal: 8,
  },
  mappingLive2d: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
  },
});

export default Live2DTest;