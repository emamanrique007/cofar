import type { SelectProps } from "./select.types";
import { cn } from "./utils";

export const Select = ({ ref, className, ...props }: SelectProps) => {
  return <select ref={ref} className={cn(className)} {...props} />;
};
