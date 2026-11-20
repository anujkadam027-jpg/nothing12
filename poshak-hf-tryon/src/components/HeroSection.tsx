import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

interface HeroVisualProps {
  onExploreCatalog: () => void;
}

export const HeroSection: React.FC<HeroVisualProps> = ({ onExploreCatalog }) => {
  return (
    <section
      aria-label="Atelier showcase"
      className="mx-auto max-w-[1400px] px-4 pt-5 pb-6 sm:px-8"
    >
      <div className="overflow-hidden rounded-3xl border border-[#E5E1D8] bg-[#E8E5DE]">
        <button
          type="button"
          onClick={onExploreCatalog}
          aria-label="Explore the Poshak collection"
          className="block h-[260px] w-full overflow-hidden sm:h-[340px] lg:h-[380px] cursor-pointer focus:outline-none"
        >
          <img
            src="/assets/studio/hero_atelier.jpg"
            alt="Curated luxury shirts, jackets, and kurtas on oak hangers inside the Poshak atelier"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover object-center transition-transform duration-500 hover:scale-[1.01]"
          />
        </button>
      </div>
    </section>
  );
};

interface BottomTitleSectionProps {
  onExploreCatalog: () => void;
  onExploreDeals: () => void;
  onLaunchFittingRoom: () => void;
}

export const StorefrontBottomTitle: React.FC<BottomTitleSectionProps> = ({
  onExploreCatalog,
  onExploreDeals,
  onLaunchFittingRoom,
}) => {
  return (
    <section
      data-testid="home-bottom-title"
      aria-label="Poshak Atelier introduction"
      className="mx-auto max-w-[1400px] px-4 pb-6 sm:px-8"
    >
      <div className="rounded-3xl border border-[#E5E1D8] bg-[#F3F1EC] px-6 py-12 text-center sm:px-12 sm:py-14">
        <p className="text-[11px] font-semibold tracking-[0.22em] text-[#9A7B4F] uppercase">
          Poshak Virtual Atelier
        </p>

        <h1 className="font-display mx-auto mt-3 max-w-2xl text-3xl leading-[1.08] font-semibold text-[#171717] [text-wrap:balance] sm:text-5xl">
          Dress in the Atelier, Before It Arrives.
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[#57544E]">
          Select a handcrafted piece across shirts, tees, jackets, bottoms, kurtas, and sarees,
          then try it via live camera, uploaded portrait, or studio drape.
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onExploreCatalog}
            className="inline-flex items-center gap-2 rounded-full bg-[#171717] px-6 py-3 text-xs font-semibold text-[#FAF9F6] transition-colors hover:bg-[#2D2D2D] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Explore Collection</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onExploreDeals}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#D4CFC4] bg-[#FAF9F6] px-5 py-3 text-xs font-medium text-[#171717] transition-colors hover:border-[#171717] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Seasonal Offers</span>
          </button>

          <button
            type="button"
            onClick={onLaunchFittingRoom}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#D4CFC4] bg-[#FAF9F6] px-5 py-3 text-xs font-medium text-[#171717] transition-colors hover:border-[#9A7B4F] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#9A7B4F]" aria-hidden="true" />
            <span>Try-On Studio</span>
          </button>
        </div>
      </div>
    </section>
  );
};
