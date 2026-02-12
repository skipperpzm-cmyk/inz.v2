// Simple utility for className concatenation (like clsx)
export function cn(...args: (string | undefined | null | false)[]): string {
  return args.filter(Boolean).join(' ');
}
