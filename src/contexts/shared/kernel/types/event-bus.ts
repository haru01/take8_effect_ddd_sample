import { Effect, Context } from "effect";
import { DomainEvent } from "../../../enrollment/domain/events/registration-session-events.js";

export interface EventBus {
  readonly publish: (event: DomainEvent) => Effect.Effect<void, never>;
  readonly subscribe: (handler: (event: DomainEvent) => Effect.Effect<void, never>) => Effect.Effect<void, never>;
}

export const EventBus = Context.GenericTag<EventBus>("@app/EventBus");