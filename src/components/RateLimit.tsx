// src/components/RateLimit.tsx
'use client';
import { useGithubToken } from '@/contexts/GithubAuthContext';
import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

export function RateLimit() {
  const { rateLimit, refreshRateLimit } = useGithubToken();
  const [hovered, setHovered] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  if (!rateLimit) {
    return null;
  }

  const resetTime = new Date(rateLimit.reset * 1000);
  const now = new Date();
  const minutesUntilReset = Math.ceil((resetTime.getTime() - now.getTime()) / (1000 * 60));
  
  const getRateLimitColor = () => {
    const percentage = rateLimit.remaining / rateLimit.limit;
    if (percentage > 0.5) return 'text-green-600';
    if (percentage > 0.2) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRateLimitBgColor = () => {
    const percentage = rateLimit.remaining / rateLimit.limit;
    if (percentage > 0.5) return 'bg-green-50 border-green-200';
    if (percentage > 0.2) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!refreshRateLimit) return;
    setRefreshing(true);
    await refreshRateLimit();
    setRefreshing(false);
  };

  return (
    <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg border ${getRateLimitBgColor()}`}>
      {/* GitHub Logo or Refresh Icon */}
      <button
        type="button"
        aria-label="Refresh rate limit"
        onClick={handleRefresh}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="focus:outline-none"
        tabIndex={0}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', padding: 0 }}
      >
        <span
          className={`transition-transform duration-200 ease-in-out ${hovered || refreshing ? 'scale-110' : 'scale-100'}`}
        >
          {hovered || refreshing ? (
            <RefreshCw className={`w-4 h-4 text-gray-700 ${refreshing ? 'animate-spin' : ''}`} />
          ) : (
            <svg 
              className="w-4 h-4 text-gray-700" 
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path 
                fillRule="evenodd" 
                d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" 
                clipRule="evenodd" 
              />
            </svg>
          )}
        </span>
      </button>
      
      {/* Rate Limit Info */}
      <div className="text-sm">
        <span className={`font-medium ${getRateLimitColor()}`}>
          {rateLimit.remaining}
        </span>
        <span className="text-gray-600">
          /{rateLimit.limit}
        </span>
      </div>
      
      {/* Reset Time */}
      <div className="text-xs text-gray-500">
        {minutesUntilReset > 0 ? `${minutesUntilReset}m` : 'soon'}
      </div>
    </div>
  );
}