import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getFallbackClothingItems } from "@/lib/fallback-catalog";

type FooterItem = {
  label: string;
  href?: string;
};

const ABOUT_US_ITEMS: FooterItem[] = [
  { label: "Our Story", href: "/our-story" },
  { label: "Team" },
  { label: "Contact Us", href: "/contact" },
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Payment Policy", href: "/payment-policy" },
  { label: "Return and Refunds", href: "/return-and-refunds" },
  { label: "Shipping Policy", href: "/shipping-policy" },
  { label: "Cancellation Policy", href: "/cancellation-policy" },
  { label: "Terms and Conditions", href: "/terms-and-conditions" },
];

const WORK_WITH_US_ITEMS: FooterItem[] = [
  { label: "Bulk & Custom Orders" },
  { label: "Become a Partner" },
  { label: "Become a Designer" },
  { label: "The Seller Academy" },
];

const FALLBACK_CLOTHING_ITEMS: FooterItem[] = getFallbackClothingItems().map((item) => ({
  label: item.name,
  href: `/customize/${item.slug}`,
}));

const MAP_EMBED_SRC =
  "https://maps.google.com/maps?q=Sy.No%206%2F3B%2C%202nd%20Cross%2C%20Begur%20Rd%2C%20Hongasandra%2C%20Bengaluru%2C%20Karnataka%20560068&z=16&output=embed";

function FooterColumn({ title, items }: { title: string; items: FooterItem[] }) {
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[#ffffff]">{title}</h2>
      <ul className="space-y-2 text-base leading-relaxed text-[#ffffff]">
        {items.map((item) => (
          <li key={`${title}-${item.label}`}>
            {item.href ? (
              <Link href={item.href} className="transition-colors hover:text-[#ffffff]/80">
                {item.label}
              </Link>
            ) : (
              <span>{item.label}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export async function SiteFooter() {
  let clothingItems: FooterItem[] = FALLBACK_CLOTHING_ITEMS;

  try {
    const products = await prisma.productType.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { slug: true, name: true },
    });

    if (products.length > 0) {
      clothingItems = products.map((product) => ({
        label: product.name,
        href: `/customize/${product.slug}`,
      }));
    }
  } catch {
    clothingItems = FALLBACK_CLOTHING_ITEMS;
  }

  return (
    <footer className="site-footer-no-radius mt-20 border-t-2 border-[#ffffff]/20 bg-[#000000] text-[#ffffff]">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-12 md:grid-cols-2 xl:grid-cols-[1.2fr_0.85fr_0.95fr_1.35fr]">
        <FooterColumn title="Clothing Items" items={clothingItems} />
        <FooterColumn title="About Us" items={ABOUT_US_ITEMS} />
        <FooterColumn title="Work With Us" items={WORK_WITH_US_ITEMS} />

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[#ffffff]">Location</h2>
          <div className="overflow-hidden rounded-2xl border border-[#ffffff]/20 bg-[#000000]/65 shadow-[0_10px_28px_rgba(0,0,0,0.35)] backdrop-blur">
            <div className="border-b border-[#ffffff]/20 px-4 py-3">
              <p className="text-sm font-medium text-[#ffffff]">Visit our production unit</p>
            </div>
            <div className="aspect-[4/3] w-full">
              <iframe
                title="CUSTOMED location on Google Maps"
                src={MAP_EMBED_SRC}
                className="h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          </div>
        </section>
      </div>

      <div className="border-t border-[#ffffff]/20">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-6 py-4 text-xs text-[#ffffff] sm:flex-row sm:items-center sm:justify-between">
          <p>Custom clothing studio for India.</p>
          <p>COD at launch. Payment gateway ready.</p>
        </div>
      </div>
    </footer>
  );
}


