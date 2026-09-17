"use client";

import * as LabelPrimitive from "@radix-ui/react-label";

import type { LabelProps } from "./label.types";
import { cn } from "./utils";

export const Label = ({ ref, className, ...props }: LabelProps) => {
  return (
    <LabelPrimitive.Root
      ref={ref}
      className={cn("block", className)}
      {...props}
    />
  );
};
