import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, TrendingUp, Brain, BarChart3, Calendar, ArrowLeft, RefreshCw, MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const ReportPage = () => {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    fetchReport();
  }, [reportId]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const response = reportId ? 
        await api.getReportById(reportId) : 
        await api.getLatestReport();
      setReport(response);
    } catch (error) {
      console.error('Error fetching report:', error);
      if (error.message.includes('No reports found')) {
        toast.error('No reports found. Please analyze tweets first.');
      } else {
        toast.error('Failed to load report');
      }
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateReport = async () => {
    try {
      setRegenerating(true);
      const response = await api.generateReport();
      setReport(response);
      toast.success('Report regenerated successfully!');
    } catch (error) {
      console.error('Error regenerating report:', error);
      if (error.message.includes('No analyzed tweets found')) {
        toast.error('No analyzed tweets found. Please analyze tweets first.');
      } else {
        toast.error('Failed to regenerate report');
      }
    } finally {
      setRegenerating(false);
    }
  };



  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getClassificationColor = (label) => {
    // Use consistent gray coloring for all classification categories
    return 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading report...</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">No Report Found</h2>
          <p className="text-gray-600 mb-4">Generate your first analysis report by analyzing tweets.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-primary"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Dashboard</span>
            </button>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(`/counselor/${report.id}`)}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Talk with AI Counselor</span>
            </button>
            <button
              onClick={handleRegenerateReport}
              disabled={regenerating}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
              <span>{regenerating ? 'Regenerating...' : 'Regenerate Report'}</span>
            </button>
          </div>
        </div>

        {/* Report Header */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <div className="flex items-center space-x-4 mb-6">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Brain className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Mental Health Analysis Report</h1>
              <div className="flex items-center space-x-4 text-gray-600 mt-2">
                <div className="flex items-center space-x-1">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(report.generated_at)}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <BarChart3 className="w-4 h-4" />
                  <span>{report.total_analyzed_tweets} tweets analyzed</span>
                </div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-blue-50 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-blue-900 mb-3">Executive Summary</h2>
            <p className="text-blue-800 leading-relaxed">{report.summary}</p>
          </div>
        </div>

        {/* Classification Breakdown */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center space-x-2">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            <span>Classification Breakdown</span>
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {Object.entries(report.classification_breakdown).map(([label, count]) => {
              const percentage = ((count / report.total_analyzed_tweets) * 100).toFixed(1);
              return (
                <div key={label} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getClassificationColor(label)}`}>
                      {label}
                    </span>
                    <span className="text-2xl font-bold text-gray-900">{count}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{percentage}% of tweets</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Full Report */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center space-x-2">
            <FileText className="w-6 h-6 text-blue-600" />
            <span>Detailed Analysis</span>
          </h2>
          
          <div className="prose prose-lg max-w-none prose-headings:text-gray-900 prose-headings:font-semibold prose-p:text-gray-700 prose-p:leading-relaxed prose-strong:text-gray-900 prose-ul:text-gray-700 prose-ol:text-gray-700 prose-li:text-gray-700 prose-blockquote:text-gray-600 prose-blockquote:border-l-blue-500 prose-table:table-auto prose-th:border prose-th:border-gray-300 prose-th:px-4 prose-th:py-2 prose-th:bg-gray-50 prose-th:font-semibold prose-th:text-gray-900 prose-td:border prose-td:border-gray-300 prose-td:px-4 prose-td:py-2 prose-td:text-gray-700">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                table: ({node, ...props}) => (
                  <div className="overflow-x-auto my-6">
                    <table className="min-w-full border-collapse border border-gray-300 rounded-lg shadow-sm" {...props} />
                  </div>
                ),
                thead: ({node, ...props}) => (
                  <thead className="bg-gray-50" {...props} />
                ),
                tbody: ({node, ...props}) => (
                  <tbody className="bg-white" {...props} />
                ),
                th: ({node, ...props}) => (
                  <th className="border border-gray-300 px-4 py-2 text-left font-semibold text-gray-900 bg-gray-50" {...props} />
                ),
                td: ({node, ...props}) => (
                  <td className="border border-gray-300 px-4 py-2 text-gray-700" {...props} />
                ),
                tr: ({node, ...props}) => (
                  <tr className="hover:bg-gray-50 transition-colors" {...props} />
                )
              }}
            >
              {report.report_content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportPage; 