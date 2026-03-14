import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { motion } from 'framer-motion';
import api from '../services/api';
import type { StoryContent } from '../types';

interface StoryViewProps {
  /** When used inside onboarding, pass forkPointId directly and onComplete callback */
  forkPointId?: number;
  onComplete?: () => void;
  embedded?: boolean;
}

export default function StoryView({ forkPointId: propForkPointId, onComplete, embedded = false }: StoryViewProps) {
  const params = useParams<{ forkPointId: string }>();
  const navigate = useNavigate();
  const forkPointId = propForkPointId || Number(params.forkPointId);

  const [story, setStory] = useState<StoryContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const fetchStory = useCallback(async () => {
    try {
      const res = await api.get(`/fork-points/${forkPointId}/story`);
      if (res.data.data) {
        setStory(res.data.data);
        return res.data.data;
      }
      return null;
    } catch {
      return null;
    }
  }, [forkPointId]);

  const generateStory = async () => {
    setGenerating(true);
    setError('');
    try {
      const res = await api.post(`/fork-points/${forkPointId}/generate-story`);
      setStory(res.data.data);
      setGenerating(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '生成失败，请重试';
      setError(msg);
      setGenerating(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchStory().then((existing) => {
      if (!existing) {
        // Auto-trigger generation
        generateStory();
      }
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forkPointId]);

  // Poll while status is generating
  useEffect(() => {
    if (story?.status !== 'generating') return;
    const interval = setInterval(async () => {
      const updated = await fetchStory();
      if (updated && updated.status !== 'generating') {
        clearInterval(interval);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [story?.status, fetchStory]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  if (generating || story?.status === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-500 rounded-full mb-6"
        />
        <h3 className="text-lg font-medium text-gray-700 mb-2">正在为你书写另一种人生……</h3>
        <p className="text-gray-400 text-sm max-w-md">
          AI 正在根据你的性格画像和人生分岔点，想象如果当初走了另一条路，你的故事会怎样展开。这大约需要 30 秒。
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={generateStory}
          className="px-6 py-2 bg-indigo-500 text-white rounded-full hover:bg-indigo-600 transition-colors"
        >
          重新生成
        </button>
      </div>
    );
  }

  if (!story?.story_markdown) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`${embedded ? '' : 'max-w-3xl mx-auto px-4 py-8'}`}
    >
      <article className="prose prose-indigo max-w-none prose-headings:text-gray-800 prose-p:text-gray-600 prose-p:leading-relaxed">
        <ReactMarkdown>{story.story_markdown}</ReactMarkdown>
      </article>

      <div className="mt-10 flex flex-wrap gap-3 justify-center">
        <button
          onClick={generateStory}
          disabled={generating}
          className="px-6 py-2.5 border border-gray-200 text-gray-600 rounded-full hover:border-indigo-300 hover:text-indigo-600 transition-all"
        >
          重新生成
        </button>
        {onComplete ? (
          <button
            onClick={onComplete}
            className="px-8 py-2.5 bg-indigo-500 text-white rounded-full font-medium hover:bg-indigo-600 transition-all shadow-md"
          >
            完成，开始探索
          </button>
        ) : (
          <button
            onClick={() => navigate('/dashboard')}
            className="px-8 py-2.5 bg-indigo-500 text-white rounded-full font-medium hover:bg-indigo-600 transition-all shadow-md"
          >
            返回主页
          </button>
        )}
      </div>
    </motion.div>
  );
}
