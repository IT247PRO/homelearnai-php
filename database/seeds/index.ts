import bcrypt from 'bcryptjs';
import { prisma } from '../src/index.js';

const DEFAULT_SUBJECTS: Array<{
  name: string;
  color: string;
  units: Array<{
    name: string;
    description: string;
    topics: Array<{ title: string; estimatedMinutes: number; learningContent: string }>;
  }>;
}> = [
  {
    name: 'Math',
    color: '#3b82f6',
    units: [
      {
        name: 'Numbers & Counting',
        description: 'Foundational number sense and counting skills.',
        topics: [
          {
            title: 'Counting to 20',
            estimatedMinutes: 20,
            learningContent: 'Practice counting objects one-by-one up to 20.',
          },
        ],
      },
    ],
  },
  {
    name: 'Reading & Language Arts',
    color: '#16a34a',
    units: [
      {
        name: 'Phonics Basics',
        description: 'Letter sounds and blending.',
        topics: [
          {
            title: 'Short Vowel Sounds',
            estimatedMinutes: 25,
            learningContent: 'Identify and practice short vowel sounds in simple words.',
          },
        ],
      },
    ],
  },
  {
    name: 'Science',
    color: '#f59e0b',
    units: [
      {
        name: 'The Natural World',
        description: 'Introductory observations about plants, animals, and weather.',
        topics: [
          {
            title: 'Living vs Non-Living Things',
            estimatedMinutes: 20,
            learningContent: 'Sort common objects into living and non-living categories.',
          },
        ],
      },
    ],
  },
  {
    name: 'Social Studies',
    color: '#8b5cf6',
    units: [
      {
        name: 'My Community',
        description: 'People, places, and roles in the local community.',
        topics: [
          {
            title: 'Community Helpers',
            estimatedMinutes: 20,
            learningContent: 'Learn about the roles of firefighters, doctors, and teachers.',
          },
        ],
      },
    ],
  },
];

const ACHIEVEMENTS: Array<{ key: string; title: string; description: string; criteria: object; points: number }> = [
  { key: 'streak-3', title: '3-Day Streak', description: 'Studied 3 days in a row.', criteria: { type: 'streak_days', value: 3 }, points: 15 },
  { key: 'streak-7', title: '7-Day Streak', description: 'Studied 7 days in a row.', criteria: { type: 'streak_days', value: 7 }, points: 40 },
  { key: 'streak-30', title: '30-Day Streak', description: 'Studied 30 days in a row.', criteria: { type: 'streak_days', value: 30 }, points: 200 },
  { key: 'first-mastered-topic', title: 'First Mastery', description: 'Mastered your first topic.', criteria: { type: 'topics_mastered', value: 1 }, points: 25 },
  { key: 'ten-mastered-topics', title: 'Topic Champion', description: 'Mastered 10 topics.', criteria: { type: 'topics_mastered', value: 10 }, points: 150 },
  { key: 'hundred-points', title: 'Century Club', description: 'Earned 100 points.', criteria: { type: 'total_points', value: 100 }, points: 10 },
];

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  for (const achievement of ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { key: achievement.key },
      update: {},
      create: achievement,
    });
  }

  await prisma.aiPromptTemplate.upsert({
    where: { key_version: { key: 'curriculum-generation', version: 'v1' } },
    update: {},
    create: {
      key: 'curriculum-generation',
      version: 'v1',
      isActive: true,
      systemPrompt:
        'You are an experienced homeschool curriculum planner. Generate a structured, age-appropriate curriculum as JSON matching the provided schema. Never include unsafe, inappropriate, or off-topic content. Keep activities concrete and actionable for a parent to run at home.',
      userPromptTemplate:
        "Child grade: {{grade}}\nIndependence level (1-4): {{independenceLevel}}\nRequested duration (days): {{durationDays}}\n\nParent's request: {{prompt}}\n\nGenerate objectives, units, and topics (with estimated minutes and learning content) that fulfill this request.",
    },
  });

  const user = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      name: 'Demo Parent',
      email: 'demo@example.com',
      passwordHash,
      kidsModeSettings: { create: {} },
      familyAiSettings: { create: { aiEnabled: false } },
    },
  });

  const children = [
    { name: 'Ava', grade: '3rd', independenceLevel: 2 },
    { name: 'Liam', grade: 'PreK', independenceLevel: 1 },
  ];

  for (const childData of children) {
    const child =
      (await prisma.child.findFirst({ where: { userId: user.id, name: childData.name } })) ??
      (await prisma.child.create({
        data: {
          userId: user.id,
          name: childData.name,
          grade: childData.grade,
          independenceLevel: childData.independenceLevel,
          learningProfile: { create: {} },
          gamificationState: { create: {} },
        },
      }));

    for (const subjectData of DEFAULT_SUBJECTS) {
      const existingSubject = await prisma.subject.findFirst({
        where: { userId: user.id, childId: child.id, name: subjectData.name },
      });
      if (existingSubject) continue;

      await prisma.subject.create({
        data: {
          userId: user.id,
          childId: child.id,
          name: subjectData.name,
          color: subjectData.color,
          units: {
            create: subjectData.units.map((unit) => ({
              name: unit.name,
              description: unit.description,
              topics: {
                create: unit.topics.map((topic) => ({
                  title: topic.title,
                  estimatedMinutes: topic.estimatedMinutes,
                  learningContent: topic.learningContent,
                })),
              },
            })),
          },
        },
      });
    }
  }

  console.log(`Seeded demo user ${user.email} with ${children.length} children and default PreK-12 subjects.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
