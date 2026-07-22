import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { riskLabel, riskDescription } from '@/features/growth/zscore';
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

// A5 (148×210mm) — same trim size as Buku KIA, so this can physically live
// alongside it instead of being a loose A4 sheet nobody keeps. Content is
// deliberately a compact snapshot + QR, not the full record: this page is a
// keepsake/pointer, the no-login web dashboard (same QR) is where parents
// actually get the full history, recommendations, and nutrition tips.
const MARGIN = 10;
const PAGE_WIDTH = 148;
const PAGE_HEIGHT = 210;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// #/p/:token (HashRouter) — the no-login, read-only public dashboard
// (PublicChildView.tsx). The in-app UI dropped its own QR for this in favor
// of a single "scan to register" QR (LinkCodeCard.tsx) — this printed
// report is the one remaining place that still points here, deliberately:
// a physical keepsake shouldn't force whoever picks it up later to create
// an account just to check a number.
function publicDashboardLink(token: string): string {
  return `${window.location.origin}${window.location.pathname}#/p/${token}`;
}

// Shared by generateChildReport() (download) and printChildReport() (print
// dialog) so the two entry points can never drift into different layouts —
// only what happens to the finished doc (save vs. autoPrint) differs.
async function buildChildReportDoc(child: Child, records: GrowthRecord[]): Promise<jsPDF> {
  const doc = new jsPDF({ format: 'a5' });
  const sorted = records.slice().sort((a, b) => a.ageMonths - b.ageMonths);
  const latest = sorted[sorted.length - 1];
  const recentHistory = sorted.slice(-5);

  // Generated up front (needs to be awaited) — 'qrcode' is lazy-loaded here
  // too, same pattern as LinkCodeCard.tsx, so it's never in the main
  // bundle even though two entry points now pull in pdf.ts.
  let qrDataUrl: string | null = null;
  if (child.publicToken) {
    try {
      const { default: QRCode } = await import('qrcode');
      qrDataUrl = await QRCode.toDataURL(publicDashboardLink(child.publicToken), { margin: 1, width: 320 });
    } catch {
      qrDataUrl = null; // report still generates fine without the QR
    }
  }

  let y = 0;

  const ensureSpace = (height: number) => {
    if (y + height > PAGE_HEIGHT - 16) {
      doc.addPage();
      y = 14;
    }
  };

  // ---- Header band ----
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, PAGE_WIDTH, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('SmartGrowth', MARGIN, 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Kartu Ringkasan Pertumbuhan', MARGIN, 15.5);
  doc.setFontSize(6.5);
  doc.text(new Date().toLocaleDateString('id-ID', { dateStyle: 'medium' }), PAGE_WIDTH - MARGIN, 15.5, {
    align: 'right'
  });

  y = 27;

  // ---- Child profile ----
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(child.name, MARGIN, y);
  y += 5.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  const profileLine = [`Lahir: ${child.birthDate}`, SEX_LABEL[child.sex], child.posyanduLocation || null]
    .filter(Boolean)
    .join(' · ');
  const wrappedProfile = doc.splitTextToSize(profileLine, CONTENT_WIDTH);
  doc.text(wrappedProfile, MARGIN, y);
  y += wrappedProfile.length * 4 + 3;

  // ---- 2T growth-trend alert ----
  if (child.growthAlert === '2T') {
    ensureSpace(12);
    doc.setFillColor(254, 226, 226);
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 10, 2, 2, 'F');
    doc.setTextColor(185, 28, 28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    const alertText = doc.splitTextToSize(
      'PERINGATAN: Berat tidak naik 2x berturut-turut (2T) — segera rujuk ke Puskesmas.',
      CONTENT_WIDTH - 6
    );
    doc.text(alertText, MARGIN + 3, y + 4.5);
    y += 10 + 4;
  }

  // ---- Risk status highlight ----
  if (latest?.riskStatus) {
    const colors = RISK_COLORS[latest.riskStatus];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const desc = doc.splitTextToSize(riskDescription(latest.riskStatus), CONTENT_WIDTH - 6);
    const boxHeight = 8 + desc.length * 3.8 + 4;
    ensureSpace(boxHeight);
    doc.setFillColor(...colors.bg);
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, boxHeight, 2.5, 2.5, 'F');
    doc.setTextColor(...colors.text);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(`Status Gizi: ${riskLabel(latest.riskStatus)}`, MARGIN + 3, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(desc, MARGIN + 3, y + 10.5);
    y += boxHeight + 4;
  }

  // ---- Ringkasan pengukuran terakhir ----
  if (latest) {
    ensureSpace(20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    doc.text('Pengukuran Terakhir', MARGIN, y);
    y += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    const summaryLines = [
      `Tanggal: ${latest.measuredAt} · Usia: ${latest.ageMonths} bln`,
      `Berat: ${latest.weightKg} kg · Tinggi: ${latest.heightCm} cm`,
      `Z-score — HAZ: ${latest.heightForAgeZ ?? '-'} · WHZ: ${latest.weightForHeightZ ?? '-'} · WAZ: ${latest.weightForAgeZ ?? '-'}`
    ];
    if (latest.officerName || latest.location) {
      summaryLines.push(
        [latest.officerName ? `Petugas: ${latest.officerName}` : null, latest.location ? `Posyandu: ${latest.location}` : null]
          .filter(Boolean)
          .join(' · ')
      );
    }
    for (const line of summaryLines) {
      const wrapped = doc.splitTextToSize(line, CONTENT_WIDTH);
      ensureSpace(wrapped.length * 4);
      doc.text(wrapped, MARGIN, y);
      y += wrapped.length * 4;
    }
    y += 4;
  }

  // ---- Riwayat singkat (maks. 5 terakhir) ----
  if (recentHistory.length > 0) {
    ensureSpace(16);
    autoTable(doc, {
      startY: y,
      margin: { top: 14, left: MARGIN, right: MARGIN },
      head: [['Tanggal', 'Berat', 'Tinggi', 'Status']],
      body: recentHistory.map((r) => [
        r.measuredAt,
        `${r.weightKg} kg`,
        `${r.heightCm} cm`,
        r.riskStatus ? riskLabel(r.riskStatus) : '-'
      ]),
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: PRIMARY }
    });
    // @ts-expect-error lastAutoTable is attached by the autoTable plugin at runtime
    y = doc.lastAutoTable.finalY + 3;
    if (sorted.length > recentHistory.length) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...MUTED);
      doc.text(
        `Menampilkan ${recentHistory.length} dari ${sorted.length} pengukuran — riwayat lengkap ada di web (scan QR).`,
        MARGIN,
        y
      );
      y += 5;
    }
    y += 3;
  }

  // ---- QR call-to-action — the primary reason this card is worth keeping ----
  if (qrDataUrl) {
    const qrSize = 34;
    const boxHeight = 8 + qrSize + 14;
    ensureSpace(boxHeight);
    doc.setDrawColor(...PRIMARY);
    doc.setLineWidth(0.5);
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, boxHeight, 2.5, 2.5, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...PRIMARY);
    doc.text('Detail Lengkap & Rekomendasi di Web', PAGE_WIDTH / 2, y + 6, { align: 'center' });

    doc.addImage(qrDataUrl, 'PNG', PAGE_WIDTH / 2 - qrSize / 2, y + 9, qrSize, qrSize);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...INK);
    const ctaBody = doc.splitTextToSize(
      `Scan untuk lihat riwayat lengkap, rekomendasi, dan tips gizi ${child.name} kapan saja — tanpa login.`,
      CONTENT_WIDTH - 8
    );
    doc.text(ctaBody, PAGE_WIDTH / 2, y + 9 + qrSize + 4, { align: 'center' });
    y += boxHeight + 4;
  }

  // ---- Disclaimer + page numbers on every page ----
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...MUTED);
    const disclaimer = doc.splitTextToSize(
      'Skrining awal berbasis standar WHO. Tidak menggantikan diagnosis dokter/ahli gizi.',
      CONTENT_WIDTH - 12
    );
    doc.text(disclaimer, MARGIN, PAGE_HEIGHT - 7);
    doc.text(`${i}/${pageCount}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 7, { align: 'right' });
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
