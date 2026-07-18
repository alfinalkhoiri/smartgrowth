import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { riskLabel, riskDescription } from '@/features/growth/zscore';
import { foodExamplesFor, nutritionTipsFor } from '@/lib/nutritionTips';
import type { Child, GrowthRecord } from '@/types';

const SEX_LABEL: Record<Child['sex'], string> = { male: 'Laki-laki', female: 'Perempuan' };

const PRIMARY: [number, number, number] = [37, 157, 101];
const INK: [number, number, number] = [31, 41, 55];
const MUTED: [number, number, number] = [107, 114, 128];

// Same 4-tier palette as RiskBadge.tsx (bg-*-100 / text-*-700 tailwind
// shades), so the report's status callout reads consistently with the app.
const RISK_COLORS: Record<string, { bg: [number, number, number]; text: [number, number, number] }> = {
  normal: { bg: [220, 252, 231], text: [21, 128, 61] },
  berisiko: { bg: [254, 243, 199], text: [180, 83, 9] },
  stunting: { bg: [255, 237, 213], text: [194, 65, 12] },
  malnutrisi: { bg: [254, 226, 226], text: [185, 28, 28] }
};

const WEIGHT_TREND_LABEL: Record<string, string> = { naik: 'Naik', tetap_turun: 'Tetap/Turun' };

const MARGIN = 14;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// #/p/:token (HashRouter) — same public route as ParentDashboardQr.tsx.
function publicDashboardLink(token: string): string {
  return `${window.location.origin}${window.location.pathname}#/p/${token}`;
}

