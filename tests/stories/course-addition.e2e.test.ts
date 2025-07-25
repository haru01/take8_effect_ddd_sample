import { describe, it } from "vitest";
import { Effect, Layer, Ref } from "effect";
import { createRegistrationSession } from "../../src/contexts/enrollment/application/commands/create-registration-session.js";
import { addCoursesToSession } from "../../src/contexts/enrollment/application/commands/add-courses-to-session.js";
import { StudentId, Term, CourseId, RegistrationSessionId } from "../../src/contexts/enrollment/domain/models/shared/value-objects.js";
import { CourseInfo } from "../../src/contexts/enrollment/domain/models/registration-session/registration-session.js";
import { InMemoryEventStore } from "../../src/contexts/shared/infrastructure/event-store/in-memory-event-store.js";
import { InMemoryRegistrationSessionRepository } from "../../src/contexts/enrollment/infrastructure/persistence/in-memory-registration-session-repository.js";
import { InMemoryEventBus } from "../../src/contexts/shared/infrastructure/event-bus/in-memory-event-bus.js";
import { EventBus } from "../../src/contexts/shared/kernel/types/event-bus.js";
import { DomainEvent } from "../../src/contexts/enrollment/domain/events/registration-session-events.js";
import {
  assertCoursesAddedSuccessfully,
  assertMaxUnitsExceededError,
  assertDuplicateCourseError,
  assertSessionNotFoundError
} from "../helpers/assertions.js";

describe("Story 2: 科目一括追加", () => {
  const TestLayer = Layer.mergeAll(
    InMemoryEventStore,
    InMemoryEventBus,
    InMemoryRegistrationSessionRepository.pipe(
      Layer.provide(Layer.mergeAll(InMemoryEventStore, InMemoryEventBus))
    )
  );

  describe("受け入れ条件", () => {
    it("複数科目を一度に追加できる", () =>
      Effect.gen(function* () {
        // Arrange
        const studentId = StudentId.make("S12345678");
        const term = Term.make("2024-Spring");
        
        // イベントキャプチャ用
        const capturedEvents = yield* Ref.make<DomainEvent[]>([]);
        const eventBus = yield* EventBus;
        
        yield* eventBus.subscribe((event) =>
          Ref.update(capturedEvents, (events) => [...events, event])
        );

        // セッション作成
        const sessionId = yield* createRegistrationSession({ studentId, term });

        // 追加する科目
        const coursesToAdd: CourseInfo[] = [
          { courseId: CourseId.make("C123456"), units: 3 },
          { courseId: CourseId.make("C234567"), units: 4 },
          { courseId: CourseId.make("C345678"), units: 2 }
        ];

        // Act
        yield* addCoursesToSession({ sessionId, courses: coursesToAdd });

        // Assert
        yield* assertCoursesAddedSuccessfully({
          sessionId,
          addedCourses: coursesToAdd,
          capturedEvents
        });
      })
        .pipe(Effect.provide(TestLayer))
        .pipe(Effect.runPromise)
    );

    it("単位数上限（20単位）を超える追加は失敗する", () =>
      Effect.gen(function* () {
        // Arrange
        const studentId = StudentId.make("S12345678");
        const term = Term.make("2024-Spring");
        const sessionId = yield* createRegistrationSession({ studentId, term });

        // 上限を超える科目（合計21単位）
        const coursesToAdd: CourseInfo[] = [
          { courseId: CourseId.make("C123456"), units: 10 },
          { courseId: CourseId.make("C234567"), units: 11 }
        ];

        // Act & Assert
        const error = yield* addCoursesToSession({ sessionId, courses: coursesToAdd }).pipe(
          Effect.flip
        );

        assertMaxUnitsExceededError(error, {
          currentUnits: 0,
          requestedUnits: 21,
          maxUnits: 20
        });
      })
        .pipe(Effect.provide(TestLayer))
        .pipe(Effect.runPromise)
    );

    it("重複科目の追加は失敗する", () =>
      Effect.gen(function* () {
        // Arrange
        const studentId = StudentId.make("S12345678");
        const term = Term.make("2024-Spring");
        const sessionId = yield* createRegistrationSession({ studentId, term });

        // 最初の科目追加（成功）
        const firstCourses: CourseInfo[] = [
          { courseId: CourseId.make("C123456"), units: 3 }
        ];
        yield* addCoursesToSession({ sessionId, courses: firstCourses });

        // 重複科目を含む追加（失敗）
        const duplicateCourses: CourseInfo[] = [
          { courseId: CourseId.make("C123456"), units: 3 }, // 重複
          { courseId: CourseId.make("C234567"), units: 4 }
        ];

        // Act & Assert
        const error = yield* addCoursesToSession({ sessionId, courses: duplicateCourses }).pipe(
          Effect.flip
        );

        assertDuplicateCourseError(error, [CourseId.make("C123456")]);
      })
        .pipe(Effect.provide(TestLayer))
        .pipe(Effect.runPromise)
    );

    it("存在しないセッションへの科目追加は失敗する", () =>
      Effect.gen(function* () {
        // Arrange
        const studentId = StudentId.make("S12345678");
        const term = Term.make("2024-Spring");
        const nonExistentSessionId = yield* RegistrationSessionId.create(studentId, term);
        const coursesToAdd: CourseInfo[] = [
          { courseId: CourseId.make("C123456"), units: 3 }
        ];

        // Act & Assert
        const error = yield* addCoursesToSession({ 
          sessionId: nonExistentSessionId, 
          courses: coursesToAdd 
        }).pipe(Effect.flip);

        assertSessionNotFoundError(error, nonExistentSessionId);
      })
        .pipe(Effect.provide(TestLayer))
        .pipe(Effect.runPromise)
    );

    it("Draft状態以外での科目追加は失敗する", () =>
      Effect.gen(function* () {
        // TODO: セッションをSubmitted状態に変更する機能が実装されたら有効化
        // 現在はDraft状態のみ実装されているため、このテストはスキップ
        // 将来のストーリー3（履修登録提出）実装後に有効化予定
      })
        .pipe(Effect.provide(TestLayer))
        .pipe(Effect.runPromise)
    );
  });
});