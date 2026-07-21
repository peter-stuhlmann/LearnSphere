import {
  Circle,
  Defs,
  Document,
  Image,
  Line,
  Link,
  Page,
  Path,
  RadialGradient,
  Rect,
  Stop,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import {
  CERTIFICATE_FONTS,
  CERTIFICATE_PALETTES,
  DEFAULT_CERTIFICATE_THEME,
  paletteForMode,
  type CertificateMode,
  type CertificatePalette,
  type CertificateTheme,
} from "@elearning/core/certificate/theme";
import { certificateDecor } from "@elearning/core/certificate/decor";

/** Logo als Buffer + Format – Dateipfade sind unter Windows unzuverlässig */
export interface CertificateLogoSource {
  data: Buffer;
  format: "png" | "jpg";
}

export interface CertificateData {
  recipientName: string;
  courseTitle: string;
  creatorName: string;
  scorePercent: number;
  issuedAt: Date;
  serial: string;
  locale: "de" | "en";
}

const TEXTS = {
  de: {
    title: "Zertifikat",
    certifies: "Hiermit wird bescheinigt, dass",
    completed: "den folgenden Kurs erfolgreich abgeschlossen hat:",
    withScore: (p: number) => `Ergebnis der Abschlussprüfung: ${p} %`,
    by: (name: string) => `Kurs von ${name}`,
    issuedOn: (date: string) => `Ausgestellt am ${date}`,
    serial: "Zertifikats-Nr.",
    issuer: "LearnSphere · learnsphere.one",
  },
  en: {
    title: "Certificate",
    certifies: "This is to certify that",
    completed: "has successfully completed the following course:",
    withScore: (p: number) => `Final exam score: ${p}%`,
    by: (name: string) => `Course by ${name}`,
    issuedOn: (date: string) => `Issued on ${date}`,
    serial: "Certificate no.",
    issuer: "LearnSphere · learnsphere.one",
  },
} as const;

/**
 * Hintergrund-Schmuck: Verläufe, Ring-Cluster und Sternbilder aus der
 * geteilten Decor-Geometrie (decor.ts) – liegt unter Rahmen und Inhalt.
 */
function Backdrop({
  theme,
  colors,
}: {
  theme: CertificateTheme;
  colors: CertificatePalette;
}) {
  const decor = certificateDecor(theme.orientation);

  return (
    // Absoluter View statt absolutem Svg: nur so bleibt der Backdrop
    // außerhalb des Flows und drückt den Inhalt nicht auf Seite 2
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      <Svg
        width={decor.width}
        height={decor.height}
        viewBox={`0 0 ${decor.width} ${decor.height}`}
      >
      <Defs>
        {decor.glows.map((glow, i) => (
          <RadialGradient
            key={i}
            id={`glow-${i}`}
            cx={glow.cx}
            cy={glow.cy}
            r={glow.r}
          >
            <Stop
              offset="0"
              stopColor={colors[glow.color]}
              stopOpacity={glow.opacity}
            />
            <Stop offset="1" stopColor={colors[glow.color]} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      {decor.glows.map((_, i) => (
        <Rect
          key={i}
          x={0}
          y={0}
          width={decor.width}
          height={decor.height}
          fill={`url(#glow-${i})`}
        />
      ))}
      {decor.mesh.edges.map((edge, i) => (
        <Line
          key={i}
          x1={edge.x1}
          y1={edge.y1}
          x2={edge.x2}
          y2={edge.y2}
          stroke={colors[decor.mesh.edgeColor]}
          strokeOpacity={decor.mesh.edgeOpacity}
          strokeWidth={0.6}
        />
      ))}
        {decor.mesh.nodes.map((node, i) => (
          <Circle
            key={i}
            cx={node.cx}
            cy={node.cy}
            r={node.r}
            fill={colors[decor.mesh.nodeColor]}
            fillOpacity={decor.mesh.nodeOpacity}
          />
        ))}
      </Svg>
    </View>
  );
}

/** Zierlinie unter dem Namen: Linie – Raute – Linie in Akzentfarbe. */
function Ornament({ accent }: { accent: string }) {
  return (
    <Svg width={150} height={9} style={{ marginBottom: 14 }}>
      <Line
        x1={0}
        y1={4.5}
        x2={62}
        y2={4.5}
        stroke={accent}
        strokeOpacity={0.85}
        strokeWidth={1}
      />
      <Path d="M75 0.5 L79.5 4.5 L75 8.5 L70.5 4.5 Z" fill={accent} />
      <Line
        x1={88}
        y1={4.5}
        x2={150}
        y2={4.5}
        stroke={accent}
        strokeOpacity={0.85}
        strokeWidth={1}
      />
    </Svg>
  );
}

/**
 * Stile aus dem Creator-Theme ableiten: Farben/Schriften kommen aus den
 * kuratierten Presets (lib/certificate/theme.ts), die Grundstruktur des
 * Zertifikats (Pflichtangaben, Aufbau) bleibt fest.
 */
function buildStyles(theme: CertificateTheme, colors: CertificatePalette) {
  const font = CERTIFICATE_FONTS[theme.font];
  const left = theme.layout === "left";

  return StyleSheet.create({
    page: {
      backgroundColor: colors.background,
      fontFamily: font.body,
      color: colors.ink,
    },
    content: {
      flex: 1,
      padding: 48,
    },
    frame: {
      flex: 1,
      padding: 36,
      display: "flex",
      flexDirection: "column",
      ...(theme.frame === "single" && {
        borderWidth: 1.5,
        borderColor: colors.ink,
      }),
      ...(theme.frame === "double" && {
        borderWidth: 1.5,
        borderColor: colors.ink,
        padding: 5,
      }),
      ...(theme.frame === "accent" && {
        borderWidth: 3,
        borderColor: colors.accent,
      }),
    },
    innerFrame: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      ...(theme.frame === "double" && {
        borderWidth: 0.75,
        borderColor: colors.ink,
        padding: 29,
      }),
    },
    topRow: {
      display: "flex",
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    brand: {
      fontSize: 14,
      // Markenschriftzug: bleibt unabhängig von der gewählten Typografie
      fontFamily: "Helvetica-Bold",
      letterSpacing: 1,
    },
    brandAccent: {
      color: colors.accent,
    },
    logo: {
      marginTop: 10,
      width: 120,
      height: 34,
      objectFit: "contain",
      objectPositionX: 0,
    },
    serial: {
      fontSize: 8,
      color: colors.muted,
      letterSpacing: 1,
      textDecoration: "none",
    },
    serialLinked: {
      fontSize: 8,
      color: colors.muted,
      letterSpacing: 1,
      /* dezenter Hinweis, dass die Nummer zur Verifikation verlinkt */
      textDecoration: "underline",
    },
    main: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: left ? "flex-start" : "center",
      textAlign: left ? "left" : "center",
    },
    titleWord: {
      fontSize: 11,
      letterSpacing: 6,
      textTransform: "uppercase",
      color: colors.accent2,
      marginBottom: 22,
    },
    certifies: {
      fontSize: 11,
      color: colors.muted,
      marginBottom: 12,
    },
    name: {
      fontSize: 34,
      fontFamily: font.display,
      marginBottom: 14,
    },
    completed: {
      fontSize: 11,
      color: colors.muted,
      marginBottom: 12,
    },
    course: {
      fontSize: 20,
      fontFamily: font.bodyBold,
      marginBottom: 8,
      maxWidth: 480,
    },
    creator: {
      fontSize: 10,
      color: colors.muted,
      marginBottom: 20,
    },
    scoreBadge: {
      fontSize: 11,
      fontFamily: font.bodyBold,
      color: colors.ink,
      borderWidth: 1,
      borderColor: colors.accent,
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderRadius: 12,
    },
    bottomRow: {
      display: "flex",
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
    },
    bottomText: {
      fontSize: 8.5,
      color: colors.muted,
    },
    rule: {
      height: 3,
      backgroundColor: colors.accent,
      width: 64,
      marginBottom: 10,
    },
    signature: {
      alignItems: "center",
    },
    signatureLine: {
      width: 150,
      borderTopWidth: 0.75,
      borderTopColor: colors.ink,
      marginBottom: 6,
    },
    signatureName: {
      fontSize: 10,
      fontFamily: font.bodyBold,
    },
    signatureRole: {
      fontSize: 8.5,
      color: colors.muted,
      marginTop: 2,
    },
  });
}

export function CertificateDocument({
  data,
  theme = DEFAULT_CERTIFICATE_THEME,
  mode = "light",
  logoSrc = null,
  verifyUrl = null,
}: {
  data: CertificateData;
  theme?: CertificateTheme;
  /** Farbwelt der Ausgabe: hell = Daybreak, dunkel = Midnight */
  mode?: CertificateMode;
  /** Creator-Logo, von der Route als Buffer geladen */
  logoSrc?: CertificateLogoSource | null;
  /** Öffentliche Verifikations-URL – macht die Seriennummer klickbar */
  verifyUrl?: string | null;
}) {
  const t = TEXTS[data.locale];
  const colors = CERTIFICATE_PALETTES[paletteForMode(mode)];
  const styles = buildStyles(theme, colors);
  const dateFormatted = new Intl.DateTimeFormat(
    data.locale === "de" ? "de-DE" : "en-GB",
    { day: "2-digit", month: "long", year: "numeric" }
  ).format(data.issuedAt);

  return (
    <Document
      title={`${t.title} – ${data.courseTitle}`}
      author="LearnSphere"
      language={data.locale}
    >
      <Page size="A4" orientation={theme.orientation} style={styles.page}>
        <Backdrop theme={theme} colors={colors} />
        <View style={styles.content}>
          <View style={styles.frame}>
            <View style={styles.innerFrame}>
              <View style={styles.topRow}>
                <View>
                  <Text style={styles.brand}>
                    Learn<Text style={styles.brandAccent}>Sphere</Text>
                  </Text>
                  {logoSrc ? (
                    // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image kennt kein alt
                    <Image src={logoSrc} style={styles.logo} />
                  ) : null}
                </View>
                {verifyUrl ? (
                  <Link src={verifyUrl} style={styles.serialLinked}>
                    {t.serial} {data.serial}
                  </Link>
                ) : (
                  <Text style={styles.serial}>
                    {t.serial} {data.serial}
                  </Text>
                )}
              </View>

              <View style={styles.main}>
                <Text style={styles.titleWord}>{t.title}</Text>
                <Text style={styles.certifies}>{t.certifies}</Text>
                <Text style={styles.name}>{data.recipientName}</Text>
                <Ornament accent={colors.accent} />
                <Text style={styles.completed}>{t.completed}</Text>
                <Text style={styles.course}>{data.courseTitle}</Text>
                <Text style={styles.creator}>{t.by(data.creatorName)}</Text>
                {theme.showScore ? (
                  <Text style={styles.scoreBadge}>
                    {t.withScore(data.scorePercent)}
                  </Text>
                ) : null}
              </View>

              <View style={styles.bottomRow}>
                <View>
                  <View style={styles.rule} />
                  <Text style={styles.bottomText}>
                    {t.issuedOn(dateFormatted)}
                  </Text>
                </View>
                {theme.signatureName ? (
                  <View style={styles.signature}>
                    <View style={styles.signatureLine} />
                    <Text style={styles.signatureName}>
                      {theme.signatureName}
                    </Text>
                    {theme.signatureRole ? (
                      <Text style={styles.signatureRole}>
                        {theme.signatureRole}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                <Text style={styles.bottomText}>{t.issuer}</Text>
              </View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
