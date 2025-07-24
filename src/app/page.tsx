// app/page.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import { Octokit } from '@octokit/rest';
import { Copy } from 'lucide-react';
import { EchoProvider, useEcho, useEchoOpenAI } from '@zdql/echo-react-sdk';

const CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID!;

const echoConfig = {
  appId: '3474f80b-4caa-4aab-867b-793f3abeef29',
  apiUrl: 'https://echo.merit.systems',
  redirectUri: process.env.NEXT_PUBLIC_ECHO_REDIRECT_URI || 'http://localhost:3000',
};

// Files larger than ~2500 LOC (150KB) are unchecked by default
const MAX_AUTO_SELECT_SIZE = 150000;

// Prevent infinite recursion and API overload
const DIRECTORY_DEPTH_CAP = 5;

// Files/directories to ignore for LLM context (binary, generated, etc.)
const IGNORE_REGEX = new RegExp([
  // Binary/Media files
  '\\.(png|jpe?g|gif|webp|svg|ico|bmp|tiff|pdf)$',
  '\\.(mp4|mov|avi|mkv|webm|flv|wmv)$', 
  '\\.(mp3|wav|flac|aac|ogg|m4a)$',
  '\\.(zip|tar|gz|rar|7z|bz2|xz)$',
  '\\.(exe|dll|so|dylib|app|dmg|msi)$',
  '\\.(doc|docx|xls|xlsx|ppt|pptx)$',
  
  // Lock files and generated content
  '(package-lock\\.json|yarn\\.lock|pnpm-lock\\.yaml|bun\\.lockb?|Cargo\\.lock|Pipfile\\.lock|poetry\\.lock|composer\\.lock)$',
  '\\.(log|tmp|temp|pid|cache|swp|swo|orig|rej)$',
  '~$',
  
  // Build/dist/cache directories  
  '(^|/)(\\.next|\\.nuxt|dist|build|out|target|coverage|\\.coverage)(/|$)',
  '(^|/)(node_modules|vendor|venv|\\.venv|__pycache__|\\.pytest_cache)(/|$)',
  
  // IDE/Editor/OS files
  '(^|/)(\\.vscode|\\.idea|\\.git|\\.svn|\\.hg)(/|$)',
  '\\.(DS_Store|Thumbs\\.db)$',
  
  // Additional generated/config files that are usually not useful
  '\\.(min\\.js|min\\.css)$',
  '\\.map$', // source maps
  '(^|/)(\\.env\\.local|\\.env\\.*.local)$' // local env files (keep .env.example)
].join('|'), 'i');

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
  aggregateSize?: number;
  children?: FileTreeNode[];
  isExpanded?: boolean;
  isChecked?: boolean | 'partial'; // boolean for files, boolean|'partial' for dirs
  isIgnored?: boolean;
  depth?: number;
}

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  stargazers_count: number;
}

// Selection states for three-state toggles
type SelectionState = 'none' | 'partial' | 'full';

interface ExtensionStats {
  extension: string;     // ".js" or "no extension" or ".gitignore"
  totalBytes: number;    // sum of all files with this extension
  fileCount: number;     // count of files with this extension
  selectionState: SelectionState; // none/partial/full selection state
}

