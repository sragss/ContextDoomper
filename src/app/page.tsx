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
  const { token, logout } = useGithubToken();

  const handleRepoSelect = (repo: GitHubRepo) => {
    router.push(`/${repo.full_name}`);
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">ContextDoomper</h1>
            <p className="text-gray-600 mb-8">GitHub repository browser and context extractor</p>
            <p className="text-gray-500 text-sm">Please sign in with GitHub to get started</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto pt-12 px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">ContextDoomper</h1>
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