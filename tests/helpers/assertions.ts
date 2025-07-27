import { Effect, Ref } from "effect";
import { expect } from "vitest";
import { RegistrationSession, CourseInfo } from "../../src/contexts/enrollment/domain/models/registration-session/registration-session.js";
import { RegistrationSessionRepository } from "../../src/contexts/enrollment/domain/repositories/registration-session-repository.js";
import { RegistrationSessionId, StudentId, Term, CourseId } from "../../src/contexts/enrollment/domain/models/shared/value-objects.js";
import { DomainEvent } from "../../src/contexts/enrollment/domain/events/registration-session-events.js";
import { MaxUnitsExceeded, DuplicateCourseInSession, SessionNotFound, InvalidRegistrationSessionId } from "../../src/contexts/enrollment/domain/errors/domain-errors.js";

// セッション作成アサーション用のヘルパー型
export interface SessionCreationAssertion {
  sessionId: RegistrationSessionId;
  expectedStudentId: StudentId;
  expectedTerm: Term;
  capturedEvents: Ref.Ref<DomainEvent[]>;
}

// セッションがリポジトリで取得可能であることを確認
export const assertSessionExistsInRepository = (
  sessionId: RegistrationSessionId,
  expectedStudentId: StudentId,
  expectedTerm: Term
) =>
  Effect.gen(function* () {
    const repository = yield* RegistrationSessionRepository;
    const session = yield* repository.findById(sessionId);
    
    expect(session.id).toBe(sessionId);
    expect(session.studentId).toBe(expectedStudentId);
    expect(session.term).toBe(expectedTerm);
    expect(session.status._tag).toBe("Draft");
    expect(session.enrollments).toHaveLength(0);
    expect(session.totalUnits).toBe(0);
    
    return session;
  });

// セッション作成イベントが正しく発行されていることを確認
export const assertSessionCreatedEventPublished = (
  capturedEvents: Ref.Ref<DomainEvent[]>,
  expectedSessionId: RegistrationSessionId,
  expectedStudentId: StudentId,
  expectedTerm: Term
) =>
  Effect.gen(function* () {
    const events = yield* Ref.get(capturedEvents);
    
    // イベントが1つ発行されていることを確認
    expect(events).toHaveLength(1);
    expect(events[0]._tag).toBe("RegistrationSessionCreated");
    
    // イベントの内容を確認
    const createdEvent = events[0];
    if (createdEvent._tag === "RegistrationSessionCreated") {
      expect(createdEvent.sessionId).toBe(expectedSessionId);
      expect(createdEvent.studentId).toBe(expectedStudentId);
      expect(createdEvent.term).toBe(expectedTerm);
      expect(createdEvent.createdAt).toBeInstanceOf(Date);
    }
    
    return events;
  });

// セッション作成の完全なアサーション（リポジトリ + イベント）
export const assertSessionCreatedSuccessfully = (
  assertion: SessionCreationAssertion
) =>
  Effect.gen(function* () {
    const { sessionId, expectedStudentId, expectedTerm, capturedEvents } = assertion;
    
    // セッションIDの形式確認（複合キー: S12345678:YYYY-Season）
    expect(sessionId).toMatch(/^S\d{8}:\d{4}-(Spring|Fall|Summer)$/);
    
    // リポジトリでの存在確認
    const session = yield* assertSessionExistsInRepository(
      sessionId, 
      expectedStudentId, 
      expectedTerm
    );
    
    // イベント発行の確認
    yield* assertSessionCreatedEventPublished(
      capturedEvents,
      sessionId,
      expectedStudentId,
      expectedTerm
    );
    
    return session;
  });

// 複数セッション作成時のアサーション
export const assertMultipleSessionsCreated = (
  sessions: Array<{
    sessionId: RegistrationSessionId;
    studentId: StudentId;
    term: Term;
  }>,
  capturedEvents: Ref.Ref<DomainEvent[]>
) =>
  Effect.gen(function* () {
    // すべてのセッションIDが異なることを確認
    const sessionIds = sessions.map(s => s.sessionId);
    expect(new Set(sessionIds).size).toBe(sessions.length);
    
    // 各セッションがリポジトリで取得可能であることを確認
    for (const session of sessions) {
      yield* assertSessionExistsInRepository(
        session.sessionId,
        session.studentId,
        session.term
      );
    }
    
    // イベントが正しい数発行されていることを確認
    const events = yield* Ref.get(capturedEvents);
    expect(events).toHaveLength(sessions.length);
    expect(events.every(e => e._tag === "RegistrationSessionCreated")).toBe(true);
    
    return events;
  });

