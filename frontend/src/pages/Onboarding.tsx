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
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      {/* Blurred oil painting background */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-no-repeat blur-sm transform-gpu scale-105"
        style={{
          backgroundImage: "url('/onboarding-sunrise.png')",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
          backgroundPosition: "left center",
        }}
      />

      <div className="relative flex-1 flex items-center justify-center px-4 py-10">
        <div
          className="relative w-full max-w-3xl rounded-[32px] shadow-monet-lg border border-white/20"
          style={{
            backgroundColor: "#F7F1E8",
          }}
        >
          {/* Header */}
          <div className="px-8 pt-7 pb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-monet-leaf/80 font-serif tracking-wide">
              {isRedo ? "重新认识你" : "认识你"}
            </h2>
            {isRedo && (
              <button
                onClick={() => navigate("/dashboard")}
                className="text-sm text-monet-haze hover:text-monet-cobalt transition-colors font-serif"
              >
                ← 返回
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="h-px mx-8 bg-gradient-to-r from-transparent via-monet-haze/30 to-transparent" />

          {/* Content */}
          <div className="px-6 md:px-8 pb-8 pt-6">
            <BubbleQuiz onComplete={handleQuizComplete} />
          </div>
        </div>
      </div>
    </div>
  );
}
