const express = require("express");
const router = express.Router();

const pool = require("../config/database");
const authenticateUser = require("../middleware/auth");
const requireClient = require("../middleware/client");

// Submit a review
router.post(
    "/providers/:id/reviews",
    authenticateUser,
    requireClient,
    async (req, res) => {
        const providerId = req.params.id;

        const { rating, comment } = req.body;

        if (
            !Number.isInteger(rating) ||
            rating < 1 ||
            rating > 5
        ) {
            return res.status(400).json({
                status: "ERROR",
                message:
                    "Rating must be an integer between 1 and 5",
            });
        }

        try {
            // Confirm provider exists
            const providerResult = await pool.query(
                `
                SELECT id
                FROM service_providers
                WHERE id = $1
                `,
                [providerId],
            );

            if (providerResult.rows.length === 0) {
                return res.status(404).json({
                    status: "ERROR",
                    message: "Provider not found",
                });
            }

            // Create review
            const reviewResult = await pool.query(
                `
                INSERT INTO reviews (
                    provider_id,
                    client_id,
                    rating,
                    comment
                )
                VALUES ($1, $2, $3, $4)
                RETURNING
                    id,
                    provider_id,
                    client_id,
                    rating,
                    comment,
                    status,
                    created_at
                `,
                [
                    providerId,
                    req.user.id,
                    rating,
                    comment || null,
                ],
            );

            // Recalculate provider rating
            const ratingResult = await pool.query(
                `
                SELECT
                    ROUND(AVG(rating), 2) AS average_rating,
                    COUNT(*) AS review_count
                FROM reviews
                WHERE
                    provider_id = $1
                    AND status = 'ACTIVE'
                `,
                [providerId],
            );

            const {
                average_rating,
                review_count,
            } = ratingResult.rows[0];

            // Update provider reputation
            await pool.query(
                `
                UPDATE service_providers
                SET
                    average_rating = $1,
                    review_count = $2,
                    updated_at = NOW()
                WHERE id = $3
                `,
                [
                    average_rating || 0,
                    Number(review_count) || 0,
                    providerId,
                ],
            );

            res.status(201).json({
                status: "OK",
                message:
                    "Review submitted successfully",
                review: reviewResult.rows[0],
                provider_rating: {
                    average_rating:
                        average_rating || 0,
                    review_count:
                        Number(review_count) || 0,
                },
            });
        } catch (error) {
            // PostgreSQL unique constraint violation
            if (error.code === "23505") {
                return res.status(409).json({
                    status: "ERROR",
                    message:
                        "You have already reviewed this provider",
                });
            }

            console.error(
                "Review submission error:",
                error,
            );

            res.status(500).json({
                status: "ERROR",
                message: "Failed to submit review",
            });
        }
    },
);

// Get provider reviews
router.get(
    "/providers/:id/reviews",
    async (req, res) => {
        const providerId = req.params.id;

        try {
            const result = await pool.query(
                `
                SELECT
                    id,
                    rating,
                    comment,
                    created_at
                FROM reviews
                WHERE
                    provider_id = $1
                    AND status = 'ACTIVE'
                ORDER BY created_at DESC
                `,
                [providerId],
            );

            res.json({
                status: "OK",
                reviews: result.rows,
            });
        } catch (error) {
            console.error(
                "Reviews retrieval error:",
                error,
            );

            res.status(500).json({
                status: "ERROR",
                message: "Failed to load reviews",
            });
        }
    },
);

module.exports = router;