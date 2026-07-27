import { AuthSkeleton } from "@/components/auth/AuthSkeleton";

export default function RegisterLoading() {
  // Registrierung öffnet die weiteren Felder progressiv – anfangs nur E-Mail.
  return <AuthSkeleton fields={1} oauth />;
}
