// src/hooks/useFileTree.ts
import { useState, useEffect } from 'react';
import { FileTreeNode, GitHubFile, SelectionState, ExtensionStats } from '@/types';
import { useGithubToken } from '@/contexts/GithubAuthContext';
import { IGNORE_REGEX, MAX_AUTO_SELECT_SIZE, DIRECTORY_DEPTH_CAP } from '@/lib/constants';

export function useFileTree(owner: string, repo: string) {
  const { octokit } = useGithubToken();
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [selectedBytes, setSelectedBytes] = useState<number>(0);
  const [extensionStats, setExtensionStats] = useState<ExtensionStats[]>([]);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Load files when owner/repo/octokit changes
  useEffect(() => {
    if (octokit && owner && repo) {
      fetchFiles();
    }
  }, [octokit, owner, repo]);

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
  }, [fileTree]);

  // Update extension stats whenever file tree or selections change
  useEffect(() => {
    if (fileTree.length > 0) {
      const stats = analyzeFileExtensions(fileTree);
      setExtensionStats(stats);
    } else {
      setExtensionStats([]);
    }
  }, [fileTree, selectedBytes]);

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
  }, [selectedBytes, fileTree]);

  const fetchAllDirectories = async (
    owner: string, 
    repo: string, 
    path: string = '', 
    depth: number = 0, 
    inheritCheckedState?: boolean,
    updateTree?: (nodes: FileTreeNode[]) => void
  ): Promise<FileTreeNode[]> => {
    if (!octokit) return [];
    
    try {
      // Update loading status
      const displayPath = path || 'root';
      if (typeof setLoadingStatus === 'function') {
        setLoadingStatus(`Loading ${displayPath}...`);
      }
      
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
                ? false 
                : false
        };
        
        nodes.push(node);
      }
      
      // Sort directories first, then files
      const sortedNodes = nodes.sort((a, b) => {
        if (a.type === 'dir' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'dir') return 1;
        return a.name.localeCompare(b.name);
      });

      // For progressive loading, update the tree immediately with current level
      if (updateTree && depth === 0) {
        updateTree([...sortedNodes]);
      }

      // Now recursively load subdirectories
      for (const node of sortedNodes) {
        if (node.type === 'dir' && depth < DIRECTORY_DEPTH_CAP) {
          node.children = await fetchAllDirectories(
            owner, 
            repo, 
            node.path, 
            depth + 1, 
            node.isChecked === true,
            updateTree
          );
          
          // Update tree progressively as each directory loads
          if (updateTree && depth === 0) {
            updateTree([...sortedNodes]);
          }
        } else if (node.type === 'dir') {
          // Initialize empty children array for manual expansion later
          node.children = [];
        }
      }

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
    if (!octokit) return;

    const updateTree = async (nodes: FileTreeNode[]): Promise<FileTreeNode[]> => {
      return Promise.all(nodes.map(async (node) => {
        if (node.path === targetPath && node.type === 'dir') {
          if (!node.isExpanded) {
            // Load children if not already loaded (for directories beyond depth cap)
            if (!node.children || node.children.length === 0) {
              const currentDepth = node.depth || 0;
              setLoadingStatus(`Expanding ${node.path}...`);
              const newChildren = await fetchAllDirectories(owner, repo, node.path, currentDepth + 1);
              // Set children's checked state to match parent
              const updateChildrenChecked = (children: FileTreeNode[]): FileTreeNode[] => {
                return children.map(child => ({
                  ...child,
                  isChecked: node.isChecked,
                  children: child.children ? updateChildrenChecked(child.children) : undefined
                }));
              };
              node.children = updateChildrenChecked(newChildren);
              setLoadingStatus('');
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

  const getFileExtension = (filename: string): string => {
    if (!filename.includes('.')) return 'no extension';
    if (filename.startsWith('.') && filename.indexOf('.', 1) === -1) {
      return filename; // .gitignore, .env, etc.
    }
    const parts = filename.split('.');
    return '.' + parts[parts.length - 1].toLowerCase();
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
    if (!octokit) return 0;

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
            const children = await fetchAllDirectories(owner, repo, node.path, 0, node.isChecked === true);
            total += await calculateSelectedBytes(children);
          }
        }
      }
    }
    
    return total;
  };

  const collectSelectedFiles = async (nodes: FileTreeNode[]): Promise<FileTreeNode[]> => {
    if (!octokit) return [];

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
            const children = await fetchAllDirectories(owner, repo, node.path, 0, node.isChecked === true);
            selectedFiles = selectedFiles.concat(await collectSelectedFiles(children));
          }
        }
      }
    }
    
    return selectedFiles;
  };

  const fetchFileContent = async (file: FileTreeNode): Promise<string> => {
    if (!octokit || file.type !== 'file') return '';

    try {
      const { data } = await octokit.repos.getContent({ 
        owner, 
        repo,
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

  const fetchFiles = async () => {
    if (!octokit) return;
    
    setLoading(true);
    setError(null);
    setFileTree([]);
    setLoadingStatus('Initializing...');
    
    try {
      // Start with a basic tree structure and update progressively
      let currentTree: FileTreeNode[] = [];
      
      const updateTreeProgressively = (newTree: FileTreeNode[]) => {
        currentTree = [...newTree];
        setFileTree(currentTree);
      };

      const tree = await fetchAllDirectories(owner, repo, '', 0, undefined, updateTreeProgressively);
      setFileTree(tree);
      setLoadingStatus('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch files');
      console.error('Failed to fetch files:', err);
      setLoadingStatus('');
    } finally {
      setLoading(false);
    }
  };

  return {
    fileTree,
    selectedBytes,
    extensionStats,
    previewContent,
    loading,
    loadingStatus,
    error,
    toggleDirectory,
    toggleCheckbox,
    toggleExtensionSelection,
    selectAll,
    deselectAll,
    collectSelectedFiles,
    fetchFiles,
  };
}