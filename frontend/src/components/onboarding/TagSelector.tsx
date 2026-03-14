import { useState, useEffect } from "react";
import api from "../../services/api";
import type { ApiResponse, TagCategory } from "../../types";

interface Props {
  onNext: () => void;
}

export default function TagSelector({ onNext }: Props) {
  const [categories, setCategories] = useState<TagCategory[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<ApiResponse<TagCategory[]>>("/profile/tags");
        if (data.code === 0 && data.data) {
          setCategories(data.data);
        }

        const { data: myTags } = await api.get<ApiResponse<{ id: number }[]>>("/profile/my-tags");
        if (myTags.code === 0 && myTags.data) {
          setSelected(new Set(myTags.data.map((t) => t.id)));
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleNext = async () => {
    setSaving(true);
    try {
      await api.post("/profile/tags", { tag_ids: Array.from(selected) });
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

  return (
    <div>
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">先来认识一下你</h1>
        <p className="text-gray-400">选择能描述你的标签，越完整越好</p>
      </div>

      {categories.map((cat) => (
        <div key={cat.id} className="mb-8">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            {cat.display_name}
          </h3>
          <div className="flex flex-wrap gap-2">
            {cat.tags.map((tag) => {
              const isSelected = selected.has(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => toggle(tag.id)}
                  className={`px-4 py-2 rounded-full text-sm transition-all ${
                    isSelected
                      ? "bg-gray-900 text-white shadow-md"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200"
                  }`}
                >
                  {tag.display_name}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex justify-between items-center mt-10 pt-6 border-t border-gray-100">
        <p className="text-sm text-gray-400">
          已选择 {selected.size} 个标签
        </p>
        <button
          onClick={handleNext}
          disabled={selected.size === 0 || saving}
          className="bg-gray-900 text-white px-8 py-3 rounded-full font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {saving ? "保存中..." : "下一步"}
        </button>
      </div>
    </div>
  );
}
