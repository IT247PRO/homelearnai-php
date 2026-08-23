# HomeLearnAI — AI-Powered Study Guide System + AI Tutor Fix

Continue working on the existing HomeLearnAI repository.

Do NOT create a separate application or disconnected study-guide system.

Extend the existing curriculum, subject, unit, topic, lesson, assignment, quiz, workbook, progress, mastery, Kids Mode, Parent Mode, and AI services.

The goal is to introduce a first-class, AI-generated STUDY GUIDE system that works for:

1. Subject
2. Unit
3. Topic
4. Lesson

The Study Guide must be useful to both:

- Parents
- Children

It must be generated from the actual curriculum and learning content, not generic AI knowledge.

The AI Tutor in Kids Mode must also be fixed and fully integrated with the current lesson/topic/study guide context.

---

# 1. CORE REQUIREMENT

For ANY:

- Subject
- Unit
- Topic
- Lesson

the system should be able to generate a comprehensive Study Guide using AI.

Example:

Subject:
7th Grade Science

Unit:
Ecosystems

Topic:
Food Webs

The system should generate a complete study guide covering the topic.

The study guide should not simply summarize the lesson.

It should explain the complete concept that the child is expected to understand.

---

# 2. STUDY GUIDE SHOULD BE A FIRST-CLASS LEARNING ARTIFACT

Create a proper Study Guide domain model.

Conceptually:

StudyGuide

    Id
    Title
    Description
    ScopeType
    SubjectId
    UnitId
    TopicId
    LessonId
    GradeLevel
    Version
    Status
    GeneratedAt
    GeneratedBy
    LastUpdatedAt
    Content
    LearningObjectives
    Skills
    Vocabulary
    Examples
    PracticeQuestions
    ReviewQuestions
    AssessmentQuestions
    AIContext
    IsPublished
    CreatedAt
    UpdatedAt

Do NOT blindly create these exact fields if the existing domain already has equivalent concepts.

Reuse existing models where appropriate.

A Study Guide should belong to a specific curriculum scope.

For example:

Subject Study Guide
Unit Study Guide
Topic Study Guide
Lesson Study Guide

---

# 3. STUDY GUIDE HIERARCHY

The system should understand the relationship:

Subject
    ↓
Unit
    ↓
Topic
    ↓
Lesson

A Study Guide generated for a:

SUBJECT

should provide a high-level overview of the subject.

A Study Guide generated for a:

UNIT

should cover all topics in the unit.

A Study Guide generated for a:

TOPIC

should cover the complete concept represented by that topic.

A Study Guide generated for a:

LESSON

should focus specifically on the lesson's learning objectives and concepts.

Do not duplicate unnecessary information.

Use lower-level study guides as source material when appropriate.

---

# 4. STUDY GUIDE GENERATION

When a parent clicks:

"Generate Study Guide"

the system should use AI to analyze:

- Curriculum
- Subject
- Unit
- Topic
- Lesson
- Learning objectives
- Skills
- Prerequisites
- Existing lesson content
- Examples
- Assignments
- Quiz questions
- Workbook content
- Child performance where appropriate

Then generate a coherent study guide.

The AI must NOT simply copy the existing lesson.

It should synthesize the content.

---

# 5. STUDY GUIDE CONTENT

A complete topic study guide should contain:

## Overview

What is this topic?

Why does it matter?

What should the child understand after studying it?

---

## Learning Objectives

Example:

By the end of this topic, the student should be able to:

- Explain what a food web is.
- Identify producers and consumers.
- Describe energy flow.
- Explain relationships between organisms.
- Analyze what happens when an organism is removed.

---

## Key Concepts

Explain every important concept.

Each concept should include:

- Simple explanation
- Detailed explanation
- Example
- Real-world connection
- Common misconception

---

## Vocabulary

For each important term:

Term

Definition

Child-friendly explanation

Example

Pronunciation where appropriate

Related terms

---

# 6. COMPLETE CONCEPT EXPLANATION

This is extremely important.

The Study Guide must not assume that the child already understands the topic.

For every major concept:

1. Introduce it.
2. Explain it simply.
3. Explain it in more detail.
4. Give an example.
5. Give another example.
6. Provide a real-world connection.
7. Explain common mistakes.
8. Give the child a chance to check understanding.

The Study Guide should allow the child to learn the concept even if they have never seen it before.

