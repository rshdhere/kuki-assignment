import { Sidebar } from "@/components/sidebar";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="app">
      <Sidebar />
      <div className="main">{children}</div>
    </div>
  );
}
