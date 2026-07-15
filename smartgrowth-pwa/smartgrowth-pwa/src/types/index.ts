export type RiskStatus = 'normal' | 'watch' | 'risk';

export interface Child {
  id: string;
  name: string;
  birthDate: string; // ISO date
  sex: 'male' | 'female';
  // Optional risk-factor fields used by the predictive layer later on
  exclusiveBreastfeeding?: boolean;
  birthWeightKg?: number;
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
  // Computed client- or server-side from WHO growth standards
  heightForAgeZ?: number;
  weightForHeightZ?: number;
  riskStatus?: RiskStatus;
}

export interface RiskAssessment {
  childId: string;
  riskStatus: RiskStatus;
  reasonCodes: string[]; // e.g. ["HAZ_BELOW_-2", "NO_EXCLUSIVE_BF"]
  assessedAt: string;
}
