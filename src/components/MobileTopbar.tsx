"use client";

import { navSections } from "@/lib/resume";

export default function MobileTopbar() {
  return (
    <>
      <div className="mobile-topbar">
        <a
          href="#home"
          style={{
            fontFamily: "var(--mono)",
            fontSize: 14,
            fontWeight: 700,
            color: "var(--text-1)",
            textDecoration: "none",
          }}
        >
          Kiiye9697
        </a>
        <div style={{ display: "flex", gap: 20 }}>
          {navSections.slice(1).map(({ id, label }) => (
            <a key={id} href={`#${id}`} className="mobile-nav-link">
              {label}
            </a>
          ))}
        </div>
      </div>

      <div style={{ height: 52, display: "block" }} className="mobile-spacer" />

      <style>{`
        @media (min-width: 769px) { .mobile-spacer { display: none; } }
      `}</style>
    </>
  );
}
