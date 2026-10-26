import type { ProfileReview } from "@/src/lib/tutor-profile-api";

// Shared by the public tutor profile (DISC-3) and subject page (DISC-4).
const rateFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export const formatRate = (rate: string | number) => `฿${rateFormat.format(Number(rate))}`;

export function Stars({ rating }: { rating: number }) {
  const stars = Number.isFinite(rating) ? Math.max(0, Math.min(5, Math.round(rating))) : 0;
  return (
    <span role="img" aria-label={`${stars} out of 5 stars`} className="text-amber-400">
      {"★".repeat(stars)}
      <span className="text-zinc-300 dark:text-zinc-700">{"★".repeat(5 - stars)}</span>
    </span>
  );
}

export function Rating({ rating, count }: { rating: number | null; count: number }) {
  if (rating === null) return <span className="text-sm text-zinc-500">No reviews yet</span>;
  return (
    <span className="text-sm text-zinc-500">
      <span className="font-semibold text-foreground">★ {rating.toFixed(1)}</span> ({count}{" "}
      {count === 1 ? "review" : "reviews"})
    </span>
  );
}

export function ReviewList({ reviews }: { reviews: ProfileReview[] }) {
  if (reviews.length === 0) return <p className="text-zinc-500">No reviews yet.</p>;
  return (
    <ul className="flex flex-col gap-4">
      {reviews.map((review) => (
        <li
          key={review.id}
          className="flex flex-col gap-1 border-t border-black/10 pt-4 first:border-0 first:pt-0 dark:border-white/15"
        >
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <Stars rating={review.rating} />
            <span className="font-medium">{review.reviewer}</span>
            <span className="text-zinc-500">
              · {review.subjectName} ·{" "}
              {new Date(review.createdAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: "Asia/Bangkok",
              })}
            </span>
          </p>
          {review.text && <p className="text-zinc-600 dark:text-zinc-400">{review.text}</p>}
        </li>
      ))}
    </ul>
  );
}
