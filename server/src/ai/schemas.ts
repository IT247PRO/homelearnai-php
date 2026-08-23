import { z } from 'zod';

// Shape of the structured JSON a curriculum-generation call must produce, validated before
// any of it is persisted (plan.md's "AI Response Validation" pipeline: never trust AI JSON
// blindly). Kept deliberately small/bounded — business validation on top of this schema
// caps unit/topic counts to prevent runaway generations.
export const curriculumGenerationSchema = z.object({
  objectives: z.array(z.string().min(1)).min(1).max(10),
  units: z
    .array(
      z.object({
        name: z.string().min(1).max(255),
        topics: z
          .array(
            z.object({
              title: z.string().min(1).max(255),
              estimatedMinutes: z.number().int().min(5).max(180),
              learningContent: z.string().min(1).max(20_000),
              vocabulary: z.array(z.string()).max(30).optional(),
              suggestedFlashcards: z
                .array(z.object({ front: z.string().min(1), back: z.string().min(1) }))
                .max(30)
                .optional(),
            })
          )
          .min(1)
          .max(20),
      })
    )
    .min(1)
    .max(10),
  suggestedScheduleDays: z.number().int().min(1).max(180).optional(),
});

export type CurriculumGeneration = z.infer<typeof curriculumGenerationSchema>;

export const curriculumGenerationRequestSchema = z.object({
  prompt: z.string().min(1).max(2000),
  durationDays: z.number().int().min(1).max(180).optional(),
  subjectId: z.number().int().optional(),
});

export type CurriculumGenerationRequest = z.infer<typeof curriculumGenerationRequestSchema>;

// Kids Mode 2.0 (src-v2/Plan3.md §12/§14/§15): a lesson section can optionally be a
// deterministically-checkable interactive check rather than static content. Shared by every
// lesson-generation schema below plus the manual lesson-authoring input (lessons.ts) so a
// parent-authored lesson can be interactive too. correctAnswer/hints are never sent to a
// Kids Mode client before they're earned — see routes/kidsLessons.ts.
export const INTERACTION_TYPES = ['multiple_choice', 'true_false', 'short_answer', 'fill_blank'] as const;

export const interactiveSectionFieldsSchema = z.object({
  interactionType: z.enum(INTERACTION_TYPES).optional(),
  choices: z.array(z.string().max(300)).max(6).optional(),
  correctAnswer: z.union([z.string(), z.array(z.string())]).optional(),
  // At most 2 progressive hints (Plan3 §15): a gentle nudge, then a more specific one.
  hints: z.array(z.string().max(300)).max(2).optional(),
});

export const lessonGenerationSchema = z.object({
  title: z.string().min(1).max(255),
  estimatedMinutes: z.number().int().min(5).max(180),
  sections: z
    .array(
      z
        .object({
          kind: z.enum(['introduction', 'instruction', 'example', 'activity', 'practice', 'challenge', 'summary', 'homework', 'vocabulary']),
          content: z.string().min(1).max(20_000),
        })
        .merge(interactiveSectionFieldsSchema)
    )
    .min(1)
    .max(15),
});
export type LessonGeneration = z.infer<typeof lessonGenerationSchema>;

// ---------------------------------------------------------------------------
// Curriculum decomposition engine (src-v2/plan2.md) — two staged, bounded AI calls
// per curriculum rather than one unbounded generation (plan2.md §33's cost control).
// ---------------------------------------------------------------------------

const CONFIDENCE_LEVELS = ['explicit', 'inferred'] as const;

/** Stage 1: turn a pasted curriculum description into a reviewable outline — units,
 * topics, skills, and measurable objectives, each tagged by whether it was explicitly
 * stated in the source text or inferred (plan2.md §4). No lesson content yet: this call
 * stays cheap and fast so the parent can review/edit before any lesson generation runs. */
export const curriculumOutlineSchema = z.object({
  courseSummary: z.string().min(1).max(2000),
  units: z
    .array(
      z.object({
        title: z.string().min(1).max(255),
        description: z.string().max(2000).optional(),
        confidence: z.enum(CONFIDENCE_LEVELS),
        topics: z
          .array(
            z.object({
              title: z.string().min(1).max(255),
              description: z.string().max(2000).optional(),
              confidence: z.enum(CONFIDENCE_LEVELS),
              // A short quote/paraphrase from rawText that justified this topic, when explicit —
              // the traceability plan2.md §41 asks for ("why are we teaching this?").
              sourceExcerpt: z.string().max(500).optional(),
              estimatedLessonCount: z.number().int().min(1).max(20),
              skills: z
                .array(
                  z.object({
                    title: z.string().min(1).max(255),
                    objectives: z.array(z.string().min(1).max(500)).min(1).max(8),
                  })
                )
                .max(8)
                .optional(),
              // Objectives that don't cleanly belong to a single named skill.
              unskilledObjectives: z.array(z.string().min(1).max(500)).max(8).optional(),
              // Titles of other topics in this same curriculum that must come first. Resolved to
              // CurriculumPrerequisite rows after persistence — the model only sees topic titles.
              prerequisiteTopicTitles: z.array(z.string().min(1).max(255)).max(5).optional(),
            })
          )
          .min(1)
          .max(10),
      })
    )
    .min(1)
    .max(8),
});
export type CurriculumOutline = z.infer<typeof curriculumOutlineSchema>;

const LESSON_TYPES = [
  'introduction',
  'instruction',
  'demonstration',
  'guided_practice',
  'independent_practice',
  'interactive_activity',
  'experiment',
  'reading',
  'discussion',
  'problem_solving',
  'review',
  'challenge',
  'project',
] as const;

