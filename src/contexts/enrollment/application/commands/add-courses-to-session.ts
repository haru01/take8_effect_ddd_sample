import { Effect } from "effect";
import { RegistrationSessionId } from "../../domain/models/shared/value-objects.js";
import { CourseInfo, RegistrationSession, MAX_UNITS_PER_TERM } from "../../domain/models/registration-session/registration-session.js";
import { RegistrationSessionRepository } from "../../domain/repositories/registration-session-repository.js";
import { EventStore } from "../../../shared/kernel/types/event-store.js";
import { EventBus } from "../../../shared/kernel/types/event-bus.js";
import { CoursesAddedToSession, EnrollmentsRequestedBatch } from "../../domain/events/registration-session-events.js";
import { EnrollmentId } from "../../domain/models/shared/value-objects.js";
import { InvalidSessionState, DuplicateCourseInSession, MaxUnitsExceeded } from "../../domain/errors/domain-errors.js";

export interface AddCoursesToSessionCommand {
  readonly sessionId: RegistrationSessionId;
  readonly courses: ReadonlyArray<CourseInfo>;
}

// 個別バリデーション関数群（ビジネスルールの明示化）

// セッションがDraft状態であることを検証
const validateセッションがドラフト状態であること = (
  session: RegistrationSession
): Effect.Effect<void, InvalidSessionState> =>
  Effect.gen(function* () {
    if (!session.canModifyCourses()) {
      return yield* Effect.fail(new InvalidSessionState({
        sessionId: session.id,
        currentState: session.statusTag,
        attemptedAction: "addCourses"
      }));
    }
  });

// 科目が重複していないことを検証
const validate科目が重複していないこと = (
  session: RegistrationSession,
  courses: ReadonlyArray<CourseInfo>
): Effect.Effect<void, DuplicateCourseInSession> =>
  Effect.gen(function* () {
    const courseIds = courses.map(c => c.courseId);
    const duplicates = session.findDuplicateCourses(courseIds);
    if (duplicates.length > 0) {
      return yield* Effect.fail(new DuplicateCourseInSession({
        sessionId: session.id,
        duplicateCourseIds: duplicates
      }));
    }
  });

// 単位数上限を超えていないことを検証
const validate単位数上限を超えていないこと = (
  session: RegistrationSession,
  courses: ReadonlyArray<CourseInfo>
): Effect.Effect<void, MaxUnitsExceeded> =>
  Effect.gen(function* () {
    const requestedUnits = courses.reduce((sum, course) => sum + course.units, 0);
    const newTotalUnits = session.totalUnits + requestedUnits;
    if (newTotalUnits > MAX_UNITS_PER_TERM) {
      return yield* Effect.fail(new MaxUnitsExceeded({
        currentUnits: session.totalUnits,
        requestedUnits,
        maxUnits: MAX_UNITS_PER_TERM
      }));
    }
  });

export const addCoursesToSession = (
  command: AddCoursesToSessionCommand
) =>
  Effect.gen(function* () {
    const eventStore = yield* EventStore;
    const eventBus = yield* EventBus;
    const repository = yield* RegistrationSessionRepository;

    const { sessionId, courses } = command;

    // 1. セッション存在確認・取得 (Repository経由で集約再構築)
    const session = yield* repository.findById(sessionId);

    // 2. ビジネスルール検証（明示的なバリデーション）
    yield* validateセッションがドラフト状態であること(session);
    yield* validate科目が重複していないこと(session, courses);
    yield* validate単位数上限を超えていないこと(session, courses);

    // 3. 科目追加イベント生成・保存
    const coursesAddedEvent = new CoursesAddedToSession({
      sessionId,
      addedCourses: courses,
      addedAt: new Date()
    });

    yield* eventStore.appendEvent(sessionId, "RegistrationSession", coursesAddedEvent);

    // 4. 履修要求バッチイベント生成・保存
    const enrollmentRequests = courses.map(course => {
      const enrollmentId = EnrollmentId.create(session.studentId, course.courseId, session.term);
      return {
        enrollmentId,
        courseId: course.courseId,
        units: course.units
      };
    });

    const enrollmentsRequestedEvent = new EnrollmentsRequestedBatch({
      sessionId,
      enrollmentRequests,
      requestedAt: new Date()
    });

    yield* eventStore.appendEvent(sessionId, "RegistrationSession", enrollmentsRequestedEvent);

    // 5. イベントパブリッシュ
    yield* eventBus.publish(coursesAddedEvent);
    yield* eventBus.publish(enrollmentsRequestedEvent);

    return sessionId;
  });