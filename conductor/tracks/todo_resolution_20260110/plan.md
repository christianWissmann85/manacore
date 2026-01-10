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
- [ ] Task: Define Stack state structure in `packages/engine/src/state`
    - [ ] Write failing tests for Stack state persistence
    - [ ] Implement `StackItem` interface and `stack` array in `GameState`
- [ ] Task: Implement Stack resolution logic (LIFO) in `reducer.ts`
    - [ ] Write failing tests for triggered/activated abilities going on stack
    - [ ] Update `reducer` to push abilities to stack instead of immediate resolution
    - [ ] Implement stack resolution step (LIFO)
- [ ] Task: Implement Priority Passing for Stack items
    - [ ] Write failing tests for responding to stack items
    - [ ] Implement priority check before resolving top of stack
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Game Engine - Ability Stack' (Protocol in workflow.md)

## Phase 3: Game Engine - Damage Prevention System
- [ ] Task: Implement Generic Replacement Effect / Shield system
    - [ ] Write failing tests for damage interception
    - [ ] Define `PreventionShield` state and `ReplacementEffect` registry
    - [ ] Update damage application logic to check for active shields
- [ ] Task: Implement Healing Salve Prevention Mode
    - [ ] Write failing tests for Healing Salve prevention (should prevent next 3 damage)
    - [ ] Implement Healing Salve ability as a `PreventionShield` creator
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Game Engine - Damage Prevention System' (Protocol in workflow.md)

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
