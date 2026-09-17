import type { TextareaProps } from "./textarea.types";
import { cn } from "./utils";

export const Textarea = ({ ref, className, ...props }: TextareaProps) => {
  return <textarea ref={ref} className={cn(className)} {...props} />;
};
