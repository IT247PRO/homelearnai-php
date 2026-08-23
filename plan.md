# Role

You are a senior software architect, full-stack engineer, UX designer, AI engineer, database engineer, security engineer, and DevOps engineer.

You are working with an **existing cloned repository**:

`https://github.com/IT247PRO/homelearnai-php`

The repository is an existing intelligent homeschool learning management system called **HomeLearnAI**.

Your job is **not to create a new application from scratch**. You must first thoroughly inspect, understand, and preserve the existing application, then transform and modernize it into a **production-quality, AI-powered homeschool learning platform**.

The existing application already contains functionality for:

* Multi-child management
* Grade-based profiles from PreK–12
* Independence levels
* Kids Mode
* PIN-protected parent controls
* Individual progress tracking
* Curriculum planning
* Subjects → Units → Topics → Sessions hierarchy
* Flexible scheduling
* Age-appropriate recommendations
* ICS calendar import
* Spaced repetition
* Performance-based interval adjustments
* Catch-up sessions
* Flashcards
* Bulk flashcard import
* Anki / Quizlet / CSV support
* Multi-language support
* HTMX real-time updates
* Responsive UI
* Caching

## PRIMARY OBJECTIVE

Transform the existing repository into a **complete AI-powered homeschool operating system** where a parent can manage one or more children and the platform can intelligently plan, teach, assess, adapt, and track each child's education.

The system should behave less like a traditional LMS and more like an **AI teaching assistant + homeschool planner + curriculum engine + student progress platform**.

The AI should understand:

* The child's age
* Grade
* Learning level
* Strengths
* Weaknesses
* Interests
* Learning pace
* Previous performance
* Curriculum
* Completed lessons
* Missed lessons
* Assessment results
* Parent preferences
* Available study time
* Learning goals

The system should continuously adapt the child's learning journey.

---

# PHASE 1 — INSPECT BEFORE MODIFYING

Before writing or modifying code, thoroughly inspect the repository.

Do NOT make assumptions about the architecture.

Determine:

* Programming language
* Framework
* PHP version
* Frontend framework
* CSS framework
* Database technology
* ORM/query approach
* Authentication system
* Authorization model
* Existing routing
* Existing controllers
* Existing services
* Existing models/entities
* Existing database schema
* Existing migrations
* Existing APIs
* Existing HTMX usage
* Existing JavaScript
* Existing CSS
* Existing templates/views
* Existing tests
* Existing configuration
* Existing environment configuration
* Existing caching
* Existing queues/background processing
* Existing AI integration
* Existing import/export functionality
* Existing curriculum functionality
* Existing flashcard functionality

Read the README and all relevant architectural/documentation files.

Create an internal understanding of the current architecture before modifying it.

Do not unnecessarily rewrite working functionality.

Prefer incremental modernization over destructive replacement.

---

# PHASE 2 — ESTABLISH THE TARGET ARCHITECTURE

After inspecting the repository, define the target architecture.

The application should have clear separation between:

## Presentation Layer

Responsible for:

* Parent dashboard
* Child dashboard
* Kids Mode
* Curriculum UI
* Lesson UI
* Flashcards
* Assessments
* Progress
* Reports
* AI interactions
* Scheduling
* Settings

## Application Layer

Responsible for:

* Curriculum planning
* Lesson generation
* Assessment generation
* Learning adaptation
* Scheduling
* Progress calculation
* Spaced repetition
* Recommendations
* AI orchestration

## Domain Layer

Model core concepts such as:

* Parent
* Child
* Household
* Grade
* Subject
* Curriculum
* Unit
* Topic
* Lesson
* LearningObjective
* Activity
* Assignment
* Assessment
* Question
* Answer
* Flashcard
* Review
* Skill
* Mastery
* LearningProfile
* StudyPlan
* Schedule
* Attendance
* Progress
* Achievement
* Recommendation

## Infrastructure Layer

Responsible for:

