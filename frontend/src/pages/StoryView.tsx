import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { motion } from 'framer-motion';
import api, { getAccessToken } from '../services/api';
import type { StoryContent } from '../types';

interface StoryViewProps {
  forkPointId?: number;
  onComplete?: () => void;
  embedded?: boolean;
}

export default function StoryView({ forkPointId: propForkPointId, onComplete, embedded = false }: StoryViewProps) {
  const params = useParams<{ forkPointId: string }>();
  const navigate = useNavigate();
  const forkPointId = propForkPointId || Number(params.forkPointId);

  const [story, setStory] = useState<StoryContent | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const fetchStory = useCallback(async (): Promise<StoryContent | null> => {
    try {
      const res = await api.get(`/fork-points/${forkPointId}/story`);
      if (res.data.data) {
        setStory(res.data.data);
        return res.data.data;
      }
    } catch {
      // ignore
    }
    return null;
  }, [forkPointId]);

  const startStream = useCallback(async () => {
    // Abort any previous stream
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setError('');
    setStreamingText('');
    setIsStreaming(true);
    setStory(null);

    const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
    const token = getAccessToken();

    try {
      const response = await fetch(`${baseURL}/fork-points/${forkPointId}/generate-story-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // keep incomplete last line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);

          if (payload === '[DONE]') {
            setIsStreaming(false);
            // Fetch persisted record to populate story state
            await fetchStory();
            return;
          }

          try {
            const parsed = JSON.parse(payload);
            if (typeof parsed === 'string') {
              setStreamingText((prev) => prev + parsed);
            } else if (parsed?.error) {
              throw new Error(parsed.error);
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== 'Unexpected token') {
              throw parseErr;
            }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : '生成失败，请重试');
      setIsStreaming(false);
    }
  }, [forkPointId, fetchStory]);

  useEffect(() => {
    setLoading(true);
    fetchStory().then((existing) => {
      setLoading(false);
      if (!existing) {
        startStream();
      }
    });
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forkPointId]);

  // ── Derived display text ──
  const displayText = story?.story_markdown ?? streamingText;
  const showSpinner = loading || (isStreaming && !streamingText);

  if (showSpinner) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4 bg-gradient-to-b from-monet-cream/50 via-monet-sage/5 to-monet-haze/10 rounded-2xl">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-monet-haze/30 border-t-monet-sage rounded-full mb-6"
        />
        <h3 className="font-serif text-lg font-medium text-monet-leaf mb-2">正在为你书写另一种人生……</h3>
        <p className="font-serif text-monet-haze text-sm max-w-md">
          AI 正在根据你的性格画像和人生分岔点，想象如果当初走了另一条路，你的故事会怎样展开。
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4 bg-gradient-to-b from-monet-cream/50 to-monet-sage/10 rounded-2xl">
        <p className="text-red-500 mb-4 font-serif">{error}</p>
        <button
          onClick={startStream}
          className="px-6 py-2 bg-monet-sage text-white rounded-full hover:bg-monet-sage/90 transition-colors font-serif"
        >
          重新生成
        </button>
      </div>
    );
  }

  if (!displayText) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`${embedded ? '' : 'max-w-3xl mx-auto px-4 py-8'}`}
    >
      <article className="prose prose-indigo max-w-none prose-headings:text-monet-leaf prose-p:text-monet-leaf/80 prose-p:leading-relaxed prose-headings:font-serif prose-p:font-serif bg-white/70 rounded-2xl p-8 shadow-monet">
        <ReactMarkdown>{displayText}</ReactMarkdown>
        {/* Blinking cursor while streaming */}
        {isStreaming && (
          <span className="inline-block w-0.5 h-4 bg-monet-sage align-middle animate-pulse ml-0.5" />
        )}
      </article>

      {!isStreaming && (
        <div className="mt-10 flex flex-wrap gap-3 justify-center">
          <button
            onClick={startStream}
            className="px-6 py-2.5 border border-monet-haze/50 text-monet-haze rounded-full hover:border-monet-sage hover:text-monet-sage transition-all font-serif"
          >
            重新生成
          </button>
          {onComplete ? (
            <button
              onClick={onComplete}
              className="px-8 py-2.5 bg-monet-sage text-white rounded-full font-medium hover:bg-monet-sage/90 transition-all shadow-monet font-serif"
            >
              完成，开始探索
            </button>
          ) : (
            <button
              onClick={() => navigate('/dashboard')}
              className="px-8 py-2.5 bg-monet-sage text-white rounded-full font-medium hover:bg-monet-sage/90 transition-all shadow-monet font-serif"
            >
              返回主页
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
