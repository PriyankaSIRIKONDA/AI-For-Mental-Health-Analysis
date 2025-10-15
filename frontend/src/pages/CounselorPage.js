import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Brain, MessageCircle, Loader } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import VoiceChat from '../components/VoiceChat';

const CounselorPage = () => {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [report, setReport] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(true);
  const [voiceModeEnabled, setVoiceModeEnabled] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchReportAndInitChat();
  }, [reportId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchReportAndInitChat = async () => {
    try {
      setChatLoading(true);
      const reportData = await api.getReportById(reportId);
      setReport(reportData);
      
      // Initialize chat with welcome message
      const welcomeMessage = {
        id: Date.now(),
        role: 'assistant',
        content: `Hello ${user?.full_name || 'there'}! I'm your AI Mental Health Counselor. I've reviewed your analysis report which shows insights from ${reportData.total_analyzed_tweets} tweets. 

I'm here to provide supportive guidance and help you process these findings. Please remember that while I can offer helpful perspectives and coping strategies, I'm not a replacement for professional mental health care.

How are you feeling about your analysis results? Is there anything specific you'd like to discuss or explore?`,
        timestamp: new Date()
      };
      
      setMessages([welcomeMessage]);
    } catch (error) {
      console.error('Error fetching report:', error);
      toast.error('Failed to load report data');
      navigate('/dashboard');
    } finally {
      setChatLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await api.chatWithCounselor(reportId, [...messages, userMessage]);
      
      const assistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to get response from counselor');
      
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: "I apologize, but I'm having trouble responding right now. Please try again in a moment.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleVoiceTranscript = (transcript) => {
    // Send the voice message directly without setting inputMessage
    if (!transcript.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: transcript.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Send to counselor
    api.chatWithCounselor(reportId, [...messages, userMessage])
      .then(response => {
        const assistantMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          content: response.message,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
      })
      .catch(error => {
        console.error('Error sending voice message:', error);
        toast.error('Failed to get response from counselor');
        
        const errorMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          content: "I apologize, but I'm having trouble responding right now. Please try again in a moment.",
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const getLastAssistantMessage = () => {
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    return assistantMessages.length > 0 ? assistantMessages[assistantMessages.length - 1].content : null;
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (chatLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading counselor session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(`/report/${reportId}`)}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Report</span>
              </button>
            </div>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Brain className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">AI Mental Health Counselor</h1>
                <p className="text-sm text-gray-600">Professional Support & Guidance</p>
              </div>
            </div>
            <div className="w-20"></div> {/* Spacer for balance */}
          </div>
        </div>
      </div>

      {/* Chat Container */}
      <div className="flex-1 flex flex-col">
        <div className="bg-white flex flex-col min-h-[calc(100vh-80px)]">
          
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto">
            {messages.map((message, index) => (
              <div
                key={message.id}
                className={`w-full border-b border-gray-100 ${
                  message.role === 'user' 
                    ? 'bg-blue-50' 
                    : 'bg-gray-50'
                }`}
              >
                <div className="max-w-4xl mx-auto px-6 py-6">
                  <div className="flex space-x-4">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {message.role === 'user' ? (
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium text-sm">
                          {user?.full_name?.charAt(0) || user?.username?.charAt(0) || 'U'}
                        </div>
                      ) : (
                        <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                          <Brain className="w-5 h-5 text-white" />
                        </div>
                      )}
                    </div>
                    
                    {/* Message Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="font-semibold text-gray-900 text-sm">
                          {message.role === 'user' ? (user?.full_name || 'You') : 'AI Counselor'}
                        </h4>
                        <span className="text-xs text-gray-500">
                          {formatTime(message.timestamp)}
                        </span>
                      </div>
                      
                      <div className="text-gray-800">
                        {message.role === 'assistant' ? (
                          <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-800 prose-strong:text-gray-900 prose-ul:text-gray-800 prose-ol:text-gray-800 prose-li:text-gray-800 prose-blockquote:text-gray-700 prose-code:text-gray-800 prose-pre:bg-gray-100">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="w-full bg-gray-50 border-b border-gray-100">
                <div className="max-w-4xl mx-auto px-6 py-6">
                  <div className="flex space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                        <Brain className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="font-semibold text-gray-900 text-sm">AI Counselor</h4>
                      </div>
                      <div className="flex items-center space-x-2 text-gray-600">
                        <Loader className="w-4 h-4 animate-spin" />
                        <span>Thinking...</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-200 bg-white">
            <div className="max-w-4xl mx-auto px-6 py-4">
              {/* Voice Chat Component */}
              <VoiceChat
                onVoiceTranscript={handleVoiceTranscript}
                isEnabled={voiceModeEnabled}
                setIsEnabled={setVoiceModeEnabled}
                isLoading={isLoading}
                lastAssistantMessage={getLastAssistantMessage()}
              />
              
              <div className="relative mt-4">
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Share your thoughts or ask for guidance..."
                  className="w-full resize-none border border-gray-300 rounded-xl px-4 py-3 pr-12 focus:ring-2 focus:ring-green-500 focus:border-transparent shadow-sm"
                  rows="1"
                  style={{ minHeight: '44px', maxHeight: '120px' }}
                  disabled={isLoading}
                  onInput={(e) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                  }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || isLoading}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              
              <div className="mt-3 text-xs text-gray-500 text-center">
                💡 This AI counselor provides supportive guidance based on your analysis. For urgent mental health concerns, please contact a professional counselor or crisis helpline.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CounselorPage; 