// 重複作成エラーのアサーション
export const assertDuplicateSessionError = (
  error: any,
  expectedSessionId: RegistrationSessionId
) => {
  expect(error._tag).toBe("SessionAlreadyExists");
  expect(error.sessionId).toBe(expectedSessionId);
};

// イベント数のアサーション（重複作成時などで使用）
export const assertEventCount = (
  capturedEvents: Ref.Ref<DomainEvent[]>,
  expectedCount: number
) =>
  Effect.gen(function* () {
    const events = yield* Ref.get(capturedEvents);
    expect(events).toHaveLength(expectedCount);
    return events;
  });

// Draft状態の詳細アサーション
export const assertSessionInDraftState = (session: RegistrationSession) => {
  expect(session.status._tag).toBe("Draft");
  expect(session.enrollments).toHaveLength(0);
  expect(session.totalUnits).toBe(0);
  
  if (session.status._tag === "Draft") {
    expect(session.status.createdAt).toBeInstanceOf(Date);
  }
};

// バリデーションエラーのアサーション（後方互換性のため残す）
export const assertValidationError = (error: any, expectedMessage: string) => {
  expect(error).toBeDefined();
  expect(error.message).toContain(expectedMessage);
};

// 型安全なドメインエラーアサーション関数
export const assertInvalidRegistrationSessionIdError = (error: InvalidRegistrationSessionId, expectedStudentId: string, expectedTerm: string) => {
  expect(error._tag).toBe("InvalidRegistrationSessionId");
  expect(error.studentId).toBe(expectedStudentId);
  expect(error.term).toBe(expectedTerm);
  expect(error.reason).toContain("セッションIDの形式が正しくありません");
};

// --- 科目追加関連のアサーション ---

// 科目追加成功アサーション用のヘルパー型
export interface CourseAdditionAssertion {
  sessionId: RegistrationSessionId;
  addedCourses: ReadonlyArray<CourseInfo>;
  capturedEvents: Ref.Ref<DomainEvent[]>;
}

// 科目追加成功の包括的アサーション
export const assertCoursesAddedSuccessfully = (assertion: CourseAdditionAssertion) =>
  Effect.gen(function* () {
    const { sessionId, addedCourses, capturedEvents } = assertion;
    
    // イベントが1つ発行されていることを確認 (CoursesAddedToSession)
    const events = yield* Ref.get(capturedEvents);
    const courseAdditionEvents = events.filter(e => 
      e._tag === "CoursesAddedToSession"
    );
    expect(courseAdditionEvents).toHaveLength(1);
    
    // CoursesAddedToSessionイベントの確認
    const coursesAddedEvent = events.find(e => e._tag === "CoursesAddedToSession");
    expect(coursesAddedEvent).toBeDefined();
    if (coursesAddedEvent && coursesAddedEvent._tag === "CoursesAddedToSession") {
      expect(coursesAddedEvent.sessionId).toBe(sessionId);
      expect(coursesAddedEvent.addedCourses).toEqual(addedCourses);
      expect(coursesAddedEvent.enrollmentRequests).toHaveLength(addedCourses.length);
      expect(coursesAddedEvent.addedAt).toBeInstanceOf(Date);
    }
    
    // リポジトリでのセッション状態確認（イベント再生で状態が更新されることを確認）
    const repository = yield* RegistrationSessionRepository;
    const updatedSession = yield* repository.findById(sessionId);
    expect(updatedSession.enrollments).toHaveLength(addedCourses.length);
    
    // 追加された科目の単位数が反映されていることを確認
    const expectedUnits = addedCourses.reduce((sum, course) => sum + course.units, 0);
    expect(updatedSession.totalUnits).toBe(expectedUnits);
  });

// 単位数上限超過エラーのアサーション
export const assertMaxUnitsExceededError = (
  error: any,
  expectedUnits: { currentUnits: number; requestedUnits: number; maxUnits: number }
) => {
  expect(error._tag).toBe("MaxUnitsExceeded");
  expect(error.currentUnits).toBe(expectedUnits.currentUnits);
  expect(error.requestedUnits).toBe(expectedUnits.requestedUnits);
  expect(error.maxUnits).toBe(expectedUnits.maxUnits);
};

// 重複科目エラーのアサーション
export const assertDuplicateCourseError = (
  error: any,
  expectedDuplicateCourseIds: ReadonlyArray<CourseId>
) => {
  expect(error._tag).toBe("DuplicateCourseInSession");
  expect(error.duplicateCourseIds).toEqual(expectedDuplicateCourseIds);
};

// セッション未存在エラーのアサーション
export const assertSessionNotFoundError = (
  error: any,
  expectedSessionId: RegistrationSessionId
) => {
  expect(error._tag).toBe("SessionNotFound");
  expect(error.sessionId).toBe(expectedSessionId);
};