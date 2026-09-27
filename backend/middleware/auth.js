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

        // Verify Supabase authentication token
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
        // Check Bide Hub account status
        // --------------------------------------------------

        const result = await pool.query(
            `
            SELECT
                id,
                role,
                status
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
        // Suspended account
        // --------------------------------------------------

        if (dbUser.status === "SUSPENDED") {
            return res.status(403).json({
                status: "ERROR",
                message:
                    "Your Bide Hub account has been suspended. Please contact Bide Hub support.",
            });
        }

        // --------------------------------------------------
        // Attach authenticated user + DB information
        // --------------------------------------------------

        req.user = {
            ...user,
            role: dbUser.role,
            status: dbUser.status,
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