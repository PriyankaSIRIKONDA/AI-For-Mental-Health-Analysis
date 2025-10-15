import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

class ApiService {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Clear invalid token
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          window.location.href = '/';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async login(credentials) {
    try {
      const response = await this.client.post('/auth/login', credentials);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async register(userData) {
    try {
      const response = await this.client.post('/auth/register', userData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getCurrentUser() {
    try {
      const response = await this.client.get('/user/me');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Tweet endpoints
  async searchTweets(query, maxResults = 100, forceRefresh = false) {
    try {
      const response = await this.client.post('/tweets/search', {
        query,
        max_results: maxResults,
        force_refresh: forceRefresh,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getUserTweets(username, maxResults = 100, forceRefresh = false) {
    try {
      const response = await this.client.post('/tweets/user', {
        username,
        max_results: maxResults,
        force_refresh: forceRefresh,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getCacheStatus(query = null, username = null) {
    try {
      const params = {};
      if (query) params.query = query;
      if (username) params.username = username;
      
      const response = await this.client.get('/tweets/cache-status', { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getSavedTweets(limit = 100, offset = 0) {
    try {
      const response = await this.client.get('/tweets/saved', {
        params: { limit, offset }
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async downloadTweets(tweets, filename = null) {
    try {
      const response = await this.client.post('/tweets/download', 
        { tweets, filename },
        { responseType: 'blob' }
      );
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename || `tweets_${Date.now()}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      return { success: true };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async analyzeTweet(tweetId, text) {
    try {
      const response = await this.client.post('/tweets/analyze', {
        tweet_id: tweetId,
        text: text
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async analyzeAllTweets() {
    try {
      // Use a longer timeout for the long-running analysis operation
      const response = await this.client.post('/tweets/analyze-all', {}, {
        timeout: 120000, // 2 minutes timeout
      });
      return response.data;
    } catch (error) {
      // For analyze-all-tweets, be more lenient with error handling
      // since the backend has its own retry logic
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        throw new Error('Analysis is taking longer than expected. Please check the results in a moment.');
      }
      throw this.handleError(error);
    }
  }

  // Report endpoints
  async generateReport() {
    try {
      const response = await this.client.post('/reports/generate');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getLatestReport() {
    try {
      const response = await this.client.get('/reports/latest');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getReportById(reportId) {
    try {
      const response = await this.client.get(`/reports/${reportId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Counselor chat endpoints
  async chatWithCounselor(reportId, messages) {
    try {
      const response = await this.client.post('/counselor/chat', {
        report_id: reportId,
        messages: messages
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Voice endpoints
  async textToSpeech(text, voiceId = "21m00Tcm4TlvDq8ikWAM") {
    try {
      const response = await this.client.post('/voice/tts', {
        text: text,
        voice_id: voiceId
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async speechToText(audioBlob) {
    try {
      const formData = new FormData();
      formData.append('audio_file', audioBlob, 'audio.wav');
      
      const response = await this.client.post('/voice/stt', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000 // 30 seconds for speech processing
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Health check
  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Error handler
  handleError(error) {
    if (error.response) {
      // Server responded with error status
      const message = error.response.data?.detail || 
                     error.response.data?.error || 
                     `Server error: ${error.response.status}`;
      return new Error(message);
    } else if (error.request) {
      // Request made but no response
      return new Error('Network error: Unable to connect to server');
    } else {
      // Something else happened
      return new Error(`Request error: ${error.message}`);
    }
  }
}

const apiService = new ApiService();
export default apiService; 