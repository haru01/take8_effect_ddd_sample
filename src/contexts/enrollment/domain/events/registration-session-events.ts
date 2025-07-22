import { Data } from "effect";
import { RegistrationSessionId, StudentId, Term } from "../models/shared/value-objects.js";

// --- 履修登録セッション関連ドメインイベント ---

export class RegistrationSessionCreated extends Data.TaggedClass("RegistrationSessionCreated")<{
  readonly sessionId: RegistrationSessionId;
  readonly studentId: StudentId;
  readonly term: Term;
  readonly createdAt: Date;
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
  | RegistrationSessionCreated;
  // | RegistrationSessionSubmitted
  // | RegistrationSessionApproved
  // | RegistrationSessionRejected;

export type DomainEvent = RegistrationSessionEvent;