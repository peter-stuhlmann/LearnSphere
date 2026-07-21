/**
 * Von LearnSphere vorgegebene Kurs-Kategorien.
 * Ein Kurs hat genau eine (oder keine) Kategorie – gespeichert wird die `id`.
 *
 * Zum Bearbeiten einfach Einträge ergänzen/ändern: `id` ist der stabile
 * Datenbank-Wert (nie ändern, sonst verlieren Kurse ihre Kategorie),
 * `de`/`en` sind die Anzeigenamen.
 */
export const COURSE_CATEGORIES = [
  { id: "programming", de: "Programmierung & Software", en: "Programming & Software" },
  { id: "web-development", de: "Webentwicklung", en: "Web Development" },
  { id: "data-ai", de: "Data Science & KI", en: "Data Science & AI" },
  { id: "it-security", de: "IT & Cybersicherheit", en: "IT & Cybersecurity" },
  { id: "design", de: "Design & UX", en: "Design & UX" },
  { id: "photo-video", de: "Fotografie & Video", en: "Photography & Video" },
  { id: "music-audio", de: "Musik & Audio", en: "Music & Audio" },
  { id: "marketing", de: "Marketing", en: "Marketing" },
  { id: "business", de: "Business & Unternehmertum", en: "Business & Entrepreneurship" },
  { id: "finance", de: "Finanzen & Investieren", en: "Finance & Investing" },
  { id: "sales-communication", de: "Vertrieb & Kommunikation", en: "Sales & Communication" },
  { id: "personal-development", de: "Persönlichkeitsentwicklung", en: "Personal Development" },
  { id: "productivity-career", de: "Produktivität & Karriere", en: "Productivity & Career" },
  { id: "languages", de: "Sprachen", en: "Languages" },
  { id: "health-fitness", de: "Gesundheit & Fitness", en: "Health & Fitness" },
  { id: "food-cooking", de: "Ernährung & Kochen", en: "Nutrition & Cooking" },
  { id: "arts-crafts", de: "Kunst & Kreatives", en: "Arts & Creativity" },
  { id: "diy", de: "Handwerk & DIY", en: "Crafts & DIY" },
  { id: "science-tech", de: "Wissenschaft & Technik", en: "Science & Technology" },
  { id: "law-taxes", de: "Recht & Steuern", en: "Law & Taxes" },
  { id: "lifestyle", de: "Lifestyle & Hobby", en: "Lifestyle & Hobbies" },
] as const;

export type CourseCategoryId = (typeof COURSE_CATEGORIES)[number]["id"];

export function isCourseCategory(id: string): id is CourseCategoryId {
  return COURSE_CATEGORIES.some((c) => c.id === id);
}

export function categoryLabel(id: string, locale: string): string {
  const category = COURSE_CATEGORIES.find((c) => c.id === id);
  if (!category) return id;
  return locale === "en" ? category.en : category.de;
}