---

# 7. CHILD-FRIENDLY VERSION

The same Study Guide should support two presentation modes.

## Kid Mode

Use:

- Age-appropriate language
- Short explanations
- Visual structure
- Examples
- Callouts
- Interactive questions
- "Think About It"
- "Try It"
- "Remember"
- "Common Mistake"

Do not make it feel like an adult textbook.

---

# 8. PARENT VERSION

Parents should be able to view a more detailed version.

Parent Study Guide should include:

- Curriculum alignment
- Learning objectives
- Skills
- Prerequisites
- Key concepts
- Vocabulary
- Expected mastery
- Common misconceptions
- Examples
- Practice questions
- Assessment suggestions
- Recommended activities
- Real-world activities
- Teaching suggestions
- Remediation suggestions
- Enrichment suggestions
- Suggested discussion questions
- AI-generated teaching tips

The parent should understand:

"What is my child supposed to learn?"

and:

"How can I help?"

---

# 9. DO NOT CREATE TWO SEPARATE CONTENT SYSTEMS

There should be one canonical Study Guide.

The UI should render it differently for:

Parent Mode

and

Kids Mode.

Conceptually:

StudyGuide
    ↓
StudyGuideContent
    ↓
Parent Presentation
Kid Presentation

Do not duplicate the actual content unnecessarily.

---

# 10. STUDY GUIDE SECTIONS

Support structured sections such as:

- Overview
- Why It Matters
- Learning Objectives
- Prerequisites
- Key Concepts
- Vocabulary
- Examples
- Non-Examples
- Diagrams
- Step-by-Step Processes
- Common Mistakes
- Misconceptions
- Real-World Applications
- Quick Review
- Practice
- Challenge Questions
- Discussion Questions
- Assessment
- Answer Key
- Further Learning

Not every section must exist for every subject.

AI should determine which sections make educational sense.

---

# 11. STUDY GUIDE FOR MATH

For mathematics, the guide should include:

- Definitions
- Rules
- Formulas
- Step-by-step procedures
- Worked examples
- Visual representations
- Common mistakes
- Practice problems
- Word problems
- Challenge problems
- "Show your work"
- Real-world applications

Example:

Topic:

Adding Fractions

The study guide should explain:

1. What fractions represent.
2. Numerator and denominator.
3. Common denominator.
4. Equivalent fractions.
5. Adding fractions with the same denominator.
6. Adding fractions with different denominators.
7. Simplifying.
8. Mixed numbers.
9. Word problems.
10. Common mistakes.

---

# 12. STUDY GUIDE FOR SCIENCE

For science include:

- Concepts
- Processes
- Scientific vocabulary
- Diagrams
- Cause and effect
- Systems
- Examples
- Experiments
- Observations
- Predictions
- Real-world applications
- Misconceptions

---

# 13. STUDY GUIDE FOR HISTORY

Include:

- Timeline
- People
- Events
- Causes
- Effects
- Relationships
- Important dates
- Vocabulary
- Primary concepts
- Historical significance
- Cause/effect questions
- Compare/contrast
- Discussion questions

---

# 14. STUDY GUIDE FOR ENGLISH / LANGUAGE ARTS

Include:

- Vocabulary
- Reading concepts
- Literary concepts
- Grammar rules
- Writing concepts
- Examples
- Text analysis
- Comprehension questions
- Writing prompts
- Common mistakes

---

# 15. AI SHOULD DETERMINE SUBJECT-SPECIFIC STRUCTURE

Do not force every subject into the exact same study-guide structure.

The AI should generate the appropriate structure based on:

Subject
Unit
Topic
Grade
Learning Objectives

For example:

Math may need formulas and worked problems.

Science may need diagrams and processes.

History may need timelines and cause/effect.

ELA may need examples and textual analysis.

---

# 16. STUDY GUIDE GENERATION OPTIONS

Parents should be able to generate a Study Guide from:

- Subject
- Unit
- Topic
- Lesson

Provide actions such as:

[Generate Study Guide]

[Regenerate Study Guide]

[Update Study Guide]

[Improve Study Guide]

[Expand Explanation]

[Make More Kid Friendly]

[Make More Detailed]

[Add Examples]

[Add Practice]

[Add Review Questions]

[Add Visual Explanations]

---

# 17. PARENT REGENERATE FUNCTION

