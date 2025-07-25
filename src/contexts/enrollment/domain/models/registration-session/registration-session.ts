import { Data, Effect } from "effect";
import { 
  RegistrationSessionId, 
  StudentId, 
  Term,
  CourseId,
  EnrollmentId,
  NonEmptyString
} from "../shared/value-objects.js";
import { MaxUnitsExceeded, DuplicateCourseInSession, InvalidSessionState } from "../../errors/domain-errors.js";

// --- 履修登録セッション状態（代数データ型） ---
export class Draft extends Data.TaggedClass("Draft")<{
  readonly createdAt: Date;
}> {}

export class Submitted extends Data.TaggedClass("Submitted")<{
  readonly submittedAt: Date;
}> {}

export class Approved extends Data.TaggedClass("Approved")<{
  readonly approvedAt: Date;
  readonly approvedBy: NonEmptyString;
}> {}

export class Rejected extends Data.TaggedClass("Rejected")<{
  readonly rejectedAt: Date;
  readonly rejectedBy: NonEmptyString;
  readonly reason: NonEmptyString;
}> {}

export type RegistrationSessionStatus = Draft | Submitted | Approved | Rejected;

// --- 科目情報 ---
export interface CourseInfo {
  readonly courseId: CourseId;
  readonly units: number;
}

// --- 履修エントリー ---
export interface EnrollmentEntry {
  readonly enrollmentId: EnrollmentId;
  readonly courseId: CourseId;
  readonly units: number;
}

// --- 履修登録セッション集約 ---
export class RegistrationSession extends Data.Class<{
  readonly id: RegistrationSessionId;
  readonly studentId: StudentId;
  readonly term: Term;
  readonly enrollments: ReadonlyArray<EnrollmentEntry>;
  readonly status: RegistrationSessionStatus;
  readonly totalUnits: number;
  readonly version: number;
}> {
  // 新規セッションの作成
  static create(
    id: RegistrationSessionId,
    studentId: StudentId,
    term: Term
  ): RegistrationSession {
    return new RegistrationSession({
      id,
      studentId,
      term,
      enrollments: [],
      status: new Draft({ createdAt: new Date() }),
      totalUnits: 0,
      version: 1
    });
  }

  // 科目IDの重複チェック
  hasCourse(courseId: CourseId): boolean {
    return this.enrollments.some(e => e.courseId === courseId);
  }

  // 科目IDリストから重複を検出
  findDuplicateCourses(courseIds: ReadonlyArray<CourseId>): ReadonlyArray<CourseId> {
    const existingCourseIds = new Set(this.enrollments.map(e => e.courseId));
    return courseIds.filter(id => existingCourseIds.has(id));
  }

  // 状態変更が可能かチェック
  canModifyCourses(): boolean {
    return this.status._tag === "Draft";
  }

  // 提出可能かチェック
  canSubmit(): boolean {
    return this.status._tag === "Draft";
  }

  // 承認・却下可能かチェック
  canApproveOrReject(): boolean {
    return this.status._tag === "Submitted";
  }

  // 現在の状態タグを取得
  get statusTag(): string {
    return this.status._tag;
  }

  // 科目追加の事前条件チェック
  validateCoursesAddition(courses: ReadonlyArray<CourseInfo>): Effect.Effect<
    void,
    MaxUnitsExceeded | DuplicateCourseInSession | InvalidSessionState
  > {
    const self = this;
    return Effect.gen(function* () {
      // 1. Draft状態チェック
      if (!self.canModifyCourses()) {
        return yield* Effect.fail(new InvalidSessionState({
          sessionId: self.id,
          currentState: self.statusTag,
          attemptedAction: "addCourses"
        }));
      }

      // 2. 重複科目チェック
      const courseIds = courses.map(c => c.courseId);
      const duplicates = self.findDuplicateCourses(courseIds);
      if (duplicates.length > 0) {
        return yield* Effect.fail(new DuplicateCourseInSession({
          sessionId: self.id,
          duplicateCourseIds: duplicates
        }));
      }

      // 3. 単位数上限チェック
      const requestedUnits = courses.reduce((sum, course) => sum + course.units, 0);
      const newTotalUnits = self.totalUnits + requestedUnits;
      if (newTotalUnits > MAX_UNITS_PER_TERM) {
        return yield* Effect.fail(new MaxUnitsExceeded({
          currentUnits: self.totalUnits,
          requestedUnits,
          maxUnits: MAX_UNITS_PER_TERM
        }));
      }
    });
  }
}

// --- ビジネスルール定数 ---
export const MAX_UNITS_PER_TERM = 20;
export const MIN_UNITS_PER_TERM = 12;