async function loadAdminProviders() {
    try {
        const {
            data: { session },
            error
        } = await supabaseClient.auth.getSession();

        if (error) {
            throw error;
        }

        if (!session) {
            window.location.href = "login.html";
            return;
        }

        const response = await fetch(
            `${API_BASE_URL}/api/providers`,
            {
                headers: {
                    Authorization:
                        `Bearer ${session.access_token}`
                }
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message ||
                "Failed to load providers"
            );
        }

        displayAdminProviders(result.providers);

    } catch (error) {
        console.error(
            "Admin providers error:",
            error
        );

        document.getElementById(
            "adminMessage"
        ).textContent = error.message;
    }
}


function displayAdminProviders(providers) {
    const container =
        document.getElementById(
            "adminProvidersList"
        );

    const message =
        document.getElementById(
            "adminMessage"
        );

    container.innerHTML = "";

    if (!providers || providers.length === 0) {
        message.textContent =
            "No providers found.";
        return;
    }

    message.textContent =
        `${providers.length} provider(s) found.`;

    providers.forEach(provider => {
        const card =
            document.createElement("div");

        card.className =
            "admin-provider-card";

        const isVerified =
            provider.verification_status ===
            "VERIFIED";

        card.innerHTML = `
            <div>
                <h3>
                    ${provider.business_name}
                </h3>

                <p>
                    📍
                    ${provider.location ||
                    "Location not provided"}
                </p>

                <p>
                    Status:
                    <strong>
                        ${provider.verification_status}
                    </strong>
                </p>
            </div>

            <div class="admin-provider-actions">

                <button
                    class="admin-action-button"
                    onclick="viewAdminProvider(
                        '${provider.id}'
                    )"
                >
                    View Details
                </button>

                <button
                    class="admin-action-button"
                    onclick="toggleVerification(
                        '${provider.id}',
                        '${isVerified
                            ? "UNVERIFIED"
                            : "VERIFIED"}'
                    )"
                >
                    ${
                        isVerified
                            ? "Remove Verification"
                            : "Verify Provider"
                    }
                </button>

            </div>
        `;

        container.appendChild(card);
    });
}


async function viewAdminProvider(providerId) {
    try {
        const {
            data: { session },
            error
        } = await supabaseClient.auth.getSession();

        if (error) {
            throw error;
        }

        if (!session) {
            window.location.href = "login.html";
            return;
        }

        const response = await fetch(
            `${API_BASE_URL}/api/admin/providers/${providerId}`,
            {
                headers: {
                    Authorization:
                        `Bearer ${session.access_token}`
                }
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message ||
                "Failed to load provider"
            );
        }

        displayAdminProviderDetails(
            result.provider
        );

    } catch (error) {
        console.error(
            "Admin provider details error:",
            error
        );

        alert(error.message);
    }
}


function displayAdminProviderDetails(provider) {
    let mediaHTML = "";

    if (
        provider.media &&
        provider.media.length > 0
    ) {
        provider.media.forEach(media => {

            if (media.media_type === "IMAGE") {
                mediaHTML += `
                    <img
                        src="${media.media_url}"
                        alt="${provider.business_name}"
                        class="admin-provider-media-image"
                    >
                `;
            }

            if (media.media_type === "VIDEO") {
                mediaHTML += `
                    <video
                        src="${media.media_url}"
                        controls
                        class="admin-provider-media-video"
                    ></video>
                `;
            }

        });
    } else {
        mediaHTML =
            "<p>No media uploaded.</p>";
    }


    let servicesHTML = "";

    if (
        provider.services &&
        provider.services.length > 0
    ) {
        servicesHTML = provider.services
            .map(service => `
                <li>
                    ${service.name}
                </li>
            `)
            .join("");
    } else {
        servicesHTML =
            "<li>No services listed.</li>";
    }


    const detailsHTML = `
        <div class="admin-provider-details">

            <div class="admin-details-header">
                <h2>
                    ${provider.business_name}
                </h2>

                <button
                    class="admin-action-button"
                    onclick="closeAdminProviderDetails()"
                >
                    Close
                </button>
            </div>


            <div class="admin-provider-info">

                <p>
                    <strong>Description:</strong>
                    ${provider.description ||
                    "Not provided"}
                </p>

                <p>
                    <strong>Location:</strong>
                    ${provider.location ||
                    "Not provided"}
                </p>

                <p>
                    <strong>Address:</strong>
                    ${provider.address ||
                    "Not provided"}
                </p>

                <p>
                    <strong>Phone:</strong>
                    ${provider.phone ||
                    "Not provided"}
                </p>

                <p>
                    <strong>WhatsApp:</strong>
                    ${provider.whatsapp_number ||
                    "Not provided"}
                </p>

                <p>
                    <strong>Rating:</strong>
                    ${provider.average_rating || 0}
                    (${provider.review_count || 0} reviews)
                </p>

                <p>
                    <strong>Verification:</strong>
                    ${provider.verification_status}
                </p>

            </div>


            <div class="admin-provider-services">

                <h3>Services</h3>

                <ul>
                    ${servicesHTML}
                </ul>

            </div>


            <div class="admin-provider-media">

                <h3>Media</h3>

                <div class="admin-media-gallery">
                    ${mediaHTML}
                </div>

            </div>

        </div>
    `;


    const container =
        document.getElementById(
            "adminProvidersList"
        );

    container.innerHTML =
        detailsHTML;

    document.getElementById(
        "adminMessage"
    ).textContent =
        "Provider details";
}


function closeAdminProviderDetails() {
    loadAdminProviders();
}


async function toggleVerification(
    providerId,
    verificationStatus
) {
    try {
        const {
            data: { session },
            error
        } = await supabaseClient.auth.getSession();

        if (error) {
            throw error;
        }

        if (!session) {
            window.location.href = "login.html";
            return;
        }

        const response = await fetch(
            `${API_BASE_URL}/api/admin/providers/${providerId}/verification`,
            {
                method: "PUT",

                headers: {
                    "Content-Type":
                        "application/json",

                    Authorization:
                        `Bearer ${session.access_token}`
                },

                body: JSON.stringify({
                    verification_status:
                        verificationStatus
                })
            }
        );

        const result =
            await response.json();

        if (!response.ok) {
            throw new Error(
                result.message ||
                "Failed to update verification"
            );
        }

        alert(result.message);

        await loadAdminProviders();

    } catch (error) {
        console.error(
            "Verification error:",
            error
        );

        alert(error.message);
    }
}


loadAdminProviders();