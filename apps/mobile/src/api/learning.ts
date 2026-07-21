import {
  courseOutlineSchema,
  enrollmentListSchema,
  lessonDetailSchema,
  type CourseOutline,
  type EnrollmentItem,
  type LessonDetail,
  type ProgressUpdate,
} from "@elearning/api-contracts/mobile/v1/learning";
import {
  quizForAttemptSchema,
  quizSubmitResponseSchema,
  certificateItemSchema,
  type CertificateItem,
  type QuizForAttempt,
  type QuizSubmitResponse,
} from "@elearning/api-contracts/mobile/v1/quiz";
import { z } from "zod";
import { apiRequest } from "./client";

/* Lern-Endpoints: alle Antworten werden gegen die Contracts geparst –
   ein Vertragsbruch fällt sofort auf, nicht erst im UI. */

export async function fetchEnrollments(
  lang: string
): Promise<EnrollmentItem[]> {
  const raw = await apiRequest<unknown>(
    `/api/mobile/v1/my/enrollments?lang=${lang}`
  );
  return enrollmentListSchema.parse(raw).data;
}

export async function fetchOutline(
  courseId: string,
  lang: string
): Promise<CourseOutline> {
  const raw = await apiRequest<unknown>(
    `/api/mobile/v1/my/courses/${courseId}?lang=${lang}`
  );
  return courseOutlineSchema.parse(raw);
}

export async function fetchLesson(
  lessonId: string,
  lang: string
): Promise<LessonDetail> {
  const raw = await apiRequest<unknown>(
    `/api/mobile/v1/lessons/${lessonId}?lang=${lang}`
  );
  return lessonDetailSchema.parse(raw);
}

export async function markVisited(lessonId: string): Promise<void> {
  await apiRequest(`/api/mobile/v1/lessons/${lessonId}/visit`, {
    method: "POST",
  });
}

export async function saveProgress(
  lessonId: string,
  update: ProgressUpdate
): Promise<void> {
  await apiRequest(`/api/mobile/v1/lessons/${lessonId}/progress`, {
    method: "PATCH",
    body: update,
  });
}

export async function enrollCourse(courseId: string): Promise<void> {
  await apiRequest(`/api/mobile/v1/courses/${courseId}/enroll`, {
    method: "POST",
  });
}

export async function fetchQuiz(quizId: string): Promise<QuizForAttempt> {
  const raw = await apiRequest<unknown>(`/api/mobile/v1/quizzes/${quizId}`);
  return quizForAttemptSchema.parse(raw);
}

export async function submitQuiz(
  quizId: string,
  answers: Record<string, string[]>
): Promise<QuizSubmitResponse> {
  const raw = await apiRequest<unknown>(
    `/api/mobile/v1/quizzes/${quizId}/submit`,
    { method: "POST", body: { answers } }
  );
  return quizSubmitResponseSchema.parse(raw);
}

export async function fetchCertificates(): Promise<CertificateItem[]> {
  const raw = await apiRequest<unknown>("/api/mobile/v1/my/certificates");
  return z.object({ data: z.array(certificateItemSchema) }).parse(raw).data;
}
