import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-[#F0F0FF] mb-3">{title}</h2>
      <div className="text-[#B8B8D0] text-sm leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export function LegalPageShell({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#0A0A0F]">
      <Navbar />
      <article className="max-w-3xl mx-auto px-4 pt-32 pb-24">
        <h1 className="text-3xl sm:text-4xl font-bold text-[#F0F0FF] tracking-tight mb-2">{title}</h1>
        <p className="text-[#8B8BA7] text-sm mb-12">Последнее обновление: {updatedAt}</p>
        {children}
      </article>
      <Footer />
    </main>
  );
}
