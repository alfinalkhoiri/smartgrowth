export function monthsBetween(birthDate: string, measuredAt: string): number {
  const birth = new Date(birthDate);
  const measured = new Date(measuredAt);
  let months = (measured.getFullYear() - birth.getFullYear()) * 12 + (measured.getMonth() - birth.getMonth());
  if (measured.getDate() < birth.getDate()) months -= 1;
  return Math.max(0, months);
}
