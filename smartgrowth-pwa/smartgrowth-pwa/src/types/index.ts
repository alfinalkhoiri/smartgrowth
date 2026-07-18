// 4 tingkat, bukan 3 — "stunting" (kronis, HAZ) dan "malnutrisi" (akut parah)
// dipisah karena urgensi rujukannya beda. Lihat risk_engine.py (score_risk).
export type RiskStatus = 'normal' | 'berisiko' | 'stunting' | 'malnutrisi';

export interface Child {
  id: string;
  name: string;
  birthDate: string; // ISO date
  sex: 'male' | 'female';
  // Info orang tua/wali — opsional, untuk keperluan kontak/pencatatan
  parentName?: string;
  parentOccupation?: string;
  // Posyandu/klinik binaan balita ini — dipakai untuk filter & pengelompokan
  // di Data Balita, beda dari GrowthRecord.location (lokasi per-kunjungan).
  posyanduLocation?: string;
  // Optional risk-factor fields used by the predictive layer later on
  exclusiveBreastfeeding?: boolean;
  birthWeightKg?: number;
  birthLengthCm?: number;
  gestationalAgeWeeks?: number; // usia kehamilan saat lahir — indikator prematuritas
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
  headCircumferenceCm?: number; // opsional, WHO Head-Circumference-for-Age
  // Dokumentasi saja, bukan input AI-vision. String (URL) saat dibaca dari
  // API; File saat dikirim ke growthApi.createRecord() untuk diunggah.
  photo?: string | File;
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
  weightForAgeZ?: number;
  headCircumferenceZ?: number;
  riskStatus?: RiskStatus;
  recommendations?: string[];
  // vs. the immediately preceding measurement for this child; null on the
  // child's first-ever record (nothing to compare against yet).
  weightTrend?: 'naik' | 'tetap_turun' | null;
}

export interface RiskAssessment {
  childId: string;
  riskStatus: RiskStatus;
  score: number; // 0-100, higher = more severe
  reasonCodes: string[]; // e.g. ["HAZ_STUNTED", "NO_EXCLUSIVE_BF"]
  recommendations: string[];
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

// Jadwal kunjungan Posyandu — tidak terikat ke anak tertentu (satu jadwal
// berlaku untuk semua balita di lokasi/waktu itu).
export interface PosyanduSchedule {
  id: string;
  scheduledAt: string; // ISO datetime
  location: string;
  notes?: string;
  createdAt: string;
}
