import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import api, { getAccessToken } from '../services/api';
import type {
  ApiResponse, ForkPoint, LifeBlock, LifeBlocksData, BlockStreamEvent,
  StoryQuestion, UserAnswer,
} from '../types';

type Phase = 'init' | 'thinking' | 'asking' | 'streaming' | 'done';

const SKELETON_COUNT = 5;

const THINKING_MESSAGES = [
  '正在分析你的性格画像...',
  '正在寻找这段旅程的关键时刻...',
  '想为你定制几个问题...',
];

export default function LifeView() {
  const { forkPointId } = useParams<{ forkPointId: string }>();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('init');
  const [forkPoint, setForkPoint] = useState<ForkPoint | null>(null);
  const [blocks, setBlocks] = useState<LifeBlock[]>([]);
  const [questions, setQuestions] = useState<StoryQuestion[]>([]);
  // answers: questionId -> selected option text (or custom text)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [showCustomInput, setShowCustomInput] = useState<Record<string, boolean>>({});
  const [thinkingStep, setThinkingStep] = useState(0);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const blockRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const thinkingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const thinkingStartRef = useRef<number>(0);

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

  // Typewriter effect for thinking messages
  useEffect(() => {
    if (phase !== 'thinking') {
      if (thinkingTimerRef.current) clearInterval(thinkingTimerRef.current);
      return;
    }
    setThinkingStep(0);
    thinkingTimerRef.current = setInterval(() => {
      setThinkingStep((s) => Math.min(s + 1, THINKING_MESSAGES.length - 1));
    }, 800);
    return () => {
      if (thinkingTimerRef.current) clearInterval(thinkingTimerRef.current);
    };
  }, [phase]);

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

  // Fetch questions and show asking phase
  const loadQuestionsAndShow = useCallback(async () => {
    setPhase('thinking');
    thinkingStartRef.current = Date.now();
    setSelectedAnswers({});
    setCustomInputs({});
    setShowCustomInput({});

    try {
      const [res] = await Promise.all([
        api.get<ApiResponse<{ questions: StoryQuestion[] }>>(`/fork-points/${forkPointId}/story-questions`),
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ]);
      const qs = res.data.data?.questions ?? [];
      setQuestions(qs);
      setPhase('asking');
    } catch {
      // On error, skip to streaming directly
      setPhase('streaming');
      startStream(undefined);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forkPointId]);

  // Start SSE stream
  const startStream = useCallback(async (answers?: UserAnswer[]) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setError('');
    setPhase('streaming');
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
        body: JSON.stringify({ answers: answers ?? [] }),
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
            setPhase('done');
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
      setPhase('done');
    }
  }, [forkPointId]);

  // On mount: check cache or go to thinking
  useEffect(() => {
    fetchBlocks().then((exists) => {
      if (exists) {
        setPhase('done');
      } else {
        loadQuestionsAndShow();
      }
    });
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forkPointId]);

  // Build UserAnswer array from selected/custom answers
  const buildAnswers = (): UserAnswer[] => {
    return questions
      .map((q) => {
        const custom = showCustomInput[q.id] ? customInputs[q.id]?.trim() : undefined;
        const selected = selectedAnswers[q.id];
        const answer = custom || selected;
        if (!answer) return null;
        return { question: q.question, answer };
      })
      .filter(Boolean) as UserAnswer[];
  };

  const handleSubmitAnswers = () => {
    startStream(buildAnswers());
  };

  const handleSkipAll = () => {
    startStream([]);
  };

  const toggleOption = (qId: string, option: string) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [qId]: prev[qId] === option ? '' : option,
    }));
    setShowCustomInput((prev) => ({ ...prev, [qId]: false }));
  };

  const toggleCustomInput = (qId: string) => {
    setShowCustomInput((prev) => {
      const next = !prev[qId];
      if (next) {
        setSelectedAnswers((sa) => ({ ...sa, [qId]: '' }));
      }
      return { ...prev, [qId]: next };
    });
  };

  const isStreaming = phase === 'streaming';
  const displayBlocks = blocks.filter((b) => b.status !== 'pending' || b.content.length > 0);
  const pendingSkeletons = isStreaming
    ? blocks.filter((b) => b.status === 'pending' && b.content.length === 0)
    : [];

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
              onClick={() => { setError(''); setBlocks([]); loadQuestionsAndShow(); }}
              className="px-6 py-2 bg-monet-sage text-white rounded-full hover:bg-monet-sage/90 transition-colors font-serif"
            >
              重新生成
            </button>
          </div>
        </div>
      )}

      {/* Thinking phase */}
      <AnimatePresence>
        {phase === 'thinking' && !error && (
          <motion.div
            key="thinking"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center min-h-[70vh] px-6"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-14 h-14 border-4 border-monet-haze/30 border-t-monet-sage rounded-full mb-8"
            />
            <div className="space-y-3 text-center">
              {THINKING_MESSAGES.map((msg, i) => (
                <motion.p
                  key={msg}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: i <= thinkingStep ? 1 : 0, y: i <= thinkingStep ? 0 : 8 }}
                  transition={{ duration: 0.4 }}
                  className={`font-serif text-base ${i === thinkingStep ? 'text-monet-leaf font-medium' : 'text-monet-haze'}`}
                >
                  {msg}
                </motion.p>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Asking phase */}
      <AnimatePresence>
        {phase === 'asking' && !error && (
          <motion.div
            key="asking"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="max-w-2xl mx-auto px-6 py-12"
          >
            <div className="text-center mb-10">
              <h2 className="font-serif text-2xl font-bold text-monet-leaf mb-2">
                在开始之前，让 AI 更了解你
              </h2>
              <p className="text-monet-haze font-serif text-sm">
                回答下面的问题，你的故事将更贴合你的内心期望
              </p>
            </div>

            <div className="space-y-8 mb-24">
              {questions.map((q, qi) => (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: qi * 0.15 }}
                  className="bg-white/80 rounded-2xl border border-monet-haze/20 p-6 shadow-monet"
                >
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="font-serif text-lg font-semibold text-monet-leaf leading-snug">
                      {q.question}
                    </h3>
                    <button
                      onClick={() => {
                        setSelectedAnswers((sa) => ({ ...sa, [q.id]: '' }));
                        setShowCustomInput((sc) => ({ ...sc, [q.id]: false }));
                      }}
                      className="ml-4 text-xs text-monet-haze/60 hover:text-monet-haze transition-colors font-serif shrink-0 mt-0.5"
                    >
                      跳过
                    </button>
                  </div>
                  {q.hint && (
                    <p className="text-monet-haze text-xs font-serif mb-4">{q.hint}</p>
                  )}
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {q.options.map((opt) => {
                      const isSelected = selectedAnswers[q.id] === opt && !showCustomInput[q.id];
                      return (
                        <button
                          key={opt}
                          onClick={() => toggleOption(q.id, opt)}
                          className={`px-4 py-3 rounded-xl text-sm font-serif text-left transition-all border ${
                            isSelected
                              ? 'bg-monet-sage/20 border-monet-sage text-monet-sage font-medium'
                              : 'bg-white/60 border-monet-haze/20 text-monet-leaf/80 hover:border-monet-sage/40 hover:bg-monet-sage/5'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3">
                    <button
                      onClick={() => toggleCustomInput(q.id)}
                      className="text-xs text-monet-haze/60 hover:text-monet-sage transition-colors font-serif"
                    >
                      ✏ 自己填写...
                    </button>
                    <AnimatePresence>
                      {showCustomInput[q.id] && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <textarea
                            autoFocus
                            value={customInputs[q.id] || ''}
                            onChange={(e) => setCustomInputs((ci) => ({ ...ci, [q.id]: e.target.value }))}
                            placeholder="写下你的想法..."
                            className="mt-2 w-full px-3 py-2 rounded-xl border border-monet-haze/30 bg-white/70 text-sm font-serif text-monet-leaf placeholder-monet-haze/40 resize-none focus:outline-none focus:border-monet-sage/50"
                            rows={3}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Fixed bottom bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur border-t border-monet-haze/20 px-6 py-4 flex gap-3 justify-center z-20">
              <button
                onClick={handleSkipAll}
                className="px-5 py-2.5 border border-monet-haze/40 text-monet-haze rounded-full text-sm font-serif hover:border-monet-haze/60 transition-all"
              >
                跳过全部，直接开始
              </button>
              <button
                onClick={handleSubmitAnswers}
                className="px-6 py-2.5 bg-monet-sage text-white rounded-full text-sm font-medium font-serif hover:bg-monet-sage/90 transition-all shadow-monet"
              >
                开始生成我的故事 →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
      {(isStreaming || phase === 'done') && (displayBlocks.length > 0 || pendingSkeletons.length > 0) && (
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
          {phase === 'done' && displayBlocks.length > 0 && !error && (
            <div className="mt-10 flex flex-wrap gap-3 justify-center">
              <button
                onClick={() => { setBlocks([]); loadQuestionsAndShow(); }}
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
