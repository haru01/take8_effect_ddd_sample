import { Data } from "effect";
import { RegistrationSessionId, StudentId, Term, CourseId, EnrollmentId } from "../models/shared/value-objects.js";
import { CourseInfo } from "../models/registration-session/registration-session.js";

// --- 履修登録セッション関連ドメインイベント ---

export class RegistrationSessionCreated extends Data.TaggedClass("RegistrationSessionCreated")<{
  readonly sessionId: RegistrationSessionId;
  readonly studentId: StudentId;
  readonly term: Term;
  readonly createdAt: Date;
}> {}

export class CoursesAddedToSession extends Data.TaggedClass("CoursesAddedToSession")<{
  readonly sessionId: RegistrationSessionId;
  readonly addedCourses: ReadonlyArray<CourseInfo>;
  readonly enrollmentRequests: ReadonlyArray<{
    readonly enrollmentId: EnrollmentId;
    readonly courseId: CourseId;
    readonly units: number;
  }>;
  readonly addedAt: Date;
}> {}

// 将来的に追加されるその他のセッションイベント（コメントアウト）
/*
export class RegistrationSessionSubmitted extends Data.TaggedClass("RegistrationSessionSubmitted")<{
  readonly sessionId: RegistrationSessionId;
  readonly submittedAt: Date;
}> {}

export class RegistrationSessionApproved extends Data.TaggedClass("RegistrationSessionApproved")<{
  readonly sessionId: RegistrationSessionId;
  readonly approvedBy: string;
  readonly approvedAt: Date;
}> {}

export class RegistrationSessionRejected extends Data.TaggedClass("RegistrationSessionRejected")<{
  readonly sessionId: RegistrationSessionId;
  readonly rejectedBy: string;
  readonly reason: string;
  readonly rejectedAt: Date;
}> {}
*/

export type RegistrationSessionEvent =
  | RegistrationSessionCreated
  | CoursesAddedToSession;
  // | RegistrationSessionSubmitted
  // | RegistrationSessionApproved
  // | RegistrationSessionRejected;

export type DomainEvent = RegistrationSessionEvent;