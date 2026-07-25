import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

/**
 * Beleg-PDF (A4) für Kaufrechnungen und Auszahlungs-Quittungen.
 * Bewusst schlicht und druckfreundlich – anders als das Zertifikat ist das
 * ein Verwaltungsdokument. Standard-Helvetica, keine Font-Registrierung.
 */

export interface BillingLine {
  label: string;
  /** vorformatierter Betrag (z. B. "29,99 €"); leer = reine Textzeile */
  amount: string;
}

export interface BillingDocumentData {
  /** Dokumenttitel, z. B. "Rechnung" / "Auszahlungs-Quittung" */
  title: string;
  /** Belegnummer, z. B. "R-2026-AB12CD34" */
  number: string;
  numberLabel: string;
  dateLabel: string;
  /** vorformatiertes Datum */
  date: string;
  /** Aussteller-Zeilen (Plattform) */
  issuer: string[];
  recipientLabel: string;
  /** Empfänger-Zeilen (Rechnungsadresse bzw. Creator) */
  recipient: string[];
  lines: BillingLine[];
  totalLabel: string;
  total: string;
  /** Hinweiszeilen unter der Summe (z. B. Steuer-Hinweis, Zahlungsweg) */
  notes: string[];
  footer: string;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1a1a24",
    paddingTop: 56,
    paddingBottom: 56,
    paddingHorizontal: 56,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  brand: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  brandAccent: { color: "#7a9c1e" },
  issuerBlock: { textAlign: "right", color: "#55565f", lineHeight: 1.5 },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  meta: { color: "#55565f", marginBottom: 24, lineHeight: 1.5 },
  sectionLabel: {
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#8a8b94",
    marginBottom: 4,
  },
  recipient: { marginBottom: 28, lineHeight: 1.5 },
  table: { marginBottom: 12 },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a24",
    paddingBottom: 6,
    marginBottom: 2,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#d9dae0",
    paddingVertical: 7,
  },
  cellLabel: { flex: 1, paddingRight: 12 },
  cellAmount: { width: 100, textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: "#1a1a24",
  },
  totalLabel: { flex: 1, fontFamily: "Helvetica-Bold" },
  totalAmount: {
    width: 100,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
  },
  notes: { marginTop: 20, color: "#55565f", lineHeight: 1.6 },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 56,
    right: 56,
    textAlign: "center",
    color: "#8a8b94",
    fontSize: 8,
  },
});

export function BillingDocument({ data }: { data: BillingDocumentData }) {
  return (
    <Document title={`${data.title} ${data.number}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <Text style={styles.brand}>
            Learn
            <Text style={styles.brandAccent}>Sphere</Text>
          </Text>
          <View style={styles.issuerBlock}>
            {data.issuer.map((line) => (
              <Text key={line}>{line}</Text>
            ))}
          </View>
        </View>

        <Text style={styles.title}>{data.title}</Text>
        <View style={styles.meta}>
          <Text>
            {data.numberLabel}: {data.number}
          </Text>
          <Text>
            {data.dateLabel}: {data.date}
          </Text>
        </View>

        <View style={styles.recipient}>
          <Text style={styles.sectionLabel}>{data.recipientLabel}</Text>
          {data.recipient.map((line) => (
            <Text key={line}>{line}</Text>
          ))}
        </View>

        <View style={styles.table}>
          {data.lines.map((line) => (
            <View key={line.label} style={styles.row}>
              <Text style={styles.cellLabel}>{line.label}</Text>
              <Text style={styles.cellAmount}>{line.amount}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{data.totalLabel}</Text>
            <Text style={styles.totalAmount}>{data.total}</Text>
          </View>
        </View>

        <View style={styles.notes}>
          {data.notes.map((line) => (
            <Text key={line}>{line}</Text>
          ))}
        </View>

        <Text style={styles.footer} fixed>
          {data.footer}
        </Text>
      </Page>
    </Document>
  );
}
