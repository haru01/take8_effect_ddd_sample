import { describe, it, expect } from "vitest";
import { Option } from "effect";
import {
  Enrollment,
  Requested,
  Approved,
  InProgress,
  Completed,
  Cancelled,
  Withdrawn
} from "../../../../src/contexts/enrollment/domain/models/enrollment/enrollment.js";
import {
  StudentId,
  CourseId,
  Term,
  RegistrationSessionId,
  EnrollmentId,
  NonEmptyString,
  Grade
} from "../../../../src/contexts/enrollment/domain/models/shared/value-objects.js";

describe("Enrollment", () => {
  const studentId = StudentId.make("S12345678");
  const courseId = CourseId.make("C000101");
  const term = Term.make("2024-Spring");
  const sessionId = RegistrationSessionId.make("RS12345678");
  const enrollmentId = EnrollmentId.create(studentId, courseId, term);

  describe("作成", () => {
    it("新規履修をRequested状態で作成できる", () => {
      const enrollment = Enrollment.create(
        enrollmentId,
        sessionId,
        studentId,
        courseId,
        term
      );

      expect(enrollment.id).toBe(enrollmentId);
      expect(enrollment.sessionId).toBe(sessionId);
      expect(enrollment.studentId).toBe(studentId);
      expect(enrollment.courseId).toBe(courseId);
      expect(enrollment.term).toBe(term);
      expect(enrollment.status._tag).toBe("Requested");
      expect(enrollment.hasGrade()).toBe(false);
      expect(Option.isNone(enrollment.getGrade())).toBe(true);
      expect(enrollment.version).toBe(1);
    });

    it("Requested状態はリクエスト日時を持つ", () => {
      const enrollment = Enrollment.create(
        enrollmentId,
        sessionId,
        studentId,
        courseId,
        term
      );
      
      expect(enrollment.status._tag).toBe("Requested");
      if (enrollment.status._tag === "Requested") {
        expect(enrollment.status.requestedAt).toBeInstanceOf(Date);
      }
    });
  });

  describe("状態遷移の可否チェック", () => {
    it("Requested状態では承認とキャンセルが可能", () => {
      const enrollment = Enrollment.create(
        enrollmentId,
        sessionId,
        studentId,
        courseId,
        term
      );

      expect(enrollment.canApprove()).toBe(true);
      expect(enrollment.canStart()).toBe(false);
      expect(enrollment.canComplete()).toBe(false);
      expect(enrollment.canWithdraw()).toBe(false);
      expect(enrollment.canCancel()).toBe(true);
    });

    it("Approved状態では開始とキャンセルが可能", () => {
      const enrollment = new Enrollment({
        id: enrollmentId,
        sessionId,
        studentId,
        courseId,
        term,
        status: new Approved({
          approvedAt: new Date(),
          approvedBy: NonEmptyString.make("advisor@university.edu")
        }),
        version: 2
      });

      expect(enrollment.canApprove()).toBe(false);
      expect(enrollment.canStart()).toBe(true);
      expect(enrollment.canComplete()).toBe(false);
      expect(enrollment.canWithdraw()).toBe(false);
      expect(enrollment.canCancel()).toBe(true);
    });

    it("InProgress状態では完了と離脱が可能", () => {
      const enrollment = new Enrollment({
        id: enrollmentId,
        sessionId,
        studentId,
        courseId,
        term,
        status: new InProgress({ startedAt: new Date() }),
        version: 3
      });

      expect(enrollment.canApprove()).toBe(false);
      expect(enrollment.canStart()).toBe(false);
      expect(enrollment.canComplete()).toBe(true);
      expect(enrollment.canWithdraw()).toBe(true);
      expect(enrollment.canCancel()).toBe(false);
    });

    it("Completed状態では何も変更できない", () => {
      const enrollment = new Enrollment({
        id: enrollmentId,
        sessionId,
        studentId,
        courseId,
        term,
        status: new Completed({
          completedAt: new Date(),
          grade: "A" as Grade
        }),
        version: 4
      });

      expect(enrollment.canApprove()).toBe(false);
      expect(enrollment.canStart()).toBe(false);
      expect(enrollment.canComplete()).toBe(false);
      expect(enrollment.canWithdraw()).toBe(false);
      expect(enrollment.canCancel()).toBe(false);
    });
  });

  describe("成績の管理", () => {
    it("初期状態では成績がない", () => {
      const enrollment = Enrollment.create(
        enrollmentId,
        sessionId,
        studentId,
        courseId,
        term
      );

      expect(enrollment.hasGrade()).toBe(false);
      expect(Option.isNone(enrollment.getGrade())).toBe(true);
    });

    it("Completed状態では成績を取得できる", () => {
      const grade = "A" as Grade;
      const enrollment = new Enrollment({
        id: enrollmentId,
        sessionId,
        studentId,
        courseId,
        term,
        status: new Completed({
          completedAt: new Date(),
          grade
        }),
        version: 4
      });

      expect(enrollment.hasGrade()).toBe(true);
      const retrievedGrade = enrollment.getGrade();
      expect(Option.isSome(retrievedGrade)).toBe(true);
      if (Option.isSome(retrievedGrade)) {
        expect(retrievedGrade.value).toBe("A");
      }
    });
  });

  describe("状態の属性", () => {
    it("Approved状態は承認者と承認日時を持つ", () => {
      const approvedBy = NonEmptyString.make("professor@university.edu");
      const approvedAt = new Date();
      
      const status = new Approved({ approvedAt, approvedBy });
      
      expect(status._tag).toBe("Approved");
      expect(status.approvedAt).toBe(approvedAt);
      expect(status.approvedBy).toBe(approvedBy);
    });

    it("Completed状態は完了日時と成績を持つ", () => {
      const completedAt = new Date();
      const grade = "B" as Grade;
      
      const status = new Completed({ completedAt, grade });
      
      expect(status._tag).toBe("Completed");
      expect(status.completedAt).toBe(completedAt);
      expect(status.grade).toBe(grade);
    });

    it("Cancelled状態はキャンセル日時と理由を持つ", () => {
      const cancelledAt = new Date();
      const reason = NonEmptyString.make("スケジュール変更のため");
      
      const status = new Cancelled({ cancelledAt, reason });
      
      expect(status._tag).toBe("Cancelled");
      expect(status.cancelledAt).toBe(cancelledAt);
      expect(status.reason).toBe(reason);
    });

    it("Withdrawn状態は離脱日時とオプションの理由を持つ", () => {
      const withdrawnAt = new Date();
      const reason = NonEmptyString.make("個人的な事情により");
      
      const statusWithReason = new Withdrawn({
        withdrawnAt,
        reason: Option.some(reason)
      });
      
      expect(statusWithReason._tag).toBe("Withdrawn");
      expect(statusWithReason.withdrawnAt).toBe(withdrawnAt);
      expect(Option.isSome(statusWithReason.reason)).toBe(true);

      const statusWithoutReason = new Withdrawn({
        withdrawnAt,
        reason: Option.none()
      });
      
      expect(Option.isNone(statusWithoutReason.reason)).toBe(true);
    });
  });

  describe("EnrollmentIdの操作", () => {
    it("複合IDを作成・解析できる", () => {
      const id = EnrollmentId.create(studentId, courseId, term);
      expect(id).toBe("S12345678:C000101:2024-Spring");

      const parsed = EnrollmentId.parse(id);
      expect(parsed.studentId).toBe(studentId);
      expect(parsed.courseId).toBe(courseId);
      expect(parsed.term).toBe(term);
    });
  });

  describe("追加のテストケース", () => {
    describe("statusTagプロパティ", () => {
      it("現在の状態タグを正しく返す", () => {
        const requestedEnrollment = Enrollment.create(
          enrollmentId,
          sessionId,
          studentId,
          courseId,
          term
        );
        expect(requestedEnrollment.statusTag).toBe("Requested");

        const approvedEnrollment = new Enrollment({
          id: enrollmentId,
          sessionId,
          studentId,
          courseId,
          term,
          status: new Approved({
            approvedAt: new Date(),
            approvedBy: NonEmptyString.make("advisor@university.edu")
          }),
          version: 2
        });
        expect(approvedEnrollment.statusTag).toBe("Approved");
      });
    });

    describe("終了状態からの遷移", () => {
      it("Cancelled状態からは何も遷移できない", () => {
        const enrollment = new Enrollment({
          id: enrollmentId,
          sessionId,
          studentId,
          courseId,
          term,
          status: new Cancelled({
            cancelledAt: new Date(),
            reason: NonEmptyString.make("セッションが却下されたため")
          }),
          version: 3
        });

        expect(enrollment.canApprove()).toBe(false);
        expect(enrollment.canStart()).toBe(false);
        expect(enrollment.canComplete()).toBe(false);
        expect(enrollment.canWithdraw()).toBe(false);
        expect(enrollment.canCancel()).toBe(false);
      });

      it("Withdrawn状態からは何も遷移できない", () => {
        const enrollment = new Enrollment({
          id: enrollmentId,
          sessionId,
          studentId,
          courseId,
          term,
          status: new Withdrawn({
            withdrawnAt: new Date(),
            reason: Option.none()
          }),
          version: 4
        });

        expect(enrollment.canApprove()).toBe(false);
        expect(enrollment.canStart()).toBe(false);
        expect(enrollment.canComplete()).toBe(false);
        expect(enrollment.canWithdraw()).toBe(false);
        expect(enrollment.canCancel()).toBe(false);
      });
    });

    describe("Data.Classの機能", () => {
      it("同じデータを持つインスタンスは等価", () => {
        const date = new Date();
        const enrollment1 = new Enrollment({
          id: enrollmentId,
          sessionId,
          studentId,
          courseId,
          term,
          status: new Requested({ requestedAt: date }),
          version: 1
        });

        const enrollment2 = new Enrollment({
          id: enrollmentId,
          sessionId,
          studentId,
          courseId,
          term,
          status: new Requested({ requestedAt: date }),
          version: 1
        });

        expect(enrollment1).toEqual(enrollment2);
      });

      it("異なるデータを持つインスタンスは非等価", () => {
        const enrollment1 = Enrollment.create(
          enrollmentId,
          sessionId,
          studentId,
          courseId,
          term
        );

        const enrollment2 = new Enrollment({
          ...enrollment1,
          version: 2
        });

        expect(enrollment1).not.toEqual(enrollment2);
      });
    });

    describe("成績へのアクセス", () => {
      it("CompletedとWithdrawn以外の状態ではhasGradeがfalse", () => {
        const states: EnrollmentStatus[] = [
          new Requested({ requestedAt: new Date() }),
          new Approved({ approvedAt: new Date(), approvedBy: NonEmptyString.make("advisor") }),
          new InProgress({ startedAt: new Date() }),
          new Cancelled({ cancelledAt: new Date(), reason: NonEmptyString.make("理由") })
        ];

        states.forEach(status => {
          const enrollment = new Enrollment({
            id: enrollmentId,
            sessionId,
            studentId,
            courseId,
            term,
            status,
            version: 1
          });
          
          expect(enrollment.hasGrade()).toBe(false);
          expect(Option.isNone(enrollment.getGrade())).toBe(true);
        });
      });

      it("Withdrawn状態では成績は常にW", () => {
        const enrollment = new Enrollment({
          id: enrollmentId,
          sessionId,
          studentId,
          courseId,
          term,
          status: new Withdrawn({
            withdrawnAt: new Date(),
            reason: Option.some(NonEmptyString.make("健康上の理由"))
          }),
          version: 3
        });

        // Withdrawnの場合、成績は常に"W"を返す
        expect(enrollment.hasGrade()).toBe(true);
        const grade = enrollment.getGrade();
        expect(Option.isSome(grade)).toBe(true);
        if (Option.isSome(grade)) {
          expect(grade.value).toBe("W");
        }
      });

      it("Withdrawn状態では理由に関わらず成績はW", () => {
        // 理由あり
        const enrollmentWithReason = new Enrollment({
          id: enrollmentId,
          sessionId,
          studentId,
          courseId,
          term,
          status: new Withdrawn({
            withdrawnAt: new Date(),
            reason: Option.some(NonEmptyString.make("個人的な事情"))
          }),
          version: 3
        });

        // 理由なし
        const enrollmentWithoutReason = new Enrollment({
          id: EnrollmentId.create(studentId, CourseId.make("C000102"), term),
          sessionId,
          studentId,
          courseId: CourseId.make("C000102"),
          term,
          status: new Withdrawn({
            withdrawnAt: new Date(),
            reason: Option.none()
          }),
          version: 3
        });

        // 両方とも"W"を返す
        [enrollmentWithReason, enrollmentWithoutReason].forEach(enrollment => {
          expect(enrollment.hasGrade()).toBe(true);
          const grade = enrollment.getGrade();
          expect(Option.isSome(grade)).toBe(true);
          if (Option.isSome(grade)) {
            expect(grade.value).toBe("W");
          }
        });
      });
    });

    describe("バージョン管理", () => {
      it("新規作成時のバージョンは1", () => {
        const enrollment = Enrollment.create(
          enrollmentId,
          sessionId,
          studentId,
          courseId,
          term
        );

        expect(enrollment.version).toBe(1);
      });

      it("バージョンは正の整数である", () => {
        const versions = [1, 2, 10, 100];
        
        versions.forEach(version => {
          const enrollment = new Enrollment({
            id: enrollmentId,
            sessionId,
            studentId,
            courseId,
            term,
            status: new Requested({ requestedAt: new Date() }),
            version
          });
          
          expect(enrollment.version).toBe(version);
          expect(enrollment.version).toBeGreaterThan(0);
          expect(Number.isInteger(enrollment.version)).toBe(true);
        });
      });
    });
  });
});