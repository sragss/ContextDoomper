// src/components/FileTree/ExtensionToggles.tsx
'use client';
import { ExtensionStats, SelectionState } from '@/types';

interface ExtensionTogglesProps {
  extensionStats: ExtensionStats[];
  onToggleExtension: (extension: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  formatBytes: (bytes: number) => string;
}

export function ExtensionToggles({ 
  extensionStats, 
  onToggleExtension, 
  onSelectAll, 
  onDeselectAll,
  formatBytes 
}: ExtensionTogglesProps) {
  if (extensionStats.length === 0) return null;
  
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
    <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-sm font-medium text-gray-700">Top File Types:</h3>
        <div className="flex gap-2">
          <button
            onClick={onSelectAll}
            className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
          >
            Select All
          </button>
          <button
            onClick={onDeselectAll}
            className="inline-flex items-center px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors"
          >
            Deselect All
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {extensionStats.map((stat) => (
          <button
            key={stat.extension}
            onClick={() => onToggleExtension(stat.extension)}
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
        ))}
      </div>
    </div>
  );
}