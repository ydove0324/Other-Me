import { useState } from 'react';
import { motion } from 'framer-motion';
import api from '../../services/api';

interface ForkPointInputProps {
  onComplete: (forkPointId: number) => void;
}

export default function ForkPointInput({ onComplete }: ForkPointInputProps) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    happened_at: '',
    actual_choice: '',
    alternative_choice: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isValid = form.title.trim() && form.actual_choice.trim() && form.alternative_choice.trim();

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post('/fork-points', {
        title: form.title,
        description: form.description || undefined,
        happened_at: form.happened_at || undefined,
        actual_choice: form.actual_choice,
        alternative_choice: form.alternative_choice,
      });
      const forkPointId = res.data.data.id;
      onComplete(forkPointId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '创建失败，请重试';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-xl mx-auto px-4"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">人生的岔路口</h2>
        <p className="text-gray-500">
          回忆一个你曾经面临选择的时刻。如果当初走了另一条路，人生会怎样？
        </p>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            那个时刻叫什么？ *
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="比如：大学选专业、那次跳槽、那段感情……"
            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            大概是什么时候？
          </label>
          <input
            type="date"
            value={form.happened_at}
            onChange={(e) => setForm({ ...form, happened_at: e.target.value })}
            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            背景故事
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="当时发生了什么？你面临怎样的处境？"
            rows={3}
            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none resize-none transition-all"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <span className="inline-block w-2 h-2 bg-gray-400 rounded-full mr-1.5" />
              你实际的选择 *
            </label>
            <textarea
              value={form.actual_choice}
              onChange={(e) => setForm({ ...form, actual_choice: e.target.value })}
              placeholder="你当时选了什么？"
              rows={2}
              className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-300 outline-none resize-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-indigo-600 mb-1">
              <span className="inline-block w-2 h-2 bg-indigo-500 rounded-full mr-1.5" />
              未走的那条路 *
            </label>
            <textarea
              value={form.alternative_choice}
              onChange={(e) => setForm({ ...form, alternative_choice: e.target.value })}
              placeholder="另一个选择是什么？"
              rows={2}
              className="w-full p-3 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-300 outline-none resize-none transition-all"
            />
          </div>
        </div>
      </div>

      {error && <p className="mt-4 text-red-500 text-sm">{error}</p>}

      <div className="mt-8 text-center">
        <button
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          className="px-10 py-3 bg-indigo-500 text-white rounded-full font-medium hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
        >
          {submitting ? '创建中...' : '探索另一种可能'}
        </button>
      </div>
    </motion.div>
  );
}
