const supabase = require("../config/supabase");

async function authenticateUser(req, res, next) {

    try {

        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                status: "ERROR",
                message: "Authorization token is required"
            });
        }

        const token = authHeader.replace("Bearer ", "");

        if (!token) {
            return res.status(401).json({
                status: "ERROR",
                message: "Invalid authorization token"
            });
        }

        const {
            data: { user },
            error
        } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({
                status: "ERROR",
                message: "Invalid or expired token"
            });
        }

        // Attach authenticated user to request
        req.user = user;

        next();

    } catch (error) {

        console.error("Authentication error:", error);

        return res.status(500).json({
            status: "ERROR",
            message: "Authentication failed"
        });

    }
}

module.exports = authenticateUser;