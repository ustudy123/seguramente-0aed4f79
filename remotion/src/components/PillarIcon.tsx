import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS } from "../constants";

interface PillarIconProps {
  icon: string;
  delay?: number;
  size?: number;
}

export const PillarIcon: React.FC<PillarIconProps> = ({
  icon,
  delay = 0,
  size = 80,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 12, stiffness: 200 },
  });

  const scale = interpolate(progress, [0, 1], [0.3, 1]);
  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const rotate = interpolate(progress, [0, 1], [-15, 0]);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 4,
        background: `linear-gradient(135deg, ${COLORS.purple} 0%, ${COLORS.purpleLight} 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.45,
        transform: `scale(${scale}) rotate(${rotate}deg)`,
        opacity,
        boxShadow: `0 8px 32px rgba(107, 63, 160, 0.4)`,
      }}
    >
      {icon}
    </div>
  );
};
