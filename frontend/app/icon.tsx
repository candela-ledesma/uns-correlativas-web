import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

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
          background:
            "radial-gradient(circle at 30% 30%, #60a5fa 0%, #1d4ed8 42%, #0f172a 100%)",
          borderRadius: "28%",
          boxShadow: "inset 0 0 0 14px rgba(255, 255, 255, 0.08)",
          fontSize: 108,
          lineHeight: 1,
        }}
      >
        🎓
      </div>
    ),
    size,
  );
}
