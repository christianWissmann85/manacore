# Plan: Project-Wide TODO Resolution

## Phase 1: CLI Client Profiling Enhancements

- [x] Task: Implement AI Agent decision-making latency tracking in `Profiler.ts` 0f586dc
  - [x] Write failing tests for AI latency tracking
  - [x] Implement start/end markers for AI move selection
  - [x] Update Profiler report to display AI metrics
- [x] Task: Implement Engine action resolution latency tracking in `Profiler.ts` 0f586dc
  - [x] Write failing tests for Engine latency tracking
  - [x] Implement timing for `applyAction` calls
  - [x] Update Profiler report to display Engine metrics
- [x] Task: Conductor - User Manual Verification 'Phase 1: CLI Client Profiling Enhancements' (Protocol in workflow.md) 0f586dc

## Phase 2: Game Engine - Ability Stack

- [x] Task: Define Stack state structure in `packages/engine/src/state` ✅ ALREADY COMPLETE
  - [x] ~~Write failing tests for Stack state persistence~~ (already exists)
  - [x] ~~Implement `StackItem` interface and `stack` array in `GameState`~~ (already exists)
- [x] Task: Implement Stack resolution logic (LIFO) in `reducer.ts` ✅ ALREADY COMPLETE
  - [x] ~~Write failing tests for triggered/activated abilities going on stack~~ (already exists)
  - [x] ~~Update `reducer` to push abilities to stack~~ (line 667: `pushAbilityToStack`)
  - [x] ~~Implement stack resolution step (LIFO)~~ (already exists)
- [x] Task: Implement Priority Passing for Stack items ✅ ALREADY COMPLETE
  - [x] ~~Write failing tests for responding to stack items~~ (already exists)
  - [x] ~~Implement priority check before resolving top of stack~~ (already exists)
- [x] Task: Conductor - User Manual Verification 'Phase 2: Game Engine - Ability Stack' (Protocol in workflow.md) ✅ 2026-01-10
  - Investigation revealed all functionality already implemented
  - Removed outdated TODO comment from reducer.ts
  - See: [findings-phase2-phase3.md](./findings-phase2-phase3.md)

## Phase 3: Game Engine - Damage Prevention System

- [x] Task: Implement Generic Replacement Effect / Shield system ✅ ALREADY COMPLETE
  - [x] ~~Write failing tests for damage interception~~ (tests exist)
  - [x] ~~Define `PreventionShield` state~~ (`PlayerState.preventionShields` exists)
  - [x] ~~Update damage application logic~~ (Circles of Protection, Samite Healer, etc. work)
- [~] Task: Implement Healing Salve Prevention Mode ⚠️ SKIPPED - NOT NEEDED FOR GYM
  - [~] ~~Write failing tests~~ (life gain mode sufficient for ML/AI training)
  - [~] ~~Implement prevention mode~~ (infrastructure exists, modal complexity unnecessary)
  - Decision: Keep simple life-gain implementation
- [x] Task: Conductor - User Manual Verification 'Phase 3: Game Engine - Damage Prevention System' (Protocol in workflow.md) ✅ 2026-01-10
  - Prevention infrastructure fully implemented and tested
  - Healing Salve modal complexity deemed unnecessary for gym scope
  - See: [findings-phase2-phase3.md](./findings-phase2-phase3.md)

## Phase 4: Python Gym - DAgger Retraining

- [ ] Task: Implement in-process training loop in `collect_dagger.py`
  - [ ] Write failing tests for training loop integration (mocking model update)
  - [ ] Implement `train_iteration` function in `collect_dagger.py`
  - [ ] Integrate retraining step into the main DAgger loop
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Python Gym - DAgger Retraining' (Protocol in workflow.md)

## Phase 5: Web Client - Lookahead Preview

- [ ] Task: Implement Backend API for one-ply lookahead
  - [ ] Write failing tests for `GET /api/game/:id/preview/:actionId`
  - [ ] Implement preview logic that returns state delta
- [ ] Task: Implement Hover-based Preview UI in Web Client
  - [ ] Write failing tests for hover state in `gameStore.ts`
  - [ ] Implement `onHover` action trigger to fetch and store preview delta
  - [ ] Update UI components to display predicted health/board changes
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Web Client - Lookahead Preview' (Protocol in workflow.md)
