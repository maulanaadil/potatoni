import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import type { ComponentProps } from "react";

// Press feedback: scale(0.97) on :active, 160ms strong ease-out (animate skill → Button press).
export const buttonVariants = cva(
  [
    "inline-flex shrink-0 select-none items-center justify-center gap-2 rounded-2xl border-2 font-display font-bold tracking-tight",
    "transition-[transform,background-color,color,border-color] duration-160 ease-out-strong",
    "active:scale-[0.97] motion-reduce:active:scale-100",
    "outline-none focus-visible:ring-4 focus-visible:ring-sun/70",
    "disabled:pointer-events-none disabled:opacity-45",
  ],
  {
    variants: {
      intent: {
        primary: "border-navy bg-navy text-cream hover:bg-navy-soft",
        sun: "border-navy bg-sun text-navy hover:bg-sun-deep",
        outline: "border-navy bg-paper text-navy hover:bg-cream-deep",
        ghost: "border-transparent bg-transparent text-navy hover:bg-navy/5",
        danger: "border-tomato bg-paper text-tomato hover:bg-tomato hover:text-paper",
        success: "border-navy bg-leaf text-paper hover:bg-leaf/90",
      },
      size: {
        sm: "h-9 px-3 text-sm pointer-coarse:h-11",
        md: "h-11 px-4 text-base",
        lg: "h-14 px-6 text-lg",
        icon: "size-11 text-lg",
      },
    },
    defaultVariants: { intent: "primary", size: "md" },
  },
);

type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonVariants>;

export function Button({ className, intent, size, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ intent, size }), className)} {...props} />;
}