// Shared by generateChildReport() (download) and printChildReport() (print
// dialog) so the two entry points can never drift into different layouts —
// only what happens to the finished doc (save vs. autoPrint) differs.
async function buildChildReportDoc(child: Child, records: GrowthRecord[]): Promise<jsPDF> {
  const doc = new jsPDF();
  const sorted = records.slice().sort((a, b) => a.ageMonths - b.ageMonths);
  const latest = sorted[sorted.length - 1];

  // Generated up front (needs to be awaited) — 'qrcode' is lazy-loaded here
  // too, same pattern as ParentDashboardQr.tsx, so it's never in the main
  // bundle even though two entry points now pull in pdf.ts.
  let qrDataUrl: string | null = null;
  if (child.publicToken) {
    try {
      const { default: QRCode } = await import('qrcode');
      qrDataUrl = await QRCode.toDataURL(publicDashboardLink(child.publicToken), { margin: 1, width: 240 });
    } catch {
      qrDataUrl = null; // report still generates fine without the QR
    }
  }

  let y = 0;

  const ensureSpace = (height: number) => {
    if (y + height > PAGE_HEIGHT - 22) {
      doc.addPage();
      y = 20;
    }
  };

  // ---- Header band ----
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, PAGE_WIDTH, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('SmartGrowth', MARGIN, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Laporan Hasil Skrining Tumbuh Kembang Balita', MARGIN, 21);
  doc.setFontSize(8);
  doc.text(`Dicetak ${new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}`, PAGE_WIDTH - MARGIN, 21, {
    align: 'right'
  });

  y = 38;

  // ---- Child profile ----
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(child.name, MARGIN, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  const profileLines = [
    `Tanggal Lahir: ${child.birthDate} · Jenis Kelamin: ${SEX_LABEL[child.sex]}`
  ];
  if (child.posyanduLocation) profileLines.push(`Posyandu: ${child.posyanduLocation}`);
  if (child.parentName) {
    profileLines.push(
      `Orang Tua: ${child.parentName}${child.parentOccupation ? ' (' + child.parentOccupation + ')' : ''}`
    );
  }
  const birthFacts = [
    child.birthWeightKg != null ? `Berat Lahir: ${child.birthWeightKg} kg` : null,
    child.birthLengthCm != null ? `Panjang Lahir: ${child.birthLengthCm} cm` : null,
    child.gestationalAgeWeeks != null ? `Usia Kehamilan: ${child.gestationalAgeWeeks} minggu` : null
  ].filter(Boolean);
  if (birthFacts.length > 0) profileLines.push(birthFacts.join(' · '));

  for (const line of profileLines) {
    doc.text(line, MARGIN, y);
    y += 5.5;
  }
  y += 3;

  // ---- 2T growth-trend alert ----
  if (child.growthAlert === '2T') {
    ensureSpace(14);
    doc.setFillColor(254, 226, 226);
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 12, 2, 2, 'F');
    doc.setTextColor(185, 28, 28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(
      'PERINGATAN: Berat badan tidak naik 2x pengukuran berturut-turut (2T) — segera rujuk ke Puskesmas.',
      MARGIN + 3,
      y + 7.5
    );
    y += 12 + 6;
  }

  // ---- Risk status highlight ----
  if (latest?.riskStatus) {
    const colors = RISK_COLORS[latest.riskStatus];
    ensureSpace(26);
    doc.setFillColor(...colors.bg);
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 24, 3, 3, 'F');
    doc.setTextColor(...colors.text);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`Status Gizi Terkini: ${riskLabel(latest.riskStatus)}`, MARGIN + 4, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const desc = doc.splitTextToSize(riskDescription(latest.riskStatus), CONTENT_WIDTH - 8);
    doc.text(desc, MARGIN + 4, y + 14.5);
    y += 24 + 8;
  }

  // ---- Measurement history table ----
  autoTable(doc, {
    startY: y,
    margin: { top: 20, left: MARGIN, right: MARGIN },
    head: [['Tanggal', 'Usia (bln)', 'Berat (kg)', 'Tinggi (cm)', 'HAZ', 'WHZ', 'WAZ', 'Tren', 'Status']],
    body: sorted.map((r) => [
      r.measuredAt,
      String(r.ageMonths),
      String(r.weightKg),
      String(r.heightCm),
      r.heightForAgeZ != null ? Number(r.heightForAgeZ).toFixed(2) : '-',
      r.weightForHeightZ != null ? Number(r.weightForHeightZ).toFixed(2) : '-',
      r.weightForAgeZ != null ? Number(r.weightForAgeZ).toFixed(2) : '-',
      r.weightTrend ? WEIGHT_TREND_LABEL[r.weightTrend] : '-',
      r.riskStatus ? riskLabel(r.riskStatus) : '-'
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: PRIMARY }
  });
  // @ts-expect-error lastAutoTable is attached by the autoTable plugin at runtime
  y = doc.lastAutoTable.finalY + 10;

  // ---- Rekomendasi & catatan petugas ----
  const recommendations = latest?.recommendations ?? [];
  const notes = latest?.notes;
  if (recommendations.length > 0 || notes) {
    ensureSpace(14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...PRIMARY);
    doc.text('Rekomendasi & Catatan Petugas', MARGIN, y);
    y += 7;

    if (recommendations.length > 0) {
      ensureSpace(6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      doc.text('Dari Kuesioner', MARGIN, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...MUTED);
      for (const rec of recommendations) {
        const wrapped = doc.splitTextToSize(`• ${rec}`, CONTENT_WIDTH - 2);
        ensureSpace(wrapped.length * 5);
        doc.text(wrapped, MARGIN + 2, y);
        y += wrapped.length * 5;
      }
      y += 3;
    }

    if (notes) {
      ensureSpace(10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      doc.text('Catatan Petugas', MARGIN, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...MUTED);
      const wrapped = doc.splitTextToSize(notes, CONTENT_WIDTH - 2);
      ensureSpace(wrapped.length * 5);
      doc.text(wrapped, MARGIN + 2, y);
      y += wrapped.length * 5;
    }
    y += 5;
  }

  // ---- Tips gizi & contoh makanan (persuasif, ditujukan ke orang tua) ----
  ensureSpace(14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...PRIMARY);
  doc.text('Tips untuk Ayah & Bunda', MARGIN, y);
  y += 7;

  for (const group of nutritionTipsFor(latest?.riskStatus)) {
    ensureSpace(6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(group.title, MARGIN, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    for (const tip of group.tips) {
      const wrapped = doc.splitTextToSize(`• ${tip}`, CONTENT_WIDTH - 2);
      ensureSpace(wrapped.length * 5);
      doc.text(wrapped, MARGIN + 2, y);
      y += wrapped.length * 5;
    }
    y += 3;
  }

  const food = foodExamplesFor(latest?.riskStatus);
  ensureSpace(14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text('Contoh Makanan & Minuman', MARGIN, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  const foodLine = doc.splitTextToSize(`Makanan: ${food.foods.join(', ')}`, CONTENT_WIDTH);
  ensureSpace(foodLine.length * 5);
  doc.text(foodLine, MARGIN, y);
  y += foodLine.length * 5 + 2;
  const drinkLine = doc.splitTextToSize(`Minuman: ${food.drinks.join(', ')}`, CONTENT_WIDTH);
  ensureSpace(drinkLine.length * 5);
  doc.text(drinkLine, MARGIN, y);
  y += drinkLine.length * 5 + 8;

  // ---- QR call-to-action ----
  if (qrDataUrl) {
    ensureSpace(40);
    doc.setDrawColor(...PRIMARY);
    doc.setLineWidth(0.5);
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 36, 3, 3, 'S');
    doc.addImage(qrDataUrl, 'PNG', MARGIN + 4, y + 3, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...PRIMARY);
    const ctaTitle = doc.splitTextToSize(`Pantau Terus Perkembangan ${child.name}`, CONTENT_WIDTH - 42);
    doc.text(ctaTitle, MARGIN + 38, y + 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    const ctaBody = doc.splitTextToSize(
      'Scan kode QR ini kapan saja untuk melihat hasil & riwayat pengukuran terbaru — tanpa perlu login atau ' +
        'install aplikasi. Simpan laporan ini dan bawa saat kunjungan berikutnya ke Posyandu.',
      CONTENT_WIDTH - 42
    );
    doc.text(ctaBody, MARGIN + 38, y + 10 + ctaTitle.length * 5);
    y += 36 + 6;
  }

  // ---- Disclaimer + page numbers on every page ----
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    const disclaimer = doc.splitTextToSize(
      'Laporan ini adalah hasil skrining awal berbasis standar WHO. Tidak menggantikan diagnosis dokter atau ' +
        'ahli gizi. Selalu konsultasikan hasil ke tenaga kesehatan.',
      CONTENT_WIDTH - 20
    );
    doc.text(disclaimer, MARGIN, PAGE_HEIGHT - 10);
    doc.text(`${i}/${pageCount}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 10, { align: 'right' });
  }

  return doc;
}

export async function generateChildReport(child: Child, records: GrowthRecord[]) {
  const doc = await buildChildReportDoc(child, records);
  doc.save(`laporan-${child.name.replace(/\s+/g, '-').toLowerCase()}.pdf`);
}

// Triggers the browser's native print dialog for the same report — a
// separate entry point from generateChildReport() (which downloads instead)
// so a kader/nakes can print directly, e.g. to hand a physical copy to a
// parent on the spot. Uses a hidden same-page <iframe> rather than
// window.open() in a new tab: navigating a *different* tab to a `blob:`
// PDF URL after the async work needed to build the doc (dynamic imports +
// QR fetch) is unreliable across browsers — some silently drop the
// navigation once the click's "user activation" window has passed, without
// throwing, leaving a blank tab behind. An iframe on the current page has
// no such restriction, and calling print() on its contentWindow once
// loaded triggers the same native dialog.
export async function printChildReport(child: Child, records: GrowthRecord[]) {
  const doc = await buildChildReportDoc(child, records);
  const url = doc.output('bloburl').toString();

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');

  await new Promise<void>((resolve) => {
    iframe.onload = () => resolve();
    iframe.src = url;
    document.body.appendChild(iframe);
  });

  const win = iframe.contentWindow;
  if (win) {
    win.focus();
    win.print();
  }

  // Cleanup after the print dialog has had a chance to open — removing it
  // immediately would tear down the PDF the dialog is trying to render.
  setTimeout(() => {
    iframe.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
}
