import { SignUp } from '@clerk/nextjs';

export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#faf9f5]">
      {/* New accounts land in the onboarding flow (identity → goals → network → ask). */}
      <SignUp forceRedirectUrl="/onboarding" />
    </div>
  );
}
