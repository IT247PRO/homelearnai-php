import { prisma } from '../lib/prisma.js';

export interface CurriculumQualityWarning {
  severity: 'warning' | 'info';
  message: string;
  unitId?: number;
  topicId?: number;
}

export interface OutlineUnit {
  id: number;
  title: string;
  topics: OutlineTopic[];
}

export interface OutlineTopic {
  id: number;
  title: string;
  objectiveCount: number;
}

export interface PrerequisiteEdge {
  topicId: number;
  requiresTopicId: number;
}

const LARGE_UNIT_TOPIC_COUNT = 10;

/**
 * Pure analysis over a plain-object outline shape (plan2.md §40's deterministic,
 * non-AI quality checks). Kept separate from the Prisma fetch below so it's testable
 * without a database, matching this codebase's convention for DB-backed services
 * (e.g. qualityHeuristics.ts's ageGroupForGrade).
 */
export function analyzeCurriculumOutline(units: OutlineUnit[], prerequisiteEdges: PrerequisiteEdge[]): CurriculumQualityWarning[] {
  const warnings: CurriculumQualityWarning[] = [];
  const titleCounts = new Map<string, number>();

  for (const unit of units) {
    if (unit.topics.length > LARGE_UNIT_TOPIC_COUNT) {
      warnings.push({
        severity: 'warning',
        message: `"${unit.title}" has ${unit.topics.length} topics — consider splitting it into two units.`,
        unitId: unit.id,
      });
    }

    for (const topic of unit.topics) {
      const key = topic.title.trim().toLowerCase();
      titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1);

      if (topic.objectiveCount === 0) {
        warnings.push({
          severity: 'warning',
          message: `"${topic.title}" has no learning objectives yet.`,
          unitId: unit.id,
          topicId: topic.id,
        });
      }
    }
  }

  for (const [title, count] of titleCounts) {
    if (count > 1) {
      warnings.push({ severity: 'info', message: `The topic title "${title}" appears ${count} times across this curriculum.` });
    }
  }

  for (const topicId of detectPrerequisiteCycles(prerequisiteEdges)) {
    warnings.push({
      severity: 'warning',
      message: 'This topic is part of a prerequisite cycle (it depends, directly or indirectly, on itself). Remove one of the prerequisite links.',
      topicId,
    });
  }

  return warnings;
}

/** DFS cycle detection over a topic-to-topic "requires" edge list. Returns the ids of
 * topics that participate in at least one cycle. Pure — no database access. */
export function detectPrerequisiteCycles(edges: PrerequisiteEdge[]): number[] {
  const adjacency = new Map<number, number[]>();
  for (const edge of edges) {
    const list = adjacency.get(edge.topicId) ?? [];
    list.push(edge.requiresTopicId);
    adjacency.set(edge.topicId, list);
  }

  const cyclic = new Set<number>();
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<number, number>();

  function visit(nodeId: number, stack: number[]) {
    color.set(nodeId, GRAY);
    stack.push(nodeId);

    for (const nextId of adjacency.get(nodeId) ?? []) {
      const nextColor = color.get(nextId) ?? WHITE;
      if (nextColor === GRAY) {
        const cycleStart = stack.indexOf(nextId);
        for (const id of stack.slice(cycleStart)) cyclic.add(id);
      } else if (nextColor === WHITE) {
        visit(nextId, stack);
      }
    }

    stack.pop();
    color.set(nodeId, BLACK);
  }

  for (const nodeId of adjacency.keys()) {
    if ((color.get(nodeId) ?? WHITE) === WHITE) visit(nodeId, []);
  }

  return [...cyclic];
}

/** DB-backed wrapper: fetches one curriculum's outline and runs the pure checks above. */
export async function runCurriculumQualityChecks(curriculumId: number): Promise<CurriculumQualityWarning[]> {
  const [units, prerequisiteEdges] = await Promise.all([
    prisma.curriculumUnit.findMany({
      where: { curriculumId },
      include: { topics: { include: { objectives: true } } },
    }),
    prisma.curriculumPrerequisite.findMany({
      where: { topic: { unit: { curriculumId } } },
      select: { topicId: true, requiresTopicId: true },
    }),
  ]);

  const outlineUnits: OutlineUnit[] = units.map((unit) => ({
    id: unit.id,
    title: unit.title,
    topics: unit.topics.map((topic) => ({ id: topic.id, title: topic.title, objectiveCount: topic.objectives.length })),
  }));

  return analyzeCurriculumOutline(outlineUnits, prerequisiteEdges);
}
