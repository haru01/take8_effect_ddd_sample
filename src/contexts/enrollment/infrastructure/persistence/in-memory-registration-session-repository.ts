import { Effect, Layer } from "effect";
import { RegistrationSession, Draft, EnrollmentEntry } from "../../domain/models/registration-session/registration-session.js";
import { RegistrationSessionRepository } from "../../domain/repositories/registration-session-repository.js";
import { EventStore } from "../../../shared/kernel/types/event-store.js";
import { DomainEvent, RegistrationSessionCreated, EnrollmentsRequestedBatch } from "../../domain/events/registration-session-events.js";
import { SessionNotFound, ReconstructionFailed } from "../../domain/errors/domain-errors.js";

// イベントからRegistrationSessionを再構築する関数
const reconstructFromEvents = (
  events: ReadonlyArray<DomainEvent>
): Effect.Effect<RegistrationSession, ReconstructionFailed> => {
  return Effect.gen(function* () {
    if (events.length === 0) {
      return yield* Effect.fail(new ReconstructionFailed({
        reason: "イベントが空です",
        eventCount: 0
      }));
    }

    // 最初のイベントはRegistrationSessionCreatedである必要がある
    const firstEvent = events[0];
    if (firstEvent._tag !== "RegistrationSessionCreated") {
      return yield* Effect.fail(new ReconstructionFailed({
        reason: `最初のイベントがRegistrationSessionCreatedではありません: ${firstEvent._tag}`,
        eventCount: events.length
      }));
    }

    const createdEvent = firstEvent as RegistrationSessionCreated;
    
    // 初期状態を作成
    let session = new RegistrationSession({
      id: createdEvent.sessionId,
      studentId: createdEvent.studentId,
      term: createdEvent.term,
      enrollments: [],
      status: new Draft({ createdAt: createdEvent.createdAt }),
      totalUnits: 0,
      version: 1
    });

    // 残りのイベントを適用してセッション状態を再構築
    for (let i = 1; i < events.length; i++) {
      const event = events[i];
      
      switch (event._tag) {
        case "CoursesAddedToSession": {
          // CoursesAddedToSessionイベントは記録するが、EnrollmentsRequestedBatchで実際の履修エントリを追加する
          break;
        }
        
        case "EnrollmentsRequestedBatch": {
          const enrollmentsRequestedEvent = event as EnrollmentsRequestedBatch;
          // 履修エントリを追加してセッション状態を更新
          const newEnrollments: EnrollmentEntry[] = enrollmentsRequestedEvent.enrollmentRequests.map(req => ({
            enrollmentId: req.enrollmentId,
            courseId: req.courseId,
            units: req.units
          }));
          
          const newTotalUnits = session.totalUnits + newEnrollments.reduce((sum, e) => sum + e.units, 0);
          
          session = new RegistrationSession({
            ...session,
            enrollments: [...session.enrollments, ...newEnrollments],
            totalUnits: newTotalUnits,
            version: session.version + 1
          });
          break;
        }
        
        default:
          // 未知のイベントタイプは警告するが処理は続行
          console.warn(`未処理のイベントタイプ: ${event._tag}`);
          break;
      }
    }

    return session;
  });
};

export const InMemoryRegistrationSessionRepository = Layer.effect(
  RegistrationSessionRepository,
  Effect.gen(function* () {
    const eventStore = yield* EventStore;

    return {
      findById: (id) =>
        Effect.gen(function* () {
          const events = yield* eventStore.getEvents(id, "RegistrationSession");
          const session = yield* reconstructFromEvents(events);
          return session;
        }).pipe(
          Effect.catchAll(() => 
            Effect.fail(new SessionNotFound({ sessionId: id }))
          )
        )
    };
  })
);