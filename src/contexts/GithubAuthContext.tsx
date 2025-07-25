// src/contexts/GithubAuthContext.tsx
'use client';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Octokit } from '@octokit/rest';
import { GithubAuthContextType } from '@/types';
import { CLIENT_ID } from '@/lib/constants';

const GithubAuthContext = createContext<GithubAuthContextType | undefined>(undefined);

interface GithubAuthProviderProps {
  children: ReactNode;
}

export function GithubAuthProvider({ children }: GithubAuthProviderProps) {
  const [token, setToken] = useState<string | null>(null);
  const [octokit, setOctokit] = useState<Octokit | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimit, setRateLimit] = useState<{
    limit: number;
    remaining: number;
    reset: number;
    used: number;
  } | null>(null);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    // Check for code in URL (GitHub OAuth callback)
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code && !token) {
      exchangeToken(code);
    }

    // Check for stored token
    const storedToken = localStorage.getItem('github_token');
    if (storedToken) {
      setToken(storedToken);
      setOctokit(new Octokit({ auth: storedToken }));
    }
  }, [token]);

  // Fetch rate limit info when octokit is available
  useEffect(() => {
    if (!octokit) return;

    const fetchRateLimit = async () => {
      try {
        const { data } = await octokit.rateLimit.get();
        setRateLimit({
          limit: data.rate.limit,
          remaining: data.rate.remaining,
          reset: data.rate.reset,
          used: data.rate.used,
        });
      } catch (err) {
        console.error('Failed to fetch rate limit:', err);
      }
    };

    // Fetch immediately
    fetchRateLimit();

    // Update every 30 seconds
    const interval = setInterval(fetchRateLimit, 30000);
    return () => clearInterval(interval);
  }, [octokit]);

  const exchangeToken = async (code: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/github/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Token exchange failed');
      }
      
      if (data.access_token) {
        setToken(data.access_token);
        localStorage.setItem('github_token', data.access_token);
        setOctokit(new Octokit({ auth: data.access_token }));
        
        // Clean URL but preserve the route
        if (typeof window !== 'undefined') {
          const currentPath = window.location.pathname;
          window.history.replaceState({}, document.title, currentPath);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Token exchange failed');
      console.error('Token exchange failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const login = () => {
    if (typeof window === 'undefined') return;
    
    const currentPath = window.location.pathname;
    const redirectUri = `${window.location.origin}${currentPath}`;
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&scope=repo&redirect_uri=${encodeURIComponent(redirectUri)}`;
  };

  const logout = () => {
    setToken(null);
    setOctokit(null);
    setError(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('github_token');
    }
  };

  const value: GithubAuthContextType = {
    token,
    octokit,
    login,
    logout,
    loading,
    error,
    rateLimit,
  };

  return (
    <GithubAuthContext.Provider value={value}>
      {children}
    </GithubAuthContext.Provider>
  );
}

export function useGithubToken(): GithubAuthContextType {
  const context = useContext(GithubAuthContext);
  if (context === undefined) {
    throw new Error('useGithubToken must be used within a GithubAuthProvider');
  }
  return context;
}