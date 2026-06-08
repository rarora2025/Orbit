import Sidebar from "@/components/Sidebar";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col h-full">
      <Sidebar />
      <main className="flex-1 mt-[4.75rem] px-3 pb-3 flex flex-col min-h-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
