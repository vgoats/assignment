/**
 * Runtime booking reassignments (substitute goats for failed promises).
 */
export interface BookingReassignment {
  issueId: string;
  bookingId: string;
  originalCanonicalId: string;
  substituteCanonicalId: string;
}

const reassignmentsByBooking = new Map<string, BookingReassignment>();

export function resetReplacements(): void {
  reassignmentsByBooking.clear();
}

export function getReassignmentForBooking(
  bookingId: string,
): BookingReassignment | undefined {
  return reassignmentsByBooking.get(bookingId);
}

export function getSubstituteAssignedIds(): Set<string> {
  return new Set(
    [...reassignmentsByBooking.values()].map((r) => r.substituteCanonicalId),
  );
}

export function recordReassignment(record: BookingReassignment): void {
  reassignmentsByBooking.set(record.bookingId, record);
}
