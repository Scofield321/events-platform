async function loadProviderProfile() {
  // ==========================================
  // SHOW PROFILE LOADER
  // ==========================================

  const profileLoader = document.getElementById("profileLoader");

  if (profileLoader) {
    profileLoader.innerHTML = createContentLoader(
      "Loading provider profile...",
      true,
    );

    profileLoader.style.display = "block";
  }

  try {
    // Get provider ID from URL

    const params = new URLSearchParams(window.location.search);

    const providerId = params.get("id");

    if (!providerId) {
      document.getElementById("providerName").textContent =
        "Provider not found";

      if (profileLoader) {
        profileLoader.style.display = "none";
      }

      return;
    }

    // Fetch provider

    const response = await fetch(`${API_BASE_URL}/api/providers/${providerId}`);

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Failed to load provider");
    }

    const provider = result.provider;

    // ==========================================
    // BASIC INFORMATION
    // ==========================================

    document.getElementById("providerName").innerHTML = `
      ${provider.business_name}

      ${
        provider.verification_status === "VERIFIED"
          ? `<span class="verified-badge">✓ Verified</span>`
          : ""
      }
    `;

    document.getElementById("providerLocation").textContent =
      provider.location || "Location not provided";

    document.getElementById("providerDescription").textContent =
      provider.description || "No description provided.";

    document.getElementById("providerAddress").textContent =
      provider.address || "Not provided";

    // ==========================================
    // REPUTATION
    // ==========================================

    const rating = Number(provider.average_rating || 0).toFixed(1);

    const reviewCount = provider.review_count || 0;

    const reliability = Number(provider.reliability_score || 0).toFixed(0);

    // Hero reputation
    document.getElementById("providerRating").textContent = rating;

    document.getElementById("providerReviews").textContent = reviewCount;

    document.getElementById("providerReliability").textContent =
      `${reliability}%`;

    // Reputation section
    document.getElementById("reputationRating").textContent = rating;

    document.getElementById("reputationReviews").textContent = reviewCount;

    document.getElementById("reputationReliability").textContent =
      `${reliability}%`;

    // ==========================================
    // CONTACT OPTIONS
    // ==========================================

    // CALL

    const callButton = document.getElementById("callProvider");

    if (provider.phone) {
      callButton.href = `tel:${provider.phone}`;
    } else {
      callButton.style.display = "none";
    }

    // WHATSAPP

    const whatsappButton = document.getElementById("whatsappProvider");

    if (provider.whatsapp_number) {
      const whatsappNumber = provider.whatsapp_number.replace(/\D/g, "");

      whatsappButton.href = `https://wa.me/${whatsappNumber}`;
    } else {
      whatsappButton.style.display = "none";
    }

    // WEBSITE

    const websiteButton = document.getElementById("websiteProvider");

    if (provider.website_url) {
      websiteButton.href = provider.website_url;
    } else {
      websiteButton.style.display = "none";
    }

    // INSTAGRAM

    const instagramButton = document.getElementById("instagramProvider");

    if (provider.instagram_url) {
      instagramButton.href = provider.instagram_url;
    } else {
      instagramButton.style.display = "none";
    }

    // FACEBOOK

    const facebookButton = document.getElementById("facebookProvider");

    if (provider.facebook_url) {
      facebookButton.href = provider.facebook_url;
    } else {
      facebookButton.style.display = "none";
    }

    // TIKTOK

    const tiktokButton = document.getElementById("tiktokProvider");

    if (provider.tiktok_url) {
      tiktokButton.href = provider.tiktok_url;
    } else {
      tiktokButton.style.display = "none";
    }

    // ==========================================
    // SERVICES
    // ==========================================

    loadProviderServices(provider.services);

    // ==========================================
    // MEDIA
    // ==========================================

    loadProviderMedia(provider.media);

    // ==========================================
    // REVIEWS
    // ==========================================

    loadProviderReviews(providerId);

    setupReviewForm(providerId);

    // ==========================================
    // HIDE PROFILE LOADER
    // ==========================================

    if (profileLoader) {
      profileLoader.style.display = "none";
    }
  } catch (error) {
    console.error("Provider profile error:", error);

    if (profileLoader) {
      profileLoader.innerHTML = `
        <div class="content-loader" role="alert">

          <p class="content-loader-message">
            Unable to load provider profile.
          </p>

        </div>
      `;

      profileLoader.style.display = "block";
    } else {
      document.getElementById("providerName").textContent =
        "Unable to load provider";
    }
  }
}

