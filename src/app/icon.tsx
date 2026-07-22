import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 14,
        }}
      >
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <path
            d="M8 6 L8 34 L26 34 L26 28 L15 28 L15 23 L24 23 L24 17 L15 17 L15 12 L26 12 L26 6 Z"
            fill="#eef5f1"
          />
          <path d="M20 34 L34 16 L26 16 L26 6 L14 22 L22 22 Z" fill="#1de582" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
