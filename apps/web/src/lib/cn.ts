import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** clsx + tailwind-merge: a caller's `bg-navy` really overrides a component's `bg-paper`. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
