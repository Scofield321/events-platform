const express = require("express");
const router = express.Router();

const pool = require("../config/database");
const supabase = require("../config/supabase");
const { createClient } = require("@supabase/supabase-js");
const authenticateUser = require("../middleware/auth");

// Save provider media

router.post("/providers/media", authenticateUser, async (req, res) => {
  const { media_type, media_url } = req.body;

  if (!["IMAGE", "VIDEO"].includes(media_type)) {
    return res.status(400).json({
      status: "ERROR",
      message: "Invalid media type",
    });
  }

  if (!media_url) {
    return res.status(400).json({
      status: "ERROR",
      message: "Media URL is required",
    });
  }

  try {
    const providerResult = await pool.query(
      `
        SELECT id
        FROM service_providers
        WHERE user_id = $1
      `,
      [req.user.id],
    );

    if (providerResult.rows.length === 0) {
      return res.status(404).json({
        status: "ERROR",
        message: "Provider profile not found",
      });
    }

    const providerId = providerResult.rows[0].id;

    // Check total current media count
    const countResult = await pool.query(
      `
        SELECT COUNT(*)::int AS count
        FROM provider_media
        WHERE provider_id = $1
      `,
      [providerId],
    );

    const mediaCount = countResult.rows[0].count;

    // Maximum of 4 total media files
    if (mediaCount >= 4) {
      return res.status(400).json({
        status: "ERROR",
        message: "Maximum of 4 media files allowed",
      });
    }

    const result = await pool.query(
      `
        INSERT INTO provider_media
          (
            provider_id,
            media_type,
            media_url,
            display_order
          )
        VALUES
          ($1, $2, $3, $4)
        RETURNING *
      `,
      [providerId, media_type, media_url, mediaCount],
    );

    res.status(201).json({
      status: "OK",
      message: "Media saved successfully",
      media: result.rows[0],
    });
  } catch (error) {
    console.error("Media database error:", error);

    res.status(500).json({
      status: "ERROR",
      message: "Failed to save media",
    });
  }
});

// ======================================================
// PROVIDER PROFILE IMAGE
// ======================================================

// Save or update provider profile image
router.post(
  "/providers/profile-image",
  authenticateUser,
  async (req, res) => {
    const { profile_image_url } = req.body;

    if (!profile_image_url) {
      return res.status(400).json({
        status: "ERROR",
        message: "Profile image URL is required",
      });
    }

    try {
      // Find provider belonging to logged-in user
      const providerResult = await pool.query(
        `
          SELECT id
          FROM service_providers
          WHERE user_id = $1
        `,
        [req.user.id],
      );

      if (providerResult.rows.length === 0) {
        return res.status(404).json({
          status: "ERROR",
          message: "Provider profile not found",
        });
      }

      const providerId = providerResult.rows[0].id;

      // Save profile image URL
      const result = await pool.query(
        `
          UPDATE service_providers
          SET
            profile_image_url = $1,
            updated_at = NOW()
          WHERE id = $2
          RETURNING
            id,
            business_name,
            profile_image_url
        `,
        [
          profile_image_url,
          providerId,
        ],
      );

      res.json({
        status: "OK",
        message: "Profile image saved successfully",
        provider: result.rows[0],
      });
    } catch (error) {
      console.error(
        "Profile image save error:",
        error,
      );

      res.status(500).json({
        status: "ERROR",
        message: "Failed to save profile image",
      });
    }
  },
);

// Get profile image for logged-in provider
router.get(
  "/providers/profile-image",
  authenticateUser,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
          SELECT
            id,
            business_name,
            profile_image_url
          FROM service_providers
          WHERE user_id = $1
        `,
        [req.user.id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          status: "ERROR",
          message: "Provider profile not found",
        });
      }

      res.json({
        status: "OK",
        provider: result.rows[0],
      });
    } catch (error) {
      console.error(
        "Profile image retrieval error:",
        error,
      );

      res.status(500).json({
        status: "ERROR",
        message:
          "Failed to fetch profile image",
      });
    }
  },
);

// Get media for the logged-in provider
router.get("/providers/media", authenticateUser, async (req, res) => {
  try {
    const result = await pool.query(
      `
                SELECT
                    pm.id,
                    pm.media_type,
                    pm.media_url,
                    pm.display_order
                FROM provider_media pm
                JOIN service_providers sp
                    ON sp.id = pm.provider_id
                WHERE sp.user_id = $1
                ORDER BY pm.display_order, pm.created_at
                `,
      [req.user.id],
    );

    res.json({
      status: "OK",
      media: result.rows,
    });
  } catch (error) {
    console.error("Error fetching media:", error);

    res.status(500).json({
      status: "ERROR",
      message: "Failed to fetch media",
    });
  }
});

// ======================================================
// DELETE PROVIDER MEDIA
// ======================================================

router.delete("/providers/media/:id", authenticateUser, async (req, res) => {
  const mediaId = req.params.id;

  try {
    // --------------------------------------------------
    // 1. Find media and verify provider ownership
    // --------------------------------------------------

    const mediaResult = await pool.query(
      `
                SELECT
                    pm.id,
                    pm.media_type,
                    pm.media_url,
                    pm.display_order,
                    sp.id AS provider_id
                FROM provider_media pm
                JOIN service_providers sp
                    ON sp.id = pm.provider_id
                WHERE pm.id = $1
                AND sp.user_id = $2
                `,
      [mediaId, req.user.id],
    );

    if (mediaResult.rows.length === 0) {
      return res.status(404).json({
        status: "ERROR",
        message: "Media not found",
      });
    }

    const media = mediaResult.rows[0];

    // --------------------------------------------------
    // 2. Extract the Storage file path
    // --------------------------------------------------

    const bucketName = "provider-media";

    const marker = `/storage/v1/object/public/${bucketName}/`;

    const markerIndex = media.media_url.indexOf(marker);

    if (markerIndex === -1) {
      return res.status(400).json({
        status: "ERROR",
        message: "Unable to determine storage file path",
      });
    }

    const filePath = decodeURIComponent(
      media.media_url.substring(markerIndex + marker.length),
    );

    // --------------------------------------------------
    // 3. Delete the file from Supabase Storage
    // --------------------------------------------------

    const authHeader = req.headers.authorization;

    const accessToken = authHeader.replace("Bearer ", "");

    const authenticatedSupabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      },
    );

    const { data: storageData, error: storageError } =
      await authenticatedSupabase.storage.from(bucketName).remove([filePath]);

    if (storageError) {
      console.error("Supabase storage delete error:", storageError);

      return res.status(500).json({
        status: "ERROR",
        message: "Failed to delete media file",
      });
    }

    // --------------------------------------------------
    // 4. Delete the database record
    // --------------------------------------------------

    await pool.query(
      `
                DELETE FROM provider_media
                WHERE id = $1
                `,
      [mediaId],
    );

    // --------------------------------------------------
    // 5. Return success
    // --------------------------------------------------

    res.json({
      status: "OK",
      message: "Media deleted successfully",
      media: {
        id: media.id,
        media_type: media.media_type,
        media_url: media.media_url,
      },
    });
  } catch (error) {
    console.error("Delete media error:", error);

    res.status(500).json({
      status: "ERROR",
      message: "Failed to delete media",
    });
  }
});

module.exports = router;
