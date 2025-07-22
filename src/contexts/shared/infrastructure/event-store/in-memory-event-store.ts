import { Effect, Layer, Ref } from "effect";
import { EventStore, EventStoreError, AggregateType } from "../../kernel/types/event-store.js";
import { DomainEvent } from "../../../enrollment/domain/events/registration-session-events.js";

interface StoredEvent {
  readonly aggregateId: string;
  readonly aggregateType: AggregateType;
  readonly event: DomainEvent;
  readonly timestamp: Date;
}

export const InMemoryEventStore = Layer.effect(
  EventStore,
  Effect.gen(function* () {
    const events = yield* Ref.make<ReadonlyArray<StoredEvent>>([]);

    return {
      appendEvent: (aggregateId, aggregateType, event) =>
        Effect.gen(function* () {
          const storedEvent: StoredEvent = {
            aggregateId,
            aggregateType,
            event,
            timestamp: new Date()
          };
          yield* Ref.update(events, (current) => [...current, storedEvent]);
        }).pipe(
          Effect.catchAll((error) =>
            Effect.fail(new EventStoreError({ cause: error }))
          )
        ),

      getEvents: (aggregateId, aggregateType) =>
        Effect.gen(function* () {
          const allEvents = yield* Ref.get(events);
          return allEvents
            .filter(e => e.aggregateId === aggregateId && e.aggregateType === aggregateType)
            .map(e => e.event);
        }).pipe(
          Effect.catchAll((error) =>
            Effect.fail(new EventStoreError({ cause: error }))
          )
        )
    };
  })
);