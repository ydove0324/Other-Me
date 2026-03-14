import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import BubbleQuiz from "../components/onboarding/BubbleQuiz";
import ForkPointInput from "../components/onboarding/ForkPointInput";
import StoryView from "./StoryView";
import api from "../services/api";

const STEPS = ["认识你", "人生岔路", "另一个我"];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [forkPointId, setForkPointId] = useState<number | null>(null);
  const navigate = useNavigate();
  const { user, fetchMe } = useAuthStore();

  useEffect(() => {
    if (user?.onboarding_completed) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  const handleQuizComplete = () => {
    setStep(1);
  };

  const handleForkPointComplete = (id: number) => {
    setForkPointId(id);
    setStep(2);
  };

  const handleStoryComplete = async () => {
    try {
      await api.post("/profile/complete-onboarding");
      await fetchMe();
      navigate("/dashboard", { replace: true });
    } catch {
      navigate("/dashboard", { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Progress */}
      <div className="border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-500">
              步骤 {step + 1} / {STEPS.length}
            </h2>
            <span className="text-sm text-gray-400">{STEPS[step]}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        {step === 0 && (
          <BubbleQuiz onComplete={handleQuizComplete} />
        )}
        {step === 1 && (
          <ForkPointInput onComplete={handleForkPointComplete} />
        )}
        {step === 2 && forkPointId && (
          <StoryView
            forkPointId={forkPointId}
            onComplete={handleStoryComplete}
            embedded
          />
        )}
      </div>
    </div>
  );
}