Parents must be able to regenerate an existing Study Guide.

Example:

Parent opens:

Math → Fractions → Comparing Fractions

They see:

Study Guide

Version 1

[Regenerate with AI]

When clicked, provide options.

Example:

Regenerate because:

- Content needs improvement
- Add more examples
- Make explanations simpler
- Make it more detailed
- Add practice questions
- Add real-world examples
- Add visual explanations
- Align with updated curriculum
- Create a new version

Also allow:

"Custom instructions"

Example:

"Explain this topic using cooking examples."

The AI should regenerate only what is necessary when possible.

---

# 18. VERSIONING

Study Guides should be versioned.

Example:

Study Guide v1
Study Guide v2
Study Guide v3

Store:

- Version
- Created date
- Created by
- Generation reason
- AI model
- Prompt/template version
- Source curriculum version

Parents should be able to:

- View current version
- Restore previous version
- Compare versions where practical

Do not destroy the previous version when regenerating.

---

# 19. APPROVAL / PUBLISHING

Generated Study Guides should support a lifecycle:

Draft

↓

AI Generated

↓

Parent Review

↓

Published

A parent may optionally approve a generated guide before making it available to the child.

Support a setting:

"Automatically publish AI-generated study guides"

This should be configurable.

---

# 20. STUDY GUIDE QUALITY VALIDATION

Before publishing, validate:

- Learning objectives are covered.
- No important curriculum concepts are missing.
- Grade level is appropriate.
- Explanations are accurate.
- Examples are correct.
- Practice questions match the topic.
- Answers are correct.
- No contradictory statements.
- No duplicate content.
- No inappropriate content.
- Vocabulary is accurate.
- Content is aligned with the actual curriculum.

For math/science, validate calculations and expected answers programmatically whenever possible.

---

# 21. CURRICULUM ALIGNMENT

Every Study Guide should retain links to:

Subject
Unit
Topic
Lesson
Skill
Learning Objective

This allows the system to answer:

"What part of the curriculum does this study guide teach?"

---

# 22. STUDY GUIDE AND LESSON RELATIONSHIP

The Study Guide should NOT replace lessons.

Instead:

Curriculum

↓

Study Guide

↓

Lessons

↓

Activities

↓

Practice

↓

Assessment

The Study Guide provides the conceptual map.

Lessons provide detailed instruction.

Activities provide interaction.

Practice builds skill.

Assessment measures mastery.

---

# 23. STUDY GUIDE SHOULD ALSO WORK AS A REVIEW TOOL

After a child completes lessons, they should be able to open:

"Review Study Guide"

The system should optionally personalize the guide.

Example:

Emily struggled with:

Common Denominators

The Study Guide could show:

"Focus on this section"

and provide additional explanation and examples.

---

# 24. PERSONALIZED STUDY GUIDE

Create a personalized mode.

Example:

"Emily's Study Guide"

It should use the child's learning data.

Include:

- Mastered concepts
- Concepts still developing
- Recommended review
- Personalized examples
- Weak vocabulary
- Suggested practice

Do not modify the canonical curriculum Study Guide.

Instead:

Canonical Study Guide
+
Child Learning Profile
=
Personalized Study Guide View

---

# 25. STUDY GUIDE SEARCH

Allow parents and children to search within the guide.

Example:

Search:

"denominator"

Results:

- Definition
- Examples
- Lesson 3
- Practice question
- Common mistake

---

# 26. BOOKMARKS

Allow children and parents to bookmark sections.

Examples:

"Review this later"

"Important"

"Need help"

Bookmarks should be associated with:

StudyGuide
Section
Child/Parent

---

# 27. HIGHLIGHTING / NOTES

Children should be able to:

- Highlight text
- Add notes
- Bookmark concepts

Parents can optionally add notes for the child.

---

# 28. PRINT / PDF

Parents should be able to:

[Print Study Guide]

[Generate PDF]

The generated PDF should be professional and printable.

Support:

- Kid version
- Parent version
- Practice worksheet
- Answer key

The printable version should use the same StudyGuide domain model.

Do not create a separate content pipeline.

---

# 29. STUDY GUIDE → PRACTICE

Every study guide should provide:

[Practice This Topic]

This should launch practice based on the concepts in the guide.

The practice engine should use:

- Learning objective
- Skill
- Difficulty
- Child mastery

---

# 30. STUDY GUIDE → QUIZ

