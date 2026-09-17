const pool = require("../config/database");

/**
 * Calculate and update a provider's reliability score.
 *
 * MVP formula:
 *
 * Reliability =
 * 30% Verification
 * +
 * 70% Adjusted Client Experience
 *
 * Adjusted Rating =
 * (Rating × Reviews + Baseline Rating × Baseline Reviews)
 * ÷
 * (Reviews + Baseline Reviews)
 *
 * Baseline Rating = 3.5
 * Baseline Reviews = 5
 */

async function calculateReliabilityScore(providerId) {
  try {
    // ==========================================
    // 1. Get provider verification status
    // ==========================================

    const providerResult = await pool.query(
      `
        SELECT
          verification_status
        FROM service_providers
        WHERE id = $1
      `,
      [providerId],
    );

    if (providerResult.rows.length === 0) {
      throw new Error("Provider not found");
    }

    const provider =
      providerResult.rows[0];

    // ==========================================
    // 2. Get active review statistics
    // ==========================================

    const reviewResult = await pool.query(
      `
        SELECT
          COALESCE(AVG(rating), 0) AS average_rating,
          COUNT(*)::int AS review_count
        FROM reviews
        WHERE
          provider_id = $1
          AND status = 'ACTIVE'
      `,
      [providerId],
    );

    const averageRating =
      Number(
        reviewResult.rows[0].average_rating || 0
      );

    const reviewCount =
      Number(
        reviewResult.rows[0].review_count || 0
      );

    // ==========================================
    // 3. No reviews = no reliability score
    // ==========================================

    if (reviewCount === 0) {
      await pool.query(
        `
          UPDATE service_providers
          SET
            reliability_score = 0,
            updated_at = NOW()
          WHERE id = $1
        `,
        [providerId],
      );

      return 0;
    }

    // ==========================================
    // 4. Verification score
    // ==========================================

    const verificationScore =
      provider.verification_status === "VERIFIED"
        ? 100
        : 0;

    // ==========================================
    // 5. Adjust client rating
    // ==========================================

    const baselineRating = 3.5;
    const baselineReviews = 5;

    const adjustedRating =
      (
        averageRating * reviewCount +
        baselineRating * baselineReviews
      ) /
      (reviewCount + baselineReviews);

    // ==========================================
    // 6. Convert client experience to percentage
    // ==========================================

    const clientExperienceScore =
      (adjustedRating / 5) * 100;

    // ==========================================
    // 7. Calculate final reliability
    // ==========================================

    const reliabilityScore =
      verificationScore * 0.30 +
      clientExperienceScore * 0.70;

    // ==========================================
    // 8. Save reliability score
    // ==========================================

    await pool.query(
      `
        UPDATE service_providers
        SET
          reliability_score = $1,
          updated_at = NOW()
        WHERE id = $2
      `,
      [
        reliabilityScore.toFixed(2),
        providerId,
      ],
    );

    return Number(
      reliabilityScore.toFixed(2)
    );
  } catch (error) {
    console.error(
      "Reliability calculation error:",
      error,
    );

    throw error;
  }
}

module.exports = calculateReliabilityScore;