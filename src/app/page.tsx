// app/page.tsx
'use client';
import { useRouter } from 'next/navigation';
import { EchoProvider } from '@zdql/echo-react-sdk';
import { useGithubToken } from '@/contexts/GithubAuthContext';
import { RepoSelector } from '@/components/RepoSelector';
import { RateLimit } from '@/components/RateLimit';
import { GitHubRepo } from '@/types';
import { ECHO_CONFIG } from '@/lib/constants';


function HomeContent() {
  const router = useRouter();
  const { token, logout, login } = useGithubToken();

  const handleRepoSelect = (repo: GitHubRepo) => {
    router.push(`/${repo.full_name}`);
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-500 bg-clip-text text-transparent tracking-wider font-mono mb-2">
              CONTEXT_DOOMPER
            </h1>
            <p className="text-gray-600 mb-8">GitHub repository browser and context extractor</p>
            <p className="text-gray-500 text-sm mb-6">Please sign in with GitHub to get started</p>
            <button
              onClick={login}
              className="inline-flex items-center px-4 py-2 bg-black text-white rounded hover:bg-gray-900 transition-colors font-semibold text-base"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
              </svg>
              Sign in with GitHub
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto pt-12 px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-500 bg-clip-text text-transparent tracking-wider font-mono mb-4">
            CONTEXT_DOOMPER
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Browse GitHub repositories and extract context for AI analysis
          </p>
          
          <div className="flex justify-center items-center space-x-4 mb-8">
            <RateLimit />
            <button 
              onClick={logout} 
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
        
        <div className="max-w-2xl mx-auto">
          <RepoSelector 
            onRepoSelect={handleRepoSelect}
            placeholder="Search GitHub repositories..."
            className="w-full"
          />
        </div>
        
        <div className="text-center mt-16 text-gray-500 text-sm">
          <p>Search for a GitHub repository to get started</p>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <EchoProvider config={ECHO_CONFIG}>
      <HomeContent />
    </EchoProvider>
  );
}