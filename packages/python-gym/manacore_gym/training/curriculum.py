"""
Curriculum Learning Scheduler for PPO training.

Implements progressive difficulty scaling: start with easy opponents
and gradually increase difficulty as the agent improves.
"""

from dataclasses import dataclass
from typing import Callable, Optional


@dataclass
class CurriculumStage:
    """A single stage in the curriculum."""

    name: str
    opponent: str
    timesteps: int
    target_win_rate: float
    min_games_to_advance: int = 100
    description: str = ""


# Standard curriculum: Random -> Greedy -> Self-play
STANDARD_CURRICULUM: list[CurriculumStage] = [
    CurriculumStage(
        name="Stage 1: Beat Random",
        opponent="random",
        timesteps=50_000,
        target_win_rate=0.90,
        min_games_to_advance=50,
        description="Learn basic game mechanics and legal moves",
    ),
    CurriculumStage(
        name="Stage 2: Beat Greedy",
        opponent="greedy",
        timesteps=200_000,
        target_win_rate=0.60,
        min_games_to_advance=100,
        description="Learn to outplay 1-ply lookahead",
    ),
    CurriculumStage(
        name="Stage 3: Self-Play",
        opponent="self",
        timesteps=500_000,
        target_win_rate=0.55,  # Slightly above 50% means improvement
        min_games_to_advance=200,
        description="Refine strategies through self-play",
    ),
]

# Fast curriculum for quick experiments
FAST_CURRICULUM: list[CurriculumStage] = [
    CurriculumStage(
        name="Stage 1: Beat Random",
        opponent="random",
        timesteps=20_000,
        target_win_rate=0.80,
        min_games_to_advance=30,
        description="Learn basic game mechanics",
    ),
    CurriculumStage(
        name="Stage 2: Beat Greedy",
        opponent="greedy",
        timesteps=80_000,
        target_win_rate=0.55,
        min_games_to_advance=50,
        description="Learn to outplay greedy bot",
    ),
]


