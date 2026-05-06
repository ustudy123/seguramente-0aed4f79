import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  indicatorClassName?: string;
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, indicatorClassName, ...props }, ref) => {
  const v = Math.max(0, Math.min(100, Number(value) || 0));

  // Cor do indicador conforme avanço — só aparece quando há progresso
  const autoColor =
    v >= 100
      ? "bg-gradient-to-r from-emerald-500 to-emerald-600"
      : v >= 75
        ? "bg-gradient-to-r from-lime-500 to-emerald-500"
        : v >= 50
          ? "bg-gradient-to-r from-yellow-400 to-lime-500"
          : v >= 25
            ? "bg-gradient-to-r from-amber-500 to-yellow-500"
            : "bg-gradient-to-r from-rose-500 to-orange-500";

  // Trilho: cinza neutro quando há progresso; vermelho-suave quando 0% (sinaliza atenção)
  const trackClass = v === 0
    ? "bg-rose-100 dark:bg-rose-950/40 ring-1 ring-inset ring-rose-200 dark:ring-rose-900/50"
    : "bg-secondary";

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        "relative h-4 w-full overflow-hidden rounded-full",
        trackClass,
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full w-full flex-1 transition-all duration-500 ease-out shadow-sm",
          indicatorClassName || autoColor,
        )}
        style={{ transform: `translateX(-${100 - v}%)` }}
      />
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
