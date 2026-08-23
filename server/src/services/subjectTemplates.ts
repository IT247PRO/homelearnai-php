export interface SubjectTemplate {
  key: string;
  name: string;
  color: string;
  units: Array<{
    name: string;
    description: string;
    topics: Array<{ title: string; estimatedMinutes: number; learningContent: string }>;
  }>;
}

// Same starter shape as database/seeds/index.ts's DEFAULT_SUBJECTS, exposed as an on-demand
// quick-start for a subject a parent adds later rather than only at initial seed time.
export const SUBJECT_TEMPLATES: SubjectTemplate[] = [
  {
    key: 'math',
    name: 'Math',
    color: '#3b82f6',
    units: [
      {
        name: 'Numbers & Counting',
        description: 'Foundational number sense and counting skills.',
        topics: [{ title: 'Counting to 20', estimatedMinutes: 20, learningContent: 'Practice counting objects one-by-one up to 20.' }],
      },
    ],
  },
  {
    key: 'reading',
    name: 'Reading & Language Arts',
    color: '#16a34a',
    units: [
      {
        name: 'Phonics Basics',
        description: 'Letter sounds and blending.',
        topics: [{ title: 'Short Vowel Sounds', estimatedMinutes: 25, learningContent: 'Identify and practice short vowel sounds in simple words.' }],
      },
    ],
  },
  {
    key: 'science',
    name: 'Science',
    color: '#f59e0b',
    units: [
      {
        name: 'The Natural World',
        description: 'Introductory observations about plants, animals, and weather.',
        topics: [{ title: 'Living vs Non-Living Things', estimatedMinutes: 20, learningContent: 'Sort common objects into living and non-living categories.' }],
      },
    ],
  },
  {
    key: 'social-studies',
    name: 'Social Studies',
    color: '#8b5cf6',
    units: [
      {
        name: 'My Community',
        description: 'People, places, and roles in the local community.',
        topics: [{ title: 'Community Helpers', estimatedMinutes: 20, learningContent: 'Learn about the roles of firefighters, doctors, and teachers.' }],
      },
    ],
  },
];

export function findSubjectTemplate(key: string): SubjectTemplate | undefined {
  return SUBJECT_TEMPLATES.find((t) => t.key === key);
}
