import { Effect } from "effect";
import { RegistrationSessionId } from "../../domain/models/shared/value-objects.js";
import { CourseInfo, addCoursesToSession as addCoursesToSessionDomain } from "../../domain/models/registration-session/registration-session.js";
import { RegistrationSessionRepository } from "../../domain/repositories/registration-session-repository.js";
import { EventStore, EventStoreError } from "../../../shared/kernel/types/event-store.js";
import { EventBus } from "../../../shared/kernel/types/event-bus.js";
import { SessionNotFound, InvalidSessionState, MaxUnitsExceeded, DuplicateCourseInSession } from "../../domain/errors/domain-errors.js";

export interface AddCoursesToSessionCommand {
  readonly sessionId: RegistrationSessionId;
  readonly courses: ReadonlyArray<CourseInfo>;
}

/**
 * 履修登録セッションに科目を追加するコマンド
 * @param command - 追加する科目の情報
 * @returns - 追加されたセッションのID
 * @throws - セッションが見つからない場合、セッションの状態が無効な場合、最大単位数を超えた場合、重複する科目が存在する場合
 * @throws - イベントストアのエラーが発生した場合
 * @remark この関数は、セッションの状態を変更するのではなく、ドメインイベントを生成して保存・パブリッシュします。
 */
export const addCoursesToSession = (
  command: AddCoursesToSessionCommand
): Effect.Effect<
  RegistrationSessionId,
  SessionNotFound | InvalidSessionState | MaxUnitsExceeded | DuplicateCourseInSession | EventStoreError,
  RegistrationSessionRepository | EventStore | EventBus
> =>
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