import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { riskLabel } from '@/features/growth/zscore';
import type { Child, GrowthRecord } from '@/types';

const SEX_LABEL: Record<Child['sex'], string> = { male: 'Laki-laki', female: 'Perempuan' };

// Laporan ringkas (profil + tabel riwayat + rekomendasi terbaru), bukan
// pengganti tombol Cetak yang sudah ada (itu untuk 1 hasil pengukuran saja).
// Sengaja tidak menyertakan gambar grafik pertumbuhan — butuh capture canvas
// recharts, kompleksitas ekstra yang datanya sudah tercakup di tabel.
export function generateChildReport(child: Child, records: GrowthRecord[]) {
  const doc = new jsPDF();
  const sorted = records.slice().sort((a, b) => a.ageMonths - b.ageMonths);
  const latest = sorted[sorted.length - 1];

  doc.setFontSize(16);
  doc.text('SmartGrowth — Laporan Skrining', 14, 18);

  doc.setFontSize(11);
  let y = 28;
  const profileLines = [
    `Nama: ${child.name}`,
    `Tanggal Lahir: ${child.birthDate} · Jenis Kelamin: ${SEX_LABEL[child.sex]}`
  ];
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
    doc.text(line, 14, y);
    y += 6;
  }

  autoTable(doc, {
    startY: y + 4,
    head: [['Tanggal', 'Usia (bln)', 'Berat (kg)', 'Tinggi (cm)', 'HAZ', 'WHZ', 'WAZ', 'Status']],
    body: sorted.map((r) => [
      r.measuredAt,
      String(r.ageMonths),
      String(r.weightKg),
      String(r.heightCm),
      r.heightForAgeZ != null ? Number(r.heightForAgeZ).toFixed(2) : '-',
      r.weightForHeightZ != null ? Number(r.weightForHeightZ).toFixed(2) : '-',
      r.weightForAgeZ != null ? Number(r.weightForAgeZ).toFixed(2) : '-',
      r.riskStatus ? riskLabel(r.riskStatus) : '-'
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [37, 157, 101] }
  });

  // @ts-expect-error lastAutoTable is attached by the autoTable plugin at runtime
  let afterTableY: number = doc.lastAutoTable.finalY + 10;

  if (latest?.recommendations && latest.recommendations.length > 0) {
    doc.setFontSize(12);
    doc.text('Rekomendasi Terakhir', 14, afterTableY);
    doc.setFontSize(10);
    afterTableY += 6;
    for (const rec of latest.recommendations) {
      const wrapped = doc.splitTextToSize(`• ${rec}`, 180);
      doc.text(wrapped, 14, afterTableY);
      afterTableY += wrapped.length * 5;
    }
  }

  doc.setFontSize(8);
  doc.setTextColor(120);
  const disclaimer = doc.splitTextToSize(
    'Laporan ini adalah hasil skrining awal berbasis standar WHO. Tidak menggantikan diagnosis dokter ' +
      'atau ahli gizi. Selalu konsultasikan hasil ke tenaga kesehatan.',
    180
  );
  doc.text(disclaimer, 14, 285);

  doc.save(`laporan-${child.name.replace(/\s+/g, '-').toLowerCase()}.pdf`);
}
