// app/api/github/token/route.ts
import { NextRequest, NextResponse } from 'next/server';

interface GitHubTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

export async function POST(request: NextRequest) {
  const { code }: { code: string } = await request.json();
  
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const data: GitHubTokenResponse = await tokenResponse.json();
  
  if (data.error) {
    return NextResponse.json(
      { error: data.error, description: data.error_description }, 
      { status: 400 }
    );
  }

  return NextResponse.json({ access_token: data.access_token });
}