* Database
* AI providers
* File storage
* Caching
* Email
* Notifications
* Background jobs
* External curriculum imports
* Calendar integrations
* Logging
* Monitoring

Keep the architecture consistent with the technology already used by the repository unless there is a strong technical reason to change it.

---

# PHASE 3 — DO NOT BREAK EXISTING FEATURES

Existing functionality is valuable.

Before changing an existing feature:

1. Understand how it works.
2. Identify dependencies.
3. Preserve existing behavior unless improvement is required.
4. Add automated tests where practical.
5. Perform regression testing.

Do not remove:

* Multi-child support
* Grade support
* Curriculum hierarchy
* Scheduling
* Spaced repetition
* Flashcards
* Imports
* Kids Mode
* Progress tracking
* Existing authentication
* Existing responsive behavior

unless there is a clear architectural reason.

If a feature needs replacement, migrate it rather than simply deleting it.

---

# PHASE 4 — AI LEARNING ENGINE

The most important enhancement is the AI Learning Engine.

Create a central AI orchestration layer rather than scattering AI API calls throughout controllers or UI code.

Use interfaces such as:

```text
AiProvider
AiLessonGenerator
AiAssessmentGenerator
AiTutor
AiCurriculumPlanner
AiLearningAnalyzer
AiRecommendationEngine
AiProgressAnalyzer
AiQuestionGenerator
```

Use dependency injection.

The system should support multiple AI providers.

Do not tightly couple the application to one provider.

For example:

```text
OpenAI
Azure OpenAI
Anthropic
Local LLM
Ollama
Future providers
```

Provider selection should be configurable.

Never expose API keys to the browser.

Never put secrets in source control.

---

# AI CURRICULUM GENERATOR

Allow parents to describe what they want their child to learn.

Example:

> Teach my 8-year-old about the solar system over the next two weeks.

The AI should generate:

* Learning objectives
* Topics
* Lessons
* Activities
* Reading material
* Experiments
* Questions
* Vocabulary
* Flashcards
* Assessments
* Review schedule
* Optional enrichment activities

The generated curriculum must be structured and stored in the database.

Do not rely on AI-generated content existing only inside chat history.

---

# AI DAILY PLANNER

Create an intelligent daily planner.

The planner should consider:

* Available hours
* School days
* Subjects
* Curriculum deadlines
* Previous performance
* Missed lessons
* Upcoming assessments
* Spaced repetition reviews
* Child fatigue / workload
* Parent-defined priorities
* Learning goals

Generate a daily schedule.

Example:

```text
8:30 Math
9:00 Reading
9:45 Break
10:00 Science
10:45 Writing
11:15 Review
```

The schedule should automatically adapt.

If a child misses a lesson, the system should intelligently reschedule it.

Do not simply move every missed item to the next day.

Use priority and workload balancing.

---

# ADAPTIVE LEARNING

Implement a mastery-based learning system.

For every skill/topic, track:

* Not Started
* Introduced
* Practicing
* Developing
* Proficient
* Mastered

Also track:

* Accuracy
* Attempts
* Time spent
* Confidence
* Assessment results
* Review history
* Last activity
* Forgetting risk

The AI should identify:

```text
Strengths
Weaknesses
Knowledge gaps
At-risk skills
Skills ready for advancement
Skills requiring review
```

---

# LEARNING PROFILE

Each child should have an evolving learning profile.

Example:

```text
Child
 ├── Grade
 ├── Age
 ├── Subjects
 ├── Learning Goals
 ├── Strengths
 ├── Weaknesses
 ├── Interests
 ├── Learning Pace
 ├── Mastery Map
 ├── Recent Performance
 ├── Recommended Activities
 └── AI Insights
```

The profile should evolve based on actual learning data.

Do not allow the AI to permanently overwrite important facts without validation.

Store AI-generated insights separately from authoritative child profile information.

---

# AI TUTOR

Add an AI tutor experience.

The child should be able to ask questions such as:

> Why does the moon change shape?

