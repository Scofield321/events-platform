const supabase = require("../config/supabase");
const pool = require("../config/database");

async function authenticateUser(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                status: "ERROR",
                message: "Authorization token is required",
            });
        }

        const token = authHeader.replace("Bearer ", "");

        if (!token) {
            return res.status(401).json({
                status: "ERROR",
                message: "Invalid authorization token",
            });
        }

        // --------------------------------------------------
        // Verify Supabase authentication token
        // --------------------------------------------------

        const {
            data: { user },
            error,
        } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({
                status: "ERROR",
                message: "Invalid or expired token",
            });
        }

        // --------------------------------------------------
        // Get Bide Hub account information
        // --------------------------------------------------

        const result = await pool.query(
            `
            SELECT
                id,
                role,
                status,
                suspension_reason,
                suspended_until
            FROM users
            WHERE id = $1
            `,
            [user.id],
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                status: "ERROR",
                message: "User account not found",
            });
        }

        const dbUser = result.rows[0];

        // --------------------------------------------------
        // Check suspended account
        // --------------------------------------------------

        if (dbUser.status === "SUSPENDED") {

            // --------------------------------------------------
            // Suspension has expired
            // --------------------------------------------------

            if (
                dbUser.suspended_until &&
                new Date(dbUser.suspended_until) <= new Date()
            ) {

                await pool.query(
                    `
                    UPDATE users

                    SET
                        status = 'ACTIVE',
                        suspension_reason = NULL,
                        suspended_until = NULL,
                        updated_at = NOW()

                    WHERE id = $1
                    `,
                    [user.id],
                );

                dbUser.status = "ACTIVE";
                dbUser.suspension_reason = null;
                dbUser.suspended_until = null;

            } else {

                // --------------------------------------------------
                // Suspension is still active
                // --------------------------------------------------

                return res.status(403).json({
                    status: "SUSPENDED",

                    message:
                        "Your Bide Hub account has been temporarily suspended.",

                    suspension: {
                        reason:
                            dbUser.suspension_reason ||
                            "No suspension reason was provided.",

                        suspended_until:
                            dbUser.suspended_until,
                    },
                });
            }
        }

        // --------------------------------------------------
        // Attach authenticated user + DB information
        // --------------------------------------------------

        req.user = {
            ...user,

            role: dbUser.role,

            status: dbUser.status,

            suspension_reason:
                dbUser.suspension_reason,

            suspended_until:
                dbUser.suspended_until,
        };

        next();

    } catch (error) {

        console.error(
            "Authentication error:",
            error,
        );

        return res.status(500).json({
            status: "ERROR",
            message: "Authentication failed",
        });
    }
}

module.exports = authenticateUser;