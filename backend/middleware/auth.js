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
        // VERIFY SUPABASE AUTHENTICATION TOKEN
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
        // GET BIDE HUB ACCOUNT INFORMATION
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
        // HANDLE SUSPENDED ACCOUNTS
        // --------------------------------------------------
        //
        // IMPORTANT:
        //
        // ADMIN accounts are allowed through even if their
        // account status is SUSPENDED.
        //
        // This prevents the administrator from locking
        // themselves out of the admin dashboard.
        //
        // Suspended PROVIDERS and other non-admin users
        // remain blocked.
        // --------------------------------------------------

        if (
            dbUser.status === "SUSPENDED" &&
            dbUser.role !== "ADMIN"
        ) {

            // --------------------------------------------------
            // SUSPENSION HAS EXPIRED
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
                // SUSPENSION IS STILL ACTIVE
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
        // ATTACH AUTHENTICATED USER + DATABASE INFORMATION
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