The AI should explain concepts at the child's appropriate level.

The tutor should:

* Adapt vocabulary
* Use age-appropriate explanations
* Ask follow-up questions
* Provide examples
* Use Socratic questioning
* Avoid immediately giving answers to assignments
* Encourage reasoning
* Detect confusion
* Recommend additional practice

For younger children, use simpler language.

For older students, progressively increase depth.

---

# AI SAFETY FOR CHILDREN

Treat this as a child-focused educational application.

Implement strong safety boundaries.

The AI must:

* Avoid inappropriate content
* Avoid sexual content
* Avoid violent or graphic material
* Avoid unsafe instructions
* Avoid encouraging dangerous activities
* Avoid manipulation
* Avoid pretending to be a parent
* Encourage contacting a trusted adult when appropriate
* Never request unnecessary personal information
* Never expose information about another child

Parents should have controls over AI functionality.

---

# AI LESSON GENERATION

Create reusable lesson generation.

A lesson should contain:

```text
Title
Subject
Grade
Estimated Duration
Learning Objectives
Introduction
Instruction
Examples
Interactive Activities
Practice
Questions
Challenge
Summary
Homework
Assessment
Vocabulary
Resources
```

Lessons should be generated using structured JSON/schema responses rather than free-form text wherever practical.

Validate AI output before storing it.

Never trust AI-generated JSON blindly.

Use schema validation.

---

# AI ASSESSMENTS

Generate assessments based on:

* Curriculum
* Learning objectives
* Previous mistakes
* Current mastery
* Grade
* Difficulty

Support:

* Multiple choice
* True/false
* Short answer
* Fill in the blank
* Matching
* Ordering
* Problem solving
* Open-ended questions

Track every answer.

Analyze mistakes.

Do not only calculate a percentage.

Determine the underlying skill or misconception.

---

# AI QUESTION ADAPTATION

Questions should dynamically change difficulty.

Example:

```text
Correct → slightly harder
Correct repeatedly → advance
Incorrect → provide easier supporting question
Repeated incorrect → identify knowledge gap
```

The system should avoid frustrating the child.

---

# SPACED REPETITION

Improve the existing spaced repetition engine.

Track:

* Difficulty
* Recall quality
* Previous intervals
* Success rate
* Consecutive correct answers
* Time since review

Allow the algorithm to be configurable.

Do not hard-code learning intervals throughout the UI.

Create a dedicated service.

---

# FLASHCARDS

Preserve existing flashcard functionality and improve it.

Support:

* Basic
* Multiple Choice
* Cloze
* True/False
* Image-based cards where supported

AI should be able to generate flashcards from:

* Lessons
* Topics
* Assessments
* Reading material
* Curriculum

---

# PARENT DASHBOARD

Create a modern parent dashboard.

It should provide:

## Overview

* Children
* Today's schedule
* Completion percentage
* Upcoming assessments
* Learning streak
* Alerts
* Recommendations

## Child Summary

For each child:

```text
Overall Progress
Subject Progress
Mastery
Time Studied
Lessons Completed
Upcoming Work
Weak Areas
Strong Areas
AI Recommendations
```

Use visual charts where appropriate.

Avoid overwhelming parents with unnecessary information.

---

# CHILD DASHBOARD

Create a child-friendly dashboard.

It should show:

* Today's lessons
* Progress
* Achievements
* Current streak
* Recommended activity
* Upcoming work

The UI should vary according to independence level.

Younger children should see simpler interfaces.

Older children can see more detailed information.

---

# KIDS MODE

Strengthen Kids Mode.

When Kids Mode is enabled:

* Hide parent administration
* Require PIN to exit
* Simplify navigation
* Increase readability
* Minimize distractions
* Prevent accidental access to settings
* Keep children inside educational workflows

Do not expose parent-sensitive information.

---

# GAMIFICATION

Implement optional educational gamification.

Support:

* Points
* XP
* Streaks
* Badges
* Achievements
* Levels
* Learning milestones

