import { useState, useEffect } from "react";
import api from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import type { ApiResponse, Persona } from "../../types";

interface Props {
  onComplete: () => void;
  onBack: () => void;
}

export default function PersonaSummary({ onComplete, onBack }: Props) {
  const [persona, setPersona] = useState<Persona | null>(null);
  const [generating, setGenerating] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchMe = useAuthStore((s) => s.fetchMe);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<ApiResponse<Persona>>("/profile/persona");
        if (data.code === 0 && data.data) {
          setPersona(data.data);
        } else {
          generatePersona();
        }
      } catch {
        generatePersona();
      }
    })();
  }, []);

  const generatePersona = async () => {
    setGenerating(true);
    setError(null);
    try {
      const { data } = await api.post<ApiResponse<Persona>>("/profile/persona/generate");
      if (data.code === 0 && data.data) {
        setPersona(data.data);
      } else {
        setError(data.message || "生成失败");
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || "生成画像时出错，请重试");
    } finally {
      setGenerating(false);
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await api.post("/profile/complete-onboarding");
      await fetchMe();
      onComplete();
    } catch {
      // ignore
    } finally {
      setCompleting(false);
    }
  };

  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-300 border-t-gray-900 mb-6" />
        <p className="text-gray-500 text-lg">AI 正在分析你的画像...</p>
        <p className="text-gray-300 text-sm mt-2">这可能需要几秒钟</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={generatePersona}
          className="bg-gray-900 text-white px-6 py-2 rounded-full hover:bg-gray-800"
        >
          重新生成
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">这就是你</h1>
        <p className="text-gray-400">AI 根据你的选择生成的画像</p>
      </div>

      {persona && (
        <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-100 rounded-2xl p-6 mb-8">
          <p className="text-gray-700 leading-relaxed text-lg font-serif">
            {persona.persona_summary}
          </p>

          {persona.personality_traits && Array.isArray(persona.personality_traits) && (
            <div className="mt-6">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                性格特质
              </h4>
              <div className="flex flex-wrap gap-2">
                {(persona.personality_traits as string[]).map((trait, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-white border border-gray-200 rounded-full text-sm text-gray-600"
                  >
                    {trait}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between items-center pt-4">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          ← 重新答题
        </button>
        <div className="flex gap-3">
          <button
            onClick={generatePersona}
            className="px-6 py-3 border border-gray-200 rounded-full text-gray-600 hover:bg-gray-50 transition-all"
          >
            重新生成
          </button>
          <button
            onClick={handleComplete}
            disabled={completing}
            className="bg-gray-900 text-white px-8 py-3 rounded-full font-medium hover:bg-gray-800 disabled:opacity-40 transition-all"
          >
            {completing ? "完成中..." : "确认，开始探索 →"}
          </button>
        </div>
      </div>
    </div>
  );
}
