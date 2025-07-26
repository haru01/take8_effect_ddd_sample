import { Effect } from "effect";
import { RegistrationSessionId } from "../../domain/models/shared/value-objects.js";
import { CourseInfo } from "../../domain/models/registration-session/registration-session.js";
import { RegistrationSessionRepository } from "../../domain/repositories/registration-session-repository.js";
import { EventStore } from "../../../shared/kernel/types/event-store.js";
import { EventBus } from "../../../shared/kernel/types/event-bus.js";
import { CoursesAddedToSession } from "../../domain/events/registration-session-events.js";
import { EnrollmentId } from "../../domain/models/shared/value-objects.js";
import { createValidationBuilder } from "../../../shared/kernel/validation/validation-builder.js";
import { validateDraftState, validateNoDuplicates, validateUnitLimit } from "../../domain/models/registration-session/registration-session.js";

export interface AddCoursesToSessionCommand {
  readonly sessionId: RegistrationSessionId;
  readonly courses: ReadonlyArray<CourseInfo>;
}

// バリデーション関数はドメインサービスから利用

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

    // 2. ビジネスルール検証（ビルダーパターンによるバリデーション）
    const validation = createValidationBuilder()
      .add(validateDraftState(session))
      .add(validateNoDuplicates(session, courses))
      .add(validateUnitLimit(session, courses))
      .execute();
    yield* validation;

    // 3. 履修要求情報生成
    const enrollmentRequests = courses.map(course => {
      const enrollmentId = EnrollmentId.create(session.studentId, course.courseId, session.term);
      return {
        enrollmentId,
        courseId: course.courseId,
        units: course.units
      };
    });

    // 4. 統合イベント生成・保存
    const coursesAddedEvent = new CoursesAddedToSession({
      sessionId,
      addedCourses: courses,
      enrollmentRequests,
      addedAt: new Date()
    });

    yield* eventStore.appendEvent(sessionId, "RegistrationSession", coursesAddedEvent);

    // 5. イベントパブリッシュ
    yield* eventBus.publish(coursesAddedEvent);

    return sessionId;
  });