Do not create addictive mechanics.

The purpose should be motivation, not excessive engagement.

Parents should be able to disable gamification.

---

# CURRICULUM MARKETPLACE / LIBRARY

Create an extensible curriculum library.

Curriculum should support:

```text
Curriculum
 └── Subject
      └── Unit
           └── Topic
                └── Lesson
                     └── Activity
```

Allow:

* Parent-created curriculum
* AI-generated curriculum
* Imported curriculum
* Reusable curriculum
* Curriculum templates

Keep curriculum content versioned where practical.

---

# RESOURCE MANAGEMENT

Lessons should support educational resources:

* PDFs
* Links
* Images
* Videos
* Worksheets
* Documents
* External resources

Do not embed arbitrary external content without security considerations.

Validate URLs.

---

# SCHEDULING

Improve scheduling.

Support:

* School days
* Time blocks
* Subject priorities
* Recurring schedules
* Holidays
* Breaks
* Appointments
* External activities
* ICS import

The scheduler should understand conflicts.

Example:

```text
School
Doctor appointment
Field trip
Sports
Family activity
```

The system should adjust the learning plan.

---

# PROGRESS ANALYTICS

Create meaningful analytics.

Track:

* Time spent
* Lessons completed
* Completion rate
* Accuracy
* Mastery
* Subject performance
* Weekly trends
* Monthly trends
* Learning streaks
* Knowledge gaps
* Assessment results

Provide parent-friendly reports.

---

# AI WEEKLY REPORT

Generate an optional weekly parent report.

Example:

```text
Weekly Learning Summary

Math
Strong improvement in multiplication.

Reading
Reading comprehension remains strong.

Science
The child struggled with planetary scale.

Recommendation
Schedule two short review sessions next week.
```

AI-generated reports must be based on actual stored learning data.

Do not invent progress.

---

# NOTIFICATIONS

Create a notification abstraction.

Potential notifications:

* Lesson reminder
* Missed lesson
* Assessment upcoming
* Curriculum milestone
* Weekly report
* Learning recommendation

Do not hard-code a specific email/SMS provider.

---

# SEARCH

Implement global search where appropriate.

Search:

* Children
* Subjects
* Curriculum
* Lessons
* Flashcards
* Resources
* Assessments

Use the existing database/search capabilities where practical.

---

# INTERNATIONALIZATION

Preserve and improve i18n.

All user-facing strings should be externalized.

Do not hard-code UI strings.

Support future languages.

AI-generated educational content should also consider the selected language.

---

# ACCESSIBILITY

Follow WCAG principles.

Ensure:

* Keyboard navigation
* Screen reader support
* Proper semantic HTML
* Labels
* Focus states
* Sufficient contrast
* Responsive layouts
* Accessible forms
* Accessible error messages

---

# RESPONSIVE DESIGN

The application must work well on:

* Desktop
* Laptop
* Tablet
* Mobile

Prioritize:

* Parent desktop experience
* Child tablet experience
* Child mobile experience

---

# SECURITY

Perform a complete security review.

Check for:

* SQL injection
* XSS
* CSRF
* Broken authorization
* IDOR
* Session issues
* Authentication weaknesses
* Unsafe file uploads
* Path traversal
* Insecure direct object references
* Secret exposure
* Improper input validation
* Mass assignment
* Unsafe deserialization
* SSRF
* Rate-limit issues

Every child-specific resource must enforce authorization.

A parent must never be able to access another household's child data unless explicitly authorized.

---

# PRIVACY

Treat children's educational information as sensitive.

Minimize collected data.

Do not send unnecessary personal information to AI providers.

Create a clear abstraction for AI data minimization.

Do not include:

* Passwords
* Authentication tokens
* Internal IDs unless necessary
* Unnecessary personal information

in AI prompts.

---

# DATABASE

Review the existing database.

Do not unnecessarily redesign working tables.

Where new functionality is required:

