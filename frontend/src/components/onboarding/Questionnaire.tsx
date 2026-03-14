import { useState, useEffect } from "react";
import api from "../../services/api";
import type { ApiResponse, Question } from "../../types";

interface Props {
  onNext: () => void;
  onBack: () => void;
}

export default function Questionnaire({ onNext, onBack }: Props) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<ApiResponse<Question[]>>("/profile/questions");
        if (data.code === 0 && data.data) {
          setQuestions(data.data);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const q = questions[current];
  const isLast = current === questions.length - 1;

  const handleAnswer = (value: string) => {
    setAnswers((prev) => ({ ...prev, [q.id]: value }));
  };

  const handleNext = () => {
    if (isLast) {
      submitAll();
    } else {
      setCurrent((c) => c + 1);
    }
  };

  const submitAll = async () => {
    setSaving(true);
    try {
      const payload = Object.entries(answers).map(([qId, text]) => ({
        question_id: Number(qId),
        answer_text: text,
        answer_data: { selected: text },
      }));
      await api.post("/profile/answers", { answers: payload });
      onNext();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-900" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 mb-4">暂无问卷题目</p>
        <button onClick={onNext} className="text-brand-600 hover:underline">跳过</button>
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-8">
        <span className="text-sm text-gray-400">
          {current + 1} / {questions.length}
        </span>
      </div>

      <div className="max-w-xl mx-auto">
        <h2 className="text-2xl font-semibold text-gray-900 mb-8 leading-relaxed">
          {q.question_text}
        </h2>

        {q.question_type === "multiple_choice" && q.options?.choices && (
          <div className="space-y-3">
            {q.options.choices.map((choice, i) => {
              const isSelected = answers[q.id] === choice;
              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(choice)}
                  className={`w-full text-left px-5 py-4 rounded-xl transition-all ${
                    isSelected
                      ? "bg-gray-900 text-white"
                      : "bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200"
                  }`}
                >
                  {choice}
                </button>
              );
            })}
          </div>
        )}

        {q.question_type === "open_ended" && (
          <textarea
            value={answers[q.id] || ""}
            onChange={(e) => handleAnswer(e.target.value)}
            placeholder="说说你的想法..."
            className="w-full h-32 px-4 py-3 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-700"
          />
        )}

        <div className="flex justify-between items-center mt-10">
          <button
            onClick={current > 0 ? () => setCurrent((c) => c - 1) : onBack}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ← 上一步
          </button>
          <button
            onClick={handleNext}
            disabled={!answers[q.id] || saving}
            className="bg-gray-900 text-white px-8 py-3 rounded-full font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {saving ? "提交中..." : isLast ? "完成问卷" : "下一题 →"}
          </button>
        </div>
      </div>
    </div>
  );
}
