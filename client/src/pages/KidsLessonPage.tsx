import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { LessonPlayer } from '../components/LessonPlayer';

interface LessonSummary {
  title: string;
  completedAt: string | null;
  isLastLessonInTopic: boolean;
  topicAssessment: { id: number; title: string } | null;
}

export default function KidsLessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const id = Number(lessonId);
  const navigate = useNavigate();
  const [justCompleted, setJustCompleted] = useState(false);

  const lessonQuery = useQuery({
    queryKey: ['kids-lesson', id],
    queryFn: async () => {
      const { data } = await api.get<{ data: LessonSummary }>(`/kids/lessons/${id}`);
      return data.data;
    },
  });

  const completed = justCompleted || Boolean(lessonQuery.data?.completedAt);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white px-4 py-6">
      <div className="mx-auto max-w-4xl">
        <Link to="/kids" className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-700">
          ← Back to Today's Work
        </Link>

        {completed ? (
          <div className="mx-auto max-w-md rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
            <p className="mb-2 text-4xl">🎉</p>
            <h1 className="mb-1 text-2xl font-bold text-slate-900">Lesson Complete!</h1>
            <p className="mb-6 text-slate-600">{lessonQuery.data?.title}</p>

            {lessonQuery.data?.isLastLessonInTopic && lessonQuery.data.topicAssessment ? (
              <button
                onClick={() => navigate(`/kids/assessments/${lessonQuery.data!.topicAssessment!.id}`)}
                className="w-full rounded-full bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700"
              >
                Take the Topic Quiz 📝
              </button>
            ) : (
              <Link to="/kids" className="block w-full rounded-full bg-slate-100 py-3 font-semibold text-slate-700 hover:bg-slate-200">
                Back to Today's Work
              </Link>
            )}
          </div>
        ) : (
          <LessonPlayer lessonId={id} onCompleted={() => setJustCompleted(true)} />
        )}
      </div>
    </div>
  );
}
