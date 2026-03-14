import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import api from "../services/api";
import { quizConfig } from "../config/quizConfig";
import type { ApiResponse, Persona, ForkPoint } from "../types";

// ── helpers ──────────────────────────────────────────────────────────────────

function getLabel(questionId: string, valueId: string): string {
  for (const section of quizConfig) {
    for (const question of section.questions) {
      if (question.id === questionId && question.options) {
        const opt = question.options.find((o) => o.id === valueId);
        if (opt) return opt.label;
      }
    }
  }
  return valueId;
}

function getSectionTitle(sectionId: string): string {
  return quizConfig.find((s) => s.id === sectionId)?.title ?? sectionId;
}

interface QuizDisplayItem {
  sectionId: string;
  sectionTitle: string;
  questionId: string;
  questionTitle: string;
  value: string | string[];
  isText?: boolean;
}

function buildQuizDisplay(persona: Persona): QuizDisplayItem[] {
  const items: QuizDisplayItem[] = [];

  const traits = persona.personality_traits as Record<string, unknown> | null;
  const values = persona.values as Record<string, unknown> | null;
  const ctx = persona.life_context as Record<string, unknown> | null;

  const mappings: Array<{ sectionId: string; questionId: string; key: string; isText?: boolean }> = [
    { sectionId: "personality", questionId: "personality_type", key: "type" },
    { sectionId: "personality", questionId: "decision_style", key: "decision_style" },
    { sectionId: "personality", questionId: "personality_traits", key: "traits" },
    { sectionId: "values", questionId: "life_priority", key: "life_priority" },
    { sectionId: "values", questionId: "career_attitude", key: "career_attitude" },
    { sectionId: "values", questionId: "relationship_style", key: "relationship_style" },
    { sectionId: "life_context", questionId: "age_range", key: "age" },
    { sectionId: "life_context", questionId: "current_mood", key: "mood" },
    { sectionId: "life_context", questionId: "life_wish", key: "wish", isText: true },
  ];

  for (const m of mappings) {
    const src = m.sectionId === "personality" ? traits : m.sectionId === "values" ? values : ctx;
    const raw = src?.[m.key];
    if (raw == null || raw === "") continue;

    const section = quizConfig.find((s) => s.id === m.sectionId);
    const question = section?.questions.find((q) => q.id === m.questionId);
    if (!question) continue;

    let displayValue: string | string[];
    if (Array.isArray(raw)) {
      displayValue = (raw as string[]).map((v) => getLabel(m.questionId, v));
    } else if (m.isText) {
      displayValue = String(raw);
    } else {
      displayValue = getLabel(m.questionId, String(raw));
    }

    items.push({
      sectionId: m.sectionId,
      sectionTitle: getSectionTitle(m.sectionId),
      questionId: m.questionId,
      questionTitle: question.title,
      value: displayValue,
      isText: m.isText,
    });
  }

  // passion_field (nested text under career_attitude)
  const passionField = values?.["passion_field"];
  if (passionField) {
    const insertIdx = items.findIndex((i) => i.questionId === "career_attitude") + 1;
    items.splice(insertIdx, 0, {
      sectionId: "values",
      sectionTitle: getSectionTitle("values"),
      questionId: "passion_field",
      questionTitle: "你热爱的领域是？",
      value: String(passionField),
      isText: true,
    });
  }

  return items;
}

const statusConfig: Record<string, { text: string; dot: string; badge: string }> = {
  draft: { text: "草稿", dot: "bg-monet-haze/60", badge: "bg-monet-haze/20 text-monet-haze" },
  generating: { text: "生成中", dot: "bg-monet-sage animate-pulse", badge: "bg-monet-sage/20 text-monet-sage" },
  completed: { text: "已完成", dot: "bg-monet-lotus", badge: "bg-monet-lotus/20 text-monet-lotus" },
  failed: { text: "失败", dot: "bg-red-400", badge: "bg-red-50 text-red-500" },
};

// ── component ─────────────────────────────────────────────────────────────────

