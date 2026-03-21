import { SiteFooter } from "@/components/site-footer";

export const metadata = {
  title: "Our Story | Customed Clothing",
  description: "Learn the story behind Customed Clothing and its founder, Devashish Shrivastav.",
};

export default function OurStoryPage() {
  return (
    <>
      <div className="mx-auto w-full max-w-7xl px-6 py-12">
        <div className="max-w-3xl">
          <p className="text-sm uppercase tracking-[0.2em] text-[#000000]">About Us</p>
          <h1 className="mt-2 text-5xl font-semibold tracking-tight text-[#000000] md:text-6xl">
            Our Story
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-[#000000] md:text-xl">
            Hi, this is Devashish Shrivastav. I am the sole founder and developer of Customed Clothing.
          </p>
        </div>

        <section className="mt-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
          <article className="space-y-5 text-base text-[#000000] md:text-lg">
            <p className="leading-relaxed">
              I came up with the idea in early 2025. I noticed that many websites and apps let users customize
              clothing items, and some even offered customization for phone covers, coffee mugs, and backpacks.
              However, I found a common problem: most of these websites looked too complex and presented too much
              information for first-time users.
            </p>
            <p className="leading-relaxed">
              So I decided to create a website of our own that simplifies the experience. My goal was to make sure
              users never feel confused, overwhelmed, or unsure about what they are doing. I created a 7-step process
              to guide users clearly, help them stay longer on the site, and prevent them from leaving before placing
              an order because of uncertainty.
            </p>
            <p className="leading-relaxed">
              The website is intentionally simple, and the landing page includes a 90-second instruction video that
              explains everything from Step 1 to Step 7. I built dedicated steps for text, image, and freehand
              painting so users can switch between all three whenever they want. There is also a 360-degree preview
              page that gives a very accurate estimate of how the final product will look.
            </p>
            <p className="leading-relaxed">
              We also have a user-friendly policy: after placing an order, users get 12 hours to contact us and explain
              exactly what they require. This helps if the website features were not enough or if the user later
              realizes that a correction is needed.
            </p>
            <p className="leading-relaxed">
              Our clothing design studio offers more features than anyone else for custom T-Shirts. The quality of our
              raw items is excellent, with the Premium+ option being the highest quality available. We have DTG
              (Direct-to-Garment), DTF (Direct-to-Film), and screen printing machines, so users can choose the print
              method they prefer.
            </p>
            <p className="leading-relaxed">
              I hope that one day our studio becomes a hub for designers all over India, where people of all ages
              visit our website so they can truly WEAR WHAT THEY WANT.
            </p>
          </article>

          <aside className="rounded-2xl border border-dashed border-[#000000] p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#000000]">Founders </p>
            <div className="mt-4 flex aspect-[4/5] w-full items-center justify-center rounded-xl border-2 border-dashed border-[#000000] px-4 text-center">
              <div>
                <p className="text-lg font-medium text-[#000000]">Image Placeholder</p>
                <p className="mt-2 text-base text-[#000000]">
                  You can replace this area with a large founder photo later.
                </p>
              </div>
            </div>
          </aside>
        </section>
      </div>
      <SiteFooter />
    </>
  );
}




