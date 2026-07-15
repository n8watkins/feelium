export function ProportionalBar({
  percentage,
  className,
}: {
  percentage: number;
  className: string;
}) {
  const width = Math.max(0, Math.min(100, percentage));
  return (
    <svg
      className="h-full w-full"
      viewBox="0 0 100 1"
      preserveAspectRatio="none"
    >
      <rect x="0" y="0" width={width} height="1" rx="0.5" className={className} />
    </svg>
  );
}
