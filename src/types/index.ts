// src/types/index.ts

export interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  type: 'file' | 'dir';
  download_url?: string | null;
}

export interface FileTreeNode {
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

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  stargazers_count: number;
}

// Selection states for three-state toggles
export type SelectionState = 'none' | 'partial' | 'full';

export interface ExtensionStats {
  extension: string;     // ".js" or "no extension" or ".gitignore"
  totalBytes: number;    // sum of all files with this extension
  fileCount: number;     // count of files with this extension
  selectionState: SelectionState; // none/partial/full selection state
}

export interface GithubAuthContextType {
  token: string | null;
  octokit: any; // Octokit instance
  login: () => void;
  logout: () => void;
  loading: boolean;
  error: string | null;
  rateLimit: {
    limit: number;
    remaining: number;
    reset: number;
    used: number;
  } | null;
}