function QueryComponent({ searchQuery, previewContent }: { searchQuery: string; previewContent: string }) {
  const { signIn, isAuthenticated } = useEcho();
  const { openai } = useEchoOpenAI();
  const [userQuestion, setUserQuestion] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const constructPrompt = (question: string, repoName: string, context: string) => {
    return `You're a coding assistant, I'm going to give you a user question about <repo>${repoName}</repo>, and you are to answer it as clearly as possible, do not be excessively verbose and get directly to the heart of the question and the answer.

<user_question>
${question}
</user_question>

<repo_context>
${context}
</repo_context>`;
  };

  const handleQuery = async () => {
    if (!userQuestion.trim() || !isAuthenticated || !openai) return;
    
    setLoading(true);
    try {
      const repoName = searchQuery || 'repository';
      const prompt = constructPrompt(userQuestion, repoName, previewContent);
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
      });
      
      setResponse(completion.choices[0].message.content || '');
    } catch (err) {
      console.error('Query failed:', err);
      setResponse('Error: Failed to get response from LLM');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 border rounded-lg p-4">
      <h2 className="text-lg font-semibold mb-4">Query Repository</h2>
      
      {!isAuthenticated ? (
        <div className="text-center py-8">
          <p className="text-gray-600 mb-4">Sign in to query the repository with AI</p>
          <button
            onClick={signIn}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Sign In to Echo
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="Ask a question about the repository..."
              value={userQuestion}
              onChange={(e) => setUserQuestion(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
              onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
            />
          </div>
          
          <button
            onClick={handleQuery}
            disabled={loading || !userQuestion.trim()}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-400"
          >
            {loading ? 'Querying...' : 'Ask AI'}
          </button>
          
          {response && (
            <div className="mt-4 p-4 bg-gray-50 rounded border">
              <h3 className="font-semibold mb-2">AI Response:</h3>
              <div className="whitespace-pre-wrap text-sm">
                {response}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HomeContent() {
  const [token, setToken] = useState<string | null>(null);
  const [octokit, setOctokit] = useState<Octokit | null>(null);
  const [files, setFiles] = useState<GitHubFile[]>([]);
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [selectedBytes, setSelectedBytes] = useState<number>(0);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [extensionStats, setExtensionStats] = useState<ExtensionStats[]>([]);
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

  // Update extension stats whenever file tree or selections change
  useEffect(() => {
    if (fileTree.length > 0) {
      const stats = analyzeFileExtensions(fileTree);
      setExtensionStats(stats);
    } else {
      setExtensionStats([]);
    }
  }, [fileTree, selectedBytes]); // Also trigger on selectedBytes change to catch individual toggles

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
    setExtensionStats([]);
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

  const fetchAllDirectories = async (owner: string, repo: string, path: string = '', depth: number = 0, inheritCheckedState?: boolean): Promise<FileTreeNode[]> => {
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
        const isIgnored = IGNORE_REGEX.test(file.path) || IGNORE_REGEX.test(file.name);
        
        const node: FileTreeNode = {
          name: file.name,
          path: file.path,
          type: file.type,
          size: file.type === 'file' ? file.size : undefined,
          depth: depth,
          isExpanded: file.type === 'dir' && depth < DIRECTORY_DEPTH_CAP,
          isIgnored: isIgnored,
          isChecked: isIgnored 
            ? false  // Ignored files are never checked
            : inheritCheckedState !== undefined 
              ? inheritCheckedState 
              : file.type === 'dir' 
                ? true 
                : (file.size || 0) <= MAX_AUTO_SELECT_SIZE
        };
        
        if (file.type === 'dir') {
          if (depth < DIRECTORY_DEPTH_CAP) {
            // Recursively load children for directories within depth limit
            node.children = await fetchAllDirectories(owner, repo, file.path, depth + 1, node.isChecked === true);
          } else {
            // Initialize empty children array for manual expansion later
            node.children = [];
          }
        }
        
        nodes.push(node);
      }
      
      // Sort directories first, then files
      const sortedNodes = nodes.sort((a, b) => {
        if (a.type === 'dir' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'dir') return 1;
        return a.name.localeCompare(b.name);
      });

      // Calculate aggregate sizes for directories
      return calculateDirectorySizes(sortedNodes);
    } catch (err) {
      console.error(`Failed to fetch directory contents for ${path}:`, err);
      return [];
    }
  };

  const calculateDirectorySizes = (nodes: FileTreeNode[]): FileTreeNode[] => {
    return nodes.map(node => {
      if (node.type === 'dir' && node.children) {
        // Recursively calculate sizes for child directories first
        node.children = calculateDirectorySizes(node.children);
        
        // Sum up all file sizes and child directory aggregate sizes
        let totalSize = 0;
        for (const child of node.children) {
          if (child.type === 'file' && child.size) {
            totalSize += child.size;
          } else if (child.type === 'dir' && child.aggregateSize) {
            totalSize += child.aggregateSize;
          }
        }
        node.aggregateSize = totalSize;
      }
      return node;
    });
  };

  const toggleDirectory = async (targetPath: string) => {
    const [owner, name] = searchQuery.split('/');
    if (!owner || !name || !octokit) return;

    const updateTree = async (nodes: FileTreeNode[]): Promise<FileTreeNode[]> => {
      return Promise.all(nodes.map(async (node) => {
        if (node.path === targetPath && node.type === 'dir') {
          if (!node.isExpanded) {
            // Load children if not already loaded (for directories beyond depth cap)
            if (!node.children || node.children.length === 0) {
              const currentDepth = node.depth || 0;
              const newChildren = await fetchAllDirectories(owner, name, node.path, currentDepth + 1);
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

  // Three-state selection logic functions
  const getDirectorySelectionState = (node: FileTreeNode): SelectionState => {
    if (node.type === 'file') {
      return node.isChecked ? 'full' : 'none';
    }
    
    if (!node.children || node.children.length === 0) {
      return node.isChecked ? 'full' : 'none';
    }
    
    const checkedCount = node.children.filter(child => {
      const childState = getDirectorySelectionState(child);
      return childState === 'full' || childState === 'partial';
    }).length;
    
    const fullyCheckedCount = node.children.filter(child => {
      const childState = getDirectorySelectionState(child);
      return childState === 'full';
    }).length;
    
    if (fullyCheckedCount === node.children.length) {
      return 'full';
    } else if (checkedCount > 0) {
      return 'partial';
    } else {
      return 'none';
    }
  };
  
  const updateDirectoryStates = (nodes: FileTreeNode[]): FileTreeNode[] => {
    return nodes.map(node => {
      if (node.type === 'dir' && node.children) {
        // First update children recursively
        const updatedChildren = updateDirectoryStates(node.children);
        
        // Then calculate this directory's state based on children
        const state = getDirectorySelectionState({ ...node, children: updatedChildren });
        let isChecked: boolean | 'partial';
        
        switch (state) {
          case 'none': isChecked = false; break;
          case 'partial': isChecked = 'partial'; break;
          case 'full': isChecked = true; break;
        }
        
        return {
          ...node,
          children: updatedChildren,
          isChecked
        };
      }
      return node;
    });
  };
  
  const toggleExtensionSelection = (targetExtension: string) => {
    const updateNodesForExtension = (nodes: FileTreeNode[], newState: boolean): FileTreeNode[] => {
      return nodes.map(node => {
        if (node.type === 'file' && !node.isIgnored) {
          const ext = getFileExtension(node.name);
          if (ext === targetExtension) {
            return { ...node, isChecked: newState };
          }
        }
        
        if (node.children) {
          return { ...node, children: updateNodesForExtension(node.children, newState) };
        }
        
        return node;
      });
    };
    
    // Find current state of this extension
    const currentStats = extensionStats.find(stat => stat.extension === targetExtension);
    const currentState = currentStats?.selectionState || 'none';
    
    // Cycle through states: none -> full -> none (skip partial for user clicks)
    // When user clicks partial, they want it to go to full
    let newState: boolean;
    if (currentState === 'none' || currentState === 'partial') {
      newState = true; // Select all files with this extension
    } else {
      newState = false; // Deselect all files with this extension
    }
    
    // Update file tree with new extension selection
    const updatedTree = updateNodesForExtension(fileTree, newState);
    
    // Update directory states based on the new file selections
    setFileTree(updateDirectoryStates(updatedTree));
  };

  const toggleCheckbox = (targetPath: string) => {
    const updateNodeChecked = (nodes: FileTreeNode[]): FileTreeNode[] => {
      return nodes.map((node) => {
        if (node.path === targetPath) {
          // For user clicks, cycle: false -> true -> false (skip partial)
          const newChecked = !node.isChecked;
          
          // Update all children to match parent state (recursive propagation down)
          const updateChildren = (children: FileTreeNode[]): FileTreeNode[] => {
            return children.map(child => ({
              ...child,
              isChecked: child.isIgnored ? false : newChecked,
              children: child.children ? updateChildren(child.children) : undefined
            }));
          };

          return {
            ...node,
            isChecked: newChecked,
            children: node.children ? updateChildren(node.children) : undefined
          };
        } else if (node.children) {
          // Recursively update children
          return {
            ...node,
            children: updateNodeChecked(node.children)
          };
        }
        return node;
      });
    };

    // Update tree with new selections
    const updatedTree = updateNodeChecked(fileTree);
    
    // Propagate states up to parents
    setFileTree(updateDirectoryStates(updatedTree));
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
            const children = await fetchAllDirectories(owner, name, node.path, 0, node.isChecked === true);
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
            const children = await fetchAllDirectories(owner, name, node.path, 0, node.isChecked === true);
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
      const tree = await fetchAllDirectories(owner, name);
      setFileTree(tree);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch files');
      console.error('Failed to fetch files:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getFileExtension = (filename: string): string => {
    if (!filename.includes('.')) return 'no extension';
    if (filename.startsWith('.') && filename.indexOf('.', 1) === -1) {
      return filename; // .gitignore, .env, etc.
    }
    const parts = filename.split('.');
    return '.' + parts[parts.length - 1].toLowerCase();
  };

  const analyzeFileExtensions = (nodes: FileTreeNode[]): ExtensionStats[] => {
    const extensionMap = new Map<string, { totalBytes: number; fileCount: number; selectedCount: number }>();
    
    const traverseNodes = (nodeList: FileTreeNode[]) => {
      for (const node of nodeList) {
        if (node.type === 'file' && !node.isIgnored && node.size) {
          const ext = getFileExtension(node.name);
          const existing = extensionMap.get(ext) || { totalBytes: 0, fileCount: 0, selectedCount: 0 };
          
          extensionMap.set(ext, {
            totalBytes: existing.totalBytes + node.size,
            fileCount: existing.fileCount + 1,
            selectedCount: existing.selectedCount + (node.isChecked ? 1 : 0)
          });
        }
        
        if (node.children && node.isExpanded) {
          traverseNodes(node.children);
        }
      }
    };
    
    traverseNodes(nodes);
    
    return Array.from(extensionMap.entries())
      .map(([extension, stats]) => {
        let selectionState: SelectionState;
        if (stats.selectedCount === 0) {
          selectionState = 'none';
        } else if (stats.selectedCount === stats.fileCount) {
          selectionState = 'full';
        } else {
          selectionState = 'partial';
        }
        
        return {
          extension,
          totalBytes: stats.totalBytes,
          fileCount: stats.fileCount,
          selectionState
        };
      })
      .sort((a, b) => b.totalBytes - a.totalBytes)
      .slice(0, 5);
  };

  const selectAll = () => {
    const updateAllNodes = (nodes: FileTreeNode[]): FileTreeNode[] => {
      return nodes.map(node => ({
        ...node,
        isChecked: node.isIgnored ? false : true, // Respect ignore list
        children: node.children ? updateAllNodes(node.children) : undefined
      }));
    };
    
    // Update all nodes to selected, then update directory states
    const updatedTree = updateAllNodes(fileTree);
    setFileTree(updateDirectoryStates(updatedTree));
  };

  const deselectAll = () => {
    const updateAllNodes = (nodes: FileTreeNode[]): FileTreeNode[] => {
      return nodes.map(node => ({
        ...node,
        isChecked: false,
        children: node.children ? updateAllNodes(node.children) : undefined
      }));
    };
    
    // Update all nodes to deselected, then update directory states
    const updatedTree = updateAllNodes(fileTree);
    setFileTree(updateDirectoryStates(updatedTree));
  };

  const ExtensionToggles = () => {
    if (extensionStats.length === 0) return null;
    
    return (
      <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-sm font-medium text-gray-700">Top File Types:</h3>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
            >
              Select All
            </button>
            <button
              onClick={deselectAll}
              className="inline-flex items-center px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors"
            >
              Deselect All
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {extensionStats.map((stat) => {
            const getStateIcon = (state: SelectionState) => {
              switch (state) {
                case 'none': return '✗';
                case 'partial': return '◐';
                case 'full': return '✓';
              }
            };
            
            const getStateClass = (state: SelectionState) => {
              switch (state) {
                case 'none': return 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200';
                case 'partial': return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
                case 'full': return 'bg-green-100 text-green-800 border border-green-200';
              }
            };
            
            return (
              <button
                key={stat.extension}
                onClick={() => toggleExtensionSelection(stat.extension)}
                className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-medium transition-colors ${getStateClass(stat.selectionState)}`}
              >
                <span className="font-mono">
                  {stat.extension === 'no extension' ? 'no ext' : stat.extension}
                </span>
                <span className="ml-1">
                  ({formatBytes(stat.totalBytes)}, {stat.fileCount} files)
                </span>
                <span className="ml-1">
                  {getStateIcon(stat.selectionState)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const TreeNode = ({ node, depth = 0 }: { node: FileTreeNode; depth?: number }) => {
    const indentStyle = { paddingLeft: `${depth * 20}px` };
    
    return (
      <div key={node.path}>
        <div 
          className={`flex items-center py-1 px-2 select-none ${
            node.isIgnored 
              ? 'text-gray-400 bg-gray-50' 
              : 'hover:bg-gray-50'
          } ${node.type === 'dir' ? 'font-medium' : ''}`}
          style={indentStyle}
          title={node.isIgnored ? 'File ignored (binary/generated/cache)' : undefined}
        >
          <input
            type="checkbox"
            checked={node.isChecked === true}
            ref={(input) => {
              if (input) input.indeterminate = node.isChecked === 'partial';
            }}
            disabled={node.isIgnored}
            onChange={(e) => {
              e.stopPropagation();
              toggleCheckbox(node.path);
            }}
            className={`mr-2 w-4 h-4 ${node.isIgnored ? 'opacity-50 cursor-not-allowed' : ''}`}
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
              {formatBytes(node.size)}
            </span>
          )}
          {node.type === 'dir' && node.aggregateSize !== undefined && (
            <span className="text-gray-500 text-xs ml-2">
              ({formatBytes(node.aggregateSize)})
            </span>
          )}
          {node.type === 'dir' && node.depth === DIRECTORY_DEPTH_CAP && (
            <span className="text-blue-500 text-xs ml-2">
              (expandable)
            </span>
          )}
          {node.isIgnored && (
            <span className="text-gray-400 text-xs ml-2">
              (ignored)
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
          <ExtensionToggles />
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

      {previewContent && (
        <QueryComponent searchQuery={searchQuery} previewContent={previewContent} />
      )}
    </div>
  );
}

export default function Home() {
  return (
    <EchoProvider config={echoConfig}>
      <HomeContent />
    </EchoProvider>
  );
}