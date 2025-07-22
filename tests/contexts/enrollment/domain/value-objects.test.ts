import { describe, it, expect } from "vitest";
import { Effect } from "effect";
import { 
  StudentId, 
  Term, 
  RegistrationSessionId,
  CourseId 
} from "../../../../src/contexts/enrollment/domain/models/shared/value-objects.js";

describe("値オブジェクトのバリデーション", () => {
  describe("StudentId", () => {
    it("有効なフォーマットをデコードできる", () =>
      Effect.gen(function* () {
        const result = yield* StudentId.decode("S12345678");
        expect(result).toBe("S12345678");
      }).pipe(Effect.runPromise)
    );

    it("無効なフォーマット（短すぎる）はエラーになる", () =>
      Effect.gen(function* () {
        const error = yield* StudentId.decode("S123").pipe(Effect.flip);
        expect(error.message).toContain("学生IDは'S'で始まる9文字である必要があります");
      }).pipe(Effect.runPromise)
    );

    it("無効なフォーマット（プレフィックスなし）はエラーになる", () =>
      Effect.gen(function* () {
        const error = yield* StudentId.decode("12345678").pipe(Effect.flip);
        expect(error.message).toContain("学生IDは'S'で始まる9文字である必要があります");
      }).pipe(Effect.runPromise)
    );

    it("無効なフォーマット（文字が含まれる）はエラーになる", () =>
      Effect.gen(function* () {
        const error = yield* StudentId.decode("S123456AB").pipe(Effect.flip);
        expect(error.message).toContain("学生IDは'S'で始まる9文字である必要があります");
      }).pipe(Effect.runPromise)
    );
  });

  describe("Term", () => {
    it("有効なフォーマット（Spring）をデコードできる", () =>
      Effect.gen(function* () {
        const result = yield* Term.decode("2024-Spring");
        expect(result).toBe("2024-Spring");
      }).pipe(Effect.runPromise)
    );

    it("有効なフォーマット（Fall）をデコードできる", () =>
      Effect.gen(function* () {
        const result = yield* Term.decode("2024-Fall");
        expect(result).toBe("2024-Fall");
      }).pipe(Effect.runPromise)
    );

    it("有効なフォーマット（Summer）をデコードできる", () =>
      Effect.gen(function* () {
        const result = yield* Term.decode("2024-Summer");
        expect(result).toBe("2024-Summer");
      }).pipe(Effect.runPromise)
    );

    it("無効なフォーマット（不正な季節）はエラーになる", () =>
      Effect.gen(function* () {
        const error = yield* Term.decode("2024-Invalid").pipe(Effect.flip);
        expect(error.message).toContain("学期は'YYYY-Spring/Fall/Summer'形式である必要があります");
      }).pipe(Effect.runPromise)
    );

    it("無効なフォーマット（年度なし）はエラーになる", () =>
      Effect.gen(function* () {
        const error = yield* Term.decode("Spring").pipe(Effect.flip);
        expect(error.message).toContain("学期は'YYYY-Spring/Fall/Summer'形式である必要があります");
      }).pipe(Effect.runPromise)
    );
  });

  describe("RegistrationSessionId", () => {
    it("有効な複合キーから生成できる", () =>
      Effect.gen(function* () {
        const studentId = StudentId.make("S12345678");
        const term = Term.make("2024-Spring");
        const sessionId = yield* RegistrationSessionId.create(studentId, term);
        expect(sessionId).toBe("S12345678:2024-Spring");
      }).pipe(Effect.runPromise)
    );

    it("不正な学生IDを使った生成は失敗する", () =>
      Effect.gen(function* () {
        const invalidStudentId = StudentId.make("INVALID");
        const validTerm = Term.make("2024-Spring");
        const error = yield* RegistrationSessionId.create(invalidStudentId, validTerm).pipe(Effect.flip);
        expect(error.message).toContain("セッションIDは'S12345678:YYYY-Season'形式である必要があります");
      }).pipe(Effect.runPromise)
    );

    it("不正な学期を使った生成は失敗する", () =>
      Effect.gen(function* () {
        const validStudentId = StudentId.make("S12345678");
        const invalidTerm = Term.make("INVALID-TERM");
        const error = yield* RegistrationSessionId.create(validStudentId, invalidTerm).pipe(Effect.flip);
        expect(error.message).toContain("セッションIDは'S12345678:YYYY-Season'形式である必要があります");
      }).pipe(Effect.runPromise)
    );

    it("両方とも不正な値での生成は失敗する", () =>
      Effect.gen(function* () {
        const invalidStudentId = StudentId.make("WRONG");
        const invalidTerm = Term.make("BAD-FORMAT");
        const error = yield* RegistrationSessionId.create(invalidStudentId, invalidTerm).pipe(Effect.flip);
        expect(error.message).toContain("セッションIDは'S12345678:YYYY-Season'形式である必要があります");
      }).pipe(Effect.runPromise)
    );

    it("コロンを含む学生IDでの生成は失敗する（区切り文字衝突）", () =>
      Effect.gen(function* () {
        const colonStudentId = StudentId.make("S12345:78");
        const validTerm = Term.make("2024-Spring");
        const error = yield* RegistrationSessionId.create(colonStudentId, validTerm).pipe(Effect.flip);
        expect(error.message).toContain("セッションIDは'S12345678:YYYY-Season'形式である必要があります");
      }).pipe(Effect.runPromise)
    );

    it("コロンを含む学期での生成は失敗する（区切り文字衝突）", () =>
      Effect.gen(function* () {
        const validStudentId = StudentId.make("S12345678");
        const colonTerm = Term.make("2024:Spring");
        const error = yield* RegistrationSessionId.create(validStudentId, colonTerm).pipe(Effect.flip);
        expect(error.message).toContain("セッションIDは'S12345678:YYYY-Season'形式である必要があります");
      }).pipe(Effect.runPromise)
    );

    it("parseメソッドで複合キーを分解できる", () => {
      const sessionId = RegistrationSessionId.make("S12345678:2024-Spring");
      const { studentId, term } = RegistrationSessionId.parse(sessionId);
      expect(studentId).toBe("S12345678");
      expect(term).toBe("2024-Spring");
    });
  });

  describe("CourseId", () => {
    it("有効なフォーマットをデコードできる", () =>
      Effect.gen(function* () {
        const result = yield* CourseId.decode("C123456");
        expect(result).toBe("C123456");
      }).pipe(Effect.runPromise)
    );

    it("無効なフォーマット（短すぎる）はエラーになる", () =>
      Effect.gen(function* () {
        const error = yield* CourseId.decode("C123").pipe(Effect.flip);
        expect(error.message).toContain("科目IDは'C'で始まる7文字である必要があります");
      }).pipe(Effect.runPromise)
    );

    it("無効なフォーマット（プレフィックスなし）はエラーになる", () =>
      Effect.gen(function* () {
        const error = yield* CourseId.decode("123456").pipe(Effect.flip);
        expect(error.message).toContain("科目IDは'C'で始まる7文字である必要があります");
      }).pipe(Effect.runPromise)
    );
  });
});