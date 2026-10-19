import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { ScrollStory } from "@/components/ScrollStory";
import { Evidence, Footer, Install, Limitations, Responsible, Verdicts } from "@/components/Sections";
import { TryIt } from "@/components/TryIt";

export default function Home() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <div id="top" />
        <Hero />
        <Evidence />
        <ScrollStory />
        <Verdicts />
        <TryIt />
        <Responsible />
        <Install />
        <Limitations />
      </main>
      <Footer />
    </>
  );
}
