let allProviders = [];

async function loadCategories() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/categories`);
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || "Failed to load categories");
    }
    const categoryFilter = document.getElementById("categoryFilter");

    result.categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      categoryFilter.appendChild(option);
    });
  } catch (error) {
    console.error("Categories error:", error);
  }
}


async function loadProviders(categoryId = "") {
  const providersList = document.getElementById("providersList");

  if (!providersList) {
    return;
  }

  // Show reusable loader
  providersList.innerHTML = createContentLoader(
    "Finding event professionals...",
    true
  );

  try {
    let url = `${API_BASE_URL}/api/providers`;

    if (categoryId) {
      url += `?category_id=${categoryId}`;
    }

    const response = await fetch(url);

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.message || "Failed to load providers"
      );
    }

    allProviders = result.providers || [];

    filterProviders();

  } catch (error) {
    console.error("Providers error:", error);

    providersList.innerHTML = `
      <p>
        Unable to load providers.
      </p>
    `;
  }
}


function filterProviders() {
  const searchTerm = document
    .getElementById("searchInput")
    .value.toLowerCase()
    .trim();

  const locationTerm = document
    .getElementById("locationInput")
    .value.toLowerCase()
    .trim();

  const filteredProviders = allProviders.filter((provider) => {
    // Search

    const searchableText = [
      provider.business_name,

      provider.description,

      provider.location,

      ...(provider.services || []).map((service) => service.name),

      ...(provider.services || []).map((service) => service.category_name),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch = !searchTerm || searchableText.includes(searchTerm);

    // Location

    const providerLocation = (provider.location || "").toLowerCase();

    const matchesLocation =
      !locationTerm || providerLocation.includes(locationTerm);

    return matchesSearch && matchesLocation;
  });

  displayProviders(filteredProviders);
}

function displayProviders(providers) {
  const container = document.getElementById("providersList");

  container.innerHTML = "";

  if (!providers || providers.length === 0) {
    container.innerHTML = `
            <p>
                No providers match your search.
            </p>
        `;

    return;
  }

  providers.forEach((provider) => {
    const card = document.createElement("div");

    card.className = "provider-card";

    const services = provider.services || [];

    const serviceNames = services.slice(0, 3).map((service) => service.name);

    const servicesHTML =
      serviceNames.length > 0
        ? serviceNames
            .map(
              (name) =>
                `<span class="service-tag">
                                ${name}
                            </span>`,
            )
            .join("")
        : `
                    <span class="service-tag">
                        Services not listed
                    </span>
                `;

    const imageHTML = provider.cover_image
      ? `
                    <img
                        src="${provider.cover_image}"
                        alt="${provider.business_name}"
                        class="provider-card-image"
                    >
                `
      : `
                    <div class="provider-card-placeholder">
                        No image available
                    </div>
                `;

    const rating = Number(provider.average_rating || 0).toFixed(1);

    const reliability = Number(provider.reliability_score || 0).toFixed(0);

    card.innerHTML = `

            ${imageHTML}

            <div class="provider-card-content">

                <h3 class="provider-card-name">

    ${provider.business_name}

    ${
      provider.verification_status === "VERIFIED"
        ? `<span class="verified-badge">✓ Verified</span>`
        : ""
    }

</h3>


                <p class="provider-location">
                    📍
                    ${provider.location || "Location not provided"}
                </p>


                <div class="provider-services">

                    ${servicesHTML}

                </div>


                <div class="provider-reputation">

                    <span>
                        ⭐ ${rating}
                    </span>

                    <span>
                        ${provider.review_count || 0}
                        reviews
                    </span>

                    <span>
                        Reliability ${reliability}%
                    </span>

                </div>


                <p class="provider-description">

                    ${provider.description || "No description provided."}

                </p>


                <a
                    href="provider-profile.html?id=${provider.id}"
                    class="provider-profile-button"
                >
                    View Profile
                </a>

            </div>

        `;

    container.appendChild(card);
  });
}

async function initializeProvidersPage() {
  await loadCategories();

  await loadProviders();

  const categoryFilter = document.getElementById("categoryFilter");

  const searchInput = document.getElementById("searchInput");

  const locationInput = document.getElementById("locationInput");

  categoryFilter.addEventListener("change", () => {
    loadProviders(categoryFilter.value);
  });

  searchInput.addEventListener("input", filterProviders);

  locationInput.addEventListener("input", filterProviders);
}

initializeProvidersPage();
