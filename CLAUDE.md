# Projekt-Setup SaaS

Wir bauen eine E-Learning-Plattform. User (Creator) können sich registrieren und Kurse anlegen (brauchen da zu ggf. ein Abo). Und User (Clients) können Kurse kaufen oder sich kostenlos eintragen (je nach einstellungen des kurses). Man braucht für alles einen Account. 

## 1. Nextjs und Packages
Installiere mit npx create-next-app die aktuelle Nextjs-Version mit Typescript und ohne Tailwind. Wir nutzen styled-components.

## 2. Wichtige Regeln:
- es muss TDD entwickelt werden
- Testabdeckung 100%!
- Mobile first ab 320px!
- Barrierefrei!
- Performance ist wehr wichtig
- Design ist absolut wichtig! Es muss richtig Spaß machen die Seite zu besuchen. Nutze Three.js, 3D-Effekte, view transition api, framer motion, gsap, etc Es soll krass sein, aber auch recht minimalitisch, clean sein, hoch modern. Nutze da gerne den Skill /frontend-design

## 3. Auth
Wir nutzen next-auth!
Ich brauche eine login und registrieren seite und route. außerdem passwort zurücksetzen und 2FA mit AuthenticatorApp. 

## 4. Baue eine Startseite
Eine Landingpage für das SaaS. Und Preise, Impressum, Datenschutz, AGB und Barrierefreiheit. 

## 5. Sprachen
Die Seite soll deutsch/englisch (später mehr) sein.

## 6. Die Kurseverwaltung: 
Sei kreativ, man soll bequem Kurse erstellen können:
- Kurse können in Abschnitte unterteilt sein
- Abschnitte können ein oder mehrere Videos oder Dateien enthalten.
- Man muss mind. XX % (kann man einstellen) gesehen haben, damit man zur Abschlussprüfung zugelassen ist. Abschnitte können auch Zwischenprüfungen haben.

## 7. Prüfung
- man muss (wenn nicht anders eingestellt) eine Abschlussprüfung machen und diese zu XX% bestehen. Dann bekommt man ein zertifikat per PDF zum download und einbinden in linkedin. Das PDF bauen wir hübsch (mehrere in verschiedenen sprachen ggf)

## Hosting
Vercel, später vielleicht Hostinger