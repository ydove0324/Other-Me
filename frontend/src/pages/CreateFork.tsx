import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import type { ApiResponse, ForkPoint } from "../types";

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
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ← 返回
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">创建人生分岔点</h1>
        <p className="text-gray-400 mb-10">回忆那个改变你人生轨迹的时刻</p>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              这个分岔点叫什么？
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="比如：25岁那年我没辞职"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              大概是什么时候？
            </label>
            <input
              type="date"
              value={form.happened_at}
              onChange={(e) => update("happened_at", e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              当时发生了什么？（背景描述）
            </label>
            <textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="描述一下当时的情况、你面临的选择..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <span className="inline-block w-2 h-2 rounded-full bg-gray-400 mr-2" />
                你实际做的选择
              </label>
              <textarea
                value={form.actual_choice}
                onChange={(e) => update("actual_choice", e.target.value)}
                placeholder="比如：留在了那家公司"
                rows={3}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <span className="inline-block w-2 h-2 rounded-full bg-brand-400 mr-2" />
                未走的那条路
              </label>
              <textarea
                value={form.alternative_choice}
                onChange={(e) => update("alternative_choice", e.target.value)}
                placeholder="比如：辞职去创业"
                rows={3}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
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
              className="bg-gray-900 text-white px-8 py-3 rounded-full font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {saving ? "创建中..." : "创建分岔点"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
