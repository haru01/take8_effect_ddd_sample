import { Effect } from "effect";

export type ValidationBuilder<E = never> = {
  readonly validations: ReadonlyArray<Effect.Effect<void, E>>;
  add<E2>(validation: Effect.Effect<void, E2>): ValidationBuilder<E | E2>;
  execute(): Effect.Effect<void, E>;
};

export const createValidationBuilder = (): ValidationBuilder => ({
  validations: [],
  add: function<E2>(validation: Effect.Effect<void, E2>) {
    return {
      validations: [...this.validations, validation],
      add: this.add,
      execute: this.execute
    } as ValidationBuilder<E2>;
  },
  execute: function() {
    return Effect.all(this.validations, { concurrency: "unbounded" }).pipe(
      Effect.asVoid
    );
  }
});