import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Brain, 
  Twitter, 
  LogOut, 
  BarChart3,
  RefreshCw,
  Zap,
  FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import apiService from '../services/api';
import TweetCard from '../components/TweetCard';
import UserProfile from '../components/UserProfile';

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tweets, setTweets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTweets, setSelectedTweets] = useState(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);

  const handleFetchMyTweets = async (maxResults = 100, forceRefresh = false) => {
    try {
      setLoading(true);
      
      // Use the authenticated user's username to fetch their tweets
      const response = await apiService.getUserTweets(user.username, maxResults, forceRefresh);
      
      setTweets(response.tweets);
      setSelectedTweets(new Set());
      
      const cacheInfo = forceRefresh ? " (fresh from API)" : "";
      toast.success(`Fetched ${response.tweets.length} of your tweets for analysis${cacheInfo}`);
    } catch (error) {
      toast.error(`Failed to fetch tweets: ${error.message}`);
      setTweets([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeAllTweets = async () => {
    try {
      setAnalyzing(true);
      setAnalysisResults(null);
      
      const response = await apiService.analyzeAllTweets();
      
      // Dismiss loading toast
      toast.dismiss('analysis');
      
      setAnalysisResults(response);
      
      if (response.analyzed_count > 0) {
        // Show success message first
        toast.success(`✅ Successfully analyzed ${response.analyzed_count} tweets!`, { duration: 2000 });
        
        // Show report generation message  
        setTimeout(() => {
          toast.loading('📊 Generating analysis report...', { id: 'report' });
        }, 500);
        
        // Redirect immediately when backend completes (no delay)
        if (response.report_id) {
          setTimeout(() => {
            toast.dismiss('report');
            toast.success('Report generated! Redirecting...', { duration: 1000 });
            navigate(`/report/${response.report_id}`);
          }, 1000); // Quick redirect after showing generation message
        } else {
          // Fallback to latest report if no specific report_id
          setTimeout(() => {
            toast.dismiss('report');
            toast.success('Report generated! Redirecting...', { duration: 1000 });
            navigate('/report');
          }, 1000);
        }
      } else {
        toast.info(response.message);
        
        // If there were no new tweets to analyze but existing data, still try to show report
        if (response.report_id) {
          setTimeout(() => {
            toast.success('Redirecting to report...', { duration: 1000 });
            navigate(`/report/${response.report_id}`);
          }, 1000);
        }
      }
    } catch (error) {
      // Dismiss any loading toasts
      toast.dismiss('analysis');
      toast.dismiss('report');
      
      // Handle specific error types more gracefully
      if (error.message.includes('taking longer than expected')) {
        toast.error('⏱️ Analysis is taking longer than expected. Please check back in a moment.', { duration: 5000 });
      } else if (error.message.includes('Network error') && error.message.includes('Unable to connect')) {
        toast.error('🔄 Connection issue detected. Analysis may still be running - please refresh to check results.', { duration: 5000 });
      } else {
        toast.error(`❌ Analysis failed: ${error.message}`, { duration: 5000 });
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const handleTweetSelect = (tweetId) => {
    const newSelected = new Set(selectedTweets);
    if (newSelected.has(tweetId)) {
      newSelected.delete(tweetId);
    } else {
      newSelected.add(tweetId);
    }
    setSelectedTweets(newSelected);
  };

  const handleViewLatestReport = () => {
    navigate('/report');
  };

  const handleGenerateReportOnly = async () => {
    try {
      setGeneratingReport(true);
      
      const response = await apiService.generateReport();
      
      toast.success('Report generated successfully!');
      
      // Redirect to the generated report
      setTimeout(() => {
        navigate(`/report/${response.id}`);
      }, 1000);
      
    } catch (error) {
      if (error.message.includes('No analyzed tweets found')) {
        toast.error('No analyzed tweets found. Please analyze tweets first before generating a report.');
      } else {
        toast.error(`Failed to generate report: ${error.message}`);
      }
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">MoodTracker</span>
            </div>

            {/* User Profile & Logout */}
            <div className="flex items-center space-x-4">
              <UserProfile user={user} />
              <button
                onClick={handleLogout}
                className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="card">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Brain className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to MoodTracker</h1>
              <p className="text-lg text-gray-600 mb-4">
                Analyze your Twitter activity to understand your emotional patterns and mental health trends
              </p>
            </div>

            {/* Action Buttons */}
            <div className="text-center">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 justify-center items-center">
                <button
                  onClick={() => handleFetchMyTweets(100)}
                  disabled={loading}
                  className="btn-primary px-6 py-3 text-base"
                >
                  {loading ? (
                    <div className="flex items-center space-x-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Fetching...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Twitter className="w-4 h-4" />
                      <span>Fetch Tweets</span>
                    </div>
                  )}
                </button>

                <button
                  onClick={handleAnalyzeAllTweets}
                  disabled={analyzing || tweets.length === 0}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white px-6 py-3 text-base rounded-lg font-medium transition-colors"
                >
                  {analyzing ? (
                    <div className="flex items-center space-x-2">
                      <Zap className="w-4 h-4 animate-pulse" />
                      <span>Analyzing...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Brain className="w-4 h-4" />
                      <span>Analyze & Report</span>
                    </div>
                  )}
                </button>

                <button
                  onClick={handleGenerateReportOnly}
                  disabled={generatingReport}
                  className="bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white px-6 py-3 text-base rounded-lg font-medium transition-colors"
                >
                  {generatingReport ? (
                    <div className="flex items-center space-x-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Generating...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4" />
                      <span>Generate Report</span>
                    </div>
                  )}
                </button>

                <button
                  onClick={handleViewLatestReport}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 text-base rounded-lg font-medium transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4" />
                    <span>View Latest Report</span>
                  </div>
                </button>
              </div>
              
              <div className="mt-4 text-sm text-gray-500 space-y-1">
                <p><strong>Step 1:</strong> Fetch your tweets → <strong>Step 2:</strong> Analyze & Report (first time) or Generate Report (if already analyzed) → <strong>Step 3:</strong> View reports</p>
                <p className="text-xs">💡 "Analyze & Report" analyzes new tweets and generates a report. "Generate Report" only creates a report from existing analyses.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Results Section */}
        {tweets.length > 0 && (
          <div className="space-y-6">

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                  <span className="font-medium text-gray-900">Total Tweets</span>
                </div>
                <p className="text-2xl font-bold text-blue-600 mt-1">{tweets.length}</p>
              </div>
              
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center space-x-2">
                  <Brain className="w-5 h-5 text-indigo-500" />
                  <span className="font-medium text-gray-900">Ready for Analysis</span>
                </div>
                <p className="text-2xl font-bold text-indigo-600 mt-1">
                  {tweets.length}
                </p>
              </div>
            </div>

            {/* Analysis Results */}
            {analysisResults && (
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Brain className="w-5 h-5 mr-2 text-purple-600" />
                  Analysis Results
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{analysisResults.analyzed_count}</p>
                    <p className="text-sm text-gray-600">Successfully Analyzed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">{analysisResults.failed_count || 0}</p>
                    <p className="text-sm text-gray-600">Failed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{analysisResults.total_count}</p>
                    <p className="text-sm text-gray-600">Total Processed</p>
                  </div>
                </div>

                {analysisResults.results && analysisResults.results.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Sample Results:</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {analysisResults.results.slice(0, 5).map((result, index) => (
                        <div key={index} className="flex justify-between items-center py-1 px-2 bg-white rounded text-sm">
                          <span className="text-gray-600">Tweet {result.tweet_id.slice(-8)}</span>
                          <span className="font-medium text-purple-700 capitalize">{result.predicted_label}</span>
                          <span className="text-gray-500">{(parseFloat(result.confidence) * 100).toFixed(1)}%</span>
                        </div>
                      ))}
                      {analysisResults.results.length > 5 && (
                        <p className="text-xs text-gray-500 text-center">...and {analysisResults.results.length - 5} more</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tweet List */}
            <div className="space-y-4">
              {tweets.map((tweet) => (
                <TweetCard
                  key={tweet.id}
                  tweet={tweet}
                  selected={selectedTweets.has(tweet.id)}
                  onSelect={() => handleTweetSelect(tweet.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {tweets.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="mx-auto w-24 h-24 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mb-4">
              <Brain className="w-12 h-12 text-blue-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to analyze your tweets</h3>
            <p className="text-gray-600 mb-6">
              Click "Fetch My Tweets" above to get started with your emotional pattern analysis.
            </p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-flex items-center space-x-3">
              <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
              <span className="text-lg text-gray-600">Fetching your tweets...</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default DashboardPage; 