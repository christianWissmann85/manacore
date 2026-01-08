# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2024-01-08

### Added
- Initial release of manacore-gym
- `ManaCoreBattleEnv` - Gymnasium-compatible environment for Magic: The Gathering
- `BunBridge` - HTTP bridge client for communicating with the game server
- Action masking support for variable legal actions
- 25-dimensional observation space with normalized features
- Sparse rewards (+1 win, -1 loss)
- Auto-start server functionality
- Vectorized environment helpers (`make_vec_env`, `make_masked_vec_env`)
- Integration with Stable Baselines3's MaskablePPO
- Example scripts:
  - `random_agent.py` - Basic environment usage
  - `train_ppo.py` - PPO training with TensorBoard logging
  - `evaluate_agent.py` - Model evaluation against multiple opponents
  - `benchmark_throughput.py` - Performance benchmarking
- Jupyter notebook tutorial (`01_getting_started.ipynb`)
- Comprehensive test suite

### Opponents Available
- `random` - Random legal action selection
- `greedy` - 1-ply lookahead heuristic bot
- `mcts` / `mcts-fast` / `mcts-strong` - Monte Carlo Tree Search variants

### Performance
- Step latency: ~2.5ms mean
- Sequential throughput: ~8 games/sec (HTTP overhead)
- Vectorized training supported for parallel environments

## Links
- [ManaCore Repository](https://github.com/christianWissmann85/manacore)
- [Documentation](https://github.com/christianWissmann85/manacore/tree/main/packages/python-gym)
