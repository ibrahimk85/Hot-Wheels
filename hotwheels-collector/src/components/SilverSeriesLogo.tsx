'use client';

/**
 * Hot Wheels Silver Series logo component for collections page.
 * Uses text styling until a dedicated logo image is added.
 */
export function SilverSeriesLogo() {
  return (
    <div className="flex flex-col items-center justify-center w-full min-h-[120px]">
      <div className="text-center space-y-1">
        <div className="font-semibold text-lg text-foreground">
          Hot Wheels
        </div>
        <div className="font-bold text-xl text-slate-600 dark:text-slate-400">
          Silver Series
        </div>
        <div className="text-xs text-muted-foreground">
          Themed Assortment
        </div>
      </div>
    </div>
  );
}
