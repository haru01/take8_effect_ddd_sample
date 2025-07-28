import { Effect, Ref } from "effect";
import { expect } from "vitest";
import { RegistrationSession, CourseInfo } from "../../src/contexts/enrollment/domain/models/registration-session/registration-session.js";
import { RegistrationSessionRepository } from "../../src/contexts/enrollment/domain/repositories/registration-session-repository.js";
import { RegistrationSessionId, StudentId, Term, CourseId } from "../../src/contexts/enrollment/domain/models/shared/value-objects.js";
import { DomainEvent } from "../../src/contexts/enrollment/domain/events/registration-session-events.js";
import { MaxUnitsExceeded, DuplicateCourseInSession, SessionNotFound, InvalidRegistrationSessionId } from "../../src/contexts/enrollment/domain/errors/domain-errors.js";
import { EventStore } from "../../src/contexts/shared/kernel/types/event-store.js";














// === Given/When/Then形式の新しいアサーション関数 ===

// Then: セッションIDの形式が正しいことを確認
export const thenSessionIdFormatIsValid = (sessionId: RegistrationSessionId) => {
  // セッションIDの形式確認（複合キー: S12345678:YYYY-Season）
  expect(sessionId).toMatch(/^S\d{8}:\d{4}-(Spring|Fall|Summer)$/);
};

// Then: RegistrationSessionCreatedイベントがイベントバスにて発行されていることを確認
export const thenRegistrationSessionCreatedEventIsPublished = (
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

      // タイムスタンプの妥当性確認（作成日時が現在時刻の±5秒以内）
      const now = new Date();
      const timeDiff = Math.abs(now.getTime() - createdEvent.createdAt.getTime());
      expect(timeDiff).toBeLessThan(5000); // 5秒以内
    }

    return events;
  });

// Then: 該当の履修登録セッションが取得できることを確認
export const thenRegistrationSessionCanBeRetrieved = (
  sessionId: RegistrationSessionId,
  expectedStudentId: StudentId,
  expectedTerm: Term
) =>
  Effect.gen(function* () {
    const repository = yield* RegistrationSessionRepository;
    const session = yield* repository.findById(sessionId);

    // 基本プロパティの確認
    expect(session.id).toBe(sessionId);
    expect(session.studentId).toBe(expectedStudentId);
    expect(session.term).toBe(expectedTerm);

    return session;
  });

// Then: RegistrationSessionCreatedイベントがイベントストアに登録されていることを確認
export const thenRegistrationSessionCreatedEventIsStoredInEventStore = (
  sessionId: RegistrationSessionId,
  expectedStudentId: StudentId,
  expectedTerm: Term
) =>
  Effect.gen(function* () {
    const eventStore = yield* EventStore;
    const events = yield* eventStore.getEvents(sessionId, "RegistrationSession");

    // イベントが1つ保存されていることを確認
    expect(events).toHaveLength(1);
    expect(events[0]._tag).toBe("RegistrationSessionCreated");

    // イベントストアに保存されたイベントの内容確認
    const storedEvent = events[0];
    if (storedEvent._tag === "RegistrationSessionCreated") {
      expect(storedEvent.sessionId).toBe(sessionId);
      expect(storedEvent.studentId).toBe(expectedStudentId);
      expect(storedEvent.term).toBe(expectedTerm);
      expect(storedEvent.createdAt).toBeInstanceOf(Date);
    }

    return events;
  });

// Then: 重複セッション作成エラーが発生することを確認
export const thenDuplicateSessionErrorOccurs = (
  error: any,
  expectedSessionId: RegistrationSessionId
) => {
  expect(error._tag).toBe("SessionAlreadyExists");
  expect(error.sessionId).toBe(expectedSessionId);
};

// Then: 指定された数のイベントのみが発行されていることを確認
export const thenExactlyNEventsArePublished = (
  capturedEvents: Ref.Ref<DomainEvent[]>,
  expectedCount: number
) =>
  Effect.gen(function* () {
    const events = yield* Ref.get(capturedEvents);
    expect(events).toHaveLength(expectedCount);
    return events;
  });

// Then: 複数のセッションが正常に作成されていることを確認
export const thenMultipleSessionsAreCreatedSuccessfully = (
  sessions: Array<{
    sessionId: RegistrationSessionId;
    studentId: StudentId;
    term: Term;
  }>,
  capturedEvents: Ref.Ref<DomainEvent[]>
) =>
  Effect.gen(function* () {
    // セッションIDの一意性確認
    const sessionIds = sessions.map(s => s.sessionId);
    expect(new Set(sessionIds).size).toBe(sessions.length);

    // 各セッションの存在確認
    for (const session of sessions) {
      yield* thenRegistrationSessionCanBeRetrieved(
        session.sessionId,
        session.studentId,
        session.term
      );
    }

    // 正しい数のイベントが発行されていることを確認
    const events = yield* Ref.get(capturedEvents);
    expect(events).toHaveLength(sessions.length);
    expect(events.every(e => e._tag === "RegistrationSessionCreated")).toBe(true);

    return events;
  });

