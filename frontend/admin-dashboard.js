async function loadAdminProviders() {
  try {
    const {
      data: { session },
      error,
    } = await supabaseClient.auth.getSession();

    if (error) {
      throw error;
    }

    if (!session) {
      window.location.href = "login.html";
      return;
    }

    const response = await fetch(`${API_BASE_URL}/api/admin/providers`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Failed to load providers");
    }

    updateAdminStatistics(result.providers);

    displayAdminProviders(result.providers);
  } catch (error) {
    console.error("Admin providers error:", error);

    document.getElementById("adminMessage").textContent = error.message;
  }
}

function displayAdminProviders(providers) {
  const container = document.getElementById("adminProvidersList");
  const message = document.getElementById("adminMessage");

  container.innerHTML = "";

  if (!providers || providers.length === 0) {
    message.textContent = "No providers found.";
    return;
  }

  message.textContent = `${providers.length} provider(s) found.`;

  providers.forEach((provider) => {
    const card = document.createElement("div");

    card.className = "admin-provider-card";

    const isVerified = provider.verification_status === "VERIFIED";

    const isSuspended = provider.account_status === "SUSPENDED";

    card.innerHTML = `
      <div>
        <h3>
          ${provider.business_name}
        </h3>

        <p>
          📍
          ${provider.location || "Location not provided"}
        </p>

        <p>
            Account Status:
            <strong>
              ${provider.account_status || "UNKNOWN"}
            </strong>
          </p>

          <p>
            Verification:
            <strong>
              ${provider.verification_status || "UNVERIFIED"}
            </strong>
        </p>

        ${
          isSuspended
            ? `
              <p>
                <strong>Account suspended</strong>
              </p>
            `
            : ""
        }
      </div>

      <div class="admin-provider-actions">

        <button
            class="admin-action-button admin-view-button"
            onclick="viewAdminProvider('${provider.id}')"
          >
            View Details
        </button>

        ${
          !isSuspended
            ? `
              <button
                class="admin-action-button admin-verify-button"
                onclick="toggleVerification(
                  '${provider.id}',
                  '${isVerified ? "UNVERIFIED" : "VERIFIED"}',
                  this
                )"
              >
                ${isVerified ? "Remove Verification" : "Verify Provider"}
              </button>

              <button
                class="admin-action-button admin-suspend-button"
                onclick="suspendProvider(
                  '${provider.id}',
                  '${provider.business_name}',
                  this
                )"
              >
                Suspend Account
              </button>
            `
            : `
              <button
                class="admin-action-button admin-activate-button"
                onclick="activateProvider(
                  '${provider.id}',
                  '${provider.business_name}',
                  this
                )"
              >
                Activate Account
              </button>
            `
        }

        <button
          class="admin-action-button admin-danger-button"
          onclick="deleteProvider(
            '${provider.id}',
            '${provider.business_name}',
            this
          )"
        >
          Delete Account
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
      error,
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
          Authorization: `Bearer ${session.access_token}`,
        },
      },
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Failed to load provider");
    }

    displayAdminProviderDetails(result.provider);
  } catch (error) {
    console.error("Admin provider details error:", error);

    alert(error.message);
  }
}

function displayAdminProviderDetails(provider) {
  let mediaHTML = "";

  if (provider.media && provider.media.length > 0) {
    provider.media.forEach((media) => {
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
    mediaHTML = "<p>No media uploaded.</p>";
  }

  let servicesHTML = "";

  if (provider.services && provider.services.length > 0) {
    servicesHTML = provider.services
      .map(
        (service) => `
                <li>
                    ${service.name}
                </li>
            `,
      )
      .join("");
  } else {
    servicesHTML = "<li>No services listed.</li>";
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
                    ${provider.description || "Not provided"}
                </p>

                <p>
                    <strong>Location:</strong>
                    ${provider.location || "Not provided"}
                </p>

                <p>
                    <strong>Address:</strong>
                    ${provider.address || "Not provided"}
                </p>

                <p>
                    <strong>Phone:</strong>
                    ${provider.phone || "Not provided"}
                </p>

                <p>
                    <strong>WhatsApp:</strong>
                    ${provider.whatsapp_number || "Not provided"}
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

  const container = document.getElementById("adminProvidersList");

  container.innerHTML = detailsHTML;

  document.getElementById("adminMessage").textContent = "Provider details";
}

function closeAdminProviderDetails() {
  loadAdminProviders();
}

async function toggleVerification(providerId, verificationStatus, button) {
  try {
    const {
      data: { session },
      error,
    } = await supabaseClient.auth.getSession();

    if (error) {
      throw error;
    }

    if (!session) {
      window.location.href = "login.html";
      return;
    }

    // Show loading state
    if (button) {
      setButtonLoading(button, "Updating...");
    }

    const response = await fetch(
      `${API_BASE_URL}/api/admin/providers/${providerId}/verification`,
      {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",

          Authorization: `Bearer ${session.access_token}`,
        },

        body: JSON.stringify({
          verification_status: verificationStatus,
        }),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.message || "Failed to update provider verification",
      );
    }

    showToast(result.message, "success");

    await loadAdminProviders();
  } catch (error) {
    console.error("Verification error:", error);

    showToast(error.message, "error");
  } finally {
    if (button) {
      resetButtonLoading(button);
    }
  }
}

// ==========================================================
// SUSPEND SERVICE PROVIDER ACCOUNT
// ==========================================================

// ==========================================================
// SUSPEND SERVICE PROVIDER ACCOUNT
// ==========================================================

async function suspendProvider(providerId, businessName, button) {
  // --------------------------------------------------------
  // Ask admin for suspension reason
  // --------------------------------------------------------

  const suspensionReason = prompt(
    `Why are you suspending ${businessName}'s account?\n\n` +
      `This reason will be shown to the provider.`,
  );

  if (suspensionReason === null) {
    return;
  }

  const trimmedReason = suspensionReason.trim();

  if (!trimmedReason) {
    showToast("A suspension reason is required.", "error");

    return;
  }

  // --------------------------------------------------------
  // Ask admin for suspension duration
  // --------------------------------------------------------

  const durationInput = prompt(
    `How many days should ${businessName}'s account be suspended?\n\n` +
      `Enter a number greater than 0.`,
  );

  if (durationInput === null) {
    return;
  }

  const durationDays = Number(durationInput);

  if (!Number.isInteger(durationDays) || durationDays <= 0) {
    showToast("Please enter a valid number of suspension days.", "error");

    return;
  }

  // --------------------------------------------------------
  // Calculate suspension end date
  // --------------------------------------------------------

  const suspendedUntil = new Date();

  suspendedUntil.setDate(suspendedUntil.getDate() + durationDays);

  // --------------------------------------------------------
  // Final confirmation
  // --------------------------------------------------------

  const confirmed = confirm(
    `Suspend ${businessName}?\n\n` +
      `Reason: ${trimmedReason}\n\n` +
      `Duration: ${durationDays} day${durationDays === 1 ? "" : "s"}\n\n` +
      `Suspension ends: ${suspendedUntil.toLocaleString()}`,
  );

  if (!confirmed) {
    return;
  }

  try {
    // ------------------------------------------------------
    // Get current session
    // ------------------------------------------------------

    const {
      data: { session },
      error,
    } = await supabaseClient.auth.getSession();

    if (error) {
      throw error;
    }

    if (!session) {
      window.location.href = "login.html";
      return;
    }

    // ------------------------------------------------------
    // Show loading state
    // ------------------------------------------------------

    if (button) {
      setButtonLoading(button, "Suspending...");
    }

    // ------------------------------------------------------
    // Send suspension request
    // ------------------------------------------------------

    const response = await fetch(
      `${API_BASE_URL}/api/admin/providers/${providerId}/suspend`,
      {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",

          Authorization: `Bearer ${session.access_token}`,
        },

        body: JSON.stringify({
          suspension_reason: trimmedReason,
          suspended_until: suspendedUntil.toISOString(),
        }),
      },
    );

    // ------------------------------------------------------
    // Safely process response
    // ------------------------------------------------------

    const contentType = response.headers.get("content-type") || "";

    let result;

    if (contentType.includes("application/json")) {
      result = await response.json();
    } else {
      const text = await response.text();

      throw new Error(text || "Server returned an unexpected response.");
    }

    if (!response.ok) {
      throw new Error(result.message || "Failed to suspend provider");
    }

    // ------------------------------------------------------
    // Success
    // ------------------------------------------------------

    showToast(
      result.message || "Provider account suspended successfully.",
      "success",
    );

    await loadAdminProviders();
  } catch (error) {
    console.error("Suspend provider error:", error);

    showToast(error.message || "Failed to suspend provider.", "error");
  } finally {
    // ------------------------------------------------------
    // Restore button
    // ------------------------------------------------------

    if (button) {
      resetButtonLoading(button);
    }
  }
}

