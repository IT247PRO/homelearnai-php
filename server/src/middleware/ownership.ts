import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { HttpError } from './errorHandler.js';

type OwnedResource =
  | 'child'
  | 'subject'
  | 'unit'
  | 'topic'
  | 'flashcard'
  | 'review'
  | 'studyPlan'
  | 'timeBlock'
  | 'learningSession'
  | 'catchUpSession'
  | 'reviewSlot'
  | 'assessment'
  | 'assessmentAttempt'
  | 'lesson'
  | 'fileAsset'
  | 'aiRecommendation'
  | 'curriculum'
  | 'curriculumUnit'
  | 'curriculumTopic'
  | 'curriculumLesson'
  | 'curriculumSkill'
  | 'curriculumObjective'
  | 'curriculumPrerequisite'
  | 'childCurriculum';

async function resolveOwnerUserId(resource: OwnedResource, id: number): Promise<number | null> {
  switch (resource) {
    case 'child': {
      const child = await prisma.child.findUnique({ where: { id } });
      return child?.userId ?? null;
    }
    case 'subject': {
      const subject = await prisma.subject.findUnique({ where: { id } });
      return subject?.userId ?? null;
    }
    case 'unit': {
      const unit = await prisma.unit.findUnique({ where: { id }, include: { subject: true } });
      return unit?.subject.userId ?? null;
    }
    case 'topic': {
      const topic = await prisma.topic.findUnique({
        where: { id },
        include: { unit: { include: { subject: true } } },
      });
      return topic?.unit.subject.userId ?? null;
    }
    case 'flashcard': {
      const flashcard = await prisma.flashcard.findUnique({
        where: { id },
        include: { topic: { include: { unit: { include: { subject: true } } } } },
      });
      return flashcard?.topic.unit.subject.userId ?? null;
    }
    case 'review': {
      const review = await prisma.review.findUnique({ where: { id }, include: { child: true } });
      return review?.child.userId ?? null;
    }
    case 'studyPlan': {
      const studyPlan = await prisma.studyPlan.findUnique({ where: { id }, include: { child: true } });
      return studyPlan?.child.userId ?? null;
    }
    case 'timeBlock': {
      const timeBlock = await prisma.timeBlock.findUnique({ where: { id }, include: { child: true } });
      return timeBlock?.child.userId ?? null;
    }
    case 'learningSession': {
      const session = await prisma.learningSession.findUnique({ where: { id }, include: { child: true } });
      return session?.child.userId ?? null;
    }
    case 'catchUpSession': {
      const catchUp = await prisma.catchUpSession.findUnique({ where: { id }, include: { child: true } });
      return catchUp?.child.userId ?? null;
    }
    case 'reviewSlot': {
      const slot = await prisma.reviewSlot.findUnique({ where: { id }, include: { child: true } });
      return slot?.child.userId ?? null;
    }
    case 'assessment': {
      const assessment = await prisma.assessment.findUnique({
        where: { id },
        include: {
          topic: { include: { unit: { include: { subject: true } } } },
          unit: { include: { subject: true } },
        },
      });
      return assessment?.topic?.unit.subject.userId ?? assessment?.unit?.subject.userId ?? null;
    }
    case 'assessmentAttempt': {
      const attempt = await prisma.assessmentAttempt.findUnique({ where: { id }, include: { child: true } });
      return attempt?.child.userId ?? null;
    }
    case 'lesson': {
      const lesson = await prisma.lesson.findUnique({
        where: { id },
        include: { topic: { include: { unit: { include: { subject: true } } } } },
      });
      return lesson?.topic.unit.subject.userId ?? null;
    }
    case 'fileAsset': {
      const asset = await prisma.fileAsset.findUnique({ where: { id } });
      return asset?.ownerUserId ?? null;
    }
    case 'aiRecommendation': {
      const recommendation = await prisma.aiRecommendation.findUnique({ where: { id }, include: { child: true } });
      return recommendation?.child.userId ?? null;
    }
    case 'curriculum': {
      const curriculum = await prisma.curriculum.findUnique({ where: { id } });
      return curriculum?.userId ?? null;
    }
    case 'curriculumUnit': {
      const unit = await prisma.curriculumUnit.findUnique({ where: { id }, include: { curriculum: true } });
      return unit?.curriculum.userId ?? null;
    }
    case 'curriculumTopic': {
      const topic = await prisma.curriculumTopic.findUnique({
        where: { id },
        include: { unit: { include: { curriculum: true } } },
      });
      return topic?.unit.curriculum.userId ?? null;
    }
    case 'curriculumLesson': {
      const lesson = await prisma.curriculumLesson.findUnique({
        where: { id },
        include: { topic: { include: { unit: { include: { curriculum: true } } } } },
      });
      return lesson?.topic.unit.curriculum.userId ?? null;
    }
    case 'curriculumSkill': {
      const skill = await prisma.curriculumSkill.findUnique({
        where: { id },
        include: { topic: { include: { unit: { include: { curriculum: true } } } } },
      });
      return skill?.topic.unit.curriculum.userId ?? null;
    }
    case 'curriculumObjective': {
      const objective = await prisma.curriculumObjective.findUnique({
        where: { id },
        include: { topic: { include: { unit: { include: { curriculum: true } } } } },
      });
      return objective?.topic.unit.curriculum.userId ?? null;
    }
    case 'curriculumPrerequisite': {
      const prerequisite = await prisma.curriculumPrerequisite.findUnique({
        where: { id },
        include: { topic: { include: { unit: { include: { curriculum: true } } } } },
      });
      return prerequisite?.topic.unit.curriculum.userId ?? null;
    }
    case 'childCurriculum': {
      const childCurriculum = await prisma.childCurriculum.findUnique({ where: { id }, include: { child: true } });
      return childCurriculum?.child.userId ?? null;
    }
  }
}

/**
 * Confirms the resource identified by req.params[paramName] belongs (directly or via its
 * FK chain up to Subject.userId) to the authenticated user. Responds 404 rather than 403 on
 * mismatch so a guessed id doesn't confirm another household's data exists.
 */
export function requireOwnership(resource: OwnedResource, paramName: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const id = Number(req.params[paramName]);
    if (!Number.isInteger(id)) return next(new HttpError(400, 'invalid_id'));

    const ownerUserId = await resolveOwnerUserId(resource, id);
    if (ownerUserId === null || ownerUserId !== req.userId) {
      return next(new HttpError(404, 'not_found'));
    }
    next();
  };
}
