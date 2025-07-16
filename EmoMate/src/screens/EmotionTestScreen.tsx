import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView,
  StyleSheet 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  EmotionProvider,
  useEmotionContext,
  FacialEmotionDetector,
  ChatEmotionAnalyzer,
  EmotionAwareCharacter
} from '../components';
import { EmotionType } from '../types/emotion';

const EmotionTestContent: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [isFacialDetectionActive, setIsFacialDetectionActive] = useState(true);
  const [isTextAnalysisActive, setIsTextAnalysisActive] = useState(true);
  
  const { 
    facialEmotion, 
    textEmotion, 
    combinedEmotion,
    setFacialEmotion,
    setTextEmotion,
    clearEmotions
  } = useEmotionContext();

  const handleFacialEmotionDetected = (emotion: EmotionType) => {
    setFacialEmotion(emotion);
  };

  const handleTextEmotionDetected = (emotion: EmotionType) => {
    setTextEmotion(emotion);
  };

  const handleManualEmotionTest = (emotion: EmotionType) => {
    setTextEmotion(emotion);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Emotion Perception MVP</Text>
          <Text style={styles.subtitle}>Camera + Text Emotion Detection</Text>
        </View>

        {/* Character Display */}
        <View style={styles.characterSection}>
          <EmotionAwareCharacter 
            size={200}
            enableEmotionMapping={true}
          />
        </View>

        {/* Facial Emotion Detection */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📷 Facial Emotion Detection</Text>
            <TouchableOpacity
              style={[styles.toggleButton, isFacialDetectionActive && styles.toggleButtonActive]}
              onPress={() => setIsFacialDetectionActive(!isFacialDetectionActive)}
            >
              <Text style={styles.toggleButtonText}>
                {isFacialDetectionActive ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
          </View>
          
          {isFacialDetectionActive && (
            <FacialEmotionDetector
              onEmotionDetected={handleFacialEmotionDetected}
              isActive={isFacialDetectionActive}
            />
          )}
          
          <Text style={styles.statusText}>
            Status: {facialEmotion || 'No emotion detected'}
          </Text>
        </View>

        {/* Text Emotion Analysis */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>💬 Text Emotion Analysis</Text>
            <TouchableOpacity
              style={[styles.toggleButton, isTextAnalysisActive && styles.toggleButtonActive]}
              onPress={() => setIsTextAnalysisActive(!isTextAnalysisActive)}
            >
              <Text style={styles.toggleButtonText}>
                {isTextAnalysisActive ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <TextInput
            style={styles.textInput}
            placeholder="输入文本测试情绪识别..."
            placeholderTextColor="#999"
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          
          {isTextAnalysisActive && inputText.length > 0 && (
            <ChatEmotionAnalyzer
              text={inputText}
              onEmotion={handleTextEmotionDetected}
              enabled={isTextAnalysisActive}
            />
          )}
          
          <Text style={styles.statusText}>
            Status: {textEmotion || 'No emotion detected'}
          </Text>
        </View>

        {/* Quick Test Buttons */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🧪 Quick Emotion Tests</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.emotionButton, styles.happyButton]}
              onPress={() => handleManualEmotionTest('happy')}
            >
              <Text style={styles.buttonText}>😊 Happy</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.emotionButton, styles.sadButton]}
              onPress={() => handleManualEmotionTest('sad')}
            >
              <Text style={styles.buttonText}>😢 Sad</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.emotionButton, styles.angryButton]}
              onPress={() => handleManualEmotionTest('angry')}
            >
              <Text style={styles.buttonText}>😠 Angry</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.emotionButton, styles.surprisedButton]}
              onPress={() => handleManualEmotionTest('surprised')}
            >
              <Text style={styles.buttonText}>😲 Surprised</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity 
            style={[styles.emotionButton, styles.neutralButton]}
            onPress={() => clearEmotions()}
          >
            <Text style={styles.buttonText}>😐 Reset to Neutral</Text>
          </TouchableOpacity>
        </View>

        {/* Emotion Status Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🧠 Emotion State Summary</Text>
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Facial Emotion:</Text>
              <Text style={styles.statusValue}>{facialEmotion || 'none'}</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Text Emotion:</Text>
              <Text style={styles.statusValue}>{textEmotion || 'none'}</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Combined Emotion:</Text>
              <Text style={[styles.statusValue, styles.combinedEmotion]}>
                {combinedEmotion}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export const EmotionTestScreen: React.FC = () => {
  return (
    <EmotionProvider>
      <EmotionTestContent />
    </EmotionProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  scrollView: {
    flex: 1,
    padding: 16
  },
  header: {
    alignItems: 'center',
    marginBottom: 20
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4
  },
  subtitle: {
    fontSize: 16,
    color: '#666'
  },
  characterSection: {
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333'
  },
  toggleButton: {
    backgroundColor: '#ddd',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12
  },
  toggleButtonActive: {
    backgroundColor: '#4CAF50'
  },
  toggleButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold'
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic'
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  emotionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center'
  },
  happyButton: {
    backgroundColor: '#4CAF50'
  },
  sadButton: {
    backgroundColor: '#2196F3'
  },
  angryButton: {
    backgroundColor: '#F44336'
  },
  surprisedButton: {
    backgroundColor: '#FF9800'
  },
  neutralButton: {
    backgroundColor: '#9E9E9E',
    marginHorizontal: 40
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold'
  },
  statusCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  statusLabel: {
    fontSize: 14,
    color: '#666'
  },
  statusValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333'
  },
  combinedEmotion: {
    color: '#4CAF50',
    fontSize: 16
  }
});