Provide:

[Take Quiz]

The quiz should cover the study guide's important concepts.

The AI should NOT simply copy study-guide questions.

Generate assessment questions that test understanding and application.

---

# 31. STUDY GUIDE → AI TUTOR

Provide:

[Ask AI Tutor]

The tutor should automatically receive the Study Guide context.

If the child is reading:

"Common Denominators"

and asks:

"Why do I need one?"

the AI must understand:

Subject
Unit
Topic
Study Guide
Current Section
Current Concept

---

# 32. FIX THE CURRENT AI TUTOR

Audit the existing AI Tutor implementation in Kids Mode.

Do not assume the current implementation is correct.

Verify:

- Tutor opens correctly.
- Tutor is actually connected to the current lesson.
- Tutor knows the current subject.
- Tutor knows the current unit.
- Tutor knows the current topic.
- Tutor knows the current lesson.
- Tutor knows the current content section.
- Tutor knows the learning objective.
- Tutor knows relevant child performance.
- Tutor knows selected text.
- Tutor knows the current question.
- Conversation persists correctly.
- Context does not leak between subjects/topics/children.
- Tutor works on desktop.
- Tutor works on mobile.
- Tutor does not cover important lesson content.
- Tutor does not reset unnecessarily when navigating lesson sections.

Fix the architecture rather than patching individual UI bugs.

---

# 33. AI TUTOR CONTEXT BUILDER

Create a centralized service such as:

TutorContextBuilder

Conceptually:

TutorContextBuilder.BuildAsync(
    childId,
    subjectId,
    unitId,
    topicId,
    lessonId,
    sectionId
)

returns:

TutorContext

Containing only relevant information.

Example:

{
    child,
    gradeLevel,
    subject,
    unit,
    topic,
    skill,
    objective,
    lesson,
    currentSection,
    currentConcept,
    studyGuideSection,
    recentPerformance,
    knownMisconceptions,
    recentAttempts,
    conversationSummary
}

Do not send the entire child's history to every AI request.

---

# 34. AI TUTOR QUICK ACTIONS

Inside the Study Guide and Lesson Player provide:

[Explain This]

[Make It Easier]

[Give Me an Example]

[Give Me a Hint]

[Teach Me]

[Quiz Me]

[Practice With Me]

[Check My Understanding]

[Why Does This Matter?]

[Explain It Another Way]

Each action must automatically include the correct context.

---

# 35. SELECTED TEXT → AI

If the child highlights text in the Study Guide or lesson:

Show:

Explain

Simplify

Example

Define

Ask Tutor

The selected text must be included in the AI request.

---

# 36. AI TUTOR MUST NOT BECOME A HOMEWORK ANSWER MACHINE

For assignments and quizzes:

Prefer:

Hint

Guided reasoning

Similar example

Step-by-step coaching

Check my work

Do not immediately provide answers.

The behavior should depend on the activity type.

---

# 37. AI TUTOR LEARNING SIGNALS

Track meaningful tutor interactions.

For example:

TutorInteraction

- ChildId
- SubjectId
- UnitId
- TopicId
- LessonId
- SkillId
- InteractionType
- Question
- SelectedText
- Response
- HelpLevel
- Timestamp

Do not treat every chat message as a mastery event.

---

# 38. LEARNING INSIGHTS

The system should identify patterns.

Example:

Child repeatedly asks:

"How do I find the common denominator?"

Generate:

LearningInsight:

Potential knowledge gap:
Finding common denominators

Confidence:
High

Recommended action:

Targeted remediation lesson.

---

# 39. STUDY GUIDE REGENERATION SHOULD USE FEEDBACK

If a parent says:

"This explanation is too difficult for my 7th grader."

The regeneration request should preserve the curriculum alignment while changing the presentation.

Do NOT regenerate random content.

Example instruction:

"Rewrite only the explanations using a 7th-grade reading level and add two visual examples."

---

# 40. PARTIAL REGENERATION

Allow regeneration of individual sections.

For example:

[Regenerate Section]

on:

Key Concepts

or:

Examples

or:

Practice Questions

or:

Vocabulary

This is preferable to regenerating the entire guide unnecessarily.

---

# 41. AI GENERATION JOBS

If generation can take significant time, use an asynchronous job.

Conceptually:

Parent
 ↓
Generate Study Guide
 ↓
