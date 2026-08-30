import { prisma } from '../lib/prisma.js';
import { getAiProvider, AiNotConfiguredError } from '../ai/provider.js';
import {
  worksheetGenerationSchema,
  type WorksheetGeneration,
  type WorksheetGenerationRequest,
  type WorksheetProblem,
} from '../ai/schemas.js';
import {
  DEFAULT_WORKSHEET_SYSTEM_PROMPT,
  DEFAULT_WORKSHEET_USER_PROMPT_TEMPLATE,
  renderTemplate,
} from '../ai/promptTemplates.js';

export interface GenerateWorksheetOptions extends WorksheetGenerationRequest {
  topicId?: number;
  lessonId?: number;
  childId?: number;
  userId: number;
}

/**
 * Robust mathematical problem synthesis engine for generating practice worksheets
 * when AI is generating or as fallback in offline environments.
 */
function synthesizeWorksheetProblems(
  title: string,
  subject: string,
  grade: string,
  problemCount: number,
  difficulty: 'foundation' | 'standard' | 'challenge',
  practiceType: string,
  lessonTitle?: string
): WorksheetGeneration {
  const problems: WorksheetProblem[] = [];
  const isFractions = /fraction|rational|divide/i.test(title + ' ' + (lessonTitle ?? ''));
  const isAlgebra = /algebra|equation|variable|linear|solve/i.test(title + ' ' + (lessonTitle ?? ''));
  const isGeometry = /geometry|area|perimeter|volume|angle|shape/i.test(title + ' ' + (lessonTitle ?? ''));
  const isDecimals = /decimal|percent|money/i.test(title + ' ' + (lessonTitle ?? ''));

  for (let i = 1; i <= problemCount; i++) {
    const num = i;
    if (isFractions) {
      if (difficulty === 'foundation') {
        const d = 2 + (i % 6);
        const n = 1 + (i % (d - 1 || 1));
        const mult = 2 + (i % 3);
        problems.push({
          problemNumber: num,
          question: `Find an equivalent fraction for $\\frac{${n}}{${d}}$ by multiplying both the numerator and denominator by $${mult}$.`,
          type: 'step_by_step',
          workspaceSize: 'medium',
          hint: `Multiply $${n} \\times ${mult}$ and $${d} \\times ${mult}$.`,
          solution: `$$\\frac{${n}}{${d}} = \\frac{${n} \\times ${mult}}{${d} \\times ${mult}} = \\frac{${n * mult}}{${d * mult}}$$`,
          answer: `$\\frac{${n * mult}}{${d * mult}}$`,
        });
      } else if (difficulty === 'challenge') {
        const a = 1 + (i % 4);
        const b = 2 + (i % 3);
        const c = 1 + (i % 3);
        const d = 3 + (i % 4);
        problems.push({
          problemNumber: num,
          question: `Solve the word problem: Maya has $\\frac{${a}}{${b}}$ meters of blue ribbon and Ethan has $\\frac{${c}}{${d}}$ meters of red ribbon. Calculate the total combined length of ribbon in simplest form: $$\\frac{${a}}{${b}} + \\frac{${c}}{${d}} = \\text{?}$$`,
          type: 'word_problem',
          workspaceSize: 'large',
          hint: `Find a common denominator for $${b}$ and $${d}$. Common denominator = $${b * d}$.`,
          solution: `$$\\frac{${a}}{${b}} + \\frac{${c}}{${d}} = \\frac{${a * d}}{${b * d}} + \\frac{${c * b}}{${b * d}} = \\frac{${a * d + c * b}}{${b * d}}$$`,
          answer: `$\\frac{${a * d + c * b}}{${b * d}}$ meters`,
        });
      } else {
        const denom = 4 + (i % 8);
        const n1 = 1 + (i % (denom - 2));
        const n2 = 1 + ((i + 1) % (denom - n1));
        problems.push({
          problemNumber: num,
          question: `Calculate the sum and simplify to lowest terms: $$\\frac{${n1}}{${denom}} + \\frac{${n2}}{${denom}} = \\text{?}$$`,
          type: 'calculation',
          workspaceSize: 'medium',
          hint: `Since the denominators are both $${denom}$, add the numerators: $${n1} + ${n2}$.`,
          solution: `$$\\frac{${n1}}{${denom}} + \\frac{${n2}}{${denom}} = \\frac{${n1} + ${n2}}{${denom}} = \\frac{${n1 + n2}}{${denom}}$$`,
          answer: `$\\frac{${n1 + n2}}{${denom}}$`,
        });
      }
    } else if (isAlgebra) {
      const coeff = 2 + (i % 5);
      const constant = 3 + (i % 7);
      const xVal = 2 + (i % 8);
      const result = coeff * xVal + constant;
      problems.push({
        problemNumber: num,
        question: `Solve for the unknown variable $x$: $$${coeff}x + ${constant} = ${result}$$`,
        type: 'step_by_step',
        workspaceSize: 'medium',
        hint: `Subtract $${constant}$ from both sides, then divide by $${coeff}$.`,
        solution: `**Step 1:** Subtract $${constant}$:\n$$${coeff}x = ${result} - ${constant} = ${result - constant}$$\n\n**Step 2:** Divide by $${coeff}$:\n$$x = \\frac{${result - constant}}{${coeff}} = ${xVal}$$`,
        answer: `$x = ${xVal}$`,
      });
    } else if (isGeometry) {
      const length = 4 + (i % 9);
      const width = 3 + (i % 6);
      const area = length * width;
      const perim = 2 * (length + width);
      if (i % 2 === 0) {
        problems.push({
          problemNumber: num,
          question: `A rectangular garden plot has a length of $l = ${length}\\text{ m}$ and a width of $w = ${width}\\text{ m}$. Calculate its total **area** $A$ and **perimeter** $P$.`,
          type: 'word_problem',
          workspaceSize: 'large',
          hint: `Use the formulas $A = l \\times w$ and $P = 2l + 2w$.`,
          solution: `**Area:**\n$$A = ${length} \\times ${width} = ${area}\\text{ m}^2$$\n\n**Perimeter:**\n$$P = 2(${length}) + 2(${width}) = ${2 * length} + ${2 * width} = ${perim}\\text{ m}$$`,
          answer: `Area $= ${area}\\text{ m}^2$, Perimeter $= ${perim}\\text{ m}$`,
        });
      } else {
        problems.push({
          problemNumber: num,
          question: `Calculate the area of a rectangle with length $${length}\\text{ cm}$ and width $${width}\\text{ cm}$: $$A = l \\cdot w$$`,
          type: 'calculation',
          workspaceSize: 'medium',
          hint: `Multiply $${length} \\times ${width}$.`,
          solution: `$$A = ${length}\\text{ cm} \\times ${width}\\text{ cm} = ${area}\\text{ cm}^2$$`,
          answer: `$${area}\\text{ cm}^2$`,
        });
      }
    } else if (isDecimals) {
      const dec1 = ((i * 1.25) % 10).toFixed(2);
      const dec2 = ((i * 0.75 + 1.1) % 10).toFixed(2);
      const sum = (parseFloat(dec1) + parseFloat(dec2)).toFixed(2);
      problems.push({
        problemNumber: num,
        question: `Calculate the sum vertically: $$${dec1} + ${dec2} = \\text{?}$$`,
        type: 'calculation',
        workspaceSize: 'medium',
        hint: `Align the decimal points before adding.`,
        solution: `$$\\begin{aligned} & ${dec1} \\\\ + & ${dec2} \\\\ \\hline & ${sum} \\end{aligned}$$`,
        answer: `$${sum}$`,
      });
    } else {
      // General arithmetic and problem solving
      const a = 12 + i * 3;
      const b = 4 + (i % 7);
      const prod = a * b;
      problems.push({
        problemNumber: num,
        question: `Calculate: $$${a} \\times ${b} = \\text{?}$$ Show your working steps clearly.`,
        type: 'calculation',
        workspaceSize: 'medium',
        hint: `Break $${a}$ into $${Math.floor(a / 10) * 10} + ${a % 10}$ or use standard long multiplication.`,
        solution: `$$${a} \\times ${b} = (${Math.floor(a / 10) * 10} \\times ${b}) + (${a % 10} \\times ${b}) = ${Math.floor(a / 10) * 10 * b} + ${(a % 10) * b} = ${prod}$$`,
        answer: `$${prod}$`,
      });
    }
  }

  return {
    title: `${title} - Practice Worksheet`,
    subtitle: lessonTitle ? `Lesson Focus: ${lessonTitle}` : 'Comprehensive Topic Practice',
    gradeLevel: grade || 'Grade 4',
    subject: subject || 'Mathematics',
    instructions:
      'Solve each problem carefully. Write all your calculation steps in the workspace provided and write your final answer in the box. Check your work before submitting!',
    estimatedMinutes: Math.max(10, problemCount * 2),
    problems,
    parentTeacherNotes: `This worksheet contains ${problemCount} ${difficulty} level problems designed to reinforce conceptual mastery, step-by-step mathematical reasoning, and problem-solving skills.`,
  };
}