* Create proper migrations
* Add indexes
* Add foreign keys
* Add constraints
* Use appropriate data types
* Add timestamps
* Consider soft deletion where appropriate
* Preserve auditability

Avoid storing large AI prompts/responses directly in frequently queried transactional tables.

Consider dedicated tables for AI operations.

Example:

```text
AiConversation
AiMessage
AiGeneration
AiPromptTemplate
AiUsage
AiRecommendation
AiInsight
```

---

# AI OBSERVABILITY

Every AI operation should have traceability.

Track:

```text
Provider
Model
Operation
RequestId
CorrelationId
Timestamp
Duration
Token usage where available
Success/failure
Error
```

Never log sensitive prompts containing unnecessary child information.

---

# COST CONTROL

AI can become expensive.

Implement:

* Caching
* Prompt reuse
* Model selection
* Token limits
* Rate limiting
* Background generation
* Deduplication
* Retry policies
* Usage tracking

Do not regenerate identical content unnecessarily.

---

# PERFORMANCE

Review performance across the entire application.

Look for:

* N+1 database queries
* Missing indexes
* Excessive API requests
* Large page payloads
* Inefficient queries
* Unnecessary AI calls
* Missing caching

Use pagination for large datasets.

Use asynchronous processing where appropriate.

---

# BACKGROUND PROCESSING

AI generation and other long-running operations should not unnecessarily block web requests.

Create a background-job abstraction for:

* Curriculum generation
* Lesson generation
* Assessment generation
* Weekly reports
* Recommendation generation
* Analytics calculations
* Import processing

Use the infrastructure already supported by the application where practical.

---

# API DESIGN

Where APIs exist, standardize them.

Use:

* Consistent HTTP status codes
* Validation
* Error responses
* Pagination
* Correlation IDs
* Authorization
* Rate limiting where appropriate

Do not expose internal database models directly.

Use DTOs/contracts.

---

# ERROR HANDLING

Create consistent error handling.

Users should receive useful messages.

Developers should receive structured logs.

Never display:

* Stack traces
* Connection strings
* SQL queries containing sensitive data
* API keys
* Internal filesystem paths

in production responses.

---

# TESTING

Add meaningful automated tests.

Prioritize:

## Unit Tests

* Curriculum planning
* Scheduling
* Spaced repetition
* Mastery calculation
* AI prompt construction
* AI response parsing
* Authorization
* Progress calculation

## Integration Tests

* Database
* Authentication
* Curriculum workflows
* Child isolation
* AI provider abstraction

## End-to-End Tests

Test the most important workflows:

```text
Create parent
Create child
Create curriculum
Generate lesson
Complete lesson
Take assessment
Analyze result
Update mastery
Generate next recommendation
```

---

# AI PROMPT ENGINEERING

Do not hard-code large prompts inside controllers.

Create reusable prompt templates.

Example:

```text
PromptTemplate
 ├── LessonGeneration
 ├── AssessmentGeneration
 ├── Tutor
 ├── CurriculumGeneration
 ├── LearningAnalysis
 ├── WeeklyReport
 └── Recommendation
```

Prompts should be versioned.

Example:

```text
lesson-generator-v1
lesson-generator-v2
```

Allow future prompt improvements without rewriting application logic.

---

# AI RESPONSE VALIDATION

Every structured AI response must be validated.

Pipeline:

```text
User Request
     ↓
Build Context
     ↓
Build Prompt
     ↓
AI Provider
     ↓
Parse Response
     ↓
Schema Validation
     ↓
Business Validation
     ↓
Persistence
     ↓
UI
```

If validation fails:

1. Retry when appropriate.
2. Attempt repair only when safe.
3. Log the failure.
4. Never persist invalid educational data.

---

# DATA MODELING

Avoid creating overly generic JSON blobs for core business entities.

Use normalized relational structures for:

* Children
* Curriculum
* Lessons
* Assessments
* Questions
* Answers
* Skills
* Mastery
* Scheduling

JSON can be used for flexible AI metadata where appropriate.

---

