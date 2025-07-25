// app/[owner]/[repo]/page.tsx
'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { EchoProvider } from '@zdql/echo-react-sdk';
import { useGithubToken } from '@/contexts/GithubAuthContext';
import { useFileTree } from '@/hooks/useFileTree';
import { RepoSelector } from '@/components/RepoSelector';
import { FileTree } from '@/components/FileTree/FileTree';
import { Preview } from '@/components/Preview';
import { QueryComponent } from '@/components/QueryComponent';
import { RateLimit } from '@/components/RateLimit';
import { GitHubRepo } from '@/types';
import { ECHO_CONFIG } from '@/lib/constants';




function RepoContent() {
  const params = useParams();
  const router = useRouter();
  const owner = params.owner as string;
  const repo = params.repo as string;
  const fullRepoName = `${owner}/${repo}`;
  
  const { token, logout } = useGithubToken();
  // Call useFileTree ONCE here
  const fileTreeState = useFileTree(owner, repo);

  // Redirect to home if not logged in
  useEffect(() => {
    if (!token) {
      router.push('/');
    }
  }, [token, router]);

  const handleRepoSelect = (selectedRepo: GitHubRepo) => {
    router.push(`/${selectedRepo.full_name}`);
  };

  if (!token) {
    return (
      <div className="p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-500 bg-clip-text text-transparent tracking-wider font-mono mb-4">
            CONTEXT_DOOMPER
          </h1>
          <p className="text-gray-600 mb-4">Redirecting to home page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-500 bg-clip-text text-transparent tracking-wider font-mono">
            CONTEXT_DOOMPER
          </h1>
          <p className="text-gray-600">Repository: <span className="font-mono text-blue-600">{fullRepoName}</span></p>
        </div>
        <div className="flex items-center space-x-4">
          <RateLimit />
          <button 
            onClick={logout} 
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </div>
      
      <RepoSelector 
        onRepoSelect={handleRepoSelect}
        initialQuery={fullRepoName}
        className="mb-4"
      />

      {/* Pass all fileTreeState props to FileTree */}
      <FileTree {...fileTreeState} owner={owner} repo={repo} />

      <Preview content={fileTreeState.previewContent} />

      <QueryComponent searchQuery={fullRepoName} previewContent={fileTreeState.previewContent} />
    </div>
  );
}

export default function RepoPage() {
  return (
    <EchoProvider config={ECHO_CONFIG}>
      <RepoContent />
    </EchoProvider>
  );
}