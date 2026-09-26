const pool = require("../config/database");

/**
 * ==========================================================
 * BIDE HUB PROVIDER RELIABILITY SCORE
 * ==========================================================
 *
 * Reliability is NOT the same as profile completion.
 *
 * It measures how strong and trustworthy a provider's
 * presence appears to a client on Bide Hub.
 *
 * SCORE:
 *
 * 25% Profile & Business Information
 * 20% Portfolio / Media
 * 15% Contact & Online Presence
 * 20% Verification
 * 20% Client Experience
 *
 * Total = 100%
 *
 * A provider does NOT need reviews to have reliability.
 * Reviews improve the score as they accumulate.
 * ==========================================================
 */

async function calculateReliabilityScore(providerId) {
  try {
    // ======================================================
    // 1. GET PROVIDER INFORMATION
    // ======================================================

    const providerResult = await pool.query(
      `
        SELECT
          id,
          business_name,
          phone,
          location,
          address,
          description,
          website_url,
          whatsapp_number,
          instagram_url,
          facebook_url,
          tiktok_url,
          youtube_url,
          profile_image_url,
          verification_status
        FROM service_providers
        WHERE id = $1
      `,
      [providerId],
    );

    if (providerResult.rows.length === 0) {
      throw new Error("Provider not found");
    }

    const provider = providerResult.rows[0];

    // ======================================================
    // 2. GET PROVIDER SERVICES
    // ======================================================

    const servicesResult = await pool.query(
      `
        SELECT COUNT(*)::int AS service_count
        FROM provider_services
        WHERE provider_id = $1
      `,
      [providerId],
    );

    const serviceCount =
      Number(servicesResult.rows[0]?.service_count || 0);

    // ======================================================
    // 3. GET PROVIDER MEDIA
    // ======================================================

    const mediaResult = await pool.query(
      `
        SELECT
          COUNT(*)::int AS media_count,
          COUNT(*) FILTER (
            WHERE media_type = 'IMAGE'
          )::int AS image_count,
          COUNT(*) FILTER (
            WHERE media_type = 'VIDEO'
          )::int AS video_count
        FROM provider_media
        WHERE provider_id = $1
      `,
      [providerId],
    );

    const mediaStats = mediaResult.rows[0] || {};

    const mediaCount =
      Number(mediaStats.media_count || 0);

    const imageCount =
      Number(mediaStats.image_count || 0);

    const videoCount =
      Number(mediaStats.video_count || 0);

    // ======================================================
    // 4. GET REVIEW STATISTICS
    // ======================================================

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
        reviewResult.rows[0]?.average_rating || 0,
      );

    const reviewCount =
      Number(
        reviewResult.rows[0]?.review_count || 0,
      );

    // ======================================================
    // 5. PROFILE & BUSINESS INFORMATION — 25%
    // ======================================================
    //
    // Business name = 5
    // Phone         = 5
    // Location      = 5
    // Address       = 3
    // Description   = 7
    //
    // Total = 25
    // ======================================================

    let profileScore = 0;

    if (
      provider.business_name &&
      provider.business_name.trim()
    ) {
      profileScore += 5;
    }

    if (
      provider.phone &&
      provider.phone.trim()
    ) {
      profileScore += 5;
    }

    if (
      provider.location &&
      provider.location.trim()
    ) {
      profileScore += 5;
    }

    if (
      provider.address &&
      provider.address.trim()
    ) {
      profileScore += 3;
    }

    if (
      provider.description &&
      provider.description.trim()
    ) {
      profileScore += 7;
    }

    // ======================================================
    // 6. PORTFOLIO / MEDIA — 20%
    // ======================================================
    //
    // Profile image = 5
    // 1 image       = 5
    // 2+ images     = 5
    // Video         = 5
    //
    // Maximum = 20
    // ======================================================

    let portfolioScore = 0;

    if (
      provider.profile_image_url &&
      provider.profile_image_url.trim()
    ) {
      portfolioScore += 5;
    }

    if (imageCount >= 1) {
      portfolioScore += 5;
    }

    if (imageCount >= 2) {
      portfolioScore += 5;
    }

    if (videoCount >= 1) {
      portfolioScore += 5;
    }

    // ======================================================
    // 7. CONTACT & ONLINE PRESENCE — 15%
    // ======================================================
    //
    // WhatsApp = 5
    // Website  = 2
    // Socials  = up to 8
    //
    // Social platforms:
    // Instagram = 2
    // Facebook  = 2
    // TikTok    = 2
    // YouTube   = 2
    //
    // Maximum = 15
    // ======================================================

    let contactScore = 0;

    if (
      provider.whatsapp_number &&
      provider.whatsapp_number.trim()
    ) {
      contactScore += 5;
    }

    if (
      provider.website_url &&
      provider.website_url.trim()
    ) {
      contactScore += 2;
    }

    if (
      provider.instagram_url &&
      provider.instagram_url.trim()
    ) {
      contactScore += 2;
    }

    if (
      provider.facebook_url &&
      provider.facebook_url.trim()
    ) {
      contactScore += 2;
    }

    if (
      provider.tiktok_url &&
      provider.tiktok_url.trim()
    ) {
      contactScore += 2;
    }

    if (
      provider.youtube_url &&
      provider.youtube_url.trim()
    ) {
      contactScore += 2;
    }

    // ======================================================
    // 8. SERVICES
    // ======================================================
    //
    // We want providers to actually tell clients what they
    // offer.
    //
    // Services are folded into the profile/business score.
    //
    // If services exist, add 5 points by taking them from
    // the profile section and normalizing below.
    // ======================================================

    // We give service presence a separate contribution,
    // then reduce the profile category proportionally.
    //
    // Simpler implementation:
    // profile + services = 30 points before normalization.
    //
    // ======================================================

    let businessAndServicesScore = profileScore;

    if (serviceCount > 0) {
      businessAndServicesScore += 5;
    }

    // Normalize business + services back to maximum 25.
    const normalizedProfileScore =
      Math.min(
        businessAndServicesScore,
        25,
      );

    // ======================================================
    // 9. VERIFICATION — 20%
    // ======================================================

    const verificationScore =
      provider.verification_status === "VERIFIED"
        ? 20
        : 0;

    // ======================================================
    // 10. CLIENT EXPERIENCE — 20%
    // ======================================================
    //
    // No reviews:
    // Give a neutral baseline rather than zero.
    //
    // Reviews gradually replace the baseline.
    //
    // Baseline rating = 3.5 / 5
    // Baseline reviews = 5
    //
    // This prevents one early review from causing a huge
    // reliability swing.
    // ======================================================

    const baselineRating = 3.5;
    const baselineReviews = 5;

    const effectiveRating =
      (
        averageRating * reviewCount +
        baselineRating * baselineReviews
      ) /
      (reviewCount + baselineReviews);

    const clientExperienceScore =
      reviewCount === 0
        ? 14
        : (effectiveRating / 5) * 20;

    // ======================================================
    // 11. FINAL SCORE
    // ======================================================

    const reliabilityScore =
      normalizedProfileScore +
      portfolioScore +
      contactScore +
      verificationScore +
      clientExperienceScore;

    // Make absolutely sure the score stays between 0 and 100.
    const finalScore = Math.max(
      0,
      Math.min(
        100,
        Number(reliabilityScore.toFixed(2)),
      ),
    );

    // ======================================================
    // 12. SAVE SCORE
    // ======================================================

    await pool.query(
      `
        UPDATE service_providers
        SET
          reliability_score = $1,
          updated_at = NOW()
        WHERE id = $2
      `,
      [
        finalScore,
        providerId,
      ],
    );

    console.log(
      `Reliability updated for provider ${providerId}: ${finalScore}%`,
    );

    return finalScore;
  } catch (error) {
    console.error(
      "Reliability calculation error:",
      error,
    );

    throw error;
  }
}

module.exports = calculateReliabilityScore;