import { Effect, Option } from "effect";
import { RegistrationSession } from "../../domain/models/registration-session/registration-session.js";
import { StudentId, Term, createRegistrationSessionId } from "../../domain/models/shared/value-objects.js";
import { SessionAlreadyExists } from "../../domain/errors/domain-errors.js";
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

    // 既存セッションの確認
    const existingSession = yield* repository.findByStudentAndTerm(studentId, term);

    if (Option.isSome(existingSession)) {
      return yield* Effect.fail(
        new SessionAlreadyExists({
          studentId,
          term,
          existingSessionId: existingSession.value.id
        })
      );
    }

    // 新しいセッションを作成
    const sessionId = createRegistrationSessionId(studentId, term);
    const session = RegistrationSession.create(sessionId, studentId, term);

    // ドメインイベントを作成
    const event = new RegistrationSessionCreated({
      sessionId,
      studentId,
      term,
      createdAt: new Date()
    });


    // セッションを保存（Read Model用） Write/Read分離は不完全
    yield* repository.save(session);
    // イベントを保存
    yield* eventStore.appendEvent(sessionId, "RegistrationSession", event);
    // イベントをパブリッシュ
    yield* eventBus.publish(event);

    return sessionId;
  });