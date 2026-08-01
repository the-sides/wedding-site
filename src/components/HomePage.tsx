import type { Post } from "@/lib/notion";
import { Posts } from "@/components/posts";

const keepsakePhotos = [
  {
    src: "/PXL_20251025_213818182.jpg",
    alt: "Jacob and Vicki smiling in the mountains",
  },
  {
    src: "/DSC03122.webp",
    alt: "Vicki smiling near a framed painting",
  },
  {
    src: "/IMG_4023.jpg",
    alt: "Jacob and Vicki sitting together at a restaurant booth",
  },
]

interface HomePageProps {
  posts: Array<Post>;
}

export function HomePage({ posts }: HomePageProps) {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f4eadc] text-[#221812]">
      <section
        className="relative min-h-[92svh] overflow-hidden px-5 py-5 sm:px-8 sm:py-7 lg:px-10"
        aria-label="Jacob and Vicki wedding hero"
      >
        <img
          src="/walking.jpg"
          alt="Jacob and Vicki under string lights"
          className="absolute inset-0 h-full w-full object-cover object-[62%_50%]"
        />
        <div className="absolute inset-0 opacity-75 bg-[linear-gradient(90deg,rgba(21,13,8,0.78)_0%,rgba(21,13,8,0.48)_42%,rgba(21,13,8,0.08)_100%)]" />
        <div className="absolute inset-0 opacity-75 bg-[radial-gradient(circle_at_24%_28%,rgba(244,234,220,0.34),transparent_30%),linear-gradient(180deg,rgba(12,7,4,0.18),rgba(12,7,4,0.5))]" />

        <div className="relative z-10 flex min-h-[calc(92svh-2.5rem)] flex-col justify-between text-[#fff8ee] sm:min-h-[calc(92svh-3.5rem)]">
          <header className="flex items-start justify-between gap-6 font-['Avenir_Next','Gill_Sans',sans-serif] text-xs uppercase tracking-[0.24em] text-[#fff1d7]/80">
            <a href="/" className="leading-none">
              J & V
            </a>
            <p className="text-right leading-relaxed">
              Wedding
              <span className="block text-[#d7b46a]">Details soon</span>
            </p>
          </header>

          <div className="grid items-end gap-10 pb-7 pt-28 sm:pb-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-12 lg:pt-36">
            <div className="max-w-4xl">
              <p className="mb-5 font-['Avenir_Next','Gill_Sans',sans-serif] text-sm uppercase tracking-[0.32em] text-[#d7b46a] sm:text-base">
                The wedding of
              </p>
              <h1 className="font-['Bodoni_72','Didot','Baskerville',serif] text-6xl leading-[0.86] text-balance sm:text-8xl lg:text-[9rem]">
                Jacob
                <span className="block">& Vicki</span>
              </h1>
              <p className="mt-6 max-w-xl font-['Avenir_Next','Gill_Sans',sans-serif] text-base leading-7 text-[#fff8ee]/82 sm:text-xl">
                October 30, 2027
              </p>
            </div>

            <div className="grid max-w-md grid-cols-3 gap-2 justify-self-start lg:justify-self-end">
              {keepsakePhotos.map((photo) => (
                <img
                  key={photo.src}
                  src={photo.src}
                  alt={photo.alt}
                  className="aspect-[3/4] min-w-0 border border-[#fff8ee]/45 object-cover shadow-2xl shadow-black/35"
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <Posts posts={posts} />

      <section className="grid min-h-[8svh] place-items-center border-t border-[#221812]/15 bg-[#f4eadc] px-5 py-4 font-['Avenir_Next','Gill_Sans',sans-serif] text-xs uppercase tracking-[0.24em] text-[#6f5a45]">
        Jacob & Vicki
      </section>
    </main>
  )
}
