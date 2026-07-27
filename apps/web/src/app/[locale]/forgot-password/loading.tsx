import { AuthSkeleton } from "@/components/auth/AuthSkeleton";

export default function ForgotPasswordLoading() {
  return <AuthSkeleton fields={1} oauth={false} />;
}
