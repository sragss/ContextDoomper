// src/components/FileTree/TreeNode.tsx
'use client';
import { FileTreeNode } from '@/types';
import { DIRECTORY_DEPTH_CAP } from '@/lib/constants';

interface TreeNodeProps {
  node: FileTreeNode;
  depth?: number;
  onToggleDirectory: (path: string) => void;
  onToggleCheckbox: (path: string) => void;
  formatBytes: (bytes: number) => string;
}

export function TreeNode({ 
  node, 
  depth = 0, 
  onToggleDirectory, 
  onToggleCheckbox,
  formatBytes 
}: TreeNodeProps) {
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
            onToggleCheckbox(node.path);
          }}
          className={`mr-2 w-4 h-4 ${node.isIgnored ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
        {node.type === 'dir' && (
          <span 
            className="mr-1 text-gray-400 transition-transform duration-200 cursor-pointer" 
            style={{ transform: node.isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
            onClick={() => onToggleDirectory(node.path)}
          >
            ▶
          </span>
        )}
        <span className="mr-2">
          {node.type === 'dir' ? '📁' : '📄'}
        </span>
        <span 
          className="flex-1 cursor-pointer"
          onClick={() => node.type === 'dir' && onToggleDirectory(node.path)}
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
            <TreeNode 
              key={child.path} 
              node={child} 
              depth={depth + 1}
              onToggleDirectory={onToggleDirectory}
              onToggleCheckbox={onToggleCheckbox}
              formatBytes={formatBytes}
            />
          ))}
        </div>
      )}
    </div>
  );
}