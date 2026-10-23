import { Sidebar } from "@/components/sidebar";
import { ToastProvider } from "@/components/toast";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ToastProvider>
      <div className="app">
        <div className="win">
          <Sidebar />
          <div className="main">{children}</div>
        </div>
      </div>
    </ToastProvider>
  );
}
