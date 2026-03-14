import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import api from "../services/api";
import type { ApiResponse, ForkPoint } from "../types";

export default function Dashboard() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [forkPoints, setForkPoints] = useState<ForkPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<ApiResponse<ForkPoint[]>>("/fork-points");
        if (data.code === 0 && data.data) {
          setForkPoints(data.data);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const getStatusLabel = (status: string) => {
    const map: Record<string, { text: string; cls: string }> = {
      draft: { text: "草稿", cls: "bg-gray-100 text-gray-500" },
      generating: { text: "生成中", cls: "bg-amber-50 text-amber-600" },
      completed: { text: "已完成", cls: "bg-green-50 text-green-600" },
      failed: { text: "失败", cls: "bg-red-50 text-red-500" },
    };
    return map[status] || map.draft;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">另一个我</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">{user?.display_name}</span>
            {user?.avatar_url && (
              <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full" />
            )}
            <button
              onClick={() => { logout(); navigate("/"); }}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              退出
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">你的人生分岔点</h2>
            <p className="text-gray-400 mt-1">每一个分岔点，都是另一种可能</p>
          </div>
          <button
            onClick={() => navigate("/create-fork")}
            className="bg-gray-900 text-white px-6 py-3 rounded-full font-medium hover:bg-gray-800 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            + 创建新的分岔点
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-900" />
          </div>
        ) : forkPoints.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-6 opacity-20">🔀</div>
            <h3 className="text-xl font-semibold text-gray-400 mb-2">还没有分岔点</h3>
            <p className="text-gray-300 mb-8">
              想想看，人生中哪个时刻你做了一个关键选择？<br />
              如果当初走了另一条路，会怎样？
            </p>
            <button
              onClick={() => navigate("/create-fork")}
              className="bg-gray-900 text-white px-8 py-3 rounded-full font-medium hover:bg-gray-800 transition-all"
            >
              创建第一个分岔点
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {forkPoints.map((fp) => {
              const status = getStatusLabel(fp.status);
              return (
                <div
                  key={fp.id}
                  onClick={() => navigate(`/story/${fp.id}`)}
                  className="bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-brand-600 transition-colors">
                          {fp.title}
                        </h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${status.cls}`}>
                          {status.text}
                        </span>
                      </div>
                      {fp.happened_at && (
                        <p className="text-sm text-gray-400 mb-2">{fp.happened_at}</p>
                      )}
                      <div className="flex gap-4 text-sm text-gray-500 mt-3">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-gray-300" />
                          实际: {fp.actual_choice.slice(0, 30)}
                          {fp.actual_choice.length > 30 ? "..." : ""}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-brand-300" />
                          假如: {fp.alternative_choice.slice(0, 30)}
                          {fp.alternative_choice.length > 30 ? "..." : ""}
                        </span>
                      </div>
                    </div>
                    <span className="text-gray-300 group-hover:text-gray-500 transition-colors text-xl">
                      →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
