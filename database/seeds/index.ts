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
      familyAiSettings: { create: { aiEnabled: true, tutorEnabled: true, contentGenerationEnabled: true } },
    },
  });

  const childrenNames = [
    { name: 'Ava', grade: '3rd', independenceLevel: 2 },
    { name: 'Liam', grade: 'PreK', independenceLevel: 1 },
    { name: 'Emma', grade: '1st', independenceLevel: 1 },
    { name: 'Noah', grade: '2nd', independenceLevel: 2 },
    { name: 'Oliver', grade: '4th', independenceLevel: 3 },
    { name: 'Sophia', grade: '5th', independenceLevel: 3 },
    { name: 'Jackson', grade: '6th', independenceLevel: 3 },
    { name: 'Mia', grade: '7th', independenceLevel: 4 },
    { name: 'Lucas', grade: '8th', independenceLevel: 4 },
    { name: 'Isabella', grade: '3rd', independenceLevel: 2 },
    { name: 'Mason', grade: '4th', independenceLevel: 3 },
    { name: 'Harper', grade: '5th', independenceLevel: 3 },
    { name: 'Ethan', grade: '4th', independenceLevel: 3 }, // Child ID 13
  ];

  for (const childData of childrenNames) {
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

  // Ensure curriculum 4 and other sample curricula exist
  const existingCurriculaCount = await prisma.curriculum.count({ where: { userId: user.id } });
  if (existingCurriculaCount < 4) {
    const sampleCurricula = [
      {
        title: 'Kindergarten Early Math & Phonics',
        subjectArea: 'Mathematics',
        gradeLevel: 'K',
        schoolYear: '2026-2027',
        status: 'ready',
        masteryThresholdPercent: 80,
      },
      {
        title: '3rd Grade Life Science & Ecosystems',
        subjectArea: 'Science',
        gradeLevel: '3rd',
        schoolYear: '2026-2027',
        status: 'ready',
        masteryThresholdPercent: 75,
      },
      {
        title: 'Middle School World History & Geography',
        subjectArea: 'Social Studies',
        gradeLevel: '6th',
        schoolYear: '2026-2027',
        status: 'outline_generated',
        masteryThresholdPercent: 70,
      },
      {
        title: '4th Grade Mathematics & STEM Mastery',
        subjectArea: 'Mathematics',
        gradeLevel: '4th',
        schoolYear: '2026-2027',
        status: 'ready',
        masteryThresholdPercent: 85,
      },
    ];

    for (let i = existingCurriculaCount; i < sampleCurricula.length; i++) {
      const cData = sampleCurricula[i];
      const createdCurriculum = await prisma.curriculum.create({
        data: {
          userId: user.id,
          title: cData.title,
          subjectArea: cData.subjectArea,
          gradeLevel: cData.gradeLevel,
          schoolYear: cData.schoolYear,
          status: cData.status,
          masteryThresholdPercent: cData.masteryThresholdPercent,
          sourceType: 'pasted_text',
          sourceName: 'National Math & STEM Standards Curriculum Guide',
          rawText: 'Comprehensive mathematics curriculum covering fractions, decimals, algebraic thinking, geometric measurement, area and perimeter, with deep conceptual understanding and problem solving.',
        },
      });

      // Populate rich units & topics for the 4th grade math curriculum
      if (cData.title.includes('Mathematics')) {
        const u1 = await prisma.curriculumUnit.create({
          data: {
            curriculumId: createdCurriculum.id,
            title: 'Unit 1: Fractions & Decimals Foundations',
            description: 'Understanding equivalent fractions, addition & subtraction with like/unlike denominators, and decimal notation.',
            confidence: 'explicit',
            sortOrder: 0,
          },
        });

        const t1 = await prisma.curriculumTopic.create({
          data: {
            curriculumUnitId: u1.id,
            title: 'Equivalent Fractions & Simplification',
            description: 'Understand why fractions such as $\\frac{2}{4}$ and $\\frac{1}{2}$ represent the same value using area models and number lines.',
            confidence: 'explicit',
            estimatedLessonCount: 3,
            lessonPlanStatus: 'generated',
            sortOrder: 0,
            objectives: {
              create: [
                { description: 'Model equivalent fractions visually using fraction bars and circle models.' },
                { description: 'Multiply numerator and denominator by the same non-zero number to find equivalent fractions: $\\frac{a}{b} = \\frac{a \\times k}{b \\times k}$.' },
                { description: 'Simplify fractions to simplest form by finding the greatest common factor (GCF).' },
              ],
            },
            skills: {
              create: [
                { title: 'Fraction Equivalence & Comparison' },
                { title: 'Simplifying Algebraic & Numerical Fractions' },
              ],
            },
            lessons: {
              create: [
                {
                  title: 'Visualizing Fraction Equivalence',
                  lessonType: 'concept_introduction',
                  estimatedMinutes: 20,
                  sequenceNumber: 1,
                  sections: {
                    create: [
                      {
                        kind: 'instruction',
                        content: '### What Are Equivalent Fractions?\n\nTwo fractions are **equivalent** if they represent the same amount of a whole or the exact same point on a number line.\n\n$$\\frac{1}{2} = \\frac{2}{4} = \\frac{4}{8} = \\frac{50}{100}$$\n\nWhen we multiply or divide both the **numerator** (top number) and the **denominator** (bottom number) by the same non-zero integer $k$, the value of the fraction does not change:\n\n$$\\frac{a}{b} = \\frac{a \\cdot k}{b \\cdot k}$$',
                        sortOrder: 0,
                      },
                      {
                        kind: 'example',
                        content: '### Worked Example\n\nFind a fraction equivalent to $\\frac{3}{5}$ with a denominator of $20$.\n\n**Step 1:** Determine what number multiplies $5$ to get $20$:\n$$20 \\div 5 = 4$$\n\n**Step 2:** Multiply both top and bottom by $4$:\n$$\\frac{3 \\times 4}{5 \\times 4} = \\frac{12}{20}$$\n\nSo $\\frac{3}{5}$ is equivalent to $\\frac{12}{20}$.',
                        sortOrder: 1,
                      },
                      {
                        kind: 'practice',
                        content: 'Which fraction is equivalent to $\\frac{2}{3}$?',
                        interactionType: 'multiple_choice',
                        choices: ['$\\frac{4}{6}$', '$\\frac{3}{4}$', '$\\frac{5}{6}$', '$\\frac{4}{9}$'],
                        correctAnswer: '$\\frac{4}{6}$',
                        hints: ['Multiply both numerator and denominator by 2.', '$\\frac{2 \\times 2}{3 \\times 2} = \\frac{4}{6}$'],
                        sortOrder: 2,
                      },
                    ],
                  },
                },
                {
                  title: 'Adding and Subtracting Fractions with Like Denominators',
                  lessonType: 'guided_practice',
                  estimatedMinutes: 25,
                  sequenceNumber: 2,
                  sections: {
                    create: [
                      {
                        kind: 'instruction',
                        content: '### Adding and Subtracting Like Fractions\n\nWhen denominators are the same, we simply add or subtract the numerators and keep the denominator constant:\n\n$$\\frac{a}{c} + \\frac{b}{c} = \\frac{a + b}{c}$$\n$$\\frac{a}{c} - \\frac{b}{c} = \\frac{a - b}{c}$$',
                        sortOrder: 0,
                      },
                      {
                        kind: 'example',
                        content: 'Calculate:\n$$\\frac{3}{8} + \\frac{2}{8} = \\frac{3 + 2}{8} = \\frac{5}{8}$$',
                        sortOrder: 1,
                      },
                    ],
                  },
                },
              ],
            },
            assessment: {
              create: {
                title: 'Fractions Equivalence & Operations Mastery Quiz',
                questions: {
                  create: [
                    {
                      type: 'multiple_choice',
                      prompt: 'Simplify the fraction $\\frac{18}{24}$ to its lowest terms.',
                      difficultyLevel: 'medium',
                      choices: ['$\\frac{3}{4}$', '$\\frac{9}{12}$', '$\\frac{6}{8}$', '$\\frac{2}{3}$'],
                      correctAnswer: '$\\frac{3}{4}$',
                    },
                    {
                      type: 'multiple_choice',
                      prompt: 'Compute: $\\frac{5}{12} + \\frac{3}{12} = \\text{?}$',
                      difficultyLevel: 'easy',
                      choices: ['$\\frac{2}{3}$', '$\\frac{8}{24}$', '$\\frac{8}{12}$', '$\\frac{1}{2}$'],
                      correctAnswer: '$\\frac{2}{3}$',
                    },
                  ],
                },
              },
            },
          },
        });

        const t2 = await prisma.curriculumTopic.create({
          data: {
            curriculumUnitId: u1.id,
            title: 'Converting Decimals and Fractions',
            description: 'Relating tenths and hundredths to decimal notation, e.g. $\\frac{7}{10} = 0.7$ and $\\frac{45}{100} = 0.45$.',
            confidence: 'explicit',
            estimatedLessonCount: 2,
            lessonPlanStatus: 'generated',
            sortOrder: 1,
            objectives: {
              create: [
                { description: 'Express a fraction with denominator 10 as an equivalent fraction with denominator 100.' },
                { description: 'Use decimal notation for fractions with denominators 10 or 100 ($0.62 = \\frac{62}{100}$).' },
              ],
            },
            prerequisites: {
              create: [
                { requiresTopicId: t1.id },
              ],
            },
          },
        });

        const u2 = await prisma.curriculumUnit.create({
          data: {
            curriculumId: createdCurriculum.id,
            title: 'Unit 2: Algebraic Thinking & Number Patterns',
            description: 'Equations with unknown variables, factor pairs, multiples, and arithmetic rules.',
            confidence: 'explicit',
            sortOrder: 1,
          },
        });

        await prisma.curriculumTopic.create({
          data: {
            curriculumUnitId: u2.id,
            title: 'Solving Single-Variable Equations',
            description: 'Solve multi-step equations involving unknown quantities such as $3x + 7 = 22$.',
            confidence: 'inferred',
            estimatedLessonCount: 3,
            lessonPlanStatus: 'generated',
            sortOrder: 0,
            objectives: {
              create: [
                { description: 'Use inverse operations to isolate the variable $x$.' },
                { description: 'Verify solutions by substituting the computed value back into the original equation.' },
              ],
            },
          },
        });

        const u3 = await prisma.curriculumUnit.create({
          data: {
            curriculumId: createdCurriculum.id,
            title: 'Unit 3: Geometry, Measurement & Area',
            description: 'Angles, perimeter $P = 2(l + w)$, area $A = l \\times w$, and coordinate grids.',
            confidence: 'explicit',
            sortOrder: 2,
          },
        });

        await prisma.curriculumTopic.create({
          data: {
            curriculumUnitId: u3.id,
            title: 'Perimeter and Area of Rectilinear Figures',
            description: 'Apply area formulas $A = l \\cdot w$ and perimeter formulas $P = 2l + 2w$ to real-world word problems.',
            confidence: 'explicit',
            estimatedLessonCount: 2,
            lessonPlanStatus: 'generated',
            sortOrder: 0,
          },
        });
      }
    }
  }

  console.log(`Seeded demo user ${user.email} with ${childrenNames.length} children and default PreK-12 subjects.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
