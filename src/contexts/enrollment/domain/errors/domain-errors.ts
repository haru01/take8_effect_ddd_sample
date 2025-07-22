import { Data } from "effect";
import { RegistrationSessionId, StudentId, Term } from "../models/shared/value-objects.js";

// --- ドメインエラー ---

export class SessionAlreadyExists extends Data.TaggedError("SessionAlreadyExists")<{
  readonly studentId: StudentId;
  readonly term: Term;
  readonly existingSessionId: RegistrationSessionId;
}> {
  get message() {
    return `履修登録セッションが既に存在します: 学生ID=${this.studentId}, 学期=${this.term}, セッションID=${this.existingSessionId}`;
  }
}

export class SessionNotFound extends Data.TaggedError("SessionNotFound")<{
  readonly sessionId?: RegistrationSessionId;
  readonly studentId?: StudentId;
  readonly term?: Term;
}> {
  get message() {
    if (this.sessionId) {
      return `履修登録セッションが見つかりません: セッションID=${this.sessionId}`;
    } else if (this.studentId && this.term) {
      return `履修登録セッションが見つかりません: 学生ID=${this.studentId}, 学期=${this.term}`;
    } else {
      return `履修登録セッションが見つかりません`;
    }
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

// 将来的に追加される可能性のあるエラー（コメントアウト）
/*
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
*/

export type DomainError =
  | SessionAlreadyExists
  | SessionNotFound
  | ReconstructionFailed;