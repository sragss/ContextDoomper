// src/components/RepoSelector.tsx
'use client';
import { GitHubRepo } from '@/types';
import { useRepoSearch } from '@/hooks/useRepoSearch';

interface RepoSelectorProps {
  onRepoSelect: (repo: GitHubRepo) => void;
  initialQuery?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function RepoSelector({ 
  onRepoSelect, 
  initialQuery = '', 
  placeholder = 'Search GitHub repositories...',
  className = '',
  disabled = false 
}: RepoSelectorProps) {
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    selectedIndex,
    showResults,
    setShowResults,
    searchRef,
    handleKeyDown,
    selectRepo,
  } = useRepoSearch(initialQuery);

  const handleRepoClick = (repo: GitHubRepo) => {
    selectRepo(repo);
    onRepoSelect(repo);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    const selectedRepo = handleKeyDown(e);
    if (selectedRepo) {
      onRepoSelect(selectedRepo);
    }
  };

  return (
    <div className={`relative ${className}`} ref={searchRef}>
      <input
        type="text"
        placeholder={placeholder}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={handleKeyPress}
        onFocus={() => searchResults.length > 0 && setShowResults(true)}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        disabled={disabled}
      />
      
      {showResults && searchResults.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {searchResults.map((repo, index) => (
            <div
              key={repo.id}
              className={`px-4 py-3 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors ${
                index === selectedIndex ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
              }`}
              onClick={() => handleRepoClick(repo)}
            >
              <div className="font-semibold text-gray-900">{repo.full_name}</div>
              {repo.description && (
                <div className="text-sm text-gray-600 mt-1">{repo.description}</div>
              )}
              <div className="text-xs text-gray-500 mt-1">
                ⭐ {repo.stargazers_count.toLocaleString()} stars
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}