AI Generation Job
 ↓
Progress
 ↓
Validation
 ↓
Draft Study Guide
 ↓
Parent Review
 ↓
Publish

Do not block the UI waiting for long AI requests.

Use the existing application's background job architecture where available.

---

# 42. STUDY GUIDE GENERATION STATUS

Show:

Generating...

Analyzing curriculum...

Building concepts...

Creating examples...

Creating practice...

Validating content...

Ready for review.

Do not expose technical AI provider details to children.

---

# 43. REGENERATION HISTORY

Parents should be able to see:

Version 3
Generated:
August 23

Reason:
Added more examples

Version 2
Generated:
August 20

Reason:
Curriculum update

Version 1
Generated:
August 18

Reason:
Initial generation

---

# 44. AI MODEL / PROMPT TRACEABILITY

For administrators/debugging, retain:

- AI model
- Prompt template version
- Generation timestamp
- Source content version
- Generation parameters where appropriate

Do not expose this information to children.

---

# 45. SECURITY

Study Guides must always be scoped by:

Child / Family
Curriculum
Parent authorization

Never allow one child to access another child's personalized study guide.

AI Tutor context must be tenant/family/child scoped.

Never put:

- API keys
- Internal IDs unnecessarily
- Provider secrets
- Parent-only information

into client-side code.

---

# 46. ACCESSIBILITY

Study Guides must support:

- Screen readers
- Keyboard navigation
- High contrast
- Large text
- Read aloud
- Responsive layouts
- Semantic headings
- Accessible interactive questions

---

# 47. KIDS MODE STUDY GUIDE EXPERIENCE

A child should see something like:

My Learning

Math
 ↓
Fractions
 ↓
Comparing Fractions

[Study Guide]

--------------------------------

Comparing Fractions

What You'll Learn

You will learn how to compare fractions
even when they have different denominators.

Key Ideas

1. Fractions represent parts of a whole.
2. The denominator tells us...
3. Equivalent fractions can help us compare...

Example

1/2 and 3/4

Let's see which is larger...

[Interactive Example]

Try It

[Start Practice]

Need Help?

[Ask My AI Tutor]

--------------------------------

Quick Review

✓ I understand...
✓ I can...
→ I need more practice with...

[Take Quiz]

---

# 48. PARENT STUDY GUIDE EXPERIENCE

Parent:

Curriculum
 ↓
7th Grade Science
 ↓
Ecosystems
 ↓
Food Webs
 ↓
Study Guide

Show:

Overview

Learning Objectives

Skills

Vocabulary

Complete Concept Map

Lessons Covered

Common Misconceptions

Examples

Activities

Practice

Assessment

Mastery Criteria

Parent Teaching Tips

Child Progress

AI Insights

[Regenerate with AI]

[Regenerate Section]

[Print]

[Export PDF]

[Publish to Child]

---

# 49. PARENT "REGENERATE WITH AI" UI

When clicked:

Generate Study Guide

Scope:

○ Subject
○ Unit
● Topic
○ Lesson

What should AI improve?

☐ More detailed explanations
☐ Simpler explanations
☐ More examples
☐ More visual explanations
☐ More practice
☐ More real-world applications
☐ More review questions
☐ Address misconceptions
☐ Better curriculum alignment

Custom Instructions:

[________________________________]

[Generate]

---

# 50. AI STUDY GUIDE PROMPT ARCHITECTURE

Do NOT place one enormous prompt directly inside a controller.

Create a dedicated StudyGuideGenerationService.

Conceptually:

StudyGuideGenerationService
    ↓
CurriculumContextBuilder
    ↓
StudyGuidePromptBuilder
    ↓
AI Provider
    ↓
Structured Output
    ↓
StudyGuideValidator
    ↓
StudyGuideRepository

This should make the system testable and provider-independent.

---

# 51. STRUCTURED AI OUTPUT

The AI should return structured JSON matching a strict schema.

Example:

{
  "title": "...",
  "overview": "...",
  "learningObjectives": [],
  "skills": [],
  "vocabulary": [],
  "concepts": [
    {
      "title": "...",
      "simpleExplanation": "...",
      "detailedExplanation": "...",
      "examples": [],
      "realWorldApplication": "...",
      "commonMisconceptions": []
    }
  ],
  "reviewQuestions": [],
  "practiceQuestions": [],
  "discussionQuestions": [],
  "assessmentTopics": []
}

