import { Effect } from "effect";
import { StudentId, Term, RegistrationSessionId } from "../../domain/models/shared/value-objects.js";
import { SessionAlreadyExists } from "../../domain/errors/domain-errors.js";
import { RegistrationSessionCreated } from "../../domain/events/registration-session-events.js";
import { RegistrationSessionRepository } from "../../domain/repositories/registration-session-repository.js";
import { EventStore } from "../../../shared/kernel/types/event-store.js";
import { EventBus } from "../../../shared/kernel/types/event-bus.js";

export interface CreateRegistrationSessionCommand {
  readonly studentId: StudentId;
  readonly term: Term;
}

// セッションが既に存在しないことを確認するヘルパー関数
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

export const createRegistrationSession = (
  command: CreateRegistrationSessionCommand
) =>
  Effect.gen(function* () {
    const eventStore = yield* EventStore;
    const eventBus = yield* EventBus;

    const { studentId, term } = command;

    // TODO: studentIdで学生の存在を確認するロジックを追加する
    // TODO: termの妥当性を確認するロジックを追加する

    // 複合キーからセッションIDを生成
    const sessionId = yield* RegistrationSessionId.create(studentId, term);

    // 既存セッションが存在しないことを確認（複合キーで直接チェック）
    yield* ensureNotExists(sessionId);

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