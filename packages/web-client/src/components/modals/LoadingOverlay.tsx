export function LoadingOverlay() {
  return (
    <div className="fixed inset-0 bg-glass-base/80 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-glass-panel rounded-full" />
          <div className="absolute inset-0 border-4 border-accent-primary border-t-transparent rounded-full animate-spin" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-lg font-semibold text-white tracking-wide">Thinking...</span>
          <span className="text-xs text-accent-primary animate-pulse">
            Processing Neural Inputs
          </span>
        </div>
      </div>
    </div>
  );
}
