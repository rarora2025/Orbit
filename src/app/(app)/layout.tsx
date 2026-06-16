import Sidebar from "@/components/Sidebar";
import StoreHydrator from "@/components/StoreHydrator";
import OnboardingGate from "@/components/OnboardingGate";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col h-full">
      <StoreHydrator />
      <OnboardingGate />
      <Sidebar />
      <main className="flex-1 mt-[4.75rem] px-3 pb-3 flex flex-col min-h-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
