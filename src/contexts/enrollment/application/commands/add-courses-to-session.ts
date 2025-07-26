import { Effect } from "effect";
import { RegistrationSessionId } from "../../domain/models/shared/value-objects.js";
import { CourseInfo, addCoursesToSession as addCoursesToSessionDomain } from "../../domain/models/registration-session/registration-session.js";
import { RegistrationSessionRepository } from "../../domain/repositories/registration-session-repository.js";
import { EventStore } from "../../../shared/kernel/types/event-store.js";
import { EventBus } from "../../../shared/kernel/types/event-bus.js";

export interface AddCoursesToSessionCommand {
  readonly sessionId: RegistrationSessionId;
  readonly courses: ReadonlyArray<CourseInfo>;
}

/**
 * 履修登録セッションに科目を追加するコマンド
 * @param command - 追加する科目の情報
 * @returns - 追加されたセッションのID
 * @remark この関数は、セッションの状態を変更するのではなく、ドメインイベントを生成して保存・パブリッシュします。
 */
export const addCoursesToSession = (
  command: AddCoursesToSessionCommand
) =>
  Effect.gen(function* () {
    const eventStore = yield* EventStore;
    const eventBus = yield* EventBus;
    const repository = yield* RegistrationSessionRepository;

    const { sessionId, courses } = command;

    const session = yield* repository.findById(sessionId);

    const coursesAddedEvent = yield* addCoursesToSessionDomain(session, courses);

    yield* eventStore.appendEvent(sessionId, "RegistrationSession", coursesAddedEvent);

    yield* eventBus.publish(coursesAddedEvent);

    return sessionId;
  });