# UX REQUIREMENTS

The UI should feel like a modern education product.

Avoid making the application feel like an old administrative database.

Use:

* Clear visual hierarchy
* Cards
* Progress indicators
* Friendly empty states
* Helpful onboarding
* Consistent navigation
* Clear actions
* Responsive layouts

However, do not sacrifice usability for visual decoration.

---

# ONBOARDING

Create a guided onboarding process.

Parent enters:

```text
Child name
Age
Grade
Subjects
Learning goals
Preferred school days
Available hours
Interests
Independence level
```

Then the system should offer:

```text
Recommended curriculum
Recommended schedule
Initial learning assessment
AI-generated learning plan
```

The parent must approve the generated plan before it becomes active.

---

# INITIAL ASSESSMENT

Allow optional AI-assisted baseline assessment.

The system should estimate:

* Current skill level
* Strengths
* Weaknesses
* Knowledge gaps

The assessment must not present AI estimates as guaranteed facts.

Label them as estimates and allow parent correction.

---

# PARENT CONTROL

Parents should control:

* AI enabled/disabled
* AI tutor enabled/disabled
* Subject priorities
* Curriculum
* School schedule
* Daily workload
* Gamification
* Notifications
* Child independence
* AI-generated content approval

---

# AUDITABILITY

Track important changes.

For example:

```text
Parent changed curriculum
Parent changed grade
Lesson generated
Lesson modified
Assessment completed
AI recommendation generated
Mastery changed
Schedule changed
```

Provide audit records where appropriate.

---

# IMPLEMENTATION STRATEGY

Do not attempt to rewrite everything at once.

Work incrementally.

Use this sequence:

## Step 1

Inspect repository.

## Step 2

Document current architecture.

## Step 3

Identify technical debt.

## Step 4

Create target architecture.

## Step 5

Create database migrations.

## Step 6

Create domain/application abstractions.

## Step 7

Implement AI provider abstraction.

## Step 8

Implement AI curriculum generation.

## Step 9

Implement AI lesson generation.

## Step 10

Implement AI assessment generation.

## Step 11

Implement adaptive learning.

## Step 12

Improve scheduling.

## Step 13

Improve dashboards.

## Step 14

Improve Kids Mode.

## Step 15

Implement analytics.

## Step 16

Implement notifications.

## Step 17

Implement security improvements.

## Step 18

Add automated tests.

## Step 19

Optimize performance.

## Step 20

Perform complete regression testing.

---

# CODE QUALITY

Write production-quality code.

Follow the conventions already used by the repository unless they are clearly problematic.

Prefer:

* Small cohesive classes
* Dependency injection
* Interfaces where abstraction is valuable
* Strong typing
* Validation
* Separation of concerns
* Async operations where appropriate
* Centralized error handling
* Centralized configuration
* Testable services

Avoid:

* God classes
* Massive controllers
* Duplicate business logic
* Global mutable state
* Hard-coded secrets
* Hard-coded configuration
* AI calls directly from templates
* Database calls directly from views
* Copy/paste implementations

---

# CONFIGURATION

All environment-specific configuration must be externalized.

Examples:

```text
AI_PROVIDER
AI_MODEL
AI_API_KEY
AI_BASE_URL
DATABASE_CONNECTION
CACHE_CONNECTION
EMAIL_CONFIGURATION
```

Never commit secrets.

Update `.env.example` or equivalent configuration templates.

---

# DOCUMENTATION

Update the repository documentation.

Create/update:

```text
README
Architecture documentation
AI architecture
Database documentation
Development setup
Environment configuration
Testing documentation
Deployment documentation
Security documentation
```

Document how another developer can clone the repository and run it locally.

---

# DEVELOPER EXPERIENCE

A new developer should be able to:

1. Clone repository.
2. Install dependencies.
3. Configure environment.
4. Create database.
5. Run migrations.
6. Start application.
7. Run tests.

Document every required command.

---

# SEED DATA

Create realistic development seed data.

