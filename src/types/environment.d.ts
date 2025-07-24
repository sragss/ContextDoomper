// types/environment.d.ts
declare global {
    namespace NodeJS {
      interface ProcessEnv {
        GITHUB_CLIENT_ID: string;
        GITHUB_CLIENT_SECRET: string;
        NEXT_PUBLIC_GITHUB_CLIENT_ID: string;
      }
    }
  }
  
  export {};