import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Heart, MessageCircle, Repeat, ExternalLink, Check, Zap, Brain, Loader2 } from 'lucide-react';
import apiService from '../services/api';

const TweetCard = ({ tweet, selected, onSelect }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num?.toString() || '0';
  };

  const openTweetInTwitter = () => {
    window.open(`https://twitter.com/${tweet.author.username}/status/${tweet.id}`, '_blank');
  };

  const analyzeTweet = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    
    try {
      const result = await apiService.analyzeTweet(tweet.id, tweet.text);
      setAnalysisResult(result);
    } catch (error) {
      setAnalysisError(error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getConfidenceColor = (confidence) => {
    const conf = parseFloat(confidence);
    if (conf >= 0.8) return 'text-green-600 bg-green-50';
    if (conf >= 0.6) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const formatProbability = (prob) => {
    return (prob * 100).toFixed(1) + '%';
  };

  return (
    <div className={`tweet-card relative ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      
      {/* Selection Checkbox */}
      <div className="absolute top-4 right-4">
        <button
          onClick={onSelect}
          className={`w-6 h-6 rounded border-2 transition-all duration-200 flex items-center justify-center ${
            selected 
              ? 'bg-blue-500 border-blue-500 text-white' 
              : 'border-gray-300 hover:border-blue-400'
          }`}
        >
          {selected && <Check className="w-4 h-4" />}
        </button>
      </div>

      {/* Tweet Header */}
      <div className="flex items-start mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <h4 className="font-medium text-gray-900 truncate">
              {tweet.author.name}
            </h4>
            <span className="text-gray-500 text-sm">
              @{tweet.author.username}
            </span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-500 text-sm">
              {formatDate(tweet.created_at)}
            </span>
            {/* Source indicator */}
            {tweet.source && (
              <>
                <span className="text-gray-400">·</span>
                <div className="flex items-center space-x-1" title="Data source: Masa API (no rate limits)">
                  <Zap className="w-3 h-3 text-purple-500" />
                  <span className="text-xs font-medium text-purple-600">
                    Masa
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <button
          onClick={openTweetInTwitter}
          className="text-gray-400 hover:text-blue-600 transition-colors"
          title="Open in Twitter"
        >
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>

      {/* Tweet Content */}
      <div className="mb-4 pr-8">
        <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
          {tweet.text}
        </p>
      </div>

      {/* Analyze Button */}
      <div className="mb-4">
        <button
          onClick={analyzeTweet}
          disabled={isAnalyzing}
          className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Analyze tweet for mental health indicators"
        >
          {isAnalyzing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Brain className="w-4 h-4" />
          )}
          <span>{isAnalyzing ? 'Analyzing...' : 'Analyze'}</span>
        </button>
      </div>

      {/* Analysis Results */}
      {analysisResult && (
        <div className="mb-4 p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
          <h5 className="font-medium text-gray-900 mb-2 flex items-center">
            <Brain className="w-4 h-4 mr-1 text-purple-600" />
            Mental Health Analysis
          </h5>
          
          {/* Primary Result */}
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-700">Prediction:</span>
              <span className="font-semibold text-purple-700 capitalize">
                {analysisResult.predicted_label}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-700">Confidence:</span>
              <span className={`px-2 py-0.5 rounded text-sm font-medium ${getConfidenceColor(analysisResult.confidence)}`}>
                {formatProbability(parseFloat(analysisResult.confidence))}
              </span>
            </div>
          </div>

          {/* All Probabilities */}
          <div>
            <h6 className="text-sm font-medium text-gray-700 mb-1">All Categories:</h6>
            <div className="grid grid-cols-2 gap-1 text-xs">
              {Object.entries(analysisResult.all_probabilities).map(([category, probability]) => (
                <div key={category} className="flex justify-between">
                  <span className="text-gray-600 capitalize">{category}:</span>
                  <span className="font-medium">{formatProbability(probability)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Analysis Error */}
      {analysisError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">
            <strong>Analysis Error:</strong> {analysisError}
          </p>
        </div>
      )}

      {/* Tweet Metrics */}
      {tweet.public_metrics && (
        <div className="flex items-center space-x-6 text-sm text-gray-600">
          <div className="flex items-center space-x-1">
            <MessageCircle className="w-4 h-4" />
            <span>{formatNumber(tweet.public_metrics.reply_count)}</span>
          </div>
          
          <div className="flex items-center space-x-1">
            <Repeat className="w-4 h-4" />
            <span>{formatNumber(tweet.public_metrics.retweet_count)}</span>
          </div>
          
          <div className="flex items-center space-x-1">
            <Heart className="w-4 h-4" />
            <span>{formatNumber(tweet.public_metrics.like_count)}</span>
          </div>
        </div>
      )}

      {/* Context Annotations */}
      {tweet.context_annotations && tweet.context_annotations.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex flex-wrap gap-2">
            {tweet.context_annotations.slice(0, 3).map((annotation, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-full"
              >
                {annotation.entity?.name || annotation.domain?.name}
              </span>
            ))}
            {tweet.context_annotations.length > 3 && (
              <span className="text-xs text-gray-500">
                +{tweet.context_annotations.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TweetCard; 