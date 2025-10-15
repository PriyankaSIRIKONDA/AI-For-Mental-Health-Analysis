import React, { useState } from 'react';
import { Search, User, Settings } from 'lucide-react';

const TweetSearch = ({ onSearch, loading, searchType }) => {
  const [query, setQuery] = useState('');
  const [maxResults, setMaxResults] = useState(100);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    onSearch(query.trim(), maxResults, searchType, forceRefresh);
  };

  const getPlaceholder = () => {
    if (searchType === 'search') {
      return 'Search tweets... (e.g., "React hooks", "#AI", "@username")';
    } else {
      return 'Enter username... (e.g., "elonmusk", "reactjs")';
    }
  };

  const getExamples = () => {
    if (searchType === 'search') {
      return [
        'React hooks',
        '#MachineLearning',
        'from:reactjs',
        'JavaScript -from:spam',
        '"artificial intelligence"'
      ];
    } else {
      return [
        'elonmusk',
        'reactjs',
        'openai',
        'vercel',
        'netflix'
      ];
    }
  };

  return (
    <div className="space-y-4">
      
      {/* Search Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {searchType === 'search' ? (
              <Search className="h-5 w-5 text-gray-400" />
            ) : (
              <User className="h-5 w-5 text-gray-400" />
            )}
          </div>
          
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={getPlaceholder()}
            className="input-field pl-10 pr-4 text-lg"
            disabled={loading}
          />
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="inline-flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span>Advanced Options</span>
          </button>

          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="btn-primary px-6"
          >
            {loading ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Searching...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                {searchType === 'search' ? (
                  <Search className="w-4 h-4" />
                ) : (
                  <User className="w-4 h-4" />
                )}
                <span>
                  {searchType === 'search' ? 'Search Tweets' : 'Get User Tweets'}
                </span>
              </div>
            )}
          </button>
        </div>
      </form>

      {/* Advanced Options */}
      {showAdvanced && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <h4 className="font-medium text-gray-900">Search Options</h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Results
              </label>
              <select
                value={maxResults}
                onChange={(e) => setMaxResults(parseInt(e.target.value))}
                className="input-field"
              >
                <option value={10}>10 tweets</option>
                <option value={25}>25 tweets</option>
                <option value={50}>50 tweets</option>
                <option value={100}>100 tweets</option>
              </select>
            </div>
            <div>
              <label className="flex items-center space-x-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={forceRefresh}
                  onChange={(e) => setForceRefresh(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span>Force refresh (bypass cache)</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Search Examples */}
      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">
          {searchType === 'search' ? 'Search Examples:' : 'Popular Users:'}
        </h4>
        <div className="flex flex-wrap gap-2">
          {getExamples().map((example, index) => (
            <button
              key={index}
              onClick={() => setQuery(example)}
              className="inline-flex items-center px-3 py-1 text-sm bg-white text-blue-700 rounded-full hover:bg-blue-100 transition-colors"
              disabled={loading}
            >
              {example}
            </button>
          ))}
        </div>
        
        {searchType === 'search' && (
          <div className="mt-3 text-sm text-blue-700">
            <p className="font-medium mb-1">Search operators:</p>
            <ul className="space-y-1 text-blue-600">
              <li><code className="bg-white px-1 rounded">from:username</code> - tweets from specific user</li>
              <li><code className="bg-white px-1 rounded">"exact phrase"</code> - exact phrase match</li>
              <li><code className="bg-white px-1 rounded">#hashtag</code> - tweets with hashtag</li>
              <li><code className="bg-white px-1 rounded">-word</code> - exclude tweets containing word</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default TweetSearch; 