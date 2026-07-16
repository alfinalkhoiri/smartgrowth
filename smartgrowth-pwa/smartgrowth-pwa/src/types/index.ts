export type RiskStatus = 'normal' | 'watch' | 'risk';

export interface Child {
  id: string;
  name: string;
  birthDate: string; // ISO date
  sex: 'male' | 'female';
  // Optional risk-factor fields used by the predictive layer later on
  exclusiveBreastfeeding?: boolean;
  birthWeightKg?: number;
  // '2T' (posyandu convention: weight failed to increase at the last two
  // measurements in a row) or null/undefined if not currently flagged.
  growthAlert?: '2T' | null;
}

export interface GrowthRecord {
  id: string;
  childId: string;
  measuredAt: string; // ISO date
  weightKg: number;
  heightCm: number;
  ageMonths: number;
  officerName?: string;
  location?: string;
  notes?: string;
  // Kuesioner faktor risiko stunting tambahan (diisi nakes). undefined/null
  // berarti belum dijawab — beda dari false yang berarti sudah ditanya dan
  // jawabannya negatif.
  cleanWaterAccess?: boolean | null;
  recurrentIllness?: boolean | null;
  immunizationComplete?: boolean | null;
  // Computed client- or server-side from WHO growth standards
  heightForAgeZ?: number;
  weightForHeightZ?: number;
  riskStatus?: RiskStatus;
  recommendations?: string[];
  // vs. the immediately preceding measurement for this child; null on the
  // child's first-ever record (nothing to compare against yet).
  weightTrend?: 'naik' | 'tetap_turun' | null;
}

export interface RiskAssessment {
  childId: string;
  riskStatus: RiskStatus;
  reasonCodes: string[]; // e.g. ["HAZ_BELOW_-2", "NO_EXCLUSIVE_BF"]
  assessedAt: string;
}

// WHO -2SD..+2SD band for the given age/sex (and height, for weight) — a
// reference guide shown alongside the input fields, not a validation rule.
export interface GrowthReference {
  ageMonths: number;
  heightMinCm: number;
  heightMaxCm: number;
  weightMinKg?: number;
  weightMaxKg?: number;
}
