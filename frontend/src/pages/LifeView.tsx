import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import type { ApiResponse, ForkPoint, AlternativeLife, TimelineEvent } from "../types";

export default function LifeView() {
  const { forkPointId } = useParams<{ forkPointId: string }>();
  const navigate = useNavigate();

  const [forkPoint, setForkPoint] = useState<ForkPoint | null>(null);
  const [life, setLife] = useState<AlternativeLife | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [loadingFp, setLoadingFp] = useState(true);
  const [loadingLife, setLoadingLife] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!forkPointId) return;
    (async () => {
      try {
        const { data } = await api.get<ApiResponse<ForkPoint>>(`/fork-points/${forkPointId}`);
        if (data.code === 0 && data.data) {
          setForkPoint(data.data);
          if (data.data.status === "completed") {
            loadLife();
          }
        }
      } catch {
        setError("加载分岔点失败");
      } finally {
        setLoadingFp(false);
      }
    })();
  }, [forkPointId]);

  const loadLife = async () => {
    setLoadingLife(true);
    try {
      const { data } = await api.get<ApiResponse<AlternativeLife>>(`/fork-points/${forkPointId}/life`);
      if (data.code === 0 && data.data) {
        setLife(data.data);
      }
    } catch {
      // no life generated yet
    } finally {
      setLoadingLife(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const { data } = await api.post<ApiResponse<AlternativeLife>>(`/fork-points/${forkPointId}/generate`);
      if (data.code === 0 && data.data) {
        setLife(data.data);
        setForkPoint((fp) => fp ? { ...fp, status: "completed" } : fp);
      } else {
        setError(data.message || "生成失败");
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || "生成失败，请重试");
    } finally {
      setGenerating(false);
    }
  };

  const handleEventClick = async (event: TimelineEvent) => {
    setSelectedEvent(event);
    if (event.detailed_narrative) return;

    if (!life) return;
    setLoadingDetail(true);
    try {
      const { data } = await api.get<ApiResponse<TimelineEvent>>(
        `/lives/${life.id}/events/${event.id}`
      );
      if (data.code === 0 && data.data) {
        setSelectedEvent(data.data);
        setLife((prev) =>
          prev
            ? {
                ...prev,
                events: prev.events.map((e) =>
                  e.id === data.data.id ? data.data : e
                ),
              }
            : prev
        );
      }
    } catch {
      // failed to load detail
    } finally {
      setLoadingDetail(false);
    }
  };

  if (loadingFp) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-900" />
      </div>
    );
  }

  if (!forkPoint) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">分岔点不存在</p>
          <button onClick={() => navigate("/dashboard")} className="text-brand-600 hover:underline">
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 sticky top-0 bg-white/80 backdrop-blur-sm z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ← 返回
          </button>
          <h1 className="text-lg font-semibold text-gray-900">{forkPoint.title}</h1>
          <div className="w-12" />
        </div>
      </header>

      {/* If not generated yet */}
      {!life && !generating && !loadingLife && (
        <div className="max-w-2xl mx-auto px-6 py-20 text-center">
          <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-100 rounded-2xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{forkPoint.title}</h2>
            {forkPoint.happened_at && (
              <p className="text-sm text-gray-400 mb-4">{forkPoint.happened_at}</p>
            )}
            {forkPoint.description && (
              <p className="text-gray-500 mb-6">{forkPoint.description}</p>
            )}
            <div className="grid grid-cols-2 gap-4 text-left">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">你实际的选择</p>
                <p className="text-gray-700">{forkPoint.actual_choice}</p>
              </div>
              <div className="bg-brand-50 border border-brand-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-brand-400 uppercase mb-2">未走的那条路</p>
                <p className="text-gray-700">{forkPoint.alternative_choice}</p>
              </div>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          <button
            onClick={handleGenerate}
            className="bg-gray-900 text-white px-10 py-4 rounded-full text-lg font-medium hover:bg-gray-800 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-gray-900/20"
          >
            探索另一种人生
          </button>
          <p className="text-sm text-gray-300 mt-4">AI 将基于你的画像生成一段平行人生</p>
        </div>
      )}

      {/* Generating */}
      {generating && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-300 border-t-gray-900 mb-6" />
          <p className="text-xl text-gray-600">正在构建你的平行人生...</p>
          <p className="text-gray-300 mt-2">AI 正在想象那条未走的路，请稍候</p>
        </div>
      )}

      {/* Loading life */}
      {loadingLife && (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-900" />
        </div>
      )}

      {/* Life timeline */}
      {life && (
        <div className="max-w-6xl mx-auto px-6 py-8">
          {life.overview && (
            <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-100 rounded-2xl p-6 mb-10">
              <p className="text-gray-600 text-lg font-serif italic">"{life.overview}"</p>
            </div>
          )}

          <div className="flex gap-8">
            {/* Timeline */}
            <div className="w-80 flex-shrink-0">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                时间线
              </h3>
              <div className="relative">
                <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-200" />
                <div className="space-y-1">
                  {life.events.map((event) => {
                    const isActive = selectedEvent?.id === event.id;
                    return (
                      <button
                        key={event.id}
                        onClick={() => handleEventClick(event)}
                        className={`relative w-full text-left pl-8 pr-3 py-3 rounded-xl transition-all ${
                          isActive
                            ? "bg-gray-900 text-white"
                            : "hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        <div
                          className={`absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 ${
                            isActive
                              ? "bg-white border-white"
                              : event.detailed_narrative
                                ? "bg-gray-900 border-gray-900"
                                : "bg-white border-gray-300"
                          }`}
                        />
                        <p className={`text-xs ${isActive ? "text-gray-300" : "text-gray-400"}`}>
                          {event.event_date || ""}
                        </p>
                        <p className={`text-sm font-medium ${isActive ? "text-white" : "text-gray-800"}`}>
                          {event.title}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Detail panel */}
            <div className="flex-1 min-w-0">
              {!selectedEvent ? (
                <div className="flex items-center justify-center h-64 text-gray-300">
                  <p>← 点击左侧时间线事件查看详情</p>
                </div>
              ) : (
                <div className="bg-white">
                  <div className="mb-6">
                    <p className="text-sm text-gray-400 mb-1">{selectedEvent.event_date || ""}</p>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">{selectedEvent.title}</h2>
                    <p className="text-gray-500 leading-relaxed">{selectedEvent.summary}</p>
                    {selectedEvent.emotional_tone && (
                      <div className="flex gap-2 mt-3">
                        {selectedEvent.emotional_tone.primary && (
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded-full">
                            {selectedEvent.emotional_tone.primary}
                          </span>
                        )}
                        {selectedEvent.emotional_tone.secondary && (
                          <span className="text-xs px-2 py-1 bg-gray-50 text-gray-400 rounded-full">
                            {selectedEvent.emotional_tone.secondary}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-gray-100 pt-6">
                    {loadingDetail ? (
                      <div className="flex items-center gap-3 py-8">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-gray-900" />
                        <span className="text-gray-400">AI 正在为你展开这段故事...</span>
                      </div>
                    ) : selectedEvent.detailed_narrative ? (
                      <div className="prose prose-gray max-w-none">
                        <div className="font-serif text-gray-700 leading-relaxed whitespace-pre-wrap text-[15px]">
                          {selectedEvent.detailed_narrative}
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEventClick(selectedEvent)}
                        className="text-brand-600 hover:underline text-sm"
                      >
                        展开详细叙事 →
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
