import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { motion } from 'framer-motion';
import api, { getAccessToken } from '../services/api';
import type { ApiResponse, ForkPoint, LifeBlock, LifeBlocksData, BlockStreamEvent } from '../types';

const SKELETON_COUNT = 5;

export default function LifeView() {
  const { forkPointId } = useParams<{ forkPointId: string }>();
  const navigate = useNavigate();

  const [forkPoint, setForkPoint] = useState<ForkPoint | null>(null);
  const [blocks, setBlocks] = useState<LifeBlock[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const blockRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Fetch fork point info
  useEffect(() => {
    if (!forkPointId) return;
    (async () => {
      try {
        const { data } = await api.get<ApiResponse<ForkPoint>>(`/fork-points/${forkPointId}`);
        if (data.code === 0 && data.data) {
          setForkPoint(data.data);
        }
      } catch {
        setError('加载分岔点失败');
      }
    })();
  }, [forkPointId]);

  // Try to load existing blocks from GET endpoint
  const fetchBlocks = useCallback(async (): Promise<boolean> => {
    try {
      const res = await api.get<ApiResponse<LifeBlocksData>>(`/fork-points/${forkPointId}/blocks`);
      if (res.data.data && res.data.data.blocks.length > 0) {
        const loaded: LifeBlock[] = res.data.data.blocks.map((s) => ({
          index: s.sort_order,
          title: s.title || `第${s.sort_order}章`,
          content: s.content || '',
          status: 'completed' as const,
        }));
        setBlocks(loaded);
        return true;
      }
    } catch {
      // no existing blocks
    }
    return false;
  }, [forkPointId]);

  // Start SSE stream
  const startStream = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setError('');
    setIsStreaming(true);
    // Initialize skeleton blocks
    setBlocks(
      Array.from({ length: SKELETON_COUNT }, (_, i) => ({
        index: i + 1,
        title: '',
        content: '',
        status: 'pending' as const,
      }))
    );

    const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
    const token = getAccessToken();

    try {
      const response = await fetch(`${baseURL}/fork-points/${forkPointId}/generate-life-stream`, {
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
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);

          if (payload === '[DONE]') {
            setIsStreaming(false);
            return;
          }

          try {
            const evt: BlockStreamEvent = JSON.parse(payload);

            if (evt.type === 'error') {
              throw new Error(evt.message || '生成失败');
            }

            if (evt.type === 'block_start' && evt.index !== undefined) {
              setBlocks((prev) => {
                const idx = prev.findIndex((b) => b.index === evt.index);
                if (idx >= 0) {
                  const updated = [...prev];
                  updated[idx] = { ...updated[idx], title: evt.title || '', status: 'streaming' };
                  return updated;
                }
                return [...prev, { index: evt.index!, title: evt.title || '', content: '', status: 'streaming' }];
              });
              // Scroll new block into view
              setTimeout(() => {
                const el = blockRefs.current.get(evt.index!);
                el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 100);
            }

            if (evt.type === 'content' && evt.index !== undefined && evt.text) {
              setBlocks((prev) =>
                prev.map((b) =>
                  b.index === evt.index ? { ...b, content: b.content + evt.text!, status: 'streaming' } : b
                )
              );
            }

            if (evt.type === 'block_end' && evt.index !== undefined) {
              setBlocks((prev) =>
                prev.map((b) => (b.index === evt.index ? { ...b, status: 'completed' } : b))
              );
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') {
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
  }, [forkPointId]);

  // On mount: try to load existing, else start stream
  useEffect(() => {
    setLoading(true);
    fetchBlocks().then((exists) => {
      setLoading(false);
      if (!exists) {
        startStream();
      }
    });
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forkPointId]);

  // Filter out unused skeleton blocks
  const displayBlocks = blocks.filter((b) => b.status !== 'pending' || b.content.length > 0);
  const pendingSkeletons = isStreaming
    ? blocks.filter((b) => b.status === 'pending' && b.content.length === 0)
    : [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-monet-haze/30 border-t-monet-sage" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas bg-gradient-to-b from-[#f0eec8] via-[#e8e8dc] to-[#dde8e0]">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur border-b border-monet-haze/20 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-monet-haze hover:text-monet-leaf transition-colors font-serif"
          >
            ← 返回
          </button>
          <h1 className="text-lg font-bold text-monet-leaf font-serif">
            {forkPoint?.title || '平行人生'}
          </h1>
          <div className="w-12" />
        </div>
      </header>

      {/* Error */}
      {error && (
        <div className="max-w-4xl mx-auto px-6 mt-8">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <p className="text-red-500 mb-4 font-serif">{error}</p>
            <button
              onClick={() => { setError(''); startStream(); }}
              className="px-6 py-2 bg-monet-sage text-white rounded-full hover:bg-monet-sage/90 transition-colors font-serif"
            >
              重新生成
            </button>
          </div>
        </div>
      )}

      {/* Streaming indicator when no blocks yet */}
      {isStreaming && displayBlocks.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-20">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-12 h-12 border-4 border-monet-haze/30 border-t-monet-sage rounded-full mb-6"
          />
          <h3 className="font-serif text-lg font-medium text-monet-leaf mb-2">正在为你书写另一种人生……</h3>
          <p className="font-serif text-monet-haze text-sm max-w-md text-center">
            AI 正在根据你的性格画像和人生分岔点，想象如果当初走了另一条路，你的故事会怎样展开。
          </p>
        </div>
      )}

      {/* Blocks content */}
      {(displayBlocks.length > 0 || pendingSkeletons.length > 0) && (
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="flex gap-8">
            {/* Left: narrative blocks (~65%) */}
            <div className="flex-1 min-w-0 space-y-8">
              {displayBlocks.map((block) => (
                <motion.div
                  key={block.index}
                  ref={(el) => { if (el) blockRefs.current.set(block.index, el); }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="bg-white/80 rounded-2xl border border-monet-haze/20 p-8 shadow-monet"
                >
                  {block.title && (
                    <h2 className="font-serif text-xl font-bold text-monet-leaf mb-4">
                      {block.title}
                    </h2>
                  )}
                  <article className="prose prose-indigo max-w-none prose-headings:text-monet-leaf prose-headings:font-serif prose-p:text-monet-leaf/80 prose-p:leading-relaxed prose-p:font-serif">
                    <ReactMarkdown>{block.content}</ReactMarkdown>
                    {block.status === 'streaming' && (
                      <span className="inline-block w-0.5 h-4 bg-monet-sage align-middle animate-pulse ml-0.5" />
                    )}
                  </article>
                </motion.div>
              ))}

              {/* Skeleton placeholders */}
              {pendingSkeletons.map((block) => (
                <div
                  key={`skeleton-${block.index}`}
                  className="bg-white/40 rounded-2xl border border-monet-haze/10 p-8 animate-pulse"
                >
                  <div className="h-6 bg-monet-haze/20 rounded w-1/3 mb-4" />
                  <div className="space-y-3">
                    <div className="h-4 bg-monet-haze/10 rounded w-full" />
                    <div className="h-4 bg-monet-haze/10 rounded w-5/6" />
                    <div className="h-4 bg-monet-haze/10 rounded w-4/6" />
                    <div className="h-4 bg-monet-haze/10 rounded w-full" />
                    <div className="h-4 bg-monet-haze/10 rounded w-3/6" />
                  </div>
                </div>
              ))}
            </div>

            {/* Right: image placeholders (~35%) */}
            <div className="hidden lg:block w-[35%] flex-shrink-0 space-y-8">
              {displayBlocks.map((block) => (
                <div
                  key={`img-${block.index}`}
                  className="bg-white/40 rounded-2xl border border-monet-haze/10 aspect-[4/3] flex items-center justify-center"
                >
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-monet-haze/10 flex items-center justify-center">
                      <svg className="w-6 h-6 text-monet-haze/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                      </svg>
                    </div>
                    <p className="text-sm text-monet-haze/50 font-serif">等待生成</p>
                  </div>
                </div>
              ))}

              {pendingSkeletons.map((block) => (
                <div
                  key={`img-skeleton-${block.index}`}
                  className="bg-white/20 rounded-2xl border border-monet-haze/5 aspect-[4/3] animate-pulse"
                />
              ))}
            </div>
          </div>

          {/* Actions after completion */}
          {!isStreaming && displayBlocks.length > 0 && !error && (
            <div className="mt-10 flex flex-wrap gap-3 justify-center">
              <button
                onClick={() => { setBlocks([]); startStream(); }}
                className="px-6 py-2.5 border border-monet-haze/50 text-monet-haze rounded-full hover:border-monet-sage hover:text-monet-sage transition-all font-serif"
              >
                重新生成
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-8 py-2.5 bg-monet-sage text-white rounded-full font-medium hover:bg-monet-sage/90 transition-all shadow-monet font-serif"
              >
                返回主页
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
