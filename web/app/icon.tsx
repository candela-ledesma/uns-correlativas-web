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
          background: "linear-gradient(135deg, #1d4ed8 0%, #0f172a 100%)",
          fontSize: 112,
          lineHeight: 1,
        }}
      >
        🎓
      </div>
    ),
    size,
  );
}