class CurriculumScheduler:
    """
    Manages curriculum progression during training.

    Tracks win rates and automatically advances to harder opponents
    when targets are met.

    Example:
        >>> scheduler = CurriculumScheduler(STANDARD_CURRICULUM)
        >>> opponent = scheduler.get_opponent()  # Returns "random"
        >>> scheduler.record_game(won=True)
        >>> if scheduler.should_advance():
        ...     scheduler.advance()
        >>> opponent = scheduler.get_opponent()  # May return "greedy" if advanced
    """

    def __init__(
        self,
        curriculum: list[CurriculumStage],
        on_stage_change: Optional[Callable[[int, CurriculumStage], None]] = None,
    ):
        """
        Initialize curriculum scheduler.

        Args:
            curriculum: List of stages to progress through
            on_stage_change: Optional callback when stage changes
        """
        self.curriculum = curriculum
        self.current_stage_idx = 0
        self.on_stage_change = on_stage_change

        # Tracking per stage
        self.stage_wins: list[int] = [0] * len(curriculum)
        self.stage_games: list[int] = [0] * len(curriculum)
        self.stage_timesteps: list[int] = [0] * len(curriculum)

        # Rolling window for recent performance
        self._recent_results: list[bool] = []
        self._window_size = 100

    @property
    def current_stage(self) -> CurriculumStage:
        """Get the current curriculum stage."""
        return self.curriculum[self.current_stage_idx]

    @property
    def is_complete(self) -> bool:
        """Check if curriculum is complete."""
        return self.current_stage_idx >= len(self.curriculum)

    def get_opponent(self) -> str:
        """
        Get the current opponent type.

        Returns "self" for self-play stages, otherwise the bot name.
        """
        if self.is_complete:
            return "greedy"  # Default after completion
        return self.current_stage.opponent

    def record_game(self, won: bool, timesteps: int = 0) -> None:
        """
        Record a game result.

        Args:
            won: Whether the agent won
            timesteps: Number of timesteps in this game
        """
        if self.is_complete:
            return

        idx = self.current_stage_idx
        if won:
            self.stage_wins[idx] += 1
        self.stage_games[idx] += 1
        self.stage_timesteps[idx] += timesteps

        # Update rolling window
        self._recent_results.append(won)
        if len(self._recent_results) > self._window_size:
            self._recent_results.pop(0)

    def get_win_rate(self, window: Optional[int] = None) -> float:
        """
        Get current win rate.

        Args:
            window: If provided, use only the last N games

        Returns:
            Win rate as float between 0 and 1
        """
        if window is not None:
            results = self._recent_results[-window:]
            if not results:
                return 0.0
            return sum(results) / len(results)

        idx = self.current_stage_idx
        if self.stage_games[idx] == 0:
            return 0.0
        return self.stage_wins[idx] / self.stage_games[idx]

    def should_advance(self) -> bool:
        """
        Check if we should advance to the next stage.

        Returns True if:
        - Met minimum games requirement
        - Recent win rate exceeds target
        """
        if self.is_complete:
            return False

        stage = self.current_stage
        games = self.stage_games[self.current_stage_idx]

        # Need minimum games
        if games < stage.min_games_to_advance:
            return False

        # Check recent win rate (use last 50 games)
        recent_win_rate = self.get_win_rate(window=50)
        return recent_win_rate >= stage.target_win_rate

    def advance(self) -> bool:
        """
        Advance to the next stage.

        Returns:
            True if advanced, False if already at final stage
        """
        if self.current_stage_idx >= len(self.curriculum) - 1:
            self.current_stage_idx = len(self.curriculum)  # Mark complete
            return False

        self.current_stage_idx += 1
        self._recent_results.clear()

        if self.on_stage_change:
            self.on_stage_change(self.current_stage_idx, self.current_stage)

        return True

    def get_progress(self) -> dict:
        """Get current progress summary."""
        idx = self.current_stage_idx
        stage = self.current_stage if not self.is_complete else None

        return {
            "stage_idx": idx,
            "stage_name": stage.name if stage else "Complete",
            "opponent": self.get_opponent(),
            "games_played": self.stage_games[idx] if not self.is_complete else sum(self.stage_games),
            "wins": self.stage_wins[idx] if not self.is_complete else sum(self.stage_wins),
            "win_rate": self.get_win_rate(),
            "recent_win_rate": self.get_win_rate(window=50),
            "target_win_rate": stage.target_win_rate if stage else None,
            "timesteps": self.stage_timesteps[idx] if not self.is_complete else sum(self.stage_timesteps),
            "is_complete": self.is_complete,
        }

    def get_summary(self) -> str:
        """Get human-readable summary of progress."""
        progress = self.get_progress()

        lines = [
            "=== Curriculum Progress ===",
            f"Stage: {progress['stage_name']}",
            f"Opponent: {progress['opponent']}",
            f"Games: {progress['games_played']}",
            f"Win Rate: {progress['win_rate']:.1%}",
            f"Recent (50): {progress['recent_win_rate']:.1%}",
        ]

        if progress["target_win_rate"]:
            lines.append(f"Target: {progress['target_win_rate']:.1%}")

        return "\n".join(lines)


class EvalCallback:
    """
    Callback for tracking training progress with curriculum.

    Integrates with sb3's callback system to track win rates
    and manage curriculum advancement.
    """

    def __init__(
        self,
        scheduler: CurriculumScheduler,
        eval_freq: int = 1000,
        verbose: int = 1,
    ):
        self.scheduler = scheduler
        self.eval_freq = eval_freq
        self.verbose = verbose
        self.n_calls = 0

    def __call__(self, locals_dict: dict, globals_dict: dict) -> bool:
        """
        Called after each training step.

        Returns False to stop training early if curriculum complete.
        """
        self.n_calls += 1

        # Check for episode completion
        if "infos" in locals_dict:
            for info in locals_dict["infos"]:
                if "episode" in info:
                    # Episode finished
                    reward = info["episode"]["r"]
                    won = reward > 0
                    length = info["episode"]["l"]
                    self.scheduler.record_game(won, timesteps=length)

        # Periodic logging and advancement check
        if self.n_calls % self.eval_freq == 0:
            if self.verbose:
                print(f"\n{self.scheduler.get_summary()}\n")

            if self.scheduler.should_advance():
                old_stage = self.scheduler.current_stage.name
                self.scheduler.advance()
                if self.verbose:
                    new_stage = self.scheduler.current_stage.name if not self.scheduler.is_complete else "Complete"
                    print("\n*** CURRICULUM ADVANCEMENT ***")
                    print(f"    {old_stage} -> {new_stage}")
                    print()

        return True  # Continue training
