import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const handleOAuthCallback = useAuthStore((s) => s.handleOAuthCallback);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const accessToken = searchParams.get("access_token");
    const refreshToken = searchParams.get("refresh_token");
    const err = searchParams.get("error");

    if (err) {
      setError(err);
      return;
    }

    if (accessToken && refreshToken) {
      handleOAuthCallback(accessToken, refreshToken).then(() => {
        navigate("/onboarding", { replace: true });
      });
    } else {
      setError("缺少认证信息");
    }
  }, [searchParams, handleOAuthCallback, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">登录失败: {error}</p>
          <button
            onClick={() => navigate("/")}
            className="text-brand-600 hover:underline"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-900 mx-auto mb-4" />
        <p className="text-gray-500">正在登录...</p>
      </div>
    </div>
  );
}
