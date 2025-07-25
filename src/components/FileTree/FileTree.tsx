// src/components/FileTree/FileTree.tsx
'use client';
import { useState, useEffect } from 'react';
import { ExtensionToggles } from './ExtensionToggles';
import { TreeNode } from './TreeNode';
import { FileTreeNode, ExtensionStats } from '@/types';

interface FileTreeProps {
  owner: string;
  repo: string;
  fileTree: FileTreeNode[];
  selectedBytes: number;
  extensionStats: ExtensionStats[];
  loading: boolean;
  loadingStatus: string;
  previewLoading: boolean;
  previewProgress: string;
  error: string | null;
  toggleDirectory: (targetPath: string) => void;
  toggleCheckbox: (targetPath: string) => void;
  toggleExtensionSelection: (targetExtension: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
}

export function FileTree({
  owner,
  repo,
  fileTree,
  selectedBytes,
  extensionStats,
  loading,
  loadingStatus,
  previewLoading,
  previewProgress,
  error,
  toggleDirectory,
  toggleCheckbox,
  toggleExtensionSelection,
  selectAll,
  deselectAll,
}: FileTreeProps) {

  // CLI-style spinner characters
  const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const [spinnerIndex, setSpinnerIndex] = useState(0);

  // Animate the CLI spinner
  useEffect(() => {
    if (!loadingStatus && !previewProgress) return;
    
    const interval = setInterval(() => {
      setSpinnerIndex(prev => (prev + 1) % spinnerChars.length);
    }, 100);
    
    return () => clearInterval(interval);
  }, [loadingStatus, previewProgress, spinnerChars.length]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  if (loading && fileTree.length === 0) {
    return (
      <div className="border rounded-lg p-4">
        <p className="text-gray-600">{loadingStatus || 'Loading file tree...'}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border rounded-lg p-4">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (fileTree.length === 0 && !loading) {
    return null;
  }

  return (
    <div className="border rounded-lg p-4">
      <h2 className="text-lg font-semibold mb-4">File Tree:</h2>
      
      <ExtensionToggles
        extensionStats={extensionStats}
        onToggleExtension={toggleExtensionSelection}
        onSelectAll={selectAll}
        onDeselectAll={deselectAll}
        formatBytes={formatBytes}
      />
      
      <div className="font-mono text-sm bg-gray-50 rounded border p-2 max-h-96 overflow-y-auto">
        {fileTree.map((node: FileTreeNode) => (
          <TreeNode 
            key={node.path} 
            node={node}
            onToggleDirectory={toggleDirectory}
            onToggleCheckbox={toggleCheckbox}
            formatBytes={formatBytes}
          />
        ))}
      </div>
      
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
        <div className="flex items-center justify-between">
          {/* Progressive Loading Status - Left Side */}
          <div className="flex items-center space-x-2 text-blue-700">
            {(loadingStatus || previewProgress) ? (
              <>
                <div className="font-mono text-blue-700 text-sm select-none">
                  {spinnerChars[spinnerIndex]}
                </div>
                <div className="text-xs font-medium">
                  {previewProgress || loadingStatus}
                </div>
              </>
            ) : (
              <div className="text-sm font-medium text-blue-800">
                Ready
              </div>
            )}
          </div>
          
          {/* Bytes Selected - Right Side */}
          <div className="text-sm font-medium text-blue-800">
            Bytes Selected: {selectedBytes.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}