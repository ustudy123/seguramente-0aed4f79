import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS } from "../constants";

interface TextRevealProps {
  text: string;
  delay?: number;
  fontSize?: number;
  color?: string;
  fontWeight?: number;
  maxWidth?: number;
  textAlign?: "left" | "center" | "right";
}

export const TextReveal: React.FC<TextRevealProps> = ({
  text,
  delay = 0,
  fontSize = 64,
  color = COLORS.white,
  fontWeight = 700,
  maxWidth,
  textAlign = "center",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 20, stiffness: 180 },
  });

  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const y = interpolate(progress, [0, 1], [40, 0]);

  return (
    <div
      style={{
        fontSize,
        fontWeight,
        fontFamily: "'Poppins', 'Inter', sans-serif",
        color,
        opacity,
        transform: `translateY(${y}px)`,
        textAlign,
        maxWidth: maxWidth || "100%",
        lineHeight: 1.2,
        letterSpacing: "-0.02em",
      }}
    >
      {text}
    </div>
  );
};
