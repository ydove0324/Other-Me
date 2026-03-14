import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { QuizQuestion, QuizOption } from '../../config/quizConfig';

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
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const currentValue = answers[question.id];

  if (question.type === 'text') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${depth > 0 ? 'ml-6 mt-3' : ''}`}
      >
        <h3 className={`font-serif font-medium mb-3 ${depth > 0 ? 'text-sm text-monet-haze' : 'text-lg text-monet-leaf'}`}>
          {question.title}
        </h3>
        <textarea
          value={(currentValue as string) || ''}
          onChange={(e) => onAnswer(question.id, e.target.value)}
          placeholder="写下你的想法……"
          className="w-full p-3 border border-monet-haze/40 rounded-2xl focus:ring-2 focus:ring-monet-sage/50 focus:border-monet-sage outline-none resize-none transition-all bg-white/60 placeholder:text-monet-haze/60 font-serif"
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

  const handleSelect = (option: QuizOption) => {
    const optionId = option.id;

    // If this is a custom input option, just toggle selection; the text box handles the value
    if (isMulti) {
      const current = [...selectedValues];
      const idx = current.indexOf(optionId);
      if (idx >= 0) {
        current.splice(idx, 1);
        // Clear custom input when deselected
        if (option.isCustomInput) {
          setCustomInputs((prev) => {
            const next = { ...prev };
            delete next[optionId];
            return next;
          });
          onAnswer(`${question.id}_custom_${optionId}`, '');
        }
      } else if (!question.maxSelections || current.length < question.maxSelections) {
        current.push(optionId);
      }
      onAnswer(question.id, current);
    } else {
      const newVal = optionId === selectedSingle ? '' : optionId;
      onAnswer(question.id, newVal);
      // Clear custom input when deselected
      if (!newVal && option.isCustomInput) {
        setCustomInputs((prev) => {
          const next = { ...prev };
          delete next[optionId];
          return next;
        });
        onAnswer(`${question.id}_custom_${optionId}`, '');
      }
    }
  };

  const isSelected = (optionId: string) =>
    isMulti ? selectedValues.includes(optionId) : selectedSingle === optionId;

  // Filter options by showIf condition (cross-section)
  const visibleOptions = question.options?.filter((opt) => {
    if (!opt.showIf) return true;
    const depVal = answers[opt.showIf.questionId];
    if (!depVal) return false;
    return Array.isArray(depVal)
      ? depVal.some((v) => opt.showIf!.values.includes(v))
      : opt.showIf.values.includes(depVal as string);
  });

  // Collect all selected options that have children (for multi-select, multiple can be active)
  const activeOptions = isMulti
    ? visibleOptions?.filter((o) => isSelected(o.id) && o.children?.length) || []
    : (() => {
        const opt = visibleOptions?.find((o) => isSelected(o.id) && o.children?.length);
        return opt ? [opt] : [];
      })();

  // Collect all selected options that are custom input
  const activeCustomOptions = visibleOptions?.filter(
    (o) => isSelected(o.id) && o.isCustomInput
  ) || [];

  return (
    <div className={`${depth > 0 ? 'ml-6 mt-3' : ''}`}>
      <h3 className={`font-serif font-medium mb-3 ${depth > 0 ? 'text-sm text-monet-haze' : 'text-lg text-monet-leaf'}`}>
        {question.title}
        {isMulti && question.maxSelections && (
          <span className="text-sm text-monet-haze font-normal ml-2">
            （{question.minSelections ? `选 ${question.minSelections}-${question.maxSelections} 个` : `最多选 ${question.maxSelections} 个`}，已选 {selectedValues.length}）
          </span>
        )}
      </h3>

      <div className="flex flex-wrap justify-center gap-4">
        {visibleOptions?.map((option) => {
          const selected = isSelected(option.id);
          return (
            <motion.button
              key={option.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleSelect(option)}
              className={`relative flex items-center justify-center rounded-full text-sm font-medium transition-all font-serif
                w-28 h-28 md:w-32 md:h-32
                ${
                  selected
                    ? 'bg-black text-white shadow-monet-lg border-2 border-monet-sage'
                    : 'bg-white/70 text-monet-leaf border border-monet-haze/40 hover:border-monet-sage/70'
                }`}
              style={
                selected
                  ? {
                      boxShadow:
                        '0 0 0 1px rgba(0,0,0,0.8), 0 0 35px rgba(128,210,175,0.6)',
                    }
                  : {
                      backgroundImage:
                        'radial-gradient(circle at 30% 20%, rgba(128,210,175,0.2), transparent 55%), radial-gradient(circle at 70% 80%, rgba(221,137,196,0.16), transparent 55%)',
                    }
              }
            >
              <span className="text-center px-3 leading-relaxed">{option.label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Custom input text boxes for isCustomInput options */}
      <AnimatePresence>
        {activeCustomOptions.map((option) => (
          <motion.div
            key={`custom-${option.id}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3"
          >
            <input
              type="text"
              value={customInputs[option.id] || ''}
              onChange={(e) => {
                setCustomInputs((prev) => ({ ...prev, [option.id]: e.target.value }));
                onAnswer(`${question.id}_custom_${option.id}`, e.target.value);
              }}
              placeholder="输入你的答案……"
              className="w-full p-2.5 text-sm border border-monet-haze/40 rounded-xl focus:ring-2 focus:ring-monet-sage/50 focus:border-monet-sage outline-none bg-white/60 placeholder:text-monet-haze/60 font-serif"
            />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Legacy: custom text for allowCustomText options */}
      {visibleOptions?.some((o) => isSelected(o.id) && o.allowCustomText) && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2">
          <input
            type="text"
            value={customInputs['__legacy'] || ''}
            onChange={(e) => {
              setCustomInputs((prev) => ({ ...prev, __legacy: e.target.value }));
              onAnswer(`${question.id}_custom`, e.target.value);
            }}
            placeholder="补充说明……"
            className="w-full p-2.5 text-sm border border-monet-haze/40 rounded-xl focus:ring-2 focus:ring-monet-sage/50 focus:border-monet-sage outline-none bg-white/60 placeholder:text-monet-haze/60 font-serif"
          />
        </motion.div>
      )}

      {/* Recursive children rendering — supports multi-select with multiple expanded */}
      <AnimatePresence>
        {activeOptions.map((opt) =>
          opt.children?.map((childQ) => (
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
          ))
        )}
      </AnimatePresence>
    </div>
  );
}
