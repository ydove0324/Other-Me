import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { QuizQuestion } from '../../config/quizConfig';

interface BubbleQuestionProps {
  question: QuizQuestion;
  answers: Record<string, string | string[]>;
  onAnswer: (questionId: string, value: string | string[]) => void;
  depth?: number;
}

export default function BubbleQuestion({
  question,
  answers,
  onAnswer,
  depth = 0,
}: BubbleQuestionProps) {
  const [customText, setCustomText] = useState('');
  const currentValue = answers[question.id];

  if (question.type === 'text') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${depth > 0 ? 'ml-6 mt-3' : ''}`}
      >
        <h3 className={`font-medium mb-3 ${depth > 0 ? 'text-sm text-gray-600' : 'text-lg text-gray-800'}`}>
          {question.title}
        </h3>
        <textarea
          value={(currentValue as string) || ''}
          onChange={(e) => onAnswer(question.id, e.target.value)}
          placeholder="写下你的想法……"
          className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none resize-none transition-all"
          rows={3}
        />
      </motion.div>
    );
  }

  const isMulti = question.type === 'multi';
  const selectedValues: string[] = isMulti
    ? (Array.isArray(currentValue) ? currentValue : [])
    : [];
  const selectedSingle = !isMulti ? (currentValue as string) : '';

  const handleSelect = (optionId: string) => {
    if (isMulti) {
      const current = [...selectedValues];
      const idx = current.indexOf(optionId);
      if (idx >= 0) {
        current.splice(idx, 1);
      } else if (!question.maxSelections || current.length < question.maxSelections) {
        current.push(optionId);
      }
      onAnswer(question.id, current);
    } else {
      onAnswer(question.id, optionId === selectedSingle ? '' : optionId);
    }
  };

  const isSelected = (optionId: string) =>
    isMulti ? selectedValues.includes(optionId) : selectedSingle === optionId;

  // Find children to show (from the selected option)
  const activeOption = question.options?.find((o) => isSelected(o.id) && o.children?.length);

  return (
    <div className={`${depth > 0 ? 'ml-6 mt-3' : ''}`}>
      <h3 className={`font-medium mb-3 ${depth > 0 ? 'text-sm text-gray-600' : 'text-lg text-gray-800'}`}>
        {question.title}
        {isMulti && question.maxSelections && (
          <span className="text-sm text-gray-400 font-normal ml-2">
            （最多选 {question.maxSelections} 个，已选 {selectedValues.length}）
          </span>
        )}
      </h3>

      <div className="flex flex-wrap gap-2">
        {question.options?.map((option) => (
          <motion.button
            key={option.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleSelect(option.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
              isSelected(option.id)
                ? 'bg-indigo-500 text-white border-indigo-500 shadow-md'
                : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
            }`}
          >
            {option.label}
          </motion.button>
        ))}
      </div>

      {/* Custom text input for options with allowCustomText */}
      {question.options?.some((o) => isSelected(o.id) && o.allowCustomText) && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2">
          <input
            type="text"
            value={customText}
            onChange={(e) => {
              setCustomText(e.target.value);
              onAnswer(`${question.id}_custom`, e.target.value);
            }}
            placeholder="补充说明……"
            className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none"
          />
        </motion.div>
      )}

      {/* Recursive children rendering */}
      <AnimatePresence>
        {activeOption?.children?.map((childQ) => (
          <motion.div
            key={childQ.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <BubbleQuestion
              question={childQ}
              answers={answers}
              onAnswer={onAnswer}
              depth={depth + 1}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
