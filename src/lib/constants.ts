// src/lib/constants.ts

export const CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID!;

export const ECHO_CONFIG = {
  appId: '3474f80b-4caa-4aab-867b-793f3abeef29',
  apiUrl: 'https://echo.merit.systems',
  redirectUri: process.env.NEXT_PUBLIC_ECHO_REDIRECT_URI || 'http://localhost:3000',
};

// Files larger than ~2500 LOC (150KB) are unchecked by default
export const MAX_AUTO_SELECT_SIZE = 150000;

// Prevent infinite recursion and API overload
export const DIRECTORY_DEPTH_CAP = 5;

// Files/directories to ignore for LLM context (binary, generated, etc.)
export const IGNORE_REGEX = new RegExp([
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