import Sidebar from "@/components/Sidebar";
import MobileTopbar from "@/components/MobileTopbar";
import MouseSpotlight from "@/components/MouseSpotlight";
import Hero from "@/components/Hero";
import Projects from "@/components/Projects";
import Experience from "@/components/Experience";
import Skills from "@/components/Skills";
import Articles from "@/components/Articles";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="shell">
      <MouseSpotlight />
      <Sidebar />
      <MobileTopbar />
      <main className="main-content">
        <div className="main-inner">
          <Hero />
          <Projects />
          <Experience />
          <Skills />
          <Articles />
          <Footer />
        </div>
      </main>
    </div>
  );
}