// Then: セッションがDraft状態で作成されていることを確認
export const thenSessionIsInDraftState = (session: RegistrationSession) => {
  expect(session.status._tag).toBe("Draft");
  expect(session.enrollments).toHaveLength(0);
  expect(session.totalUnits).toBe(0);

  if (session.status._tag === "Draft") {
    expect(session.status.createdAt).toBeInstanceOf(Date);
  }
};

// Then: 無効なセッションIDエラーが発生することを確認
export const thenInvalidSessionIdErrorOccurs = (
  error: InvalidRegistrationSessionId,
  expectedStudentId: string,
  expectedTerm: string
) => {
  expect(error._tag).toBe("InvalidRegistrationSessionId");
  expect(error.studentId).toBe(expectedStudentId);
  expect(error.term).toBe(expectedTerm);
  expect(error.reason).toContain("セッションIDの形式が正しくありません");
};

// === 科目追加関連のThenアサーション関数 ===

// Then: 科目が履修登録セッションに正常に追加されることを確認
export const thenCoursesAreAddedToRegistrationSession = (
  sessionId: RegistrationSessionId,
  addedCourses: ReadonlyArray<CourseInfo>,
  capturedEvents: Ref.Ref<DomainEvent[]>
) =>
  Effect.gen(function* () {
    // CoursesAddedToSessionイベントが発行されていることを確認
    const events = yield* Ref.get(capturedEvents);
    const courseAdditionEvents = events.filter(e =>
      e._tag === "CoursesAddedToSession"
    );
    expect(courseAdditionEvents).toHaveLength(1);

    // イベントの内容確認
    const coursesAddedEvent = events.find(e => e._tag === "CoursesAddedToSession");
    expect(coursesAddedEvent).toBeDefined();
    if (coursesAddedEvent && coursesAddedEvent._tag === "CoursesAddedToSession") {
      expect(coursesAddedEvent.sessionId).toBe(sessionId);
      expect(coursesAddedEvent.addedCourses).toEqual(addedCourses);
      expect(coursesAddedEvent.enrollmentRequests).toHaveLength(addedCourses.length);
      expect(coursesAddedEvent.addedAt).toBeInstanceOf(Date);
    }

    return events;
  });

// Then: 履修登録セッションに科目が反映されていることを確認
export const thenSessionReflectsAddedCourses = (
  sessionId: RegistrationSessionId,
  expectedCourses: ReadonlyArray<CourseInfo>
) =>
  Effect.gen(function* () {
    const repository = yield* RegistrationSessionRepository;
    const updatedSession = yield* repository.findById(sessionId);

    // 追加された科目数の確認
    expect(updatedSession.enrollments).toHaveLength(expectedCourses.length);

    // 単位数の反映確認
    const expectedUnits = expectedCourses.reduce((sum, course) => sum + course.units, 0);
    expect(updatedSession.totalUnits).toBe(expectedUnits);

    return updatedSession;
  });

// Then: 単位数上限超過エラーが発生することを確認
export const thenMaxUnitsExceededErrorOccurs = (
  error: any,
  expectedUnits: { currentUnits: number; requestedUnits: number; maxUnits: number }
) => {
  expect(error._tag).toBe("MaxUnitsExceeded");
  expect(error.currentUnits).toBe(expectedUnits.currentUnits);
  expect(error.requestedUnits).toBe(expectedUnits.requestedUnits);
  expect(error.maxUnits).toBe(expectedUnits.maxUnits);
};

// Then: 重複科目エラーが発生することを確認
export const thenDuplicateCourseErrorOccurs = (
  error: any,
  expectedDuplicateCourseIds: ReadonlyArray<CourseId>
) => {
  expect(error._tag).toBe("DuplicateCourseInSession");
  expect(error.duplicateCourseIds).toEqual(expectedDuplicateCourseIds);
};

// Then: セッション未存在エラーが発生することを確認
export const thenSessionNotFoundErrorOccurs = (
  error: any,
  expectedSessionId: RegistrationSessionId
) => {
  expect(error._tag).toBe("SessionNotFound");
  expect(error.sessionId).toBe(expectedSessionId);
};

// === Phase 3: 3層構造アサーション関数 ===

// === 1層目: ドメイン結果の確認 ===

