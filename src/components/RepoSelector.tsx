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

  const handleFocus = () => {
    // If we have results, show them
    if (searchResults.length > 0) {
      setShowResults(true);
    }
    // If we have a query but no results, trigger a search
    else if (searchQuery.trim()) {
      setShowResults(true);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    // Show results when typing (they will be filtered by the search)
    if (e.target.value.trim()) {
      setShowResults(true);
    } else {
      setShowResults(false);
    }
  };

  return (
    <div className={`relative ${className}`} ref={searchRef}>
      <input
        type="text"
        placeholder={placeholder}
        value={searchQuery}
        onChange={handleInput}
        onKeyDown={handleKeyPress}
        onFocus={handleFocus}
        className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-gray-400 font-mono text-sm tracking-wide transition-all duration-200 shadow-lg"
        disabled={disabled}
      />
      
      {showResults && searchResults.length > 0 && (
        <div className="absolute z-10 w-full mt-2 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl max-h-60 overflow-y-auto backdrop-blur-sm">
          {searchResults.map((repo, index) => (
            <div
              key={repo.id}
              className={`px-4 py-3 cursor-pointer border-b border-gray-800 last:border-b-0 transition-all duration-150 ${
                index === selectedIndex ? 'bg-blue-900 border-blue-600 text-blue-100' : 'hover:bg-gray-800 text-gray-200'
              }`}
              onClick={() => handleRepoClick(repo)}
            >
              <div className="font-mono font-semibold text-sm tracking-wide">{repo.full_name}</div>
              {repo.description && (
                <div className="text-xs text-gray-400 mt-1 font-mono">{repo.description}</div>
              )}
              <div className="text-xs text-gray-500 mt-1 font-mono">
                ⭐ {repo.stargazers_count.toLocaleString()} stars
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}