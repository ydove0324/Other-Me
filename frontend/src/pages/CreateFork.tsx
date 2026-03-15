import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import type { ApiResponse, ForkPoint } from "../types";
import DatePickerRoller from "../components/DatePickerRoller";

export default function CreateFork() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    description: "",
    happened_at: "",
    actual_choice: "",
    alternative_choice: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!form.title || !form.actual_choice || !form.alternative_choice) {
      setError("请填写标题、实际选择和未走的路");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { data } = await api.post<ApiResponse<ForkPoint>>("/fork-points", {
        ...form,
        happened_at: form.happened_at || null,
      });
      if (data.code === 0 && data.data) {
        navigate(`/life/${data.data.id}`, { replace: true });
      } else {
        setError(data.message || "创建失败");
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || "创建失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas bg-gradient-to-b from-[#f0eec8] via-[#e8e8dc] to-[#dde8e0]">
      <header className="border-b border-monet-haze/20 bg-white/50">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-monet-haze hover:text-monet-leaf transition-colors font-serif"
          >
            ← 返回
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="font-serif text-3xl font-bold text-monet-leaf mb-2">创建人生分岔点</h1>
        <p className="font-serif text-monet-haze mb-10">回忆那个改变你人生轨迹的时刻</p>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-monet-leaf mb-2 font-serif">
              这个分岔点叫什么？
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="比如：25岁那年我没辞职"
              className="w-full px-4 py-3 border border-monet-haze/40 rounded-2xl focus:outline-none focus:ring-2 focus:ring-monet-sage/50 focus:border-monet-sage bg-white/60 placeholder:text-monet-haze/50 font-serif"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-monet-leaf mb-2 font-serif">
              大概是什么时候？
            </label>
            <DatePickerRoller
              value={form.happened_at}
              onChange={(v) => update("happened_at", v)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-monet-leaf mb-2 font-serif">
              当时发生了什么？（背景描述）
            </label>
            <p className="text-xs text-monet-haze mb-1 font-serif">建议输入 100 字以上</p>
            <textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="描述一下当时的情况、你面临的选择..."
              maxLength={300}
              rows={4}
              className="w-full px-4 py-3 border border-monet-haze/40 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-monet-sage/50 focus:border-monet-sage bg-white/60 placeholder:text-monet-haze/50 font-serif"
            />
            <p className="text-right text-xs text-monet-haze mt-1 font-serif">{form.description.length}/300</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-monet-leaf mb-2 font-serif">
                <span className="inline-block w-2 h-2 rounded-full bg-monet-sage mr-2" />
                你实际做的选择
              </label>
              <textarea
                value={form.actual_choice}
                onChange={(e) => update("actual_choice", e.target.value)}
                placeholder="比如：留在了那家公司"
                rows={3}
                className="w-full px-4 py-3 border border-monet-sage/50 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-monet-sage/50 focus:border-monet-sage bg-white/60 placeholder:text-monet-haze/50 font-serif"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-monet-lotus mb-2 font-serif">
                <span className="inline-block w-2 h-2 rounded-full bg-monet-lotus mr-2" />
                未走的那条路
              </label>
              <textarea
                value={form.alternative_choice}
                onChange={(e) => update("alternative_choice", e.target.value)}
                placeholder="比如：辞职去创业"
                rows={3}
                className="w-full px-4 py-3 border border-monet-lotus/50 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-monet-lotus/50 focus:border-monet-lotus bg-white/60 placeholder:text-monet-haze/50 font-serif"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <div className="flex justify-end pt-4">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="bg-monet-sage text-white px-8 py-3 rounded-full font-medium hover:bg-monet-sage/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-monet font-serif"
            >
              {saving ? "创建中..." : "创建分岔点"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
