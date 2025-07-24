# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` or `bun dev` - Start development server with Turbopack (Next.js 15.4.4)
- `npm run build` - Build the application for production
- `npm start` - Start production server
- `npm run lint` - Run Next.js linter

## Project Architecture

This is a Next.js 15 application that implements a GitHub repository browser with OAuth authentication. The architecture follows Next.js App Router patterns:

### Core Components
- **GitHub OAuth Flow**: Implements complete OAuth authentication flow using GitHub's API
  - Client-side authentication in `src/app/page.tsx:75-77`
  - Server-side token exchange in `src/app/api/github/token/route.ts:10-36`
  - Token storage via localStorage for persistence

### Key Dependencies
- **@octokit/rest**: GitHub API client for repository interactions
- **Next.js 15**: Uses App Router with React Server Components
- **Tailwind CSS v4**: Styling with dark/light theme support
- **TypeScript**: Full type safety with custom environment types

### File Structure
- `src/app/page.tsx` - Main application component with GitHub integration
- `src/app/api/github/token/route.ts` - OAuth token exchange endpoint
- `src/types/environment.d.ts` - Environment variable type definitions
- `src/app/layout.tsx` - Root layout with Geist font configuration

### Environment Variables Required
- `GITHUB_CLIENT_ID` - GitHub OAuth app client ID (server-side)
- `GITHUB_CLIENT_SECRET` - GitHub OAuth app client secret (server-side)
- `NEXT_PUBLIC_GITHUB_CLIENT_ID` - GitHub OAuth app client ID (client-side)

### State Management
Uses React useState for local component state management:
- GitHub token authentication state
- File listing from repository API calls
- Loading and error states

The application fetches and displays repository contents from hardcoded repositories (React, Next.js) but can be extended to support any GitHub repository.