/** Simple `{{key}}` substitution — good enough until a templating library is actually needed. */
export function renderTemplate(template: string, vars: Record<string, string | number | undefined>): string {
  return template.replace(/{{\s*(\w+)\s*}}/g, (_match, key: string) => {
    const value = vars[key];
    return value === undefined ? '' : String(value);
  });
}

/** Appended to every content-generation system prompt — the client renders all of this
 * text through a Markdown+KaTeX pipeline (RichContent), so formatting only shows up if the
 * model is actually told to produce it. */
export const RICH_FORMATTING_INSTRUCTION = `Format all written content as Markdown (headings, bullet/numbered lists, bold/italic, tables where useful). Write any mathematical expression or equation in LaTeX, delimited with $...$ for inline math or $$...$$ for a standalone equation — never as plain-text approximations like x^2 or sqrt(x).`;

export const DEFAULT_CURRICULUM_SYSTEM_PROMPT = `You are an experienced homeschool curriculum planner. Generate a structured, age-appropriate curriculum as JSON matching the provided schema. Never include unsafe, inappropriate, or off-topic content. Keep activities concrete and actionable for a parent to run at home. ${RICH_FORMATTING_INSTRUCTION}`;

export const DEFAULT_CURRICULUM_USER_PROMPT_TEMPLATE = `Child grade: {{grade}}
Independence level (1-4): {{independenceLevel}}
Requested duration (days): {{durationDays}}

Parent's request: {{prompt}}

Generate objectives, units, and topics (with estimated minutes and learning content) that fulfill this request.`;

// ---------------------------------------------------------------------------
// Curriculum decomposition engine (src-v2/plan2.md)
// ---------------------------------------------------------------------------

/** plan2.md §15 — do not use the same lesson-generation strategy for every subject.
 * Looked up by substring match against the curriculum's free-text subjectArea; a subject
 * that doesn't match any entry falls back to GENERIC_PEDAGOGY_HINT. */
const SUBJECT_PEDAGOGY_HINTS: Array<{ match: RegExp; hint: string }> = [
  {
    match: /math/i,
    hint: 'Prioritize: concept explanation, worked examples, guided practice, independent practice, problem solving, and mastery checks.',
  },
  {
    match: /science/i,
    hint: 'Prioritize: concepts, observation, experiments/models, vocabulary, data interpretation, and scientific reasoning.',
  },
  {
    match: /english|language arts|ela|reading|writing|literature/i,
    hint: 'Prioritize: reading, vocabulary, comprehension, grammar, writing, analysis, and discussion.',
  },
  {
    match: /history|social studies|geography|civics/i,
    hint: 'Prioritize: chronology, context, cause and effect, primary sources, vocabulary, evidence, and analysis.',
  },
  {
    match: /spanish|french|german|latin|language(?! arts)/i,
    hint: 'Prioritize: vocabulary, grammar, listening, speaking, reading, writing, and spaced repetition of vocabulary.',
  },
];
const GENERIC_PEDAGOGY_HINT = 'Prioritize a clear explanation, worked/guided examples, independent practice, and a check for understanding.';

export function subjectPedagogyHint(subjectArea: string): string {
  return SUBJECT_PEDAGOGY_HINTS.find((entry) => entry.match.test(subjectArea))?.hint ?? GENERIC_PEDAGOGY_HINT;
}

export const DEFAULT_CURRICULUM_ANALYSIS_SYSTEM_PROMPT = `You are an experienced curriculum specialist. A parent has pasted a real school course description. Decompose it into a structured outline as JSON matching the provided schema: units, topics, skills, and measurable learning objectives (e.g. "Student can add two fractions with different denominators and simplify the result" — never vague like "Understand fractions").

Distinguish carefully between:
- "explicit": stated directly in the source text.
- "inferred": a reasonable topic/skill a course like this would need, but not literally stated.

Do not invent full lesson content yet — this is an outline only. Identify prerequisite relationships between topics within this same curriculum (e.g. "Equivalent Fractions" requires "Understanding Numerators and Denominators") using each topic's exact title. Never include unsafe, inappropriate, or off-topic content.`;

export const DEFAULT_CURRICULUM_ANALYSIS_USER_PROMPT_TEMPLATE = `Subject area: {{subjectArea}}
Grade level: {{gradeLevel}}
{{pedagogyHint}}

--- Course description (pasted by the parent) ---
{{rawText}}
--- end of course description ---

Produce the full outline: units, topics (with an estimated lesson count per topic reflecting its actual complexity — simple topics need only 1-3 lessons, complex ones may need 8+), skills, objectives, and prerequisite relationships.`;

export const DEFAULT_TOPIC_LESSON_PLAN_SYSTEM_PROMPT = `You are an experienced teacher building an interactive lesson sequence for one topic within a larger curriculum. A topic name alone is never enough information to write one generic lesson — break it into the logical progression a student actually needs, in teaching order (e.g. for "Fractions": numerator/denominator → equivalent fractions → comparing → adding → subtracting → word problems → review, NOT one lesson called "Fractions"). Vary the number of lessons to match the topic's real complexity — do not force a fixed count.

Every lesson must be a real interactive teaching experience, not a page to read: include at least one section of kind 'interactive_activity' or 'questions' with interactionType set (multiple_choice, true_false, short_answer, or fill_blank), a correctAnswer, and up to 2 progressive hints (a gentle nudge, then a more specific one) — do not reveal the answer in the hints themselves. Leave interactionType/choices/correctAnswer/hints unset on purely explanatory sections (introduction, instruction, example, summary, etc).

End with a topic assessment whose questions are tagged to the skill they test. Never include unsafe, inappropriate, or off-topic content. ${RICH_FORMATTING_INSTRUCTION}`;

export const DEFAULT_TOPIC_LESSON_PLAN_USER_PROMPT_TEMPLATE = `Subject area: {{subjectArea}}
Grade level: {{gradeLevel}}
{{pedagogyHint}}

Topic: {{topicTitle}}
Topic description: {{topicDescription}}
Suggested lesson count for this topic: approximately {{estimatedLessonCount}}

Skills and objectives this topic must cover (grouped by skill, index each skill starting at 0 for question-tagging):
{{skillsBlock}}

Prerequisite topics the student has already covered: {{prerequisiteTitles}}

Generate the ordered lesson sequence and the topic assessment now.`;
