import { Effect } from "effect";
import { StudentId, Term, RegistrationSessionId } from "../../domain/models/shared/value-objects.js";
import { SessionAlreadyExists, InvalidRegistrationSessionId } from "../../domain/errors/domain-errors.js";
import { createRegistrationSession as createRegistrationSessionEvent } from "../../domain/models/registration-session/registration-session.js";
import { RegistrationSessionRepository } from "../../domain/repositories/registration-session-repository.js";
import { EventStore, EventStoreError } from "../../../shared/kernel/types/event-store.js";
import { EventBus } from "../../../shared/kernel/types/event-bus.js";

export interface CreateRegistrationSessionCommand {
  readonly studentId: StudentId;
  readonly term: Term;
}

/**
 * セッションが存在しないことを確認するヘルパー関数
 * @param sessionId - 確認するセッションのID
 * @returns - セッションが存在しない場合は何も返さず、存在する場合はSessionAlreadyExistsエラーを投げる
 */
const ensureNotExists = (sessionId: RegistrationSessionId) =>
  Effect.gen(function* () {
    const repository = yield* RegistrationSessionRepository;
    return yield* repository.findById(sessionId).pipe(
      Effect.flatMap(() =>
        Effect.fail(new SessionAlreadyExists({
          sessionId
        }))
      ),
      Effect.catchTag("SessionNotFound", () => Effect.succeed(undefined))
    );
  });

/**
 * 履修登録セッションを作成するコマンド
 * @param command - 作成するセッションの情報
 * @returns - 作成されたセッションのID
 * @throws - セッションが既に存在する場合
 * @throws - セッションIDのパースエラーが発生した場合
 * @throws - イベントストアのエラーが発生した場合
 * @remark この関数は、セッションの状態を変更するのではなく、ドメインイベントを生成して保存・パブリッシュします。
 */
export const createRegistrationSession = (
  command: CreateRegistrationSessionCommand
): Effect.Effect<
  RegistrationSessionId,
  SessionAlreadyExists | InvalidRegistrationSessionId | EventStoreError,
  RegistrationSessionRepository | EventStore | EventBus
> =>
  Effect.gen(function* () {
    const eventStore = yield* EventStore;
    const eventBus = yield* EventBus;

    const { studentId, term } = command;

    // TODO: studentIdで学生の存在を確認するロジックを追加する
    // TODO: termの妥当性を確認するロジックを追加する

    const sessionId = yield* RegistrationSessionId.create(studentId, term);

    yield* ensureNotExists(sessionId);

    const event = createRegistrationSessionEvent(sessionId, studentId, term);

    // イベントを保存（イベントソーシング: セッションは永続化せずイベントのみ保存）
    // 注意: 現在は非同期投影を実装していないため、リポジトリはイベントから再構築
    yield* eventStore.appendEvent(sessionId, "RegistrationSession", event);
    // イベントをパブリッシュ
    yield* eventBus.publish(event);

    return sessionId;
  });