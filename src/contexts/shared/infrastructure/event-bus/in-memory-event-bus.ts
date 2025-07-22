import { Effect, Layer, Ref } from "effect";
import { EventBus } from "../../kernel/types/event-bus.js";
import { DomainEvent } from "../../../enrollment/domain/events/registration-session-events.js";

type EventHandler = (event: DomainEvent) => Effect.Effect<void, never>;

export const InMemoryEventBus = Layer.effect(
  EventBus,
  Effect.gen(function* () {
    const handlers = yield* Ref.make<ReadonlyArray<EventHandler>>([]);

    return {
      publish: (event) =>
        Effect.gen(function* () {
          const currentHandlers = yield* Ref.get(handlers);
          yield* Effect.all(
            currentHandlers.map((handler) => handler(event)),
            { concurrency: "unbounded" }
          );
        }),

      subscribe: (handler) =>
        Effect.gen(function* () {
          yield* Ref.update(handlers, (current) => [...current, handler]);
        })
    };
  })
);