import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold outline-none transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#059669]/25 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-[#059669] text-white shadow-[0_12px_24px_-12px_rgba(5,150,105,0.7)] hover:bg-[#047857]",
        destructive:
          "bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:ring-red-600/25",
        outline:
          "border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-[#059669]/30 hover:bg-[#ECFDF5] hover:text-[#047857]",
        secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200",
        ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        link:
          "h-auto rounded-none p-0 text-[#059669] underline-offset-4 hover:text-[#047857] hover:underline",
      },
      size: {
        default: "h-11 px-5 py-3",
        sm: "h-8 gap-1.5 rounded-lg px-3 text-xs",
        lg: "h-12 px-6",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
