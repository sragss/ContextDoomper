// src/hooks/useRepoSearch.ts
import { useState, useEffect, useRef } from 'react';
import { GitHubRepo } from '@/types';
import { useGithubToken } from '@/contexts/GithubAuthContext';

export function useRepoSearch(initialQuery: string = '') {
  const { octokit } = useGithubToken();
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [searchResults, setSearchResults] = useState<GitHubRepo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Debounced search effect
  useEffect(() => {
    if (!searchQuery.trim() || !octokit) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        const { data } = await octokit.search.repos({
          q: searchQuery,
          sort: 'stars',
          order: 'desc',
          per_page: 10
        });
        setSearchResults(data.items);
        setShowResults(true);
        setSelectedIndex(-1);
      } catch (err) {
        console.error('Search failed:', err);
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, octokit]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults || searchResults.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < searchResults.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          return searchResults[selectedIndex];
        }
        break;
      case 'Escape':
        setShowResults(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const selectRepo = (repo: GitHubRepo) => {
    setShowResults(false);
    setSelectedIndex(-1);
    return repo;
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
    setSelectedIndex(-1);
  };

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    selectedIndex,
    showResults,
    setShowResults,
    searchRef,
    handleKeyDown,
    selectRepo,
    clearSearch,
  };
}