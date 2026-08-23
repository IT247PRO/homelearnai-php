import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ChildrenPage from './pages/ChildrenPage';
import ChildPage from './pages/ChildPage';
import ReviewPage from './pages/ReviewPage';
import AiCurriculumPage from './pages/AiCurriculumPage';
import ParentDashboardPage from './pages/ParentDashboardPage';
import KidsModeSettingsPage from './pages/KidsModeSettingsPage';
import KidsHomePage from './pages/KidsHomePage';
import KidsReviewPage from './pages/KidsReviewPage';
import KidsLessonPage from './pages/KidsLessonPage';
import KidsAssessmentPage from './pages/KidsAssessmentPage';
import TasksPage from './pages/TasksPage';
import FlashcardPreviewPage from './pages/FlashcardPreviewPage';
import FlashcardPrintPage from './pages/FlashcardPrintPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import OnboardingPage from './pages/OnboardingPage';
import ProfilePage from './pages/ProfilePage';
import PlanningPage from './pages/PlanningPage';
import CalendarPage from './pages/CalendarPage';
import CurriculaListPage from './pages/CurriculaListPage';
import CurriculumImportPage from './pages/CurriculumImportPage';
import CurriculumOutlinePage from './pages/CurriculumOutlinePage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './hooks/useAuth';
import { isSupportedLocale, useTranslation } from './i18n';

/** Adopts the signed-in user's saved locale once they log in, without overriding a
 * deliberate pre-login language choice made via the switcher. */
function useSyncLocaleWithUser() {
  const { user } = useAuth();
  const { setLocale } = useTranslation();

  useEffect(() => {
    if (user && isSupportedLocale(user.locale)) {
      setLocale(user.locale);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.locale]);
}

export default function App() {
  useSyncLocaleWithUser();

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <ParentDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/children"
        element={
          <ProtectedRoute>
            <ChildrenPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/children/:childId"
        element={
          <ProtectedRoute>
            <ChildPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/children/:childId/review"
        element={
          <ProtectedRoute>
            <ReviewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/children/:childId/calendar"
        element={
          <ProtectedRoute>
            <CalendarPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/children/:childId/planning"
        element={
          <ProtectedRoute>
            <PlanningPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/children/:childId/ai"
        element={
          <ProtectedRoute>
            <AiCurriculumPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/curricula"
        element={
          <ProtectedRoute>
            <CurriculaListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/curricula/new"
        element={
          <ProtectedRoute>
            <CurriculumImportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/curricula/:id/outline"
        element={
          <ProtectedRoute>
            <CurriculumOutlinePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/kids-mode/settings"
        element={
          <ProtectedRoute>
            <KidsModeSettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tasks"
        element={
          <ProtectedRoute>
            <TasksPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/topics/:topicId/flashcards/preview"
        element={
          <ProtectedRoute>
            <FlashcardPreviewPage />
          </ProtectedRoute>
        }
      />
      {/* Deliberately not wrapped in AppLayout (no nav chrome) — but still auth-gated like
          every other page, since it hits the same authenticated flashcards endpoint. */}
      <Route
        path="/topics/:topicId/flashcards/print"
        element={
          <ProtectedRoute>
            <FlashcardPrintPage />
          </ProtectedRoute>
        }
      />
      {/* Kids Mode pages authorize via their own short-lived session cookie, not the
          parent's auth — no ProtectedRoute wrapper here. */}
      <Route path="/kids" element={<KidsHomePage />} />
      <Route path="/kids/review" element={<KidsReviewPage />} />
      <Route path="/kids/lessons/:lessonId" element={<KidsLessonPage />} />
      <Route path="/kids/assessments/:assessmentId" element={<KidsAssessmentPage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
