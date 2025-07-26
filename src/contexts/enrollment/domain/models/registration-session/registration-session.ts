import { Data, Effect } from "effect";
import {
  RegistrationSessionId,
  StudentId,
  Term,
  CourseId,
  EnrollmentId,
  NonEmptyString
} from "../shared/value-objects.js";
import { InvalidSessionState, DuplicateCourseInSession, MaxUnitsExceeded } from "../../errors/domain-errors.js";
import { CoursesAddedToSession, RegistrationSessionCreated } from "../../events/registration-session-events.js";

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
}

// --- ビジネスルール定数 ---
export const MAX_UNITS_PER_TERM = 20;
export const MIN_UNITS_PER_TERM = 12;

// --- バリデーション関数群 ---
// XXX: ファイルサイズが大きくなったら分割することを検討

/**
 * Draft状態のセッションに科目を追加できるかチェック
 * @param session - 対象の履修登録セッション
 * @returns - Draft状態であれば成功、そうでなければInvalidSessionState
 */
export const validateDraftState = (session: RegistrationSession) =>
  session.canModifyCourses()
    ? Effect.void
    : Effect.fail(new InvalidSessionState({
        sessionId: session.id,
        currentState: session.statusTag,
        attemptedAction: "addCourses"
      }));

/**
 * 重複科目がないかチェック
 * @param session - 対象の履修登録セッション
 * @param courses - 追加する科目のリスト
 * @returns - 重複がなければ成功、重複があればDuplicateCourseInSessionエラー
 *
 * @remarks 重複したらエラーではなくて、除外するようにする案もあるが一旦はこのままで。
 */
export const validateNoDuplicates = (session: RegistrationSession, courses: ReadonlyArray<CourseInfo>) => {
  const duplicates = session.findDuplicateCourses(courses.map(c => c.courseId));
  return duplicates.length === 0
    ? Effect.void
    : Effect.fail(new DuplicateCourseInSession({
        sessionId: session.id,
        duplicateCourseIds: duplicates
      }));
};

/**
 * 単位数の上限を超えないかチェック
 * @param session - 対象の履修登録セッション
 * @param courses - 追加する科目のリスト
 * @returns - 上限を超えなければ成功、超えたらMaxUnitsExceededエラー
 *
 * @remarks MAX_UNITS_PER_TERM は 固定値でハードコードされているが、将来的には設定可能にすることも検討
 */
export const validateUnitLimit = (session: RegistrationSession, courses: ReadonlyArray<CourseInfo>) => {
  const newTotal = session.totalUnits + courses.reduce((sum, c) => sum + c.units, 0);
  return newTotal <= MAX_UNITS_PER_TERM
    ? Effect.void
    : Effect.fail(new MaxUnitsExceeded({
        currentUnits: session.totalUnits,
        requestedUnits: courses.reduce((sum, c) => sum + c.units, 0),
        maxUnits: MAX_UNITS_PER_TERM
      }));
};

// --- ドメインロジック関数群 ---
// XXX: ファイルサイズが大きくなったら分割することを検討

/**
 * 履修登録セッションを作成するコマンド
 * @param sessionId - セッションID
 * @param studentId - 学生ID
 * @param term - 対象学期
 * @returns - RegistrationSessionCreatedイベント
 */
export const createRegistrationSession = (
  sessionId: RegistrationSessionId,
  studentId: StudentId,
  term: Term
): RegistrationSessionCreated => {
  return new RegistrationSessionCreated({
    sessionId,
    studentId,
    term,
    createdAt: new Date()
  });
};

/**
 * 科目をセッションに追加するドメインロジック
 *
 * @param session - 対象の履修登録セッション
 * @param courses - 追加する科目のリスト
 * @returns - CoursesAddedToSessionイベント
 * @throws - InvalidSessionState, DuplicateCourseInSession, MaxUnitsExceeded
 * @remarks
 * - セッションがDraft状態であることを確認
 * - 重複科目がないことを確認
 * - 単位数の上限を超えないことを確認
 * - 履修要求情報を生成
 * - CoursesAddedToSessionイベントを生成
 *
 * この関数は、Effectを返すので、呼び出し側でEffect.runPromiseなどで実行する必要があります。
 * この関数は、ドメインイベントを生成するためのもので、セッションの状態を直接変更するものではありません。
 */
export const addCoursesToSession = (
  session: RegistrationSession,
  courses: ReadonlyArray<CourseInfo>
): Effect.Effect<
  CoursesAddedToSession,
  InvalidSessionState | DuplicateCourseInSession | MaxUnitsExceeded
> => Effect.gen(function* () {
  // バリデーション実行
  // XXX: エラーを複数検出した場合は、最初に検出されたエラーのみを返すになっているので注意
  yield* validateDraftState(session);
  yield* validateNoDuplicates(session, courses);
  yield* validateUnitLimit(session, courses);

  // 履修要求情報生成
  const enrollmentRequests = courses.map(course => {
    const enrollmentId = EnrollmentId.create(session.studentId, course.courseId, session.term);
    return {
      enrollmentId,
      courseId: course.courseId,
      units: course.units
    };
  });

  // イベント生成
  return new CoursesAddedToSession({
    sessionId: session.id,
    addedCourses: courses,
    enrollmentRequests,
    addedAt: new Date()
  });
});