export function revalidatePath() {}
export function revalidateTag() {}
export function unstable_cache<T extends (...args: any[]) => any>(fn: T): T {
  return fn;
}