// ==========================================================
// ACTIVATE SUSPENDED ACCOUNT
// ==========================================================

async function activateProvider(providerId, businessName, button) {
  const confirmed = confirm(`Activate ${businessName}'s account?`);

  if (!confirmed) {
    return;
  }

  try {
    // ------------------------------------------------------
    // Get current session
    // ------------------------------------------------------

    const {
      data: { session },
      error,
    } = await supabaseClient.auth.getSession();

    if (error) {
      throw error;
    }

    if (!session) {
      window.location.href = "login.html";
      return;
    }

    // ------------------------------------------------------
    // Show loading state
    // ------------------------------------------------------

    if (button) {
      setButtonLoading(button, "Activating...");
    }

    // ------------------------------------------------------
    // Send activation request
    // ------------------------------------------------------

    const response = await fetch(
      `${API_BASE_URL}/api/admin/providers/${providerId}/activate`,
      {
        method: "PUT",

        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      },
    );

    // ------------------------------------------------------
    // Safely process response
    // ------------------------------------------------------

    const contentType = response.headers.get("content-type") || "";

    let result;

    if (contentType.includes("application/json")) {
      result = await response.json();
    } else {
      const text = await response.text();

      throw new Error(text || "Server returned an unexpected response.");
    }

    if (!response.ok) {
      throw new Error(result.message || "Failed to activate provider");
    }

    // ------------------------------------------------------
    // Success
    // ------------------------------------------------------

    showToast(
      result.message || "Provider account activated successfully.",
      "success",
    );

    await loadAdminProviders();
  } catch (error) {
    console.error("Activate provider error:", error);

    showToast(error.message || "Failed to activate provider.", "error");
  } finally {
    // ------------------------------------------------------
    // Restore button
    // ------------------------------------------------------

    if (button) {
      resetButtonLoading(button);
    }
  }
}