// Then: 学生が履修計画を開始できる状態になっていることを確認（ビジネス価値）
export const thenStudentCanStartEnrollmentPlanning = (
  sessionId: RegistrationSessionId,
  studentId: StudentId,
  term: Term
) =>
  Effect.gen(function* () {
    // ビジネス価値の確認: 学生が履修計画を開始できる状態

    // 1. セッションIDが発行されていること（学生が識別可能）
    expect(sessionId).toBeDefined();
    expect(typeof sessionId).toBe("string");
    expect(sessionId.length).toBeGreaterThan(0);

    // 2. セッションが学生に紐づいていること
    const repository = yield* RegistrationSessionRepository;
    const session = yield* repository.findById(sessionId);
    expect(session.studentId).toBe(studentId);
    expect(session.term).toBe(term);

    // 3. セッションが編集可能な状態であること（履修計画開始可能）
    expect(session.canModifyCourses()).toBe(true);
    expect(session.status._tag).toBe("Draft");

    return session;
  });

// Then: 学生が科目を履修計画に追加できる状態になっていることを確認
export const thenStudentCanAddCoursesToEnrollmentPlan = (
  sessionId: RegistrationSessionId,
  addedCourses: ReadonlyArray<CourseInfo>
) =>
  Effect.gen(function* () {
    // ビジネス価値の確認: 科目が履修計画に反映されている

    const repository = yield* RegistrationSessionRepository;
    const session = yield* repository.findById(sessionId);

    // 1. 科目が履修計画に追加されていること
    expect(session.enrollments).toHaveLength(addedCourses.length);

    // 2. 単位数が履修計画に反映されていること
    const expectedUnits = addedCourses.reduce((sum, course) => sum + course.units, 0);
    expect(session.totalUnits).toBe(expectedUnits);

    // 3. セッションが引き続き編集可能であること
    expect(session.canModifyCourses()).toBe(true);

    return session;
  });

// === 2層目: イベントソーシング確認 ===

// Then: イベントソーシングパターンが正しく実行されていることを確認
export const thenEventSourcingPatternsAreCorrectlyExecuted = (
  sessionId: RegistrationSessionId,
  studentId: StudentId,
  term: Term,
  capturedEvents: Ref.Ref<DomainEvent[]>
) =>
  Effect.gen(function* () {
    // イベントソーシングの技術的確認

    // 1. イベントストアへの永続化確認
    yield* thenRegistrationSessionCreatedEventIsStoredInEventStore(sessionId, studentId, term);

    // 2. イベントバスでの発行確認
    yield* thenRegistrationSessionCreatedEventIsPublished(capturedEvents, sessionId, studentId, term);

    // 3. 集約の再構築確認
    const session = yield* thenRegistrationSessionCanBeRetrieved(sessionId, studentId, term);

    return { session };
  });

// Then: 科目追加のイベントソーシングパターンが正しく実行されていることを確認
export const thenCourseAdditionEventSourcingPatternsAreCorrectlyExecuted = (
  sessionId: RegistrationSessionId,
  addedCourses: ReadonlyArray<CourseInfo>,
  capturedEvents: Ref.Ref<DomainEvent[]>
) =>
  Effect.gen(function* () {
    // 科目追加のイベントソーシング確認

    // 1. CoursesAddedToSessionイベントの発行確認
    yield* thenCoursesAreAddedToRegistrationSession(sessionId, addedCourses, capturedEvents);

    // 2. 集約状態の更新確認
    const session = yield* thenSessionReflectsAddedCourses(sessionId, addedCourses);

    return { session };
  });

// === 3層目: 集約状態確認 ===

// Then: 集約の整合性が保たれていることを確認
export const thenAggregateConsistencyIsPreserved = (
  sessionId: RegistrationSessionId,
  expectedStudentId: StudentId,
  expectedTerm: Term
) =>
  Effect.gen(function* () {
    // 集約の技術的整合性確認

    const repository = yield* RegistrationSessionRepository;
    const session = yield* repository.findById(sessionId);

    // 1. 基本識別情報の整合性
    expect(session.id).toBe(sessionId);
    expect(session.studentId).toBe(expectedStudentId);
    expect(session.term).toBe(expectedTerm);

    // 2. バージョン管理の整合性
    expect(session.version).toBeGreaterThan(0);
    expect(Number.isInteger(session.version)).toBe(true);

    // 3. ビジネス不変条件の保持
    expect(session.totalUnits).toBeGreaterThanOrEqual(0);
    expect(session.totalUnits).toBeLessThanOrEqual(20); // MAX_UNITS_PER_TERM
    expect(session.enrollments.length).toBeGreaterThanOrEqual(0);

    // 4. 状態遷移の妥当性
    expect(["Draft", "Submitted", "Approved", "Rejected"].includes(session.status._tag)).toBe(true);

    return session;
  });