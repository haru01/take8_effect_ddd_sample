# GitHub Copilot Configuration

## Project Overview

This is an enrollment management system built with TypeScript, Effect-TS, and following CQRS/Event Sourcing patterns.

## Key Technologies
- TypeScript
- Effect-TS (functional programming library)
- Vitest (testing framework)
- CQRS (Command Query Responsibility Segregation)
- Event Sourcing
- Domain-Driven Design (DDD)

## Code Style Guidelines

### Use Effect-TS Patterns
```typescript
// Good: Use Brand types
export type StudentId = string & Brand.Brand<"StudentId">;

// Bad: Use primitive types
export type StudentId = string;
```

### Follow CQRS Pattern
```typescript
// Domain layer: Business logic
export const performAction = (aggregate, input) =>
  Effect.gen(function* () {
    yield* validate(aggregate, input);
    return new DomainEvent({ ... });
  });

// Application layer: Infrastructure coordination
export const command = (input) =>
  Effect.gen(function* () {
    const aggregate = yield* repository.findById(id);
    const event = yield* domainLogic(aggregate, input);
    yield* eventStore.appendEvent(id, "Type", event);
    return id;
  });
```

### Test-First Development
Always write failing tests before implementation following AcceptanceTDD cycle:
1. Red (failing test)
2. Green (minimal implementation)
3. Refactor (improve code quality)

## Project Structure
```
src/contexts/enrollment/
├── domain/         # Business logic
├── application/    # Use cases
└── infrastructure/ # Technical implementation

tests/
├── stories/        # Acceptance tests
└── helpers/        # Test utilities
```

## Quality Standards
- Test coverage: 90%+ required
- TypeScript errors: 0
- All tests must pass
- Follow existing patterns

## References
For detailed guidelines, see `.github/copilot-instructions/` directory.