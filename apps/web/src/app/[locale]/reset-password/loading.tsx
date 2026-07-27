import { AuthSkeleton } from "@/components/auth/AuthSkeleton";

export default function ResetPasswordLoading() {
  return <AuthSkeleton fields={2} oauth={false} />;
}
