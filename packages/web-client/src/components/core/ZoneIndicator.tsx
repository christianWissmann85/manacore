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
      className="flex flex-col items-center gap-0.5 p-2 rounded-lg hover:bg-glass-highlight transition-colors group"
      title={label}
    >
      <span className="text-lg opacity-70 group-hover:opacity-100 transition-opacity">{icon}</span>
      <span className="text-xs font-mono text-glass-text-secondary group-hover:text-glass-text-primary">
        {count}
      </span>
    </button>
  );
}
