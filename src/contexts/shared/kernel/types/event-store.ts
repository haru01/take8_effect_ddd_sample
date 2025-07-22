import { Effect, Context, Data } from "effect";
import { DomainEvent } from "../../../enrollment/domain/events/registration-session-events.js";
import { EnrollmentId, RegistrationSessionId } from "@enrollment/domain/models/shared/value-objects.js";

export class EventStoreError extends Data.TaggedError("EventStoreError")<{
  readonly cause: unknown;
}> {}

export type AggregateType = "RegistrationSession" | "Enrollment";
export type AggregateId =  RegistrationSessionId | EnrollmentId;
export interface EventStore {
  readonly appendEvent: (aggregateId: AggregateId, aggregateType: AggregateType, event: DomainEvent) => Effect.Effect<void, EventStoreError>;
  readonly getEvents: (aggregateId: AggregateId, aggregateType: AggregateType) => Effect.Effect<ReadonlyArray<DomainEvent>, EventStoreError>;
}

export const EventStore = Context.GenericTag<EventStore>("@app/EventStore");