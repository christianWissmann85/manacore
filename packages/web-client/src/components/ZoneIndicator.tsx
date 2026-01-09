interface ZoneIndicatorProps {
  icon: string;
  count: number;
  label: string;
  onClick?: () => void;
}

export function ZoneIndicator({ icon, count, label, onClick }: ZoneIndicatorProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-0.5 p-2 rounded hover:bg-board-accent/30 transition-colors"
      title={label}
    >
      <span className="text-lg">{icon}</span>
      <span className="text-sm font-mono">{count}</span>
    </button>
  );
}