const CURRICULUM_LESSON_SECTION_KINDS = [
  'introduction',
  'instruction',
  'example',
  'guided_practice',
  'independent_practice',
  'interactive_activity',
  'activity',
  'practice',
  'questions',
  'challenge',
  'vocabulary',
  'summary',
  'exit_ticket',
  'homework',
] as const;

/** Stage 2: one call per CurriculumTopic. Given that topic's skills/objectives (never just
 * its title — plan2.md §6), produces a variable-length, ordered lesson sequence plus one
 * topic assessment whose questions are skill-tagged (by index into the topic's skill list,
 * resolved to a CurriculumSkill id after persistence — plan2.md §22/§23). */
export const curriculumTopicLessonPlanSchema = z.object({
  lessons: z
    .array(
      z.object({
        title: z.string().min(1).max(255),
        lessonType: z.enum(LESSON_TYPES),
        estimatedMinutes: z.number().int().min(5).max(120),
        sections: z
          .array(
            z
              .object({
                kind: z.enum(CURRICULUM_LESSON_SECTION_KINDS),
                content: z.string().min(1).max(20_000),
              })
              .merge(interactiveSectionFieldsSchema)
          )
          .min(1)
          .max(12),
      })
    )
    .min(1)
    .max(15),
  assessment: z.object({
    title: z.string().min(1).max(255),
    questions: z
      .array(
        z.object({
          type: z.enum(['multiple_choice', 'true_false', 'short_answer', 'fill_blank', 'open_ended']),
          prompt: z.string().min(1).max(2000),
          choices: z.array(z.string()).max(10).optional(),
          correctAnswer: z.union([z.string(), z.array(z.string())]).optional(),
          difficultyLevel: z.enum(['easy', 'medium', 'hard']).optional(),
          // Index into this topic's skill list (as sent in the prompt); omitted if the
          // question doesn't map cleanly to one named skill.
          skillIndex: z.number().int().min(0).optional(),
        })
      )
      .min(3)
      .max(20),
  }),
});
export type CurriculumTopicLessonPlan = z.infer<typeof curriculumTopicLessonPlanSchema>;

export const assessmentGenerationSchema = z.object({
  title: z.string().min(1).max(255),
  questions: z
    .array(
      z.object({
        type: z.enum(['multiple_choice', 'true_false', 'short_answer', 'fill_blank', 'open_ended']),
        prompt: z.string().min(1).max(2000),
        choices: z.array(z.string()).max(10).optional(),
        // Not z.unknown() — an unconstrained "any" schema has no bounded JSON Schema shape,
        // which fails structured-output grammar generation on some providers (observed:
        // Ollama/llama.cpp's grammar converter rejects it outright). A string covers
        // true_false/short_answer/fill_blank/open_ended; an array covers multi-select
        // multiple_choice — every realistic shape this field actually needs.
        correctAnswer: z.union([z.string(), z.array(z.string())]).optional(),
        difficultyLevel: z.enum(['easy', 'medium', 'hard']).default('medium'),
      })
    )
    .min(1)
    .max(30),
});
export type AssessmentGeneration = z.infer<typeof assessmentGenerationSchema>;

// ---------------------------------------------------------------------------
// Study Guide generation (plan4.md §51's structured-output shape) — a synthesized
// conceptual map of a topic, not a summary of any single lesson (plan4 §61).
// ---------------------------------------------------------------------------

export const studyGuideConceptSchema = z.object({
  title: z.string().min(1).max(255),
  simpleExplanation: z.string().min(1).max(2000),
  detailedExplanation: z.string().min(1).max(8000),
  example: z.string().max(2000).optional(),
  realWorldApplication: z.string().max(1000).optional(),
  commonMisconceptions: z.array(z.string().max(500)).max(5).optional(),
});

export const studyGuideVocabularyTermSchema = z.object({
  term: z.string().min(1).max(255),
  definition: z.string().min(1).max(1000),
  childFriendlyExplanation: z.string().max(1000).optional(),
  example: z.string().max(500).optional(),
});

export const studyGuideQuestionSchema = z.object({
  question: z.string().min(1).max(2000),
  answer: z.string().min(1).max(2000),
  explanation: z.string().max(1000).optional(),
});

// A second, separately-constructed schema with the identical shape — not a reuse of
// studyGuideQuestionSchema. zod-to-json-schema dedupes by object identity, and factoring two
// array fields into the same Zod object reference makes it emit an internal $ref (e.g.
// "#/definitions/response/properties/practiceQuestions/items") that Ollama's grammar
// compiler (llama.cpp) cannot resolve once toJsonSchema() extracts the root definition —
// observed directly: "Error resolving ref ... definitions not in {...}". Every schema in
// this file must be fully inlined for that reason (see stripLengthConstraints's comment in
// ollama.ts for the sibling constraint on length limits).
export const studyGuideReviewQuestionSchema = z.object({
  question: z.string().min(1).max(2000),
  answer: z.string().min(1).max(2000),
  explanation: z.string().max(1000).optional(),
});

export const studyGuideGenerationSchema = z.object({
  overview: z.string().min(1).max(4000),
  learningObjectives: z.array(z.string().min(1).max(500)).min(1).max(15),
  concepts: z.array(studyGuideConceptSchema).min(1).max(20),
  vocabulary: z.array(studyGuideVocabularyTermSchema).max(30).optional(),
  practiceQuestions: z.array(studyGuideQuestionSchema).max(20).optional(),
  reviewQuestions: z.array(studyGuideReviewQuestionSchema).max(20).optional(),
});
export type StudyGuideGeneration = z.infer<typeof studyGuideGenerationSchema>;
