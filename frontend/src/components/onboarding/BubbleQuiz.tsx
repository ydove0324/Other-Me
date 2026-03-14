import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { quizConfig } from '../../config/quizConfig';
import BubbleQuestion from './BubbleQuestion';
import api from '../../services/api';

interface BubbleQuizProps {
  onComplete: () => void;
}

export default function BubbleQuiz({ onComplete }: BubbleQuizProps) {
  const [currentSection, setCurrentSection] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const section = quizConfig[currentSection];
  const totalSections = quizConfig.length;
  const progress = ((currentSection + 1) / totalSections) * 100;

  const handleAnswer = (questionId: string, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  /** Check if a question should be shown based on showIf condition (cross-section) */
  const shouldShowQuestion = (q: { showIf?: { questionId: string; values: string[] } }) => {
    if (!q.showIf) return true;
    const depValue = answers[q.showIf.questionId];
    if (!depValue) return false;
    return Array.isArray(depValue)
      ? depValue.some((v) => q.showIf!.values.includes(v))
      : q.showIf.values.includes(depValue as string);
  };

  const getVisibleQuestions = () => {
    return section.questions.filter((q) => shouldShowQuestion(q));
  };

  const isSectionComplete = () => {
    // Skippable sections are never blocking
    if (section.skippable) return true;

    return getVisibleQuestions()
      .filter((q) => q.required)
      .every((q) => {
        const val = answers[q.id];
        if (!val) return false;
        if (Array.isArray(val)) {
          const min = q.minSelections || 1;
          return val.length >= min;
        }
        return (val as string).length > 0;
      });
  };

  const handleNext = async () => {
    if (currentSection < totalSections - 1) {
      setCurrentSection((s) => s + 1);
      return;
    }

    // Last section — submit
    setSubmitting(true);
    setError('');
    try {
      // Update display_name if nickname was provided
      const nickname = answers['nickname'] as string;
      if (nickname) {
        await api.patch('/profile/display-name', { display_name: nickname });
      }

      await api.post('/profile/quiz-answers', { answers });
      onComplete();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '提交失败，请重试';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrev = () => {
    if (currentSection > 0) {
      setCurrentSection((s) => s - 1);
    }
  };

  const handleSkipSection = () => {
    if (currentSection < totalSections - 1) {
      setCurrentSection((s) => s + 1);
    }
  };

  const isLastSection = currentSection === totalSections - 1;

  return (
    <div className="max-w-2xl mx-auto px-4">
      {/* Progress bar + Skip (top) for skippable sections */}
      <div className="mb-8">
        <div className="flex justify-between items-center text-sm text-monet-haze mb-2 font-serif">
          <span>{section.title}</span>
          <span className="flex items-center gap-3">
            {section.skippable && (
              section.id === 'daily_texture' ? (
                <button
                  onClick={handleSkipSection}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 border-monet-haze/50 text-monet-haze hover:border-monet-cobalt hover:text-monet-cobalt transition-colors"
                >
                  轻松可选，随意作答 · 跳过本部分
                </button>
              ) : (
                <button
                  onClick={handleSkipSection}
                  className="text-monet-haze hover:text-monet-cobalt transition-colors"
                >
                  跳过本部分
                </button>
              )
            )}
            <span>{currentSection + 1} / {totalSections}</span>
          </span>
        </div>
        <div className="h-2 bg-monet-haze/20 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-monet-sage rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      {/* Section content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={section.id}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.3 }}
        >
          {section.subtitle && section.id !== 'daily_texture' && (
            <p className="text-monet-haze mb-6 font-serif">{section.subtitle}</p>
          )}

          <div className="space-y-8">
            {getVisibleQuestions().map((question) => (
              <BubbleQuestion
                key={question.id}
                question={question}
                answers={answers}
                onAnswer={handleAnswer}
              />
            ))}
          </div>

          {/* "但……因为人不是被标签定义的" after self_labels */}
          {section.id === 'daily_texture' && answers['self_labels'] && (Array.isArray(answers['self_labels']) ? (answers['self_labels'] as string[]).length > 0 : false) && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 text-sm text-monet-haze italic font-serif text-center"
            >
              但……人不是被标签定义的，你大概率有自己的复杂。
            </motion.p>
          )}
        </motion.div>
      </AnimatePresence>

      {error && (
        <p className="mt-4 text-red-500 text-sm">{error}</p>
      )}

      {/* Navigation */}
      <div className="flex justify-between items-center mt-10">
        <button
          onClick={handlePrev}
          disabled={currentSection === 0}
          className="px-6 py-2.5 text-monet-haze hover:text-monet-leaf disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-serif"
        >
          &larr; 上一步
        </button>

        <div className="flex gap-3">
          <button
            onClick={handleNext}
            disabled={!isSectionComplete() || submitting}
            className="px-8 py-2.5 bg-monet-sage text-white rounded-full font-medium hover:bg-monet-sage/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-monet hover:shadow-monet-lg font-serif"
          >
            {submitting
              ? '齿轮转动中..'
              : isLastSection
                ? '准备好啦，和另一个我相遇吧'
                : '下一步 \u2192'}
          </button>
        </div>
      </div>
    </div>
  );
}
