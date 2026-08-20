import { Sidebar } from "@/components/layout/Sidebar";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lg:flex">
      <Sidebar />
      <div className="lg:flex-1 lg:pl-60 min-w-0">{children}</div>
    </div>
  );
}
