import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Loader, Phone, PhoneOff } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const VoiceChat = ({ 
  onVoiceTranscript, 
  onVoiceResponse, 
  isEnabled, 
  setIsEnabled,
  isLoading,
  lastAssistantMessage 
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [lastPlayedMessage, setLastPlayedMessage] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const audioElementRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Initialize audio context for volume visualization
  useEffect(() => {
    if (isEnabled) {
      initializeAudioContext();
    } else {
      cleanup();
    }
    
    return cleanup;
  }, [isEnabled]);

  // Auto-play TTS when new assistant message arrives and voice mode is enabled
  useEffect(() => {
    if (isEnabled && 
        lastAssistantMessage && 
        lastAssistantMessage !== lastPlayedMessage &&
        !isSpeaking && 
        !isLoading && 
        !isRecording && 
        !isProcessing) {
      
      console.log('Auto-playing TTS for new message');
      // Add a small delay to ensure the message is fully rendered
      const timer = setTimeout(() => {
        handleTextToSpeech(lastAssistantMessage, true); // true flag for auto-play
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [lastAssistantMessage, isEnabled, lastPlayedMessage]);

  const initializeAudioContext = () => {
    try {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
    }
  };

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsRecording(false);
    setAudioLevel(0);
  };

  const visualizeAudio = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    setAudioLevel(Math.min(average / 128, 1));
    
    animationFrameRef.current = requestAnimationFrame(visualizeAudio);
  };

  const startRecording = async () => {
    try {
      // Check if browser supports getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error('Your browser does not support microphone access.');
        return;
      }

      // Request microphone permission explicitly
      console.log('Requesting microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        } 
      });
      
      console.log('Microphone permission granted, stream obtained');
      streamRef.current = stream;
      
      // Connect to audio context for visualization
      if (audioContextRef.current && analyserRef.current) {
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);
        visualizeAudio();
      }

      // Check MediaRecorder support
      if (!window.MediaRecorder) {
        toast.error('Your browser does not support audio recording.');
        cleanup();
        return;
      }

      // Set up MediaRecorder with fallback MIME types
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/mp4';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = '';
          }
        }
      }

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        await handleSpeechToText(audioBlob);
        cleanup();
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error);
        toast.error('Recording error occurred.');
        cleanup();
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.success('Recording started - speak now!');
      
    } catch (error) {
      console.error('Error starting recording:', error);
      
      if (error.name === 'NotAllowedError') {
        toast.error('Microphone permission denied. Please allow microphone access and try again.');
      } else if (error.name === 'NotFoundError') {
        toast.error('No microphone found. Please connect a microphone and try again.');
      } else if (error.name === 'NotSupportedError') {
        toast.error('Microphone not supported in this browser.');
      } else {
        toast.error(`Failed to access microphone: ${error.message}`);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSpeechToText = async (audioBlob) => {
    setIsProcessing(true);
    try {
      console.log('Processing audio blob for speech recognition...');
      const response = await api.speechToText(audioBlob);
      const transcript = response.transcript;
      
      console.log('Transcript received:', transcript);
      
      if (transcript && transcript.trim().length > 0) {
        onVoiceTranscript(transcript);
        const shortTranscript = transcript.substring(0, 50) + (transcript.length > 50 ? '...' : '');
        toast.success(`Transcribed: "${shortTranscript}"`);
      } else {
        toast.error('No speech detected. Please speak clearly and try again.');
      }
    } catch (error) {
      console.error('STT Error:', error);
      if (error.message.includes('timeout')) {
        toast.error('Speech recognition timed out. Please try a shorter message.');
      } else if (error.message.includes('network')) {
        toast.error('Network error. Please check your connection and try again.');
      } else {
        toast.error('Failed to transcribe speech. Please try again.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTextToSpeech = async (text, isAutoPlay = false) => {
    if (!text || isSpeaking) return;
    
    // Stop any currently playing audio first
    stopTTS();
    
    setIsSpeaking(true);
    try {
      console.log('Generating TTS for:', text.substring(0, 50) + '...', isAutoPlay ? '(auto-play)' : '(manual)');
      const response = await api.textToSpeech(text);
      
      // Create audio element and play
      const audio = new Audio();
      audioElementRef.current = audio;
      
      // Set up event listeners before setting src
      audio.oncanplay = () => {
        console.log('Audio can play, starting playback');
      };
      
      audio.onended = () => {
        console.log('Audio playback ended');
        setIsSpeaking(false);
        audioElementRef.current = null;
        
        // Track that this message has been played (only for auto-play)
        if (isAutoPlay) {
          setLastPlayedMessage(text);
          console.log('Marked message as played to prevent repeat');
        }
      };
      
      audio.onerror = (e) => {
        console.error('Error playing TTS audio:', e);
        setIsSpeaking(false);
        audioElementRef.current = null;
        toast.error('Failed to play audio');
      };
      
      audio.onpause = () => {
        console.log('Audio paused');
        setIsSpeaking(false);
      };
      
      // Disable looping explicitly
      audio.loop = false;
      audio.autoplay = false;
      
      // Set the audio source
      audio.src = response.audio_url;
      
      // Play the audio
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error('Error playing audio:', error);
          setIsSpeaking(false);
          audioElementRef.current = null;
          toast.error('Failed to play audio - please check browser audio settings');
        });
      }
      
    } catch (error) {
      console.error('TTS Error:', error);
      setIsSpeaking(false);
      toast.error('Failed to generate speech');
    }
  };

  const stopTTS = () => {
    if (audioElementRef.current) {
      console.log('Stopping TTS audio');
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
      audioElementRef.current.removeAttribute('src');
      audioElementRef.current.load(); // Reset the audio element
      audioElementRef.current = null;
    }
    setIsSpeaking(false);
  };

  const requestMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Stop the stream immediately
      toast.success('Microphone permission granted!');
      return true;
    } catch (error) {
      console.error('Permission request failed:', error);
      if (error.name === 'NotAllowedError') {
        toast.error('Please allow microphone access in your browser settings');
      } else {
        toast.error('Failed to request microphone permission');
      }
      return false;
    }
  };

  const toggleVoiceMode = async () => {
    const newEnabled = !isEnabled;
    
    if (newEnabled) {
      // Request permission when enabling voice mode
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        return; // Don't enable if permission denied
      }
    }
    
    setIsEnabled(newEnabled);
    
    if (!newEnabled) {
      // Clean up when disabling
      stopRecording();
      stopTTS();
      cleanup();
      setLastPlayedMessage(null); // Reset played message tracking
      toast.success('Voice mode disabled');
    } else {
      setLastPlayedMessage(null); // Reset played message tracking when enabling
      toast.success('Voice mode enabled - Click microphone to start talking');
    }
  };

  return (
    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border">
      {/* Voice Mode Toggle */}
      <button
        onClick={toggleVoiceMode}
        className={`flex items-center space-x-2 px-3 py-2 rounded-lg font-medium transition-all ${
          isEnabled 
            ? 'bg-green-600 text-white hover:bg-green-700' 
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }`}
      >
        {isEnabled ? <Phone className="w-4 h-4" /> : <PhoneOff className="w-4 h-4" />}
        <span className="text-sm">
          {isEnabled ? 'Voice On' : 'Voice Off'}
        </span>
      </button>

      {isEnabled && (
        <>
          {/* Recording Button */}
          <div className="relative">
            <button
              onClick={isRecording ? stopRecording : () => {
                if (isSpeaking) {
                  stopTTS(); // Stop TTS if it's playing before starting recording
                  setTimeout(startRecording, 100); // Small delay to ensure TTS stops
                } else {
                  startRecording();
                }
              }}
              disabled={isProcessing}
              className={`relative p-3 rounded-full transition-all ${
                isRecording 
                  ? 'bg-red-500 text-white animate-pulse' 
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isProcessing ? (
                <Loader className="w-5 h-5 animate-spin" />
              ) : isRecording ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
              
              {/* Audio level visualization */}
              {isRecording && (
                <div className="absolute inset-0 rounded-full border-4 border-red-300 animate-ping opacity-75" 
                     style={{ 
                       transform: `scale(${1 + audioLevel * 0.5})`,
                       opacity: 0.3 + audioLevel * 0.7 
                     }} 
                />
              )}
            </button>
          </div>

          {/* TTS Controls */}
          <button
            onClick={isSpeaking ? stopTTS : () => lastAssistantMessage && handleTextToSpeech(lastAssistantMessage, false)}
            disabled={!lastAssistantMessage || isProcessing}
            className={`p-2 rounded-lg transition-all ${
              isSpeaking 
                ? 'bg-orange-500 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            } ${(!lastAssistantMessage || isProcessing) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Status Indicator */}
          <div className="text-xs text-gray-600">
            {isProcessing && 'Transcribing...'}
            {isSpeaking && 'Speaking... (click mic to interrupt)'}
            {isRecording && 'Recording...'}
            {!isProcessing && !isSpeaking && !isRecording && 'Ready'}
          </div>
        </>
      )}
    </div>
  );
};

export default VoiceChat; 