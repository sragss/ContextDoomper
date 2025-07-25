// src/components/QueryComponent.tsx
'use client';
import { useState } from 'react';
import { useEcho, useEchoOpenAI } from '@zdql/echo-react-sdk';

interface QueryComponentProps {
  searchQuery: string;
  previewContent: string;
  className?: string;
}

export function QueryComponent({ searchQuery, previewContent, className = '' }: QueryComponentProps) {
  const { signIn, isAuthenticated } = useEcho();
  const { openai } = useEchoOpenAI();
  const [userQuestion, setUserQuestion] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const constructPrompt = (question: string, repoName: string, context: string) => {
    return `You're a coding assistant, I'm going to give you a user question about <repo>${repoName}</repo>, and you are to answer it as clearly as possible, do not be excessively verbose and get directly to the heart of the question and the answer.

<user_question>
${question}
</user_question>

<repo_context>
${context}
</repo_context>`;
  };

  const handleQuery = async () => {
    if (!userQuestion.trim() || !isAuthenticated || !openai) return;
    
    setLoading(true);
    try {
      const repoName = searchQuery || 'repository';
      const prompt = constructPrompt(userQuestion, repoName, previewContent);
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4.1',
        messages: [{ role: 'user', content: prompt }],
      });
      
      setResponse(completion.choices[0].message.content || '');
    } catch (err) {
      console.error('Query failed:', err);
      setResponse('Error: Failed to get response from LLM');
    } finally {
      setLoading(false);
    }
  };

  if (!previewContent) {
    return null;
  }

  return (
    <div className={`mt-6 border rounded-lg p-4 ${className}`}>
      <h2 className="text-lg font-semibold mb-4">Query Repository</h2>
      
      {!isAuthenticated ? (
        <div className="text-center py-8">
          <p className="text-gray-600 mb-4">Sign in to query the repository with AI</p>
          <button
            onClick={signIn}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Sign In to Echo
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="Ask a question about the repository..."
              value={userQuestion}
              onChange={(e) => setUserQuestion(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
              onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
            />
          </div>
          
          <button
            onClick={handleQuery}
            disabled={loading || !userQuestion.trim()}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-400"
          >
            {loading ? 'Querying...' : 'Ask AI'}
          </button>
          
          {response && (
            <div className="mt-4 p-4 bg-gray-50 rounded border">
              <h3 className="font-semibold mb-2">AI Response:</h3>
              <div className="whitespace-pre-wrap text-sm">
                {response}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}