// ==========================================================
// DELETE ACCOUNT FOR SERVICE PROVIDER
// ==========================================================

async function deleteProvider(providerId, businessName, button) {
  const confirmed = confirm(
    `PERMANENTLY DELETE ${businessName}?\n\n` +
      `This will remove the provider profile, reviews, services, media and account data.\n\n` +
      `This action cannot be undone.`,
  );

  if (!confirmed) {
    return;
  }

  try {
    // ------------------------------------------------------
    // Get current session
    // ------------------------------------------------------

    const {
      data: { session },
      error,
    } = await supabaseClient.auth.getSession();

    if (error) {
      throw error;
    }

    if (!session) {
      window.location.href = "login.html";
      return;
    }

    // ------------------------------------------------------
    // Show loading state
    // ------------------------------------------------------

    if (button) {
      setButtonLoading(button, "Deleting...");
    }

    // ------------------------------------------------------
    // Delete provider
    // ------------------------------------------------------

    const response = await fetch(
      `${API_BASE_URL}/api/admin/providers/${providerId}`,
      {
        method: "DELETE",

        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      },
    );

    // ------------------------------------------------------
    // Safely process response
    // ------------------------------------------------------

    const contentType = response.headers.get("content-type") || "";

    let result;

    if (contentType.includes("application/json")) {
      result = await response.json();
    } else {
      const text = await response.text();

      throw new Error(text || "Server returned an unexpected response.");
    }

    if (!response.ok) {
      throw new Error(result.message || "Failed to delete provider");
    }

    // ------------------------------------------------------
    // Success
    // ------------------------------------------------------

    showToast(
      result.message || "Provider account deleted successfully.",
      "success",
    );

    await loadAdminProviders();
  } catch (error) {
    console.error("Delete provider error:", error);

    showToast(error.message || "Failed to delete provider.", "error");
  } finally {
    // ------------------------------------------------------
    // Restore button
    // ------------------------------------------------------

    if (button) {
      resetButtonLoading(button);
    }
  }
}