function loadProviderServices(services) {
  const container = document.getElementById("providerServices");

  if (!container) {
    return;
  }

  // Show loader while services are being prepared
  container.innerHTML = createInlineLoader("Loading services...");

  // No services
  if (!services || services.length === 0) {
    container.textContent = "No services listed.";
    return;
  }

  // Clear loader
  container.innerHTML = "";

  services.forEach((service) => {
    const serviceCard = document.createElement("div");

    serviceCard.className = "service-item";

    serviceCard.innerHTML = `
      <strong>
        ${service.name}
      </strong>

      <p>
        ${service.category_name}
      </p>
    `;

    container.appendChild(serviceCard);
  });
}

function loadProviderMedia(media) {
  const container = document.getElementById("providerMedia");

  if (!container) {
    return;
  }

  // Show loader while media is being prepared
  container.innerHTML = createContentLoader(
    "Loading provider portfolio...",
    true,
  );

  // No media
  if (!media || media.length === 0) {
    container.textContent = "No media uploaded.";
    return;
  }

  // Clear loader
  container.innerHTML = "";

  media.forEach((item) => {
    const mediaElement = document.createElement("div");

    mediaElement.className = "public-media-item";

    if (item.media_type === "IMAGE") {
      const image = document.createElement("img");

      image.src = item.media_url;
      image.alt = "Provider work";

      mediaElement.appendChild(image);
    }

    if (item.media_type === "VIDEO") {
      const video = document.createElement("video");

      video.src = item.media_url;
      video.controls = true;

      mediaElement.appendChild(video);
    }

    container.appendChild(mediaElement);
  });
}

async function loadProviderReviews(providerId) {
  const container = document.getElementById("providerReviewsList");

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/providers/${providerId}/reviews`,
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Failed to load reviews");
    }

    const reviews = result.reviews || [];

    container.innerHTML = "";

    if (reviews.length === 0) {
      container.innerHTML = `
                <p>
                    No reviews yet.
                </p>
            `;

      return;
    }

    reviews.forEach((review) => {
      const reviewElement = document.createElement("div");

      reviewElement.className = "review-item";

      const stars = "⭐".repeat(review.rating);

      const date = new Date(review.created_at).toLocaleDateString();

      reviewElement.innerHTML = `
                <div class="review-header">
                    <strong>
                        ${stars}
                    </strong>

                    <span>
                        ${date}
                    </span>
                </div>

                <p class="review-comment">
                    ${review.comment || "No comment provided."}
                </p>

                <small>
                    Client
                </small>
            `;

      container.appendChild(reviewElement);
    });
  } catch (error) {
    console.error("Reviews loading error:", error);

    container.innerHTML = `
            <p>
                Unable to load reviews.
            </p>
        `;
  }
}

async function setupReviewForm(providerId) {
  const reviewForm = document.getElementById("reviewFormContainer");

  const loginMessage = document.getElementById("reviewLoginMessage");

  try {
    const {
      data: { session },
      error,
    } = await supabaseClient.auth.getSession();

    if (error) {
      throw error;
    }

    // No logged-in user
    if (!session) {
      loginMessage.style.display = "block";

      return;
    }

    // Get the user's role
    const response = await fetch(`${API_BASE_URL}/api/me`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Failed to load user profile");
    }

    const user = result.user;

    // Only CLIENT accounts can review
    if (user.role === "CLIENT") {
      reviewForm.style.display = "block";

      loginMessage.style.display = "none";

      setupReviewSubmission(providerId, session);
    } else {
      reviewForm.style.display = "none";

      loginMessage.style.display = "none";
    }
  } catch (error) {
    console.error("Review form setup error:", error);
  }
}

function setupReviewSubmission(providerId, session) {
  const submitButton = document.getElementById("submitReview");

  const ratingInput = document.getElementById("reviewRating");

  const commentInput = document.getElementById("reviewComment");

  const message = document.getElementById("reviewFormMessage");

  submitButton.addEventListener("click", async () => {
    const rating = Number(ratingInput.value);

    const comment = commentInput.value.trim();

    submitButton.disabled = true;

    message.textContent = "Submitting review...";

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/providers/${providerId}/reviews`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",

            Authorization: `Bearer ${session.access_token}`,
          },

          body: JSON.stringify({
            rating,
            comment,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to submit review");
      }

      message.textContent = "Review submitted successfully!";

      commentInput.value = "";

      await loadProviderReviews(providerId);

      // Refresh provider rating
      await refreshProviderRating(providerId);
    } catch (error) {
      console.error("Review submission error:", error);

      message.textContent = error.message;
    } finally {
      submitButton.disabled = false;
    }
  });
}

async function refreshProviderRating(providerId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/providers/${providerId}`);

    const result = await response.json();

    if (!response.ok) {
      return;
    }

    const provider = result.provider;

    document.getElementById("providerRating").textContent =
      provider.average_rating || "0";

    document.getElementById("providerReviews").textContent =
      provider.review_count || "0";
  } catch (error) {
    console.error("Rating refresh error:", error);
  }
}

loadProviderProfile();
