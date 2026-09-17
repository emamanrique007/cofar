import { useEffect } from "react";
import type { FieldErrors } from "react-hook-form";

export const useScrollToError = (errors: FieldErrors) => {
  useEffect(() => {
    const nodes = Array.from(document.getElementsByClassName("FormError"));
    const parents = nodes.flatMap(node => {
      if (!node.parentElement) {
        return [];
      }

      return [node.parentElement];
    });
    const ordered = [...parents].sort((left, right) => {
      return right.scrollHeight - left.scrollHeight;
    });
    const target = ordered[0];

    if (!target) {
      return;
    }

    window.requestAnimationFrame(() => {
      const yOffset = -64 - 8;
      const y = target.getBoundingClientRect().top + window.scrollY + yOffset;

      window.scrollTo({ top: y, behavior: "smooth" });
    });
  }, [errors]);
};