/* ========================================
   ADMIN DASHBOARD STATISTICS
======================================== */

function updateAdminStatistics(providers) {
  const totalProviders = providers.length;

  const verifiedProviders = providers.filter(
    (provider) => provider.verification_status === "VERIFIED",
  ).length;

  const pendingProviders = providers.filter(
    (provider) => provider.verification_status !== "VERIFIED",
  ).length;

  const totalReviews = providers.reduce(
    (total, provider) => total + Number(provider.review_count || 0),
    0,
  );

  let ratingTotal = 0;

  let ratingProviders = 0;

  providers.forEach((provider) => {
    const rating = Number(provider.average_rating || 0);

    if (rating > 0) {
      ratingTotal += rating;

      ratingProviders++;
    }
  });

  const platformRating =
    ratingProviders > 0 ? (ratingTotal / ratingProviders).toFixed(1) : "0.0";

  const totalProvidersElement = document.getElementById("totalProvidersStat");

  const verifiedProvidersElement = document.getElementById(
    "verifiedProvidersStat",
  );

  const pendingProvidersElement = document.getElementById(
    "pendingProvidersStat",
  );

  const totalReviewsElement = document.getElementById("totalReviewsStat");

  const platformRatingElement = document.getElementById("platformRatingStat");

  if (totalProvidersElement) {
    totalProvidersElement.textContent = totalProviders;
  }

  if (verifiedProvidersElement) {
    verifiedProvidersElement.textContent = verifiedProviders;
  }

  if (pendingProvidersElement) {
    pendingProvidersElement.textContent = pendingProviders;
  }

  if (totalReviewsElement) {
    totalReviewsElement.textContent = totalReviews;
  }

  if (platformRatingElement) {
    platformRatingElement.textContent = platformRating;
  }
  updateAdminCategories(providers);
}

/* ========================================
   CATEGORY STATISTICS
======================================== */

function updateAdminCategories(providers) {
  const container = document.getElementById("adminCategoriesList");

  if (!container) {
    return;
  }

  const categoryCounts = {};

  providers.forEach((provider) => {
    if (!provider.services || provider.services.length === 0) {
      return;
    }

    const categoriesSeen = new Set();

    provider.services.forEach((service) => {
      const category = service.category_name;

      if (!category) {
        return;
      }

      /*
       * Count each provider only once
       * within a category.
       */

      if (categoriesSeen.has(category)) {
        return;
      }

      categoriesSeen.add(category);

      if (!categoryCounts[category]) {
        categoryCounts[category] = 0;
      }

      categoryCounts[category]++;
    });
  });

  const categories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);

  if (categories.length === 0) {
    container.innerHTML = `
            <p>
                No provider categories available yet.
            </p>
        `;

    return;
  }

  container.innerHTML = "";

  categories.forEach(([categoryName, count]) => {
    const categoryElement = document.createElement("div");

    categoryElement.className = "admin-category-item";

    categoryElement.innerHTML = `
                <span class="admin-category-name">
                    ${categoryName}
                </span>

                <div class="admin-category-count">
                    <strong>
                        ${count}
                    </strong>

                    <span>
                        provider${count === 1 ? "" : "s"}
                    </span>
                </div>
            `;
    container.appendChild(categoryElement);
  });
}

loadAdminProviders();

// ==========================================
// BIDE HUB ADMIN BOOKING INQUIRIES
// ==========================================

const INQUIRY_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUOTING",
  "AWAITING_CLIENT",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "DECLINED",
];

let adminInquiries = [];

function getInquirySession() {
  return supabaseClient.auth.getSession().then(({ data, error }) => {
    if (error) throw error;

    if (!data.session) {
      window.location.href = "login.html";
      throw new Error("Please log in to continue.");
    }

    return data.session;
  });
}

function formatInquiryDate(value) {
  if (!value) return "Not provided";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function formatInquiryAmount(value) {
  if (value === null || value === undefined || value === "") {
    return "Not set";
  }

  return `UGX ${Number(value).toLocaleString("en-UG", {
    maximumFractionDigits: 2,
  })}`;
}

function createInquiryElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;

  return element;
}