Include:

* Example parent
* Multiple children
* Multiple grades
* Subjects
* Curriculum
* Units
* Topics
* Lessons
* Flashcards
* Assessments
* Progress
* Mastery data

Do not use real personal information.

---

# DEMO EXPERIENCE

After implementation, the application should have a polished demo workflow.

Example:

```text
Parent logs in
      ↓
Creates child
      ↓
Completes onboarding
      ↓
AI recommends curriculum
      ↓
Parent approves
      ↓
AI creates learning plan
      ↓
Daily schedule generated
      ↓
Child enters Kids Mode
      ↓
Child completes lesson
      ↓
Child takes assessment
      ↓
System analyzes results
      ↓
Mastery updated
      ↓
AI recommends next activity
      ↓
Parent sees progress
```

This entire flow should work end-to-end.

---

# IMPORTANT IMPLEMENTATION RULES

## Rule 1 — Inspect First

Do not blindly overwrite files.

## Rule 2 — Preserve Working Features

Enhance rather than destroy.

## Rule 3 — No Fake Features

Do not create buttons that do nothing.

Every implemented UI action must connect to real functionality.

## Rule 4 — No Placeholder AI

Do not create fake AI responses such as:

```text
"AI response goes here"
```

If AI integration is not configured, provide a clean configuration/error state.

## Rule 5 — No Hard-Coded Secrets

Never commit API keys.

## Rule 6 — No Unvalidated AI Data

Validate AI output before persistence.

## Rule 7 — Secure Every Child Resource

Always enforce tenant/household/parent authorization.

## Rule 8 — Keep AI Provider Independent

The application must not be architecturally locked to one AI vendor.

## Rule 9 — Maintainability Over Cleverness

Prefer straightforward code over unnecessary abstraction.

## Rule 10 — Production Readiness

Treat this as a real product, not a prototype.

---

# FINAL ACCEPTANCE CRITERIA

The transformed application must provide a coherent experience where:

### Parent

Can:

* Create multiple children
* Configure each child
* Set grade
* Set learning goals
* Configure schedule
* Select curriculum
* Approve AI-generated curriculum
* Monitor progress
* Review assessments
* Review AI insights
* Configure AI settings
* Manage Kids Mode
* Review reports

### Child

Can:

* Enter Kids Mode
* See today's work
* Complete lessons
* Ask the AI tutor questions
* Complete activities
* Take assessments
* Review flashcards
* Earn optional achievements
* See their progress

### AI

Can:

* Generate curriculum
* Generate lessons
* Generate questions
* Generate assessments
* Analyze performance
* Identify knowledge gaps
* Adjust difficulty
* Recommend activities
* Build study plans
* Generate weekly summaries
* Support tutoring

### System

Must:

* Persist all important learning data
* Secure child data
* Support multiple AI providers
* Validate AI responses
* Track AI usage
* Support background jobs
* Provide meaningful analytics
* Be responsive
* Be accessible
* Be testable
* Be maintainable
* Be deployable

---

# EXECUTION INSTRUCTIONS FOR CLAUDE

Start by inspecting the existing repository thoroughly.

Do not immediately start generating code.

First determine what already exists and what can be reused.

Then create an implementation plan based on the actual repository.

After that, implement the changes incrementally.

For every significant change:

1. Explain what you found.
2. Explain why the change is required.
3. Implement it.
4. Run relevant tests.
5. Fix errors.
6. Check for regressions.
7. Continue to the next phase.

Do not stop after creating an architecture document.

The objective is to **actually modify the cloned repository and produce a working application**.

At the end, provide:

* Summary of architecture
* Files changed
* Database changes
* New features
* AI architecture
* Configuration requirements
* Environment variables
* Commands to run
* Tests executed
* Known limitations
* Recommended next steps

Most importantly:

**Do not build a superficial AI wrapper around the existing application. Transform the repository into a cohesive adaptive AI homeschool learning platform while preserving and improving its existing capabilities.**
