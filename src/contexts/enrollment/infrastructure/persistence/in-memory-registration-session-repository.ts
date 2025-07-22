import { Effect, Layer } from "effect";
import { RegistrationSession, Draft } from "../../domain/models/registration-session/registration-session.js";
import { RegistrationSessionRepository } from "../../domain/repositories/registration-session-repository.js";
import { EventStore } from "../../../shared/kernel/types/event-store.js";
import { DomainEvent, RegistrationSessionCreated } from "../../domain/events/registration-session-events.js";
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

    // 残りのイベントを適用（現在はRegistrationSessionCreatedのみなので、そのまま返す）
    // 今後、他のイベント（CoursesAdded, Submitted等）を処理する予定
    for (let i = 1; i < events.length; i++) {
      const event = events[i];
      // 将来的なイベント処理のための準備
      // 現在は追加のイベント処理がないので、そのまま継続
      // 不明なイベントタイプがあれば警告（ただし失敗はしない）
      console.warn(`未処理のイベントタイプ: ${event._tag}`);
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