export default function Profile() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const [persona, setPersona] = useState<Persona | null>(null);
  const [forkPoints, setForkPoints] = useState<ForkPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<"quiz" | "stories">("quiz");

  useEffect(() => {
    (async () => {
      try {
        const [personaRes, forkRes] = await Promise.all([
          api.get<ApiResponse<Persona>>("/profile/persona"),
          api.get<ApiResponse<ForkPoint[]>>("/fork-points"),
        ]);
        if (personaRes.data.code === 0 && personaRes.data.data) {
          setPersona(personaRes.data.data);
        }
        if (forkRes.data.code === 0 && forkRes.data.data) {
          setForkPoints(forkRes.data.data);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const quizItems = persona ? buildQuizDisplay(persona) : [];

  const sections = quizConfig
    .map((s) => ({
      id: s.id,
      title: s.title,
      items: quizItems.filter((i) => i.sectionId === s.id),
    }))
    .filter((s) => s.items.length > 0);

  const completedStories = forkPoints.filter((fp) => fp.status === "completed");
  const otherForks = forkPoints.filter((fp) => fp.status !== "completed");

  return (
    <div className="min-h-screen bg-canvas bg-gradient-to-b from-[#f0eec8] via-[#e8e8dc] to-[#dde8e0]">
      {/* Nav */}
      <header className="bg-white/70 backdrop-blur border-b border-monet-haze/20 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-1 text-monet-haze hover:text-monet-leaf transition-colors font-serif text-sm"
          >
            ← 返回
          </button>
          <h1 className="text-base font-bold text-monet-leaf font-serif">我的主页</h1>
          <button
            onClick={() => { logout(); navigate("/"); }}
            className="text-sm text-monet-haze hover:text-monet-leaf font-serif"
          >
            退出
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">

        {/* Avatar + name */}
        <div className="flex flex-col items-center gap-4 pt-2">
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.display_name}
              className="w-24 h-24 rounded-full ring-4 ring-white shadow-monet object-cover"
            />
          ) : (
            <div className="w-24 h-24 rounded-full ring-4 ring-white shadow-monet bg-gradient-to-br from-monet-sage to-monet-lotus flex items-center justify-center">
              <span className="text-white text-3xl font-serif font-bold">
                {user?.display_name?.[0]?.toUpperCase() ?? "?"}
              </span>
            </div>
          )}
          <div className="text-center">
            <h2 className="font-serif text-2xl font-bold text-monet-leaf">{user?.display_name}</h2>
            <p className="text-sm text-monet-haze mt-1 font-serif">{user?.email}</p>
          </div>
          {persona?.persona_summary && (
            <div className="bg-white/80 border border-monet-haze/20 rounded-2xl px-6 py-4 max-w-lg text-center">
              <p className="font-serif text-sm text-monet-leaf/80 leading-relaxed italic">
                "{persona.persona_summary}"
              </p>
            </div>
          )}
        </div>

        {/* New fork point CTA */}
        <div className="bg-gradient-to-r from-monet-sage/10 to-monet-lotus/10 border border-monet-sage/30 rounded-2xl p-5 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-serif font-semibold text-monet-leaf">开启新的分岔点</h3>
            <p className="font-serif text-sm text-monet-haze mt-0.5">如果当初走了另一条路，会怎样？</p>
          </div>
          <button
            onClick={() => navigate("/create-fork")}
            className="shrink-0 bg-monet-sage text-white px-5 py-2.5 rounded-full font-medium hover:bg-monet-sage/90 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-monet font-serif text-sm"
          >
            + 新建
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex gap-1 bg-white/60 p-1 rounded-full border border-monet-haze/20 w-fit">
          {(["quiz", "stories"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveSection(tab)}
              className={`px-5 py-1.5 rounded-full text-sm font-serif transition-all ${
                activeSection === tab
                  ? "bg-monet-sage text-white shadow-sm"
                  : "text-monet-haze hover:text-monet-leaf"
              }`}
            >
              {tab === "quiz"
                ? "关于我"
                : `我的故事${forkPoints.length > 0 ? `（${forkPoints.length}）` : ""}`}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-monet-haze/30 border-t-monet-sage" />
          </div>
        )}

        {/* Quiz answers */}
        {!loading && activeSection === "quiz" && (
          <div className="space-y-5">
            {sections.length === 0 ? (
              <div className="text-center py-16">
                <p className="font-serif text-monet-haze">还没有完成问卷</p>
              </div>
            ) : (
              sections.map((section) => (
                <div
                  key={section.id}
                  className="bg-white/80 border border-monet-haze/20 rounded-2xl p-6 space-y-5"
                >
                  <h3 className="font-serif font-semibold text-monet-leaf border-b border-monet-haze/10 pb-2">
                    {section.title}
                  </h3>
                  {section.items.map((item) => (
                    <div key={item.questionId}>
                      <p className="font-serif text-xs text-monet-haze mb-2">{item.questionTitle}</p>
                      {item.isText ? (
                        <p className="font-serif text-sm text-monet-leaf/90 bg-monet-haze/5 rounded-xl px-4 py-2.5 leading-relaxed">
                          {String(item.value)}
                        </p>
                      ) : Array.isArray(item.value) ? (
                        <div className="flex flex-wrap gap-2">
                          {item.value.map((v) => (
                            <span
                              key={v}
                              className="font-serif text-sm bg-monet-sage/10 text-monet-sage border border-monet-sage/20 px-3 py-1 rounded-full"
                            >
                              {v}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="inline-block font-serif text-sm bg-monet-lotus/10 text-monet-leaf border border-monet-lotus/20 px-4 py-1.5 rounded-full">
                          {String(item.value)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}

        {/* Stories */}
        {!loading && activeSection === "stories" && (
          <div className="space-y-4">
            {forkPoints.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <p className="text-4xl opacity-30">🔀</p>
                <p className="font-serif text-monet-haze">还没有分岔点</p>
                <button
                  onClick={() => navigate("/create-fork")}
                  className="font-serif text-sm text-monet-sage hover:underline"
                >
                  创建第一个 →
                </button>
              </div>
            ) : (
              <>
                {completedStories.length > 0 && (
                  <div className="space-y-3">
                    <p className="font-serif text-xs text-monet-haze uppercase tracking-wider pl-1">
                      已完成的故事
                    </p>
                    {completedStories.map((fp) => (
                      <ForkCard
                      key={fp.id}
                      fp={fp}
                      onTimeline={() => navigate(`/life/${fp.id}`)}
                      onStory={() => navigate(`/story/${fp.id}`)}
                    />
                    ))}
                  </div>
                )}
                {otherForks.length > 0 && (
                  <div className="space-y-3">
                    {completedStories.length > 0 && (
                      <p className="font-serif text-xs text-monet-haze uppercase tracking-wider pl-1">
                        其他分岔点
                      </p>
                    )}
                    {otherForks.map((fp) => (
                      <ForkCard
                      key={fp.id}
                      fp={fp}
                      onTimeline={() => navigate(`/life/${fp.id}`)}
                      onStory={() => navigate(`/story/${fp.id}`)}
                    />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function ForkCard({ fp, onTimeline, onStory }: { fp: ForkPoint; onTimeline: () => void; onStory: () => void }) {
  const s = statusConfig[fp.status] ?? statusConfig.draft;
  const hasAny = fp.has_timeline || fp.has_story;

  return (
    <div className="bg-white/80 border border-monet-haze/20 rounded-2xl p-5">
      {/* Title row */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
        <h4 className="font-serif font-semibold text-monet-leaf truncate flex-1">{fp.title}</h4>
        {!hasAny && (
          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${s.badge}`}>{s.text}</span>
        )}
      </div>

      {/* Meta */}
      {fp.happened_at && (
        <p className="font-serif text-xs text-monet-haze mb-2 pl-4">{fp.happened_at}</p>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-monet-haze font-serif pl-4 mb-4">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-monet-sage" />
          实际：{fp.actual_choice.slice(0, 28)}{fp.actual_choice.length > 28 ? "…" : ""}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-monet-lotus" />
          假如：{fp.alternative_choice.slice(0, 28)}{fp.alternative_choice.length > 28 ? "…" : ""}
        </span>
      </div>

      {/* Entry buttons */}
      {hasAny ? (
        <div className="flex gap-2">
          {fp.has_timeline && (
            <button
              onClick={onTimeline}
              className="flex items-center gap-1.5 text-xs font-serif px-3 py-1.5 rounded-full bg-monet-sage/10 text-monet-sage border border-monet-sage/20 hover:bg-monet-sage/20 transition-all"
            >
              <span>📅</span> 时间线
            </button>
          )}
          {fp.has_story && (
            <button
              onClick={onStory}
              className="flex items-center gap-1.5 text-xs font-serif px-3 py-1.5 rounded-full bg-monet-lotus/10 text-monet-leaf border border-monet-lotus/20 hover:bg-monet-lotus/20 transition-all"
            >
              <span>📖</span> 故事文章
            </button>
          )}
        </div>
      ) : (
        <p className="font-serif text-xs text-monet-haze/60 pl-4">暂未生成内容</p>
      )}
    </div>
  );
}
