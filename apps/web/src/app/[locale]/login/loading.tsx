import { AuthSkeleton } from "@/components/auth/AuthSkeleton";

export default function LoginLoading() {
  return <AuthSkeleton fields={2} oauth />;
}
