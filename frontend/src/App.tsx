import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import Landing from "./pages/Landing";
import AuthCallback from "./pages/AuthCallback";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import CreateFork from "./pages/CreateFork";
import LifeView from "./pages/LifeView";
import StoryView from "./pages/StoryView";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-900" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const fetchMe = useAuthStore((s) => s.fetchMe);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <Onboarding />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/create-fork"
        element={
          <ProtectedRoute>
            <CreateFork />
          </ProtectedRoute>
        }
      />
      <Route
        path="/life/:forkPointId"
        element={
          <ProtectedRoute>
            <LifeView />
          </ProtectedRoute>
        }
      />
      <Route
        path="/story/:forkPointId"
        element={
          <ProtectedRoute>
            <StoryView />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
