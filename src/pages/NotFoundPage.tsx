import { useState, useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import ClientNavbar from '../components/layout/client/ClientNavbar';
import ClientBottomNav from '../components/layout/client/ClientBottomNav';
import MIcon from '../components/shared/MIcon';
import { useLanguage } from '../context/LanguageContext';
import { tx } from '../i18n/tx';


/**
 * NotFoundPage (404) — Reproduction 100% intégrale et fidèle du design Stitch HTML `page_404_tokpa/code.html`
 */
export default function NotFoundPage() {
  const { isFr } = useLanguage();
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const moveX = (e.clientX - window.innerWidth / 2) / 50;
      const moveY = (e.clientY - window.innerHeight / 2) / 50;
      setMousePos({ x: moveX, y: moveY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col overflow-x-hidden font-body">
      {/* TopNavBar Header */}
      <ClientNavbar />

      {/* Main Content with 404 Layout */}
      <main className="relative flex-grow flex items-center justify-center p-md min-h-[calc(100vh-116px)] pt-[68px]">
        {/* Full Screen Background Overlay */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-warm-low via-surface to-warm/80 opacity-90" />
          <div className="absolute inset-0 bg-surface/85 backdrop-blur-[2px]" />
        </div>

        {/* Content Container */}
        <div className="relative z-10 max-w-[600px] w-full text-center space-y-lg animate-fade-in my-auto py-md">
          {/* Icon/Visual Element */}
          <div className="flex justify-center mb-md">
            <div className="w-24 h-24 bg-primary-container rounded-full flex items-center justify-center shadow-lg transform hover:rotate-12 transition-transform duration-300">
              <MIcon
                name="storefront"
                className="text-on-primary-container text-[48px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              />
            </div>
          </div>

          {/* 404 Giant Watermark Title with Parallax */}
          <h1
            className="font-h1 text-[120px] md:text-[180px] leading-none text-primary font-extrabold tracking-tighter opacity-10 drop-shadow-sm absolute left-1/2 -top-24 select-none pointer-events-none transition-transform duration-75"
            style={{
              transform: `translate(calc(-50% + ${mousePos.x}px), ${mousePos.y}px)`,
            }}
          >
            404
          </h1>

          <div className="space-y-sm relative z-20">
            <h2 className="font-h1 text-h1 text-on-surface">
              {isFr ? tx("Oups ! Cette page s'est perdue au marché.") : 'Oops! This page got lost at the market.'}
            </h2>
            <p className="font-body text-body text-text-secondary max-w-[400px] mx-auto">
              {isFr
                ? tx("La page que vous recherchez semble avoir quitté son étal. Elle est peut-être en train de négocier un meilleur prix ailleurs.")
                : 'The page you are looking for seems to have left its stall. It might be bargaining for a better price elsewhere.'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-md pt-lg relative z-20">
            <Link
              to="/"
              className="group w-full sm:w-auto flex items-center justify-center gap-xs px-lg py-3 bg-primary-container text-white font-h3 rounded-xl active:scale-[0.97] transition-all hover:bg-primary-hover shadow-md cursor-pointer"
            >
              <MIcon name="home" />
              <span>{isFr ? tx("Retour à l'accueil") : 'Back to home'}</span>
            </Link>

            <Link
              to="/catalogue"
              className="w-full sm:w-auto flex items-center justify-center gap-xs px-lg py-3 bg-surface border-2 border-primary-container text-primary font-h3 rounded-xl active:scale-[0.97] transition-all hover:bg-primary-tint cursor-pointer"
            >
              <MIcon name="grid_view" />
              <span>{isFr ? 'Explorer le catalogue' : 'Explore catalog'}</span>
            </Link>
          </div>

          {/* Interaction Layer: Small Floating Elements */}
          <div className="hidden lg:block pointer-events-none">
            <div className="absolute -top-12 -left-12 animate-bounce transition-all duration-1000">
              <MIcon name="shopping_bag" className="text-primary-light text-4xl opacity-40" />
            </div>
            <div className="absolute -bottom-12 -right-12 animate-pulse transition-all duration-700">
              <MIcon name="receipt_long" className="text-primary-light text-4xl opacity-40" />
            </div>
          </div>
        </div>
      </main>

      {/* BottomNavBar */}
      <ClientBottomNav />
    </div>
  );
}
