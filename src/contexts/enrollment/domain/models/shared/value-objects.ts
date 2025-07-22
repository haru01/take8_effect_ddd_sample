import { Schema, Brand } from "effect";

// --- NonEmptyString ---
export type NonEmptyString = string & Brand.Brand<"NonEmptyString">;

const NonEmptyStringSchema = Schema.String.pipe(
  Schema.minLength(1, { message: () => "文字列は1文字以上である必要があります" }),
  Schema.brand("NonEmptyString")
);

export const NonEmptyString = {
  decode: Schema.decode(NonEmptyStringSchema),
  encode: Schema.encode(NonEmptyStringSchema),
  make: (value: string): NonEmptyString => value as NonEmptyString,
};

// --- StudentId ---
export type StudentId = string & Brand.Brand<"StudentId">;

const StudentIdSchema = Schema.String.pipe(
  Schema.pattern(/^S\d{8}$/, {
    message: () => "学生IDは'S'で始まる9文字である必要があります"
  }),
  Schema.brand("StudentId")
);

export const StudentId = {
  decode: Schema.decode(StudentIdSchema),
  encode: Schema.encode(StudentIdSchema),
  make: (value: string): StudentId => value as StudentId,
};

// --- CourseId ---
export type CourseId = string & Brand.Brand<"CourseId">;

const CourseIdSchema = Schema.String.pipe(
  Schema.pattern(/^C\d{6}$/, {
    message: () => "科目IDは'C'で始まる7文字である必要があります"
  }),
  Schema.brand("CourseId")
);

export const CourseId = {
  decode: Schema.decode(CourseIdSchema),
  encode: Schema.encode(CourseIdSchema),
  make: (value: string): CourseId => value as CourseId,
};

// --- Term ---
export type Term = string & Brand.Brand<"Term">;

const TermSchema = Schema.String.pipe(
  Schema.pattern(/^\d{4}-(Spring|Fall|Summer)$/, {
    message: () => "学期は'YYYY-Spring/Fall/Summer'形式である必要があります"
  }),
  Schema.brand("Term")
);

export const Term = {
  decode: Schema.decode(TermSchema),
  encode: Schema.encode(TermSchema),
  make: (value: string): Term => value as Term,
};

// --- RegistrationSessionId ---
export type RegistrationSessionId = string & Brand.Brand<"RegistrationSessionId">;

const RegistrationSessionIdSchema = Schema.String.pipe(
  Schema.pattern(/^RS\d{8}$/, {
    message: () => "セッションIDは'RS'で始まる10文字である必要があります"
  }),
  Schema.brand("RegistrationSessionId")
);

export const RegistrationSessionId = {
  decode: Schema.decode(RegistrationSessionIdSchema),
  encode: Schema.encode(RegistrationSessionIdSchema),
  make: (value: string): RegistrationSessionId => value as RegistrationSessionId,
};

// セッションIDの生成
let idCounter = 0;
export const createRegistrationSessionId = (
  _studentId: StudentId,
  _term: Term
): RegistrationSessionId => {
  // 実際は連番やUUIDを使用
  // テスト用に連番とタイムスタンプを組み合わせて一意性を保証
  const timestamp = Date.now().toString().slice(-6);
  const counter = (++idCounter).toString().padStart(2, '0');
  return RegistrationSessionId.make(`RS${timestamp}${counter}`);
};

// --- EnrollmentId ---
// 複合IDとしてのEnrollmentId（StudentId:CourseId:Term）
export type EnrollmentId = string & Brand.Brand<"EnrollmentId">;

export const EnrollmentId = {
  make: (value: string): EnrollmentId => value as EnrollmentId,
  create: (
    studentId: StudentId,
    courseId: CourseId,
    term: Term
  ): EnrollmentId => {
    return `${studentId}:${courseId}:${term}` as EnrollmentId;
  },
  parse: (
    enrollmentId: EnrollmentId
  ): { studentId: StudentId; courseId: CourseId; term: Term } => {
    const [studentId, courseId, term] = enrollmentId.split(':');
    return {
      studentId: StudentId.make(studentId),
      courseId: CourseId.make(courseId),
      term: Term.make(term)
    };
  }
};

// --- 成績 ---
export const Grade = Schema.Literal("A", "B", "C", "D", "F", "W", "I", "P");
export type Grade = Schema.Schema.Type<typeof Grade>;