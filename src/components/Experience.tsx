import Image from "next/image";
import { experiences } from "@/lib/resume";
import FadeUp from "./FadeUp";

export default function Experience() {
  return (
    <section id="experience" className="section">
      <div className="section-label">Experience</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {experiences.map((exp, i) => (
          <FadeUp key={i} delay={i * 100} spring>
            {/* Job header */}
            <div className="glass-card" style={{ padding: "20px 24px", marginBottom: 24 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
                  {exp.icon && (
                    <div
                      style={{
                        width: 92,
                        minWidth: 92,
                        height: 36,
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <Image
                        src={exp.icon}
                        alt={`${exp.company} logo`}
                        width={exp.iconWidth}
                        height={exp.iconHeight}
                        style={{
                          width: "auto",
                          height: exp.iconDisplayHeight,
                          objectFit: "contain",
                        }}
                      />
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-1)", marginBottom: 4 }}>
                      {exp.role}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-3)" }}>
                        {exp.company}
                      </span>
                      <span style={{ color: "var(--border)", fontSize: 10 }}>·</span>
                      <span
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 12,
                          color: "var(--accent)",
                          background: "var(--accent-dim)",
                          border: "1px solid rgba(96,165,250,0.2)",
                          borderRadius: 4,
                          padding: "2px 8px",
                        }}
                      >
                        {exp.department}
                      </span>
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 12,
                    color: "var(--text-3)",
                    paddingTop: 2,
                    whiteSpace: "nowrap",
                  }}
                >
                  {exp.period}
                </span>
              </div>
            </div>

            {/* Highlights */}
            <div style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 52 }}>
              {exp.highlights.map((h, j) => (
                <div key={j} className="highlight-item">
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--text-2)",
                      marginBottom: 6,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 11,
                        color: "var(--accent)",
                        opacity: 0.6,
                      }}
                    >
                      {String(j + 1).padStart(2, "0")}
                    </span>
                    {h.title}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      color: "var(--text-3)",
                      lineHeight: 1.8,
                    }}
                  >
                    {h.desc}
                  </div>
                </div>
              ))}
            </div>

            {i < experiences.length - 1 && (
              <hr className="divider" style={{ marginBottom: 52 }} />
            )}
          </FadeUp>
        ))}
      </div>
    </section>
  );
}
