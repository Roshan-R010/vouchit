/** Keep long generated references readable; retain the full value in labels/tooltips. */
export function shortClaimReference(reference: string) {
  return reference.length > 14 ? `${reference.slice(0, 10)}…` : reference;
}
