export default function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--border-light)",
        padding: "28px 0 48px",
        marginTop: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-3)" }}>
          Kiiye9697 · {new Date().getFullYear()}
        </span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-3)" }}>
          Built with Next.js · Zhihu sync enabled
        </span>
      </div>
    </footer>
  );
}
