import { Effect, Context } from "effect";
import { RegistrationSession } from "../models/registration-session/registration-session.js";
import { RegistrationSessionId, StudentId, Term } from "../models/shared/value-objects.js";
import { SessionNotFound } from "../errors/domain-errors.js";
import { EventStoreError } from "../../../shared/kernel/types/event-store.js";

export interface RegistrationSessionRepository {
  readonly findById: (id: RegistrationSessionId) => Effect.Effect<RegistrationSession, SessionNotFound | EventStoreError>;
  readonly findByStudentAndTerm: (studentId: StudentId, term: Term) => Effect.Effect<RegistrationSession, SessionNotFound | EventStoreError>;
}

export const RegistrationSessionRepository = Context.GenericTag<RegistrationSessionRepository>("@app/RegistrationSessionRepository");