Validate the schema before storing.

---

# 52. AI SHOULD NOT INVENT CURRICULUM REQUIREMENTS

The Study Guide must be grounded in the supplied curriculum.

If the source curriculum says:

Students should understand X, Y, and Z.

The guide must cover X, Y, and Z.

AI may expand explanations and examples but must not silently replace the curriculum.

If the AI identifies missing information, flag it rather than inventing curriculum requirements.

---

# 53. CURRICULUM SOURCE TRACEABILITY

Where practical, allow each Study Guide concept to reference its source:

Subject
Unit
Topic
Lesson
Learning Objective

This allows the parent to understand:

"Where did this concept come from?"

---

# 54. STUDY GUIDE QUALITY SCORE

Optionally calculate an internal quality score based on:

- Objective coverage
- Skill coverage
- Vocabulary coverage
- Example coverage
- Assessment alignment
- Grade appropriateness
- Completeness
- Validation results

For example:

Study Guide Quality:
92%

Do not show this to children unless useful.

---

# 55. DUPLICATE DETECTION

If multiple lessons explain the same concept, do not generate repetitive Study Guide content.

The Study Guide should synthesize the information.

---

# 56. AI SHOULD BE ABLE TO ANSWER FROM THE STUDY GUIDE

The AI Tutor should use the Study Guide as a trusted contextual source.

Example:

Child:

"What does this mean?"

AI:

"The study guide explains that..."

But it should still explain concepts naturally rather than constantly saying:

"The study guide says..."

---

# 57. STUDY GUIDE SHOULD DRIVE REVIEW

When a child finishes a topic:

[Review Study Guide]

should be available.

The system should highlight:

- Concepts mastered
- Concepts developing
- Concepts needing review

---

# 58. STUDY GUIDE SHOULD DRIVE SPACED REPETITION

Vocabulary and key concepts should be eligible for:

- Flashcards
- Spaced repetition
- Review questions

This connects Study Guides to the existing review system.

---

# 59. STUDY GUIDE SHOULD DRIVE ADAPTIVE LEARNING

The learning engine should be able to identify:

Study Guide concept
 ↓
Skill
 ↓
Mastery

If the child struggles with a concept:

Study Guide
 ↓
AI explanation
 ↓
Additional example
 ↓
Practice
 ↓
Remediation

---

# 60. COMPLETE LEARNING ARCHITECTURE

The final architecture should look like:

Curriculum
    ↓
Subject
    ↓
Unit
    ↓
Topic
    ↓
Topic Learning Model
    ↓
Study Guide
    ↓
Lessons
    ↓
Interactive Learning
    ↓
Assignments
    ↓
Practice
    ↓
Quizzes
    ↓
Mastery
    ↓
Learning Insights
    ↓
Adaptive Recommendation

AI operates across this entire system:

AI Curriculum Analysis
AI Study Guide Generation
AI Lesson Generation
AI Interactive Content Generation
AI Tutor
AI Practice Generation
AI Assessment Generation
AI Learning Analysis
AI Remediation Generation

---

# 61. IMPORTANT: STUDY GUIDE IS NOT JUST A SUMMARY

Do NOT implement:

Lesson Content
    ↓
AI summarize()
    ↓
Study Guide

That is insufficient.

Instead:

Curriculum
+
Learning Objectives
+
Skills
+
Lessons
+
Assessments
+
Examples
+
Misconceptions
+
Learning Model
    ↓
AI Synthesis
    ↓
Complete Study Guide

The guide must represent the complete knowledge structure the student is expected to understand.

---

# 62. IMPLEMENTATION PROCESS

Before changing code:

1. Inspect the repository.
2. Understand the current architecture.
3. Identify existing curriculum models.
4. Identify existing AI services.
5. Identify existing Kids Mode.
6. Identify existing Parent Mode.
7. Identify current AI Tutor implementation.
8. Identify current lesson system.
9. Identify current progress/mastery system.
10. Identify existing background job infrastructure.
11. Identify existing database patterns.
12. Reuse existing abstractions.

Then produce an implementation plan.

Do not immediately start creating duplicate entities.

---

# 63. IMPLEMENTATION REQUIREMENTS

Implement end-to-end:

Backend:

