import { SiteBrand } from "@/components/site-brand";
import { SiteNav } from "@/components/site-nav";

export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-clip text-foreground">
      <header className="sticky top-0 z-30 border-b border-[#ffffff]/20 bg-[#000000]">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <SiteBrand />
          <SiteNav />
        </div>
      </header>
      <main className="relative z-10">{children}</main>
    </div>
  );
}
