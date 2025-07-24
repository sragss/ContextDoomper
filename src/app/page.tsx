// app/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { Octokit } from '@octokit/rest';

const CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID!;

interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  type: 'file' | 'dir';
  download_url?: string | null;
}

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [octokit, setOctokit] = useState<Octokit | null>(null);
  const [files, setFiles] = useState<GitHubFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for code in URL
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
        
        // Clean URL
        window.history.replaceState({}, document.title, '/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Token exchange failed');
      console.error('Token exchange failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const login = () => {
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&scope=repo`;
  };

  const logout = () => {
    setToken(null);
    setOctokit(null);
    setFiles([]);
    localStorage.removeItem('github_token');
  };

  const fetchFiles = async (repo: string) => {
    if (!octokit) return;
    
    setLoading(true);
    setError(null);
    
    const [owner, name] = repo.split('/');
    try {
      const { data } = await octokit.repos.getContent({ 
        owner, 
        repo: name,
        path: '' 
      });
      
      // getContent returns a single file or an array of files
      const filesArray = Array.isArray(data) ? data : [data];
      setFiles(filesArray as GitHubFile[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch files');
      console.error('Failed to fetch files:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">GitHub File Browser</h1>
        <button 
          onClick={login}
          className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800"
          disabled={loading}
        >
          {loading ? 'Processing...' : 'Login with GitHub'}
        </button>
        {error && (
          <p className="text-red-500 mt-2">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">GitHub File Browser</h1>
      
      <button 
        onClick={logout} 
        className="bg-red-500 text-white px-4 py-2 rounded mb-4 hover:bg-red-600"
      >
        Logout
      </button>
      
      <div className="mb-4 space-x-2">
        <button 
          onClick={() => fetchFiles('facebook/react')}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
          disabled={loading}
        >
          Fetch React Repo
        </button>
        <button 
          onClick={() => fetchFiles('vercel/next.js')}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
          disabled={loading}
        >
          Fetch Next.js Repo
        </button>
      </div>

      {error && (
        <p className="text-red-500 mb-4">{error}</p>
      )}

      {loading && (
        <p className="text-gray-600">Loading...</p>
      )}

      {files.length > 0 && (
        <div className="border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-2">Files:</h2>
          <ul className="space-y-1">
            {files.map((file) => (
              <li key={file.sha} className="flex items-center space-x-2">
                <span>{file.type === 'dir' ? '📁' : '📄'}</span>
                <span>{file.name}</span>
                <span className="text-gray-500 text-sm">
                  {file.type === 'file' && `(${file.size} bytes)`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}