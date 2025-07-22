import { describe, it, expect } from "vitest";
import {
  RegistrationSession,
  Draft,
  Submitted,
  Approved,
  Rejected,
  MAX_UNITS_PER_TERM,
  MIN_UNITS_PER_TERM
} from "../../../../src/contexts/enrollment/domain/models/registration-session/registration-session.js";
import {
  StudentId,
  CourseId,
  Term,
  EnrollmentId,
  NonEmptyString,
  createRegistrationSessionId
} from "../../../../src/contexts/enrollment/domain/models/shared/value-objects.js";

describe("RegistrationSession", () => {
  const studentId = StudentId.make("S12345678");
  const term = Term.make("2024-Spring");
  const sessionId = createRegistrationSessionId(studentId, term);

  describe("作成", () => {
    it("新規セッションをDraft状態で作成できる", () => {
      const session = RegistrationSession.create(sessionId, studentId, term);

      expect(session.id).toBe(sessionId);
      expect(session.studentId).toBe(studentId);
      expect(session.term).toBe(term);
      expect(session.enrollments).toHaveLength(0);
      expect(session.totalUnits).toBe(0);
      expect(session.status._tag).toBe("Draft");
      expect(session.version).toBe(1);
    });

    it("Draft状態は作成日時を持つ", () => {
      const session = RegistrationSession.create(sessionId, studentId, term);
      
      expect(session.status._tag).toBe("Draft");
      if (session.status._tag === "Draft") {
        expect(session.status.createdAt).toBeInstanceOf(Date);
      }
    });
  });

  describe("科目の重複チェック", () => {
    it("登録済み科目を検出できる", () => {
      const courseId = CourseId.make("C000101");
      const enrollmentId = EnrollmentId.create(studentId, courseId, term);
      
      const session = new RegistrationSession({
        id: sessionId,
        studentId,
        term,
        enrollments: [{
          enrollmentId,
          courseId,
          units: 3
        }],
        status: new Draft({ createdAt: new Date() }),
        totalUnits: 3,
        version: 1
      });

      expect(session.hasCourse(courseId)).toBe(true);
      expect(session.hasCourse(CourseId.make("C000102"))).toBe(false);
    });

    it("複数科目から重複を検出できる", () => {
      const courseId1 = CourseId.make("C000101");
      const courseId2 = CourseId.make("C000102");
      const enrollmentId1 = EnrollmentId.create(studentId, courseId1, term);
      
      const session = new RegistrationSession({
        id: sessionId,
        studentId,
        term,
        enrollments: [{
          enrollmentId: enrollmentId1,
          courseId: courseId1,
          units: 3
        }],
        status: new Draft({ createdAt: new Date() }),
        totalUnits: 3,
        version: 1
      });

      const duplicates = session.findDuplicateCourses([courseId1, courseId2]);
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0]).toBe(courseId1);
    });
  });

  describe("状態遷移の可否チェック", () => {
    it("Draft状態では科目変更が可能", () => {
      const session = RegistrationSession.create(sessionId, studentId, term);
      expect(session.canModifyCourses()).toBe(true);
      expect(session.canSubmit()).toBe(true);
      expect(session.canApproveOrReject()).toBe(false);
    });

    it("Submitted状態では承認・却下が可能", () => {
      const session = new RegistrationSession({
        id: sessionId,
        studentId,
        term,
        enrollments: [],
        status: new Submitted({ submittedAt: new Date() }),
        totalUnits: 0,
        version: 2
      });

      expect(session.canModifyCourses()).toBe(false);
      expect(session.canSubmit()).toBe(false);
      expect(session.canApproveOrReject()).toBe(true);
    });

    it("Approved状態では何も変更できない", () => {
      const session = new RegistrationSession({
        id: sessionId,
        studentId,
        term,
        enrollments: [],
        status: new Approved({
          approvedAt: new Date(),
          approvedBy: NonEmptyString.make("advisor@university.edu")
        }),
        totalUnits: 0,
        version: 3
      });

      expect(session.canModifyCourses()).toBe(false);
      expect(session.canSubmit()).toBe(false);
      expect(session.canApproveOrReject()).toBe(false);
    });

    it("Rejected状態では何も変更できない", () => {
      const session = new RegistrationSession({
        id: sessionId,
        studentId,
        term,
        enrollments: [],
        status: new Rejected({
          rejectedAt: new Date(),
          rejectedBy: NonEmptyString.make("advisor@university.edu"),
          reason: NonEmptyString.make("単位数が不足しています")
        }),
        totalUnits: 0,
        version: 3
      });

      expect(session.canModifyCourses()).toBe(false);
      expect(session.canSubmit()).toBe(false);
      expect(session.canApproveOrReject()).toBe(false);
    });
  });

  describe("状態の属性", () => {
    it("Approved状態は承認者と承認日時を持つ", () => {
      const approvedBy = NonEmptyString.make("advisor@university.edu");
      const approvedAt = new Date();
      
      const status = new Approved({ approvedAt, approvedBy });
      
      expect(status._tag).toBe("Approved");
      expect(status.approvedAt).toBe(approvedAt);
      expect(status.approvedBy).toBe(approvedBy);
    });

    it("Rejected状態は却下者、却下日時、理由を持つ", () => {
      const rejectedBy = NonEmptyString.make("advisor@university.edu");
      const rejectedAt = new Date();
      const reason = NonEmptyString.make("前提科目を履修していません");
      
      const status = new Rejected({ rejectedAt, rejectedBy, reason });
      
      expect(status._tag).toBe("Rejected");
      expect(status.rejectedAt).toBe(rejectedAt);
      expect(status.rejectedBy).toBe(rejectedBy);
      expect(status.reason).toBe(reason);
    });
  });

  describe("ビジネスルール定数", () => {
    it("最大単位数は20", () => {
      expect(MAX_UNITS_PER_TERM).toBe(20);
    });

    it("最小単位数は12", () => {
      expect(MIN_UNITS_PER_TERM).toBe(12);
    });
  });
});