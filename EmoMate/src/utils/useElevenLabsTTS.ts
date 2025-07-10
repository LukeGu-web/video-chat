import { useState, useCallback, useEffect } from 'react';
import { useAudioPlayer } from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import { ELEVENLABS_CONFIG, getElevenLabsApiKey } from '../constants/ai';

export interface UseElevenLabsTTSReturn {
  isSpeaking: boolean;
  isGenerating: boolean; // 新增：是否正在生成语音
  error: string | null;
  speak: (text: string, voiceId?: string) => Promise<void>;
  stop: () => Promise<void>;
  currentSegment: string; // 当前正在播放的语音片段
}

export const useElevenLabsTTS = (): UseElevenLabsTTSReturn => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false); // 新增：语音生成状态
  const [playbackTimer, setPlaybackTimer] = useState<NodeJS.Timeout | null>(null);
  const [currentSegment, setCurrentSegment] = useState<string>(''); // 当前播放的语音片段
  
  // Initialize audio player with null to avoid native module errors
  const audioPlayer = useAudioPlayer(null);

  const createMockSegments = (text: string): {text: string, start: number, end: number}[] => {
    const segments: {text: string, start: number, end: number}[] = [];
    const sentences = text.split(/[。！？]/);
    let currentTime = 0;
    
    for (const sentence of sentences) {
      if (sentence.trim()) {
        const duration = sentence.length * 0.15; // 估算每个字符0.15秒
        segments.push({
          text: sentence.trim(),
          start: currentTime,
          end: currentTime + duration
        });
        currentTime += duration + 0.2; // 添加一点间隔
      }
    }
    
    return segments;
  };

  const generateSpeechFile = async (text: string, voiceId?: string): Promise<string> => {
    const apiKey = getElevenLabsApiKey();
    if (!apiKey) {
      throw new Error('ElevenLabs API密钥未配置。请在环境变量中设置ELEVENLABS_API_KEY。');
    }

    const voice = voiceId || ELEVENLABS_CONFIG.voices[ELEVENLABS_CONFIG.defaultVoice];
    const url = `${ELEVENLABS_CONFIG.baseURL}/text-to-speech/${voice}`;
    
    // 创建临时文件路径
    const fileName = `elevenlabs_${Date.now()}.mp3`;
    const fileUri = FileSystem.documentDirectory + fileName;

    // 使用 XMLHttpRequest 来正确处理二进制数据
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.responseType = 'blob';
      
      // 设置请求头
      xhr.setRequestHeader('Accept', 'audio/mpeg');
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('xi-api-key', apiKey);
      
      xhr.onload = async () => {
        if (xhr.status === 200) {
          try {
            // 将 blob 转换为 base64 并保存到文件
            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64data = reader.result as string;
              const base64Audio = base64data.split(',')[1]; // 移除 data:audio/mpeg;base64, 前缀
              
              await FileSystem.writeAsStringAsync(fileUri, base64Audio, {
                encoding: FileSystem.EncodingType.Base64,
              });
              
              resolve(fileUri);
            };
            reader.readAsDataURL(xhr.response);
          } catch (error) {
            reject(new Error(`保存音频文件失败: ${error}`));
          }
        } else {
          reject(new Error(`ElevenLabs API调用失败: ${xhr.status}`));
        }
      };
      
      xhr.onerror = () => {
        reject(new Error('网络请求失败'));
      };
      
      // 发送请求
      const postData = JSON.stringify({
        text: text,
        model_id: ELEVENLABS_CONFIG.defaultModel,
        voice_settings: ELEVENLABS_CONFIG.settings,
      });
      
      xhr.send(postData);
    });
  };

  const generateSpeechWithTimestamps = async (text: string, voiceId?: string): Promise<{audioUri: string, segments: {text: string, start: number, end: number}[]}> => {
    const apiKey = getElevenLabsApiKey();
    if (!apiKey) {
      throw new Error('ElevenLabs API密钥未配置。请在环境变量中设置ELEVENLABS_API_KEY。');
    }

    const voice = voiceId || ELEVENLABS_CONFIG.voices[ELEVENLABS_CONFIG.defaultVoice];
    const url = `${ELEVENLABS_CONFIG.baseURL}/text-to-speech/${voice}/stream/with-timestamps`;
    
    console.log('🎵 开始生成带时间戳的语音:', { text, voice, url });
    
    // 创建临时文件路径
    const fileName = `elevenlabs_${Date.now()}.mp3`;
    const fileUri = FileSystem.documentDirectory + fileName;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.responseType = 'text';
      
      // 设置请求头
      xhr.setRequestHeader('Accept', 'text/plain');
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('xi-api-key', apiKey);
      
      let audioData = '';
      let segments: {text: string, start: number, end: number}[] = [];
      let processedLines = new Set<string>();
      
      xhr.onprogress = (event) => {
        const responseText = xhr.responseText;
        const lines = responseText.split('\n');
        
        for (const line of lines) {
          if (line.trim() && !processedLines.has(line)) {
            processedLines.add(line);
            try {
              const data = JSON.parse(line);
              console.log('📦 收到流式数据:', data);
              
              if (data.audio_base64) {
                audioData += data.audio_base64;
              }
              if (data.alignment && data.alignment.characters) {
                console.log('🔤 处理字符对齐信息:', data.alignment.characters.length, '个字符');
                // 处理字符级别的对齐信息，合并成单词或短语
                const chars = data.alignment.characters;
                let currentSegment = '';
                let segmentStart = 0;
                
                for (let i = 0; i < chars.length; i++) {
                  const char = chars[i];
                  if (currentSegment === '') {
                    segmentStart = char.start_time_seconds;
                  }
                  currentSegment += char.character;
                  
                  // 当遇到标点符号或达到一定长度时，创建一个新的段落
                  if (char.character.match(/[。！？，；：]/)) {
                    if (currentSegment.trim()) {
                      segments.push({
                        text: currentSegment.trim(),
                        start: segmentStart,
                        end: char.end_time_seconds
                      });
                      console.log('📝 添加段落:', currentSegment.trim(), `(${segmentStart}s - ${char.end_time_seconds}s)`);
                    }
                    currentSegment = '';
                  }
                }
                
                // 处理最后一个段落
                if (currentSegment.trim()) {
                  const lastChar = chars[chars.length - 1];
                  segments.push({
                    text: currentSegment.trim(),
                    start: segmentStart,
                    end: lastChar.end_time_seconds
                  });
                  console.log('📝 添加最后段落:', currentSegment.trim(), `(${segmentStart}s - ${lastChar.end_time_seconds}s)`);
                }
              }
            } catch (e) {
              console.log('⚠️ 解析JSON失败:', line, e);
            }
          }
        }
      };
      
      xhr.onload = async () => {
        if (xhr.status === 200) {
          try {
            // 保存音频文件
            if (audioData) {
              await FileSystem.writeAsStringAsync(fileUri, audioData, {
                encoding: FileSystem.EncodingType.Base64,
              });
              console.log('💾 音频文件已保存:', fileUri);
            }
            
            console.log('✅ 生成完成，共', segments.length, '个段落');
            resolve({ audioUri: fileUri, segments });
          } catch (error) {
            reject(new Error(`保存音频文件失败: ${error}`));
          }
        } else {
          console.error('❌ ElevenLabs API调用失败:', xhr.status, xhr.responseText);
          reject(new Error(`ElevenLabs API调用失败: ${xhr.status}`));
        }
      };
      
      xhr.onerror = () => {
        reject(new Error('网络请求失败'));
      };
      
      // 发送请求
      const postData = JSON.stringify({
        text: text,
        model_id: ELEVENLABS_CONFIG.defaultModel,
        voice_settings: ELEVENLABS_CONFIG.settings,
      });
      
      xhr.send(postData);
    });
  };

  // Monitor audio player state changes
  useEffect(() => {
    // isSpeaking 只在实际播放音频时为 true
    setIsSpeaking(audioPlayer.playing);
    
    // 检查音频是否播放完成（currentTime >= duration）
    if (!audioPlayer.playing && audioPlayer.duration > 0 && audioPlayer.currentTime >= audioPlayer.duration - 0.1) {
      setIsSpeaking(false);
      // 清理备用定时器
      if (playbackTimer) {
        clearTimeout(playbackTimer);
        setPlaybackTimer(null);
      }
    }
    
    // 当音频播放完成时清理临时文件
    if (!audioPlayer.playing && !isGenerating && audioUri && audioPlayer.currentTime > 0) {
      // 延迟清理，确保音频已完全停止
      setTimeout(() => {
        FileSystem.deleteAsync(audioUri, { idempotent: true });
        setAudioUri(null);
      }, 500);
    }
  }, [audioPlayer.playing, audioUri, audioPlayer.currentTime, audioPlayer.duration, isGenerating]);

  const speak = useCallback(async (text: string, voiceId?: string) => {
    if (!text.trim()) return;

    try {
      setError(null);
      setIsGenerating(true); // 开始生成语音
      setCurrentSegment(''); // 清空当前段落
      
      // 停止当前播放
      if (audioPlayer.playing) {
        audioPlayer.pause();
        audioPlayer.seekTo(0);
      }

      // 清理之前的音频文件
      if (audioUri) {
        FileSystem.deleteAsync(audioUri, { idempotent: true });
      }

      // 临时使用普通API，测试基本功能
      console.log('🔧 使用普通API并创建模拟段落');
      
      // 使用普通API生成语音
      const newAudioUri = await generateSpeechFile(text, voiceId);
      
      // 创建模拟的段落数据用于测试
      const segments = createMockSegments(text);
      console.log('📝 创建模拟段落:', segments);
      
      // 使用 replace 方法设置新的音频源
      audioPlayer.replace(newAudioUri);
      setAudioUri(newAudioUri);
      
      // 等待音频加载完成后播放
      setTimeout(() => {
        audioPlayer.play();
        setIsGenerating(false);
        
        console.log('🎵 开始播放音频，段落数:', segments.length);
        
        // 开始监控段落播放
        const segmentTimer = setInterval(() => {
          if (audioPlayer.playing) {
            const currentTime = audioPlayer.currentTime;
            const currentSegmentData = segments.find(s => 
              currentTime >= s.start && currentTime < s.end
            );
            
            if (currentSegmentData) {
              console.log('📝 更新当前段落:', currentSegmentData.text, `时间: ${currentTime}s`);
              setCurrentSegment(currentSegmentData.text);
            } else if (currentTime >= segments[segments.length - 1]?.end) {
              console.log('🎵 播放完成，清空段落');
              setCurrentSegment('');
              clearInterval(segmentTimer);
            }
          } else {
            console.log('🎵 停止播放，清空段落');
            setCurrentSegment('');
            clearInterval(segmentTimer);
          }
        }, 100);
        
        setPlaybackTimer(segmentTimer);
      }, 100);

    } catch (err) {
      setError(err instanceof Error ? err.message : '语音合成失败');
      setIsGenerating(false);
      setIsSpeaking(false);
      setCurrentSegment('');
      console.error('ElevenLabs TTS Error:', err);
    }
  }, [audioPlayer, audioUri]);

  const stop = useCallback(async () => {
    try {
      if (audioPlayer.playing) {
        audioPlayer.pause();
        audioPlayer.seekTo(0);
      }
      
      // 停止所有状态
      setIsGenerating(false);
      setIsSpeaking(false);
      setCurrentSegment(''); // 清空当前段落
      
      // 清理备用定时器
      if (playbackTimer) {
        clearInterval(playbackTimer);
        setPlaybackTimer(null);
      }
      
      // 清理临时音频文件
      if (audioUri) {
        FileSystem.deleteAsync(audioUri, { idempotent: true });
        setAudioUri(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '停止播放失败');
      setIsGenerating(false);
      setIsSpeaking(false); // 确保即使出错也重置状态
      setCurrentSegment(''); // 清空当前段落
      // 清理备用定时器
      if (playbackTimer) {
        clearInterval(playbackTimer);
        setPlaybackTimer(null);
      }
    }
  }, [audioPlayer, audioUri, playbackTimer]);

  return {
    isSpeaking,
    isGenerating,
    error,
    speak,
    stop,
    currentSegment,
  };
};