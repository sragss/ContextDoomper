// src/components/Preview.tsx
'use client';
import { Copy } from 'lucide-react';

interface PreviewProps {
  content: string;
  title?: string;
  className?: string;
}

export function Preview({ content, title = 'Preview', className = '' }: PreviewProps) {
  const copyToClipboard = async () => {
    if (content) {
      try {
        await navigator.clipboard.writeText(content);
      } catch (err) {
        console.error('Failed to copy to clipboard:', err);
      }
    }
  };

  if (!content) {
    return null;
  }

  return (
    <div className={`mt-6 border rounded-lg p-4 ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
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
          {content}
        </pre>
      </div>
    </div>
  );
}