async function loadAdminInquiries() {
  const message = document.getElementById("adminInquiriesMessage");
  const container = document.getElementById("adminInquiriesList");

  if (!message || !container) return;

  message.textContent = "Loading booking inquiries...";
  container.replaceChildren();

  try {
    const session = await getInquirySession();

    const response = await fetch(
      `${API_BASE_URL}/api/admin/inquiries`,
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.message || "Unable to load booking inquiries."
      );
    }

    adminInquiries = Array.isArray(result.inquiries)
      ? result.inquiries
      : [];

    updateInquirySummary();
    displayAdminInquiries();
  } catch (error) {
    console.error("Admin inquiries error:", error);
    message.textContent =
      error.message || "Unable to load booking inquiries.";
  }
}

function updateInquirySummary() {
  const total = adminInquiries.length;

  const newCount = adminInquiries.filter(
    (item) => item.status === "NEW"
  ).length;

  const confirmedCount = adminInquiries.filter(
    (item) => item.status === "CONFIRMED"
  ).length;

  document.getElementById("totalInquiriesCount").textContent = total;
  document.getElementById("newInquiriesCount").textContent = newCount;
  document.getElementById("confirmedInquiriesCount").textContent =
    confirmedCount;
}

function displayAdminInquiries() {
  const container = document.getElementById("adminInquiriesList");
  const message = document.getElementById("adminInquiriesMessage");
  const filter = document.getElementById("inquiryStatusFilter");

  const selectedStatus = filter ? filter.value : "ALL";

  const filtered = adminInquiries.filter(
    (item) =>
      selectedStatus === "ALL" || item.status === selectedStatus
  );

  container.replaceChildren();

  if (filtered.length === 0) {
    message.textContent =
      adminInquiries.length === 0
        ? "No booking inquiries have been received yet."
        : "No inquiries match this status filter.";
    return;
  }

  message.textContent = `${filtered.length} inquiry/inquiries displayed.`;

  filtered.forEach((inquiry) => {
    container.appendChild(createInquiryCard(inquiry));
  });
}

