import { Effect, Layer, Ref, Option } from "effect";
import { RegistrationSession } from "../../domain/models/registration-session/registration-session.js";
import { RegistrationSessionId } from "../../domain/models/shared/value-objects.js";
import { RegistrationSessionRepository } from "../../domain/repositories/registration-session-repository.js";

export const InMemoryRegistrationSessionRepository = Layer.effect(
  RegistrationSessionRepository,
  Effect.gen(function* () {
    const sessions = yield* Ref.make<Map<RegistrationSessionId, RegistrationSession>>(new Map());

    return {
      findById: (id) =>
        Effect.gen(function* () {
          const sessionMap = yield* Ref.get(sessions);
          const session = sessionMap.get(id);
          return session ? Option.some(session) : Option.none();
        }),

      findByStudentAndTerm: (studentId, term) =>
        Effect.gen(function* () {
          const sessionMap = yield* Ref.get(sessions);
          const found = Array.from(sessionMap.values()).find(
            (session) => session.studentId === studentId && session.term === term
          );
          return found ? Option.some(found) : Option.none();
        }),

      save: (session) =>
        Effect.gen(function* () {
          yield* Ref.update(sessions, (map) => new Map(map).set(session.id, session));
        })
    };
  })
);