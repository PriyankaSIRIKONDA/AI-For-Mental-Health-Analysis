import React from 'react';

const UserProfile = ({ user }) => {
  if (!user) {
    return (
      <div className="flex items-center">
        <span className="text-sm text-gray-500">Loading...</span>
      </div>
    );
  }

  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  return (
    <div className="flex items-center">
      <div className="hidden sm:block">
        <div className="text-sm font-medium text-gray-900">
          {user.name}
        </div>
        <div className="text-xs text-gray-500">
          @{user.username}
          {user.public_metrics?.followers_count && (
            <span className="ml-2">
              {formatNumber(user.public_metrics.followers_count)} followers
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile; 