function createInquiryCard(inquiry) {
  const card = createInquiryElement("article", "admin-inquiry-card");

  const heading = createInquiryElement(
    "div",
    "admin-inquiry-heading"
  );

  const titleGroup = createInquiryElement("div");

  titleGroup.appendChild(
    createInquiryElement(
      "h3",
      "",
      inquiry.client_name || "Unnamed client"
    )
  );

  titleGroup.appendChild(
    createInquiryElement(
      "p",
      "admin-inquiry-meta",
      `Received ${formatInquiryDate(inquiry.created_at)}`
    )
  );

  const statusBadge = createInquiryElement(
    "span",
    "admin-inquiry-status",
    String(inquiry.status || "NEW").replaceAll("_", " ")
  );

  heading.append(titleGroup, statusBadge);
  card.appendChild(heading);

  const details = createInquiryElement("div", "admin-inquiry-details");

  const detailRows = [
    ["Provider", inquiry.business_name || "Provider not found"],
    ["Phone", inquiry.client_phone || "Not provided"],
    ["Email", inquiry.client_email || "Not provided"],
    ["Event type", inquiry.event_type || "Not provided"],
    ["Event date", formatInquiryDate(inquiry.event_date)],
    ["Location", inquiry.event_location || "Not provided"],
    ["Budget", inquiry.budget_range || "Not specified"],
    ["Requirements", inquiry.requirements || "Not provided"],
  ];

  detailRows.forEach(([label, value]) => {
    const row = createInquiryElement("div", "admin-inquiry-detail-row");

    row.appendChild(createInquiryElement("strong", "", `${label}:`));
    row.appendChild(createInquiryElement("span", "", String(value)));

    details.appendChild(row);
  });

  card.appendChild(details);

  const management = createInquiryElement(
    "div",
    "admin-inquiry-management"
  );

  const statusLabel = createInquiryElement("label", "", "Inquiry status");
  const statusSelect = document.createElement("select");
  statusSelect.className = "admin-inquiry-status-select";
  statusSelect.setAttribute("aria-label", "Inquiry status");

  INQUIRY_STATUSES.forEach((status) => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = status.replaceAll("_", " ");
    option.selected = status === inquiry.status;
    statusSelect.appendChild(option);
  });

  statusLabel.appendChild(statusSelect);
  management.appendChild(statusLabel);

  function addMoneyField(labelText, value) {
    const label = createInquiryElement("label", "", labelText);
    const input = document.createElement("input");

    input.type = "number";
    input.min = "0";
    input.step = "0.01";
    input.placeholder = "Amount in UGX";
    input.value = value ?? "";
    input.className = "admin-inquiry-money-input";

    label.appendChild(input);
    management.appendChild(label);

    return input;
  }

  const quotedAmount = addMoneyField(
    "Client quotation (UGX)",
    inquiry.quoted_amount
  );

  const providerAmount = addMoneyField(
    "Provider payout (UGX)",
    inquiry.provider_amount
  );

  const commissionAmount = addMoneyField(
    "Bide Hub commission (UGX)",
    inquiry.bidehub_commission
  );

  const notesLabel = createInquiryElement(
    "label",
    "admin-inquiry-notes-label",
    "Internal admin notes"
  );

  const notes = document.createElement("textarea");
  notes.rows = 3;
  notes.maxLength = 5000;
  notes.placeholder =
    "Record client calls, provider negotiations and follow-up actions.";
  notes.value = inquiry.admin_notes || "";

  notesLabel.appendChild(notes);
  management.appendChild(notesLabel);

  const amountSummary = createInquiryElement(
    "p",
    "admin-inquiry-amount-summary"
  );

  function updateAmountSummary() {
    const clientAmount = Number(quotedAmount.value);
    const payoutAmount = Number(providerAmount.value);

    if (
      quotedAmount.value.trim() !== "" &&
      providerAmount.value.trim() !== "" &&
      clientAmount >= 0 &&
      payoutAmount >= 0
    ) {
      const difference = clientAmount - payoutAmount;

      amountSummary.textContent =
        `Quotation less provider payout: ${formatInquiryAmount(difference)}` +
        (difference < 0 ? " — check these amounts." : "");
    } else {
      amountSummary.textContent =
        "Enter a client quotation and provider payout to see the difference.";
    }
  }

  quotedAmount.addEventListener("input", updateAmountSummary);
  providerAmount.addEventListener("input", updateAmountSummary);
  updateAmountSummary();

  management.appendChild(amountSummary);

  const saveButton = createInquiryElement(
    "button",
    "admin-action-button admin-verify-button",
    "Save Changes"
  );

  saveButton.type = "button";

  saveButton.addEventListener("click", async () => {
    const quotedText = quotedAmount.value.trim();
    const providerText = providerAmount.value.trim();
    const commissionText = commissionAmount.value.trim();

    const quoted = quotedText === "" ? null : Number(quotedText);
    const payout = providerText === "" ? null : Number(providerText);
    const commission =
      commissionText === "" ? null : Number(commissionText);

    for (const [label, amount] of [
      ["Client quotation", quoted],
      ["Provider payout", payout],
      ["Bide Hub commission", commission],
    ]) {
      if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
        showToast(`${label} must be a valid non-negative amount.`, "error");
        return;
      }
    }

    if (quoted !== null && payout !== null && payout > quoted) {
      showToast(
        "Provider payout cannot exceed the client quotation.",
        "error"
      );
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
      const session = await getInquirySession();

      const response = await fetch(
        `${API_BASE_URL}/api/admin/inquiries/${inquiry.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            status: statusSelect.value,
            quoted_amount: quoted,
            provider_amount: payout,
            bidehub_commission: commission,
            admin_notes: notes.value.trim(),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Unable to save inquiry.");
      }

      showToast("Inquiry updated successfully.", "success");
      await loadAdminInquiries();
    } catch (error) {
      console.error("Save inquiry error:", error);
      showToast(error.message || "Unable to save inquiry.", "error");
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "Save Changes";
    }
  });

  management.appendChild(saveButton);
  card.appendChild(management);

  return card;
}

document
  .getElementById("refreshInquiriesButton")
  ?.addEventListener("click", loadAdminInquiries);

document
  .getElementById("inquiryStatusFilter")
  ?.addEventListener("change", displayAdminInquiries);

// Load inquiries alongside the existing provider dashboard.
loadAdminInquiries();

