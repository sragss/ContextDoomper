// app/page.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import { Octokit } from '@octokit/rest';
import { Copy } from 'lucide-react';

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

interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
  children?: FileTreeNode[];
  isExpanded?: boolean;
  isChecked?: boolean;
}

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  stargazers_count: number;
}

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [octokit, setOctokit] = useState<Octokit | null>(null);
  const [files, setFiles] = useState<GitHubFile[]>([]);
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [selectedBytes, setSelectedBytes] = useState<number>(0);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GitHubRepo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

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

  // Calculate selected bytes whenever fileTree changes
  useEffect(() => {
    const updateSelectedBytes = async () => {
      const bytes = await calculateSelectedBytes(fileTree);
      setSelectedBytes(bytes);
    };
    
    if (fileTree.length > 0) {
      updateSelectedBytes();
    } else {
      setSelectedBytes(0);
    }
  }, [fileTree, searchQuery, octokit]);

  // Update preview content whenever selections change
  useEffect(() => {
    const updatePreview = async () => {
      if (fileTree.length > 0 && selectedBytes > 0) {
        const content = await generateXMLPreview();
        setPreviewContent(content);
      } else {
        setPreviewContent('');
      }
    };
    
    updatePreview();
  }, [selectedBytes, fileTree, searchQuery, octokit]);

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

  const copyToClipboard = async () => {
    if (previewContent) {
      try {
        await navigator.clipboard.writeText(previewContent);
      } catch (err) {
        console.error('Failed to copy to clipboard:', err);
      }
    }
  };

  const logout = () => {
    setToken(null);
    setOctokit(null);
    setFiles([]);
    setFileTree([]);
    setSelectedBytes(0);
    setPreviewContent('');
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
    localStorage.removeItem('github_token');
  };

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
          selectRepo(searchResults[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowResults(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const selectRepo = (repo: GitHubRepo) => {
    fetchFiles(repo.full_name);
    setSearchQuery(repo.full_name);
    setShowResults(false);
    setSelectedIndex(-1);
  };

  const fetchDirectoryContents = async (owner: string, repo: string, path: string = '', inheritCheckedState?: boolean): Promise<FileTreeNode[]> => {
    if (!octokit) return [];
    
    try {
      const { data } = await octokit.repos.getContent({ 
        owner, 
        repo,
        path 
      });
      
      const filesArray = Array.isArray(data) ? data : [data];
      const nodes: FileTreeNode[] = [];
      
      for (const file of filesArray as GitHubFile[]) {
        const node: FileTreeNode = {
          name: file.name,
          path: file.path,
          type: file.type,
          size: file.type === 'file' ? file.size : undefined,
          isExpanded: false,
          isChecked: inheritCheckedState || false
        };
        
        if (file.type === 'dir') {
          // For directories, we'll load children when expanded
          node.children = [];
        }
        
        nodes.push(node);
      }
      
      // Sort directories first, then files
      return nodes.sort((a, b) => {
        if (a.type === 'dir' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'dir') return 1;
        return a.name.localeCompare(b.name);
      });
    } catch (err) {
      console.error(`Failed to fetch directory contents for ${path}:`, err);
      return [];
    }
  };

  const toggleDirectory = async (targetPath: string) => {
    const [owner, name] = searchQuery.split('/');
    if (!owner || !name || !octokit) return;

    const updateTree = async (nodes: FileTreeNode[]): Promise<FileTreeNode[]> => {
      return Promise.all(nodes.map(async (node) => {
        if (node.path === targetPath && node.type === 'dir') {
          if (!node.isExpanded) {
            // Load children if not already loaded
            if (!node.children || node.children.length === 0) {
              const newChildren = await fetchDirectoryContents(owner, name, node.path);
              // Set children's checked state to match parent
              const updateChildrenChecked = (children: FileTreeNode[]): FileTreeNode[] => {
                return children.map(child => ({
                  ...child,
                  isChecked: node.isChecked,
                  children: child.children ? updateChildrenChecked(child.children) : undefined
                }));
              };
              node.children = updateChildrenChecked(newChildren);
            }
            return { ...node, isExpanded: true };
          } else {
            return { ...node, isExpanded: false };
          }
        } else if (node.children) {
          return { ...node, children: await updateTree(node.children) };
        }
        return node;
      }));
    };

    setFileTree(await updateTree(fileTree));
  };

  const toggleCheckbox = (targetPath: string) => {
    const updateNodeChecked = (nodes: FileTreeNode[]): FileTreeNode[] => {
      return nodes.map((node) => {
        if (node.path === targetPath) {
          const newChecked = !node.isChecked;
          // Update all children to match parent state
          const updateChildren = (children: FileTreeNode[]): FileTreeNode[] => {
            return children.map(child => ({
              ...child,
              isChecked: newChecked,
              children: child.children ? updateChildren(child.children) : undefined
            }));
          };

          return {
            ...node,
            isChecked: newChecked,
            children: node.children ? updateChildren(node.children) : undefined
          };
        } else if (node.children) {
          // Recursively update children, but don't change this node's state
          return {
            ...node,
            children: updateNodeChecked(node.children)
          };
        }
        return node;
      });
    };

    setFileTree(updateNodeChecked(fileTree));
  };

  const calculateSelectedBytes = async (nodes: FileTreeNode[]): Promise<number> => {
    const [owner, name] = searchQuery.split('/');
    if (!owner || !name || !octokit) return 0;

    let total = 0;
    
    for (const node of nodes) {
      if (node.isChecked) {
        if (node.type === 'file' && node.size) {
          total += node.size;
        } else if (node.type === 'dir') {
          if (node.children && node.children.length > 0) {
            // If children are already loaded, use them
            total += await calculateSelectedBytes(node.children);
          } else {
            // If children aren't loaded, fetch them to calculate size
            const children = await fetchDirectoryContents(owner, name, node.path, node.isChecked);
            total += await calculateSelectedBytes(children);
          }
        }
      }
    }
    
    return total;
  };

  const collectSelectedFiles = async (nodes: FileTreeNode[]): Promise<FileTreeNode[]> => {
    const [owner, name] = searchQuery.split('/');
    if (!owner || !name || !octokit) return [];

    let selectedFiles: FileTreeNode[] = [];
    
    for (const node of nodes) {
      if (node.isChecked) {
        if (node.type === 'file') {
          selectedFiles.push(node);
        } else if (node.type === 'dir') {
          if (node.children && node.children.length > 0) {
            // If children are already loaded, use them
            selectedFiles = selectedFiles.concat(await collectSelectedFiles(node.children));
          } else {
            // If children aren't loaded, fetch them
            const children = await fetchDirectoryContents(owner, name, node.path, node.isChecked);
            selectedFiles = selectedFiles.concat(await collectSelectedFiles(children));
          }
        }
      }
    }
    
    return selectedFiles;
  };

  const fetchFileContent = async (file: FileTreeNode): Promise<string> => {
    const [owner, name] = searchQuery.split('/');
    if (!owner || !name || !octokit || file.type !== 'file') return '';

    try {
      const { data } = await octokit.repos.getContent({ 
        owner, 
        repo: name,
        path: file.path 
      });
      
      if ('content' in data && data.content) {
        return atob(data.content.replace(/\s/g, ''));
      }
    } catch (err) {
      console.error(`Failed to fetch content for ${file.path}:`, err);
    }
    
    return '';
  };

  const generateXMLPreview = async (): Promise<string> => {
    const selectedFiles = await collectSelectedFiles(fileTree);
    if (selectedFiles.length === 0) return '';

    let xmlContent = '<repository>\n';
    
    // Add file tree section
    xmlContent += '  <file_tree>\n';
    for (const file of selectedFiles) {
      xmlContent += `    ${file.path}\n`;
    }
    xmlContent += '  </file_tree>\n\n';
    
    // Add file contents
    for (const file of selectedFiles) {
      const content = await fetchFileContent(file);
      const escapedContent = content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
      
      xmlContent += `  <file path="${file.path}">\n`;
      xmlContent += `${escapedContent}\n`;
      xmlContent += `  </file>\n`;
    }
    
    xmlContent += '</repository>';
    return xmlContent;
  };

  const fetchFiles = async (repo: string) => {
    if (!octokit) return;
    
    setLoading(true);
    setError(null);
    setFiles([]);
    setFileTree([]);
    
    const [owner, name] = repo.split('/');
    try {
      const tree = await fetchDirectoryContents(owner, name);
      setFileTree(tree);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch files');
      console.error('Failed to fetch files:', err);
    } finally {
      setLoading(false);
    }
  };

  const TreeNode = ({ node, depth = 0 }: { node: FileTreeNode; depth?: number }) => {
    const indentStyle = { paddingLeft: `${depth * 20}px` };
    
    return (
      <div key={node.path}>
        <div 
          className={`flex items-center py-1 px-2 hover:bg-gray-50 select-none ${
            node.type === 'dir' ? 'font-medium' : ''
          }`}
          style={indentStyle}
        >
          <input
            type="checkbox"
            checked={node.isChecked || false}
            onChange={(e) => {
              e.stopPropagation();
              toggleCheckbox(node.path);
            }}
            className="mr-2 w-4 h-4"
          />
          {node.type === 'dir' && (
            <span 
              className="mr-1 text-gray-400 transition-transform duration-200 cursor-pointer" 
              style={{ transform: node.isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
              onClick={() => toggleDirectory(node.path)}
            >
              ▶
            </span>
          )}
          <span className="mr-2">
            {node.type === 'dir' ? '📁' : '📄'}
          </span>
          <span 
            className="flex-1 cursor-pointer"
            onClick={() => node.type === 'dir' && toggleDirectory(node.path)}
          >
            {node.name}
          </span>
          {node.type === 'file' && node.size && (
            <span className="text-gray-500 text-xs ml-2">
              {node.size.toLocaleString()} bytes
            </span>
          )}
        </div>
        {node.type === 'dir' && node.isExpanded && node.children && (
          <div>
            {node.children.map((child) => (
              <TreeNode key={child.path} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  if (!token) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">ContextDoomper</h1>
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
      <h1 className="text-2xl font-bold mb-4">ContextDoomper</h1>
      
      <button 
        onClick={logout} 
        className="bg-red-500 text-white px-4 py-2 rounded mb-4 hover:bg-red-600"
      >
        Logout
      </button>
      
      <div className="mb-4 relative" ref={searchRef}>
        <input
          type="text"
          placeholder="Search GitHub repositories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => searchResults.length > 0 && setShowResults(true)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading}
        />
        
        {showResults && searchResults.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {searchResults.map((repo, index) => (
              <div
                key={repo.id}
                className={`px-4 py-3 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                  index === selectedIndex ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                }`}
                onClick={() => selectRepo(repo)}
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

      {error && (
        <p className="text-red-500 mb-4">{error}</p>
      )}

      {loading && (
        <p className="text-gray-600">Loading...</p>
      )}

      {fileTree.length > 0 && (
        <div className="border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">File Tree:</h2>
          <div className="font-mono text-sm bg-gray-50 rounded border p-2 max-h-96 overflow-y-auto">
            {fileTree.map((node) => (
              <TreeNode key={node.path} node={node} />
            ))}
          </div>
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <div className="text-sm font-medium text-blue-800">
              Bytes Selected: {selectedBytes.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {previewContent && (
        <div className="mt-6 border rounded-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Preview</h2>
            <button
              onClick={copyToClipboard}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
              title="Copy to clipboard"
            >
              <Copy size={16} />
            </button>
          </div>
          <div className="bg-gray-50 rounded border p-4 max-h-96 overflow-y-auto">
            <pre className="font-mono text-xs whitespace-pre-wrap break-all">
              {previewContent}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}