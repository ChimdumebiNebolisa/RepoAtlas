import { ImageResponse } from "next/og";

export const socialPreviewAlt =
  "RepoAtlas take-home coding interview review with five passes from brief to next change";

export const socialPreviewSize = {
  width: 1200,
  height: 630,
} as const;

const reviewPasses = ["Brief", "Core path", "Decision", "Proof", "Limit"] as const;

export function renderTakeHomeSocialPreview() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#f6f9f7",
          color: "#172822",
          fontFamily: "sans-serif",
          padding: "58px 64px",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            opacity: 0.28,
            backgroundImage:
              "linear-gradient(#c9d9d1 1px, transparent 1px), linear-gradient(90deg, #c9d9d1 1px, transparent 1px)",
            backgroundSize: "42px 42px",
          }}
        />

        <div
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "stretch",
            gap: 54,
            position: "relative",
          }}
        >
          <div
            style={{
              width: 670,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "8px 0 10px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 13,
                  color: "#087a55",
                  fontSize: 24,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    display: "flex",
                    background: "#087a55",
                    borderRadius: 4,
                  }}
                />
                RepoAtlas
              </div>

              <div
                style={{
                  display: "flex",
                  marginTop: 82,
                  color: "#087a55",
                  fontSize: 23,
                  fontWeight: 700,
                }}
              >
                Take-home coding interview review
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 17,
                  fontSize: 64,
                  lineHeight: 1.02,
                  fontWeight: 800,
                  letterSpacing: "-0.045em",
                }}
              >
                Review your take-home before you explain it.
              </div>
            </div>

            <div
              style={{
                display: "flex",
                fontSize: 22,
                color: "#49635a",
              }}
            >
              Five file-backed passes for one clear technical story.
            </div>
          </div>

          <div
            style={{
              width: 350,
              display: "flex",
              flexDirection: "column",
              background: "#172822",
              color: "#f6f9f7",
              borderRadius: 30,
              padding: "30px 28px 28px",
              boxShadow: "0 24px 60px rgba(23, 40, 34, 0.22)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingBottom: 22,
                borderBottom: "1px solid rgba(246, 249, 247, 0.2)",
              }}
            >
              <span style={{ display: "flex", fontSize: 19, fontWeight: 700 }}>Review docket</span>
              <span
                style={{
                  display: "flex",
                  color: "#8ce0bd",
                  fontSize: 15,
                  letterSpacing: "0.08em",
                }}
              >
                05 PASSES
              </span>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                paddingTop: 12,
              }}
            >
              {reviewPasses.map((label, index) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 18,
                    minHeight: 70,
                    borderBottom:
                      index === reviewPasses.length - 1
                        ? "none"
                        : "1px solid rgba(246, 249, 247, 0.13)",
                  }}
                >
                  <span
                    style={{
                      width: 38,
                      height: 38,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      border: "1px solid rgba(140, 224, 189, 0.55)",
                      borderRadius: 10,
                      color: "#8ce0bd",
                      fontSize: 17,
                      fontWeight: 700,
                    }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span style={{ display: "flex", fontSize: 24, fontWeight: 650 }}>{label}</span>
                </div>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                marginTop: "auto",
                paddingTop: 17,
                color: "#b9cbc3",
                fontSize: 16,
              }}
            >
              Evidence first. Rationale stays yours.
            </div>
          </div>
        </div>
      </div>
    ),
    socialPreviewSize,
  );
}
