import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0f0d",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 92,
            fontWeight: 800,
            fontFamily: "sans-serif",
            letterSpacing: -4,
          }}
        >
          <span style={{ color: "#eef5f1" }}>E</span>
          <span style={{ color: "#1de582" }}>B</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
