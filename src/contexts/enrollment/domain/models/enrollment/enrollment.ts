import { Data, Option } from "effect";
import { 
  EnrollmentId,
  RegistrationSessionId,
  StudentId,
  CourseId,
  Term,
  Grade,
  NonEmptyString
} from "../shared/value-objects.js";

// --- 履修状態（代数データ型） ---
export class Requested extends Data.TaggedClass("Requested")<{
  readonly requestedAt: Date;
}> {}

export class Approved extends Data.TaggedClass("Approved")<{
  readonly approvedAt: Date;
  readonly approvedBy: NonEmptyString;
}> {}

export class InProgress extends Data.TaggedClass("InProgress")<{
  readonly startedAt: Date;
}> {}

export class Completed extends Data.TaggedClass("Completed")<{
  readonly completedAt: Date;
  readonly grade: Grade;
}> {}

export class Cancelled extends Data.TaggedClass("Cancelled")<{
  readonly cancelledAt: Date;
  readonly reason: NonEmptyString;
}> {}

export class Withdrawn extends Data.TaggedClass("Withdrawn")<{
  readonly withdrawnAt: Date;
  readonly reason: Option.Option<NonEmptyString>;
}> {}

export type EnrollmentStatus = Requested | Approved | InProgress | Completed | Cancelled | Withdrawn;

// --- 履修エンティティ ---
export class Enrollment extends Data.Class<{
  readonly id: EnrollmentId;
  readonly sessionId: RegistrationSessionId;
  readonly studentId: StudentId;
  readonly courseId: CourseId;
  readonly term: Term;
  readonly status: EnrollmentStatus;
  readonly version: number;
}> {
  // 新規履修の作成
  static create(
    id: EnrollmentId,
    sessionId: RegistrationSessionId,
    studentId: StudentId,
    courseId: CourseId,
    term: Term
  ): Enrollment {
    return new Enrollment({
      id,
      sessionId,
      studentId,
      courseId,
      term,
      status: new Requested({ requestedAt: new Date() }),
      version: 1
    });
  }

  // 承認可能かチェック
  canApprove(): boolean {
    return this.status._tag === "Requested";
  }

  // 開始可能かチェック
  canStart(): boolean {
    return this.status._tag === "Approved";
  }

  // 完了可能かチェック
  canComplete(): boolean {
    return this.status._tag === "InProgress";
  }

  // 離脱可能かチェック
  canWithdraw(): boolean {
    return this.status._tag === "InProgress";
  }

  // キャンセル可能かチェック
  canCancel(): boolean {
    return this.status._tag === "Requested" || this.status._tag === "Approved";
  }

  // 成績が設定されているかチェック
  hasGrade(): boolean {
    return this.status._tag === "Completed" || this.status._tag === "Withdrawn";
  }

  // 成績を取得（Completed状態またはWithdrawn状態の場合）
  getGrade(): Option.Option<Grade> {
    if (this.status._tag === "Completed") {
      return Option.some(this.status.grade);
    }
    if (this.status._tag === "Withdrawn") {
      return Option.some("W" as Grade);
    }
    return Option.none();
  }

  // 現在の状態タグを取得
  get statusTag(): string {
    return this.status._tag;
  }
}