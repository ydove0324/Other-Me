import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useEffect } from "react";

export default function Landing() {
  const { isAuthenticated, user, loginWithGoogle, loading } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      navigate(user.onboarding_completed ? "/dashboard" : "/onboarding");
    }
  }, [isAuthenticated, user, loading, navigate]);

  return (
    <div className="min-h-screen bg-canvas flex flex-col bg-gradient-to-b from-[#f0eec8] via-[#e8e8dc] to-[#dde8e0]">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-serif text-5xl md:text-6xl font-bold tracking-tight text-monet-leaf mb-6">
            另一个
            <span className="bg-gradient-to-r from-monet-cobalt to-monet-sage bg-clip-text text-transparent">
              我
            </span>
          </h1>
          <p className="font-serif text-xl md:text-2xl text-monet-haze font-light mb-4">
            与未选择的自己重逢
          </p>
          <p className="font-serif text-base text-monet-haze/80 max-w-lg mx-auto mb-12 leading-relaxed">
            你有没有想过，那个没考公、没回老家、没分手的自己，现在正过着怎样的人生？
            <br />
            设定一个人生分岔点，AI 帮你看见那条未走的路。
          </p>

          <button
            onClick={loginWithGoogle}
            className="inline-flex items-center gap-3 bg-monet-sage/90 text-white px-8 py-4 rounded-full text-lg font-medium hover:bg-monet-sage transition-all hover:scale-[1.02] active:scale-[0.98] shadow-monet hover:shadow-monet-lg"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            使用 Google 账号登录
          </button>
        </div>
      </div>

      {/* Bottom */}
      <div className="text-center pb-8 text-sm text-monet-haze/70 font-serif">
        另一个我，不是用来羡慕的，是用来拥抱的。
      </div>
    </div>
  );
}