- Study Guide domain model
- Study Guide repository
- Study Guide service
- AI generation service
- Context builder
- Validation
- Versioning
- Publishing
- Regeneration
- Section regeneration
- Parent APIs
- Kids APIs
- Tutor context APIs
- Learning insight integration
- Database migrations

Frontend:

- Parent Study Guide
- Kids Study Guide
- Generate UI
- Regenerate UI
- Version history
- Publish workflow
- Study Guide reader
- Interactive sections
- AI Tutor integration
- Selected text AI actions
- Practice integration
- Quiz integration
- Progress integration

Tests:

- Unit tests
- Integration tests
- API tests
- Authorization tests
- Study Guide generation validation
- AI Tutor context tests
- Child isolation tests
- Parent authorization tests

---

# 64. ACCEPTANCE TEST

Demonstrate the following complete scenario.

Parent enters:

7th Grade Science
→ Ecosystems
→ Food Webs

Parent clicks:

Generate Study Guide

AI creates:

- Overview
- Objectives
- Skills
- Vocabulary
- Complete concept explanations
- Examples
- Non-examples
- Common misconceptions
- Real-world examples
- Practice
- Review
- Assessment blueprint

Parent reviews it and publishes it.

Child enters Kids Mode.

Child opens:

Science
→ Ecosystems
→ Food Webs
→ Study Guide

Child reads the guide.

Child selects:

"Energy flows from producers to consumers."

Clicks:

Explain This

AI Tutor opens beside the study guide.

The AI knows:

Child
Grade
Science
Ecosystems
Food Webs
Current Study Guide
Current Section
Selected Text

The AI explains the concept appropriately for the child's grade.

Child then clicks:

Give Me an Example

AI provides a relevant example.

Child clicks:

Teach Me

AI launches a short interactive teaching sequence.

Child completes the interaction.

The result is recorded against the appropriate skill.

Child clicks:

Practice This Topic

Practice questions are generated or selected based on the child's mastery.

Child struggles with one concept.

The system detects the weakness.

AI Tutor provides an alternative explanation.

The system recommends targeted practice.

After successful practice:

Mastery is updated.

Parent can then see:

Food Webs
-------------------------
Mastered:
✓ Producers
✓ Consumers

Developing:
→ Energy Flow

Needs Review:
⚠ Food Web Relationships

AI Insight:
The student understands the terminology but needs
more practice explaining energy transfer.

Recommendation:
Complete 2 targeted practice activities.

---

# 65. FINAL PRODUCT STANDARD

The finished system should feel like:

A digital textbook
+
Personal study guide
+
Interactive teacher
+
AI tutor
+
Workbook
+
Practice system
+
Assessment system
+
Adaptive learning engine

It must NOT feel like:

CRUD LMS
+
AI-generated summary
+
Generic chatbot.

The central experience should be:

CURRICULUM

↓

What should the child learn?

↓

STUDY GUIDE

What does the complete concept mean?

↓

LESSON

Teach me the concept.

↓

INTERACTIVE LEARNING

Let me explore and practice it.

↓

AI TUTOR

Help me when I'm confused.

↓

PRACTICE

Let me try it.

↓

ASSESSMENT

Show what I know.

↓

MASTERY

Determine what I actually understand.

↓

ADAPTIVE LEARNING

Determine what I should do next.

---

# 66. MOST IMPORTANT RULE

For every Subject, Unit, Topic, and Lesson:

The parent should be able to generate a Study Guide with AI.

The child should be able to access the appropriate Study Guide.

The Study Guide should be grounded in the curriculum.

The Study Guide should explain the complete concept.

The Study Guide should contain examples.

The Study Guide should contain practice and review.

The Study Guide should connect to lessons.

The Study Guide should connect to the AI Tutor.

The AI Tutor must understand exactly what the child is currently learning.

The AI Tutor must use the Study Guide and current lesson as context.

The parent must be able to regenerate the guide.

The parent must be able to regenerate individual sections.

The system must maintain versions.

The parent must remain in control of what is published to the child.

The Study Guide must feed practice, assessment, mastery, and adaptive learning.

Most importantly:

DO NOT BUILD A GENERIC AI SUMMARY FEATURE.

BUILD A CURRICULUM-AWARE, VERSIONED, INTERACTIVE, CHILD-FRIENDLY STUDY GUIDE SYSTEM THAT BECOMES A CORE PART OF THE HOMELEARNAI LEARNING ENGINE.