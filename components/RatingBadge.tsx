import { ratingMeta, type RatingTier } from "@/lib/stats/rating";

function TierGlyph({ tier, size }: { tier: RatingTier; size: number }) {
  const stroke = "currentColor";
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": true as const,
  };

  if (tier === "S") {
    return (
      <svg {...common}>
        <path
          d="M12 2.5 20 7v10l-8 4.5L4 17V7l8-4.5Z"
          fill="currentColor"
          fillOpacity="0.18"
          stroke={stroke}
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path d="M12 7.5v9M9 10.5h6" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    );
  }
  if (tier === "A") {
    return (
      <svg {...common}>
        <path
          d="M12 3.2 20.5 12 12 20.8 3.5 12 12 3.2Z"
          fill="currentColor"
          fillOpacity="0.18"
          stroke={stroke}
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (tier === "B") {
    return (
      <svg {...common}>
        <rect
          x="4.5"
          y="4.5"
          width="15"
          height="15"
          rx="3.5"
          fill="currentColor"
          fillOpacity="0.18"
          stroke={stroke}
          strokeWidth="1.75"
        />
      </svg>
    );
  }
  if (tier === "C") {
    return (
      <svg {...common}>
        <circle
          cx="12"
          cy="12"
          r="7.5"
          fill="currentColor"
          fillOpacity="0.18"
          stroke={stroke}
          strokeWidth="1.75"
        />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path
        d="M8.2 4.5h7.6L20 8.2v7.6L15.8 19.5H8.2L4 15.8V8.2L8.2 4.5Z"
        fill="currentColor"
        fillOpacity="0.18"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function RatingBadge({
  score,
  size = "md",
}: {
  score: number;
  size?: "md" | "lg";
}) {
  const rating = ratingMeta(score);
  const glyph = size === "lg" ? 22 : 14;
  return (
    <span
      className={`rating-badge ${size === "lg" ? "rating-badge-lg" : ""}`}
      style={{ color: rating.color }}
      title={`Sample rating ${rating.score} · tier ${rating.tier}`}
    >
      <TierGlyph tier={rating.tier} size={glyph} />
      <span className="rating-score display">{rating.score}</span>
      <span className="rating-tier">{rating.tier}</span>
    </span>
  );
}
