interface InfoStatsProps {
  items: Array<{ label: string; value: string | number }>;
}

export function InfoStats({ items }: InfoStatsProps) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-1">
          <span className="font-medium">{item.label}:</span>
          <span className="text-foreground">{item.value}</span>
          {index < items.length - 1 && (
            <span className="mx-1 text-muted-foreground">•</span>
          )}
        </div>
      ))}
    </div>
  );
}








