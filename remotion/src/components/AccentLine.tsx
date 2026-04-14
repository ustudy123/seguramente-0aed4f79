import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS } from "../constants";

interface AccentLineProps {
  delay?: number;
  width?: number;
  color?: string;
  align?: "left" | "center";
}

export const AccentLine: React.FC<AccentLineProps> = ({
  delay = 0,
  width = 120,
  color = COLORS.orange,
  align = "center",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 25, stiffness: 200 },
  });

  const scaleX = interpolate(progress, [0, 1], [0, 1]);

  return (
    <div
      style={{
        width,
        height: 4,
        borderRadius: 2,
        background: color,
        transform: `scaleX(${scaleX})`,
        transformOrigin: align === "center" ? "center" : "left",
        margin: align === "center" ? "0 auto" : undefined,
      }}
    />
  );
};
