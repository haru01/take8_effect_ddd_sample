import { Effect, Layer, Option } from "effect";
import { RegistrationSession, Draft } from "../../domain/models/registration-session/registration-session.js";
import { RegistrationSessionId } from "../../domain/models/shared/value-objects.js";
import { RegistrationSessionRepository } from "../../domain/repositories/registration-session-repository.js";
import { EventStore } from "../../../shared/kernel/types/event-store.js";
import { DomainEvent, RegistrationSessionCreated } from "../../domain/events/registration-session-events.js";

// イベントからRegistrationSessionを再構築する関数
const reconstructFromEvents = (
  events: ReadonlyArray<DomainEvent>
): Option.Option<RegistrationSession> => {
  if (events.length === 0) {
    return Option.none();
  }

  // 最初のイベントはRegistrationSessionCreatedである必要がある
  const firstEvent = events[0];
  if (firstEvent._tag !== "RegistrationSessionCreated") {
    return Option.none();
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

  // 残りのイベントを適用（現在はRegistrationSessionCreatedのみなので、そのまま返す）
  // 今後、他のイベント（CoursesAdded, Submitted等）を処理する予定
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for (let i = 1; i < events.length; i++) {
    // 現在はRegistrationSessionCreatedのみなので、そのまま継続
  }

  return Option.some(session);
};

export const InMemoryRegistrationSessionRepository = Layer.effect(
  RegistrationSessionRepository,
  Effect.gen(function* () {
    const eventStore = yield* EventStore;

    return {
      findById: (id) =>
        Effect.gen(function* () {
          const events = yield* eventStore.getEvents(id, "RegistrationSession");
          return reconstructFromEvents(events);
        }).pipe(
          Effect.catchAll(() => Effect.succeed(Option.none()))
        ),

      findByStudentAndTerm: (studentId, term) =>
        Effect.gen(function* () {
          // NOTE: 現在の実装では全セッションを走査する必要がある
          // 実際のプロダクションではインデックスや投影を使用すべき
          
          // 全てのRegistrationSessionの集約IDを取得
          const allSessionIds = yield* eventStore.getAllAggregateIds("RegistrationSession");
          
          // 各セッションを調べて、studentIdとtermが一致するものを探す
          for (const sessionId of allSessionIds) {
            const events = yield* eventStore.getEvents(sessionId, "RegistrationSession");
            const session = reconstructFromEvents(events);
            
            if (Option.isSome(session) && 
                session.value.studentId === studentId && 
                session.value.term === term) {
              return session;
            }
          }
          
          return Option.none();
        }).pipe(
          Effect.catchAll(() => Effect.succeed(Option.none()))
        )
    };
  })
);