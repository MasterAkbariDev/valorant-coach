import { ratingMeta } from "@/lib/stats/rating";

export default function RatingBadge({ score }: { score: number }) {
  const rating = ratingMeta(score);
  return (
    <span className="rating-badge" style={{ color: rating.color }} title={`Tracker-style rating ${rating.score} · ${rating.tier}`}>
      <span className={`rating-shape rating-shape-${rating.shape}`} style={{ background: rating.color }} aria-hidden="true" />
      <span className="rating-score display">{rating.score}</span>
      <span className="rating-tier">{rating.tier}</span>
    </span>
  );
}
