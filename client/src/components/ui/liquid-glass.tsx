import { cn } from "@/lib/utils";
import { forwardRef, HTMLAttributes } from "react";

export interface LiquidGlassProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "strong";
  animate?: boolean;
}

const LiquidGlass = forwardRef<HTMLDivElement, LiquidGlassProps>(
  ({ className, variant = "default", animate = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          variant === "strong" ? "liquid-glass-strong" : "liquid-glass",
          animate && "animate-morphing",
          className
        )}
        {...props}
      />
    );
  }
);

LiquidGlass.displayName = "LiquidGlass";

export { LiquidGlass };
