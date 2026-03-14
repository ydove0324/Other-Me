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
      draft: { text: "草稿", cls: "bg-monet-haze/20 text-monet-haze" },
      generating: { text: "生成中", cls: "bg-monet-sage/20 text-monet-sage" },
      completed: { text: "已完成", cls: "bg-monet-lotus/20 text-monet-lotus" },
      failed: { text: "失败", cls: "bg-red-50 text-red-500" },
    };
    return map[status] || map.draft;
  };

  return (
    <div className="min-h-screen bg-canvas bg-gradient-to-b from-[#f0eec8] via-[#e8e8dc] to-[#dde8e0]">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur border-b border-monet-haze/20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-monet-leaf font-serif">另一个我</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/onboarding?redo=true")}
              className="text-sm text-monet-haze hover:text-monet-leaf transition-colors font-serif"
            >
              重做测试
            </button>
            <button
              onClick={() => navigate("/profile")}
              className="flex items-center gap-2 group"
            >
              <span className="text-sm text-monet-haze group-hover:text-monet-leaf transition-colors font-serif">
                {user?.display_name}
              </span>
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt=""
                  className="w-8 h-8 rounded-full ring-2 ring-transparent group-hover:ring-monet-sage transition-all"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-monet-sage to-monet-lotus flex items-center justify-center ring-2 ring-transparent group-hover:ring-monet-sage transition-all">
                  <span className="text-white text-xs font-serif font-bold">
                    {user?.display_name?.[0]?.toUpperCase() ?? "?"}
                  </span>
                </div>
              )}
            </button>
            <button
              onClick={() => { logout(); navigate("/"); }}
              className="text-sm text-monet-haze hover:text-monet-leaf font-serif"
            >
              退出
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-serif text-2xl font-bold text-monet-leaf">你的人生分岔点</h2>
            <p className="font-serif text-monet-haze mt-1">每一个分岔点，都是另一种可能</p>
          </div>
          <button
            onClick={() => navigate("/create-fork")}
            className="bg-monet-sage text-white px-6 py-3 rounded-full font-medium hover:bg-monet-sage/90 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-monet font-serif"
          >
            + 创建新的分岔点
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-monet-haze/30 border-t-monet-sage" />
          </div>
        ) : forkPoints.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-6 opacity-30">🔀</div>
            <h3 className="font-serif text-xl font-semibold text-monet-haze mb-2">还没有分岔点</h3>
            <p className="font-serif text-monet-haze/80 mb-8">
              想想看，人生中哪个时刻你做了一个关键选择？<br />
              如果当初走了另一条路，会怎样？
            </p>
            <button
              onClick={() => navigate("/create-fork")}
              className="bg-monet-sage text-white px-8 py-3 rounded-full font-medium hover:bg-monet-sage/90 transition-all shadow-monet font-serif"
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
                  onClick={() => navigate(`/life/${fp.id}`)}
                  className="bg-white/80 border border-monet-haze/20 rounded-2xl p-6 hover:shadow-monet hover:border-monet-sage/40 transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-serif text-lg font-semibold text-monet-leaf group-hover:text-monet-sage transition-colors">
                          {fp.title}
                        </h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${status.cls}`}>
                          {status.text}
                        </span>
                      </div>
                      {fp.happened_at && (
                        <p className="text-sm text-monet-haze mb-2 font-serif">{fp.happened_at}</p>
                      )}
                      <div className="flex gap-4 text-sm text-monet-haze mt-3 font-serif">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-monet-sage" />
                          实际: {fp.actual_choice.slice(0, 30)}
                          {fp.actual_choice.length > 30 ? "..." : ""}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-monet-lotus" />
                          假如: {fp.alternative_choice.slice(0, 30)}
                          {fp.alternative_choice.length > 30 ? "..." : ""}
                        </span>
                      </div>
                    </div>
                    <span className="text-monet-haze group-hover:text-monet-sage transition-colors text-xl">
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
