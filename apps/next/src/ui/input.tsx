import type { InputProps } from "./input.types";
import { cn } from "./utils";

export const Input = ({ ref, className, type, ...props }: InputProps) => {
  return <input ref={ref} type={type} className={cn(className)} {...props} />;
};
