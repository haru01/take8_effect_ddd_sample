import { Effect, Context, Option } from "effect";
import { RegistrationSession } from "../models/registration-session/registration-session.js";
import { RegistrationSessionId, StudentId, Term } from "../models/shared/value-objects.js";

export interface RegistrationSessionRepository {
  readonly findById: (id: RegistrationSessionId) => Effect.Effect<Option.Option<RegistrationSession>, never>;
  readonly findByStudentAndTerm: (studentId: StudentId, term: Term) => Effect.Effect<Option.Option<RegistrationSession>, never>;
  readonly save: (session: RegistrationSession) => Effect.Effect<void, never>;
}

export const RegistrationSessionRepository = Context.GenericTag<RegistrationSessionRepository>("@app/RegistrationSessionRepository");