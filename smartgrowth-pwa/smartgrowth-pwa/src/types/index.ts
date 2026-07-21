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
  // Only present for kader_nakes/admin or an already-linked orangtua (see
  // ChildSerializer.get_public_token on the backend) — the bearer token for
  // the no-login parent dashboard QR (Fase 2). undefined for anyone else.
  publicToken?: string;
  // Same visibility rule as publicToken — the 6-digit code an orangtua
  // redeems (POST /children/link/) to attach their own account to this
  // child, so they can see it *and* record pengukuran mandiri for it.
  linkCode?: string;
}

// Slice of a measurement shown on the no-login parent dashboard — same
// shape as the fields GrowthRecord already has, just fewer of them (no
// officerName/location/photo/raw questionnaire answers, see
// PublicGrowthRecordSerializer on the backend). recommendations/notes ARE
// included — the "Rekomendasi" tab renders identically on both this page
// and ChildDashboard.tsx.
export interface PublicGrowthRecord {
  measuredAt: string;
  weightKg: number;
  heightCm: number;
  headCircumferenceCm?: number;
  ageMonths: number;
  heightForAgeZ?: number;
  weightForHeightZ?: number;
  weightForAgeZ?: number;
  headCircumferenceZ?: number;
  riskStatus?: RiskStatus;
  weightTrend?: 'naik' | 'tetap_turun' | null;
  recommendations?: string[];
  notes?: string;
}

export interface PublicChildDashboard {
  name: string;
  birthDate: string;
  sex: 'male' | 'female';
  growthAlert?: '2T' | null;
  records: PublicGrowthRecord[];
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
