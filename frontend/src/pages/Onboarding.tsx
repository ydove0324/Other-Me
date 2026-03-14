import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import BubbleQuiz from "../components/onboarding/BubbleQuiz";
import api from "../services/api";

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isRedo = searchParams.get("redo") === "true";
  const { user, fetchMe } = useAuthStore();

  useEffect(() => {
    if (user?.onboarding_completed && !isRedo) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate, isRedo]);

  const handleQuizComplete = async () => {
    try {
      if (!isRedo) {
        await api.post("/profile/complete-onboarding");
      }
      await fetchMe();
    } catch {
      // ignore
    }
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen bg-canvas bg-gradient-to-b from-[#f0eec8] via-[#e8e8dc] to-[#dde8e0]">
      {/* Header */}
      <div className="border-b border-monet-haze/20">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-monet-haze font-serif">
            {isRedo ? "重新认识你" : "认识你"}
          </h2>
          {isRedo && (
            <button
              onClick={() => navigate("/dashboard")}
              className="text-sm text-monet-haze hover:text-monet-leaf transition-colors font-serif"
            >
              ← 返回
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        <BubbleQuiz onComplete={handleQuizComplete} />
      </div>
    </div>
  );
}
