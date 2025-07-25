import { Data } from "effect";
import { RegistrationSessionId } from "../models/shared/value-objects.js";

// --- ドメインエラー ---

export class SessionAlreadyExists extends Data.TaggedError("SessionAlreadyExists")<{
  readonly sessionId: RegistrationSessionId;
}> {
  get message() {
    const { studentId, term } = RegistrationSessionId.parse(this.sessionId);
    return `履修登録セッションが既に存在します: 学生ID=${studentId}, 学期=${term}`;
  }
}

export class SessionNotFound extends Data.TaggedError("SessionNotFound")<{
  readonly sessionId: RegistrationSessionId;
}> {
  get message() {
    const { studentId, term } = RegistrationSessionId.parse(this.sessionId);
    return `履修登録セッションが見つかりません: 学生ID=${studentId}, 学期=${term}`;
  }
}

export class ReconstructionFailed extends Data.TaggedError("ReconstructionFailed")<{
  readonly reason: string;
  readonly eventCount: number;
}> {
  get message() {
    return `イベントからの再構築に失敗しました: ${this.reason} (イベント数: ${this.eventCount})`;
  }
}

export class InvalidSessionState extends Data.TaggedError("InvalidSessionState")<{
  readonly sessionId: RegistrationSessionId;
  readonly currentState: string;
  readonly attemptedAction: string;
}> {
  get message() {
    return `無効な状態遷移です: セッションID=${this.sessionId}, 現在の状態=${this.currentState}, 試行されたアクション=${this.attemptedAction}`;
  }
}

export class MaxUnitsExceeded extends Data.TaggedError("MaxUnitsExceeded")<{
  readonly currentUnits: number;
  readonly requestedUnits: number;
  readonly maxUnits: number;
}> {
  get message() {
    return `最大単位数を超過します: 現在=${this.currentUnits}, 追加要求=${this.requestedUnits}, 最大=${this.maxUnits}`;
  }
}

export class DuplicateCourseInSession extends Data.TaggedError("DuplicateCourseInSession")<{
  readonly sessionId: RegistrationSessionId;
  readonly duplicateCourseIds: ReadonlyArray<string>;
}> {
  get message() {
    return `セッションに重複する科目があります: セッションID=${this.sessionId}, 重複科目=${this.duplicateCourseIds.join(", ")}`;
  }
}

export type DomainError =
  | SessionAlreadyExists
  | SessionNotFound
  | ReconstructionFailed
  | InvalidSessionState
  | MaxUnitsExceeded
  | DuplicateCourseInSession;