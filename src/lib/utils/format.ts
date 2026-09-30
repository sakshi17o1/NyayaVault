export function formatClassification(classification: string | null | undefined): string {
  if (!classification) return "Unknown";

  switch (classification) {
    case 'PROTECTED_VICTIM_WITNESS':
      return 'Class 1 (Highly Confidential)';
    case 'RESTRICTED':
      return 'Class 2 (Restricted Access)';
    case 'CONFIDENTIAL':
      return 'Class 3 (Confidential)';
    case 'INTERNAL':
      return 'Class 4 (Internal Police Use)';
    case 'PUBLIC':
      return 'Class 5 (Public Information)';
    default:
      return classification;
  }
}
