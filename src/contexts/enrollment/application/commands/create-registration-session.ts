import { Effect } from "effect";
import { StudentId, Term, createRegistrationSessionId } from "../../domain/models/shared/value-objects.js";
import { SessionAlreadyExists, SessionNotFound } from "../../domain/errors/domain-errors.js";
import { RegistrationSessionCreated } from "../../domain/events/registration-session-events.js";
import { RegistrationSessionRepository } from "../../domain/repositories/registration-session-repository.js";
import { EventStore } from "../../../shared/kernel/types/event-store.js";
import { EventBus } from "../../../shared/kernel/types/event-bus.js";

export interface CreateRegistrationSessionCommand {
  readonly studentId: StudentId;
  readonly term: Term;
}

export const createRegistrationSession = (
  command: CreateRegistrationSessionCommand
) =>
  Effect.gen(function* () {
    const repository = yield* RegistrationSessionRepository;
    const eventStore = yield* EventStore;
    const eventBus = yield* EventBus;

    const { studentId, term } = command;

    // 既存セッションの確認 - SessionNotFoundエラーをキャッチして継続、それ以外のエラーは再throw
    const sessionExists = yield* Effect.gen(function* () {
      const existingSession = yield* repository.findByStudentAndTerm(studentId, term);
      return existingSession;
    }).pipe(
      Effect.catchTag("SessionNotFound", () => Effect.succeed(null)),
      // EventStoreErrorなど他のエラーは再throw
      Effect.catchAll((error) => Effect.fail(error))
    );

    if (sessionExists) {
      return yield* Effect.fail(
        new SessionAlreadyExists({
          studentId,
          term,
          existingSessionId: sessionExists.id
        })
      );
    }

    // 新しいセッションIDを作成
    const sessionId = createRegistrationSessionId(studentId, term);

    // ドメインイベントを作成
    const event = new RegistrationSessionCreated({
      sessionId,
      studentId,
      term,
      createdAt: new Date()
    });


    // イベントを保存（イベントソーシング: セッションは永続化せずイベントのみ保存）
    // 注意: 現在は非同期投影を実装していないため、リポジトリはイベントから再構築
    yield* eventStore.appendEvent(sessionId, "RegistrationSession", event);
    // イベントをパブリッシュ
    yield* eventBus.publish(event);

    return sessionId;
  });