export async function generateWorksheet(options: GenerateWorksheetOptions): Promise<WorksheetGeneration> {
  const {
    topicId,
    lessonId,
    childId,
    userId,
    problemCount = 10,
    difficulty = 'standard',
    practiceType = 'mixed',
    includeAnswerKey = true,
    childName,
    customInstructions,
  } = options;

  let topicTitle = 'General Mathematics';
  let topicDescription = '';
  let subjectArea = 'Mathematics';
  let gradeLevel = 'Grade 4';
  let lessonTitle: string | undefined;
  let lessonContext = '';
  let finalChildName = childName ?? 'Student';

  // If child is provided, look up child profile
  if (childId) {
    const child = await prisma.child.findFirst({
      where: { id: childId, userId },
      select: { name: true, grade: true },
    });
    if (child) {
      if (!childName) finalChildName = child.name;
      if (child.grade) gradeLevel = child.grade.includes('Grade') ? child.grade : `Grade ${child.grade}`;
    }
  }

  // If topic is provided, fetch topic details and its parent unit/subject
  if (topicId) {
    const topic = await prisma.topic.findFirst({
      where: { id: topicId },
      include: {
        unit: {
          include: {
            subject: true,
          },
        },
      },
    });

    if (topic) {
      topicTitle = topic.title;
      topicDescription = topic.learningContent?.slice(0, 1500) ?? '';
      if (topic.unit?.subject) {
        subjectArea = topic.unit.subject.name;
      }
    }
  }

  // If lesson is provided, fetch lesson details
  if (lessonId) {
    const lesson = await prisma.lesson.findFirst({
      where: { id: lessonId },
      include: {
        sections: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (lesson) {
      lessonTitle = lesson.title;
      const sectionSummaries = lesson.sections
        .map((s) => `[${s.kind}] ${s.content.slice(0, 300)}`)
        .join('\n');
      lessonContext = `Lesson Title: ${lesson.title}\nLesson Content Highlights:\n${sectionSummaries}`;
    }
  }

  // Attempt to call AI provider (Gemini / configured AI)
  try {
    const provider = getAiProvider();
    if (provider.name !== 'none') {
      const userPrompt = renderTemplate(DEFAULT_WORKSHEET_USER_PROMPT_TEMPLATE, {
        subject: subjectArea,
        topicTitle,
        gradeLevel,
        childName: finalChildName,
        problemCount,
        difficulty,
        practiceType,
        lessonContext: lessonContext ? `\n--- Lesson Context ---\n${lessonContext}\n--- End Lesson Context ---` : '',
        customInstructions: customInstructions ? `Additional Parent Guidelines: ${customInstructions}` : '',
      });

      const result = await provider.generateJson({
        systemPrompt: DEFAULT_WORKSHEET_SYSTEM_PROMPT,
        userPrompt,
        schema: worksheetGenerationSchema,
      });

      // Record AI Generation for accountability and token usage
      await prisma.aiGeneration.create({
        data: {
          userId,
          childId: childId ?? null,
          kind: 'worksheet_generation',
          status: 'succeeded',
          validationStatus: 'valid',
          requestContextRedacted: { topicTitle, subjectArea, problemCount, difficulty },
          provider: result.provider,
          model: result.model,
          promptTokens: result.usage.promptTokens ?? null,
          completionTokens: result.usage.completionTokens ?? null,
        },
      }).catch((e) => console.warn('Could not record aiGeneration log:', e));

      return result.data;
    }
  } catch (err) {
    if (!(err instanceof AiNotConfiguredError)) {
      console.warn('AI generation encountered error, falling back to rigorous synthesizer:', err);
    }
  }

  // Fallback to high-quality synthetic generation
  return synthesizeWorksheetProblems(
    topicTitle,
    subjectArea,
    gradeLevel,
    problemCount,
    difficulty,
    practiceType,
    lessonTitle
  );
}
