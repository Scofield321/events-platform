const API_BASE_URL = "https://events-platform-ym0v.onrender.com";

const SUPABASE_URL = "https://uainkysoifpgvqxcnpde.supabase.co";

const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhaW5reXNvaWZwZ3ZxeGNucGRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0MjAxOTMsImV4cCI6MjEwNDk5NjE5M30.5mvpz4XVX64S9AwcmGeDtvynyawGEbuC0MfweNB63rM";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
);

window.currentProviderUser = {};
window.currentProviderServices = [];
window.currentProviderMedia = [];

console.log("Supabase connected:", supabaseClient);

/* ========================================
   REUSABLE LOADING SYSTEM
======================================== */


/**
 * Creates a spinner element.
 */
function createLoaderSpinner() {
    const spinner = document.createElement("span");

    spinner.className = "loader-spinner";

    spinner.setAttribute("aria-hidden", "true");

    return spinner;
}

function showToast(message, type = "success") {
    const existingToast =
        document.getElementById("appToast");

    if (existingToast) {
        existingToast.remove();
    }

    const toast =
        document.createElement("div");

    toast.id = "appToast";
    toast.className =
        `app-toast app-toast-${type}`;

    const icon =
        type === "success"
            ? "✓"
            : type === "error"
                ? "!"
                : "i";

    toast.innerHTML = `
        <span class="app-toast-icon">
            ${icon}
        </span>

        <span class="app-toast-message">
            ${message}
        </span>
    `;

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    setTimeout(() => {
        toast.classList.remove("show");

        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3500);
}

/**
 * Returns HTML for a content loader.
 *
 * Example:
 *
 * element.innerHTML = createContentLoader("Loading providers...");
 */
function createContentLoader(message = "Loading...") {
    return `
        <div class="content-loader" role="status">

            <span
                class="loader-spinner"
                aria-hidden="true"
            ></span>

            <p class="content-loader-message">
                ${message}
            </p>

        </div>
    `;
}


/**
 * Returns HTML for a small inline loader.
 *
 * Example:
 *
 * element.innerHTML = createInlineLoader("Loading...");
 */
function createInlineLoader(message = "Loading...") {
    return `
        <span class="inline-loader" role="status">

            <span
                class="loader-spinner"
                aria-hidden="true"
            ></span>

            <span class="inline-loader-message">
                ${message}
            </span>

        </span>
    `;
}


/**
 * Sets a button into loading state.
 *
 * Example:
 *
 * setButtonLoading(button, "Saving...");
 */
function setButtonLoading(button, message = "Loading...") {
    if (!button) {
        return;
    }

    // Save the original button content
    if (!button.dataset.originalContent) {
        button.dataset.originalContent = button.innerHTML;
    }

    button.disabled = true;

    button.classList.add("is-loading");

    button.innerHTML = `
        <span class="button-loader">

            <span
                class="loader-spinner"
                aria-hidden="true"
            ></span>

            <span>
                ${message}
            </span>

        </span>
    `;
}


/**
 * Restores a button after loading.
 *
 * Example:
 *
 * resetButtonLoading(button);
 */
function resetButtonLoading(button) {
    if (!button) {
        return;
    }

    button.disabled = false;

    button.classList.remove("is-loading");

    if (button.dataset.originalContent) {
        button.innerHTML = button.dataset.originalContent;

        delete button.dataset.originalContent;
    }
}


/**
 * Shows a full-page loading overlay.
 *
 * Example:
 *
 * showPageLoader("Loading your dashboard...");
 */
function showPageLoader(message = "Loading...") {
    // Prevent duplicate loaders
    if (document.getElementById("pageLoader")) {
        return;
    }

    const loader = document.createElement("div");

    loader.id = "pageLoader";

    loader.className = "page-loader";

    loader.innerHTML = `
        <div
            class="page-loader-content"
            role="status"
            aria-live="polite"
        >

            <span
                class="loader-spinner"
                aria-hidden="true"
            ></span>

            <p class="page-loader-message">
                ${message}
            </p>

        </div>
    `;

    document.body.appendChild(loader);
}


/**
 * Removes the full-page loading overlay.
 */
function hidePageLoader() {
    const loader = document.getElementById("pageLoader");

    if (loader) {
        loader.remove();
    }
}

// ======================================================
// PROVIDER REGISTRATION
// ======================================================

const registerForm = document.getElementById("registerForm");

if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const businessName = document
      .getElementById("businessName")
      .value.trim();

    const email = document
      .getElementById("email")
      .value.trim();

    const phone = document
      .getElementById("phone")
      .value.trim();

    const location = document
      .getElementById("location")
      .value.trim();

    const password =
      document.getElementById("password").value;

    const message =
      document.getElementById("registerMessage");

    const registerButton =
      document.getElementById("registerButton");

    message.textContent =
      "Creating your account...";

    try {
      // Show loading state
      setButtonLoading(
        registerButton,
        "Creating account..."
      );

      // 1. Create account in Supabase Auth
      const { data, error } =
        await supabaseClient.auth.signUp({
          email: email,
          password: password,
        });

      if (error) {
        throw error;
      }

      const authUser = data.user;

      if (!authUser) {
        throw new Error(
          "User account was not created."
        );
      }

      console.log(
        "Auth user created:",
        authUser.id
      );

      // 2. Create provider profile
      const response = await fetch(
        `${API_BASE_URL}/api/providers/register`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            user_id: authUser.id,
            email: email,
            phone: phone,
            business_name: businessName,
            location: location,
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ||
          "Failed to create provider profile."
        );
      }

      message.textContent =
        "Account created successfully! Redirecting...";

      window.location.href =
        "provider-dashboard.html";

    } catch (error) {
      console.error(
        "Registration error:",
        error
      );

      message.textContent =
        error.message;

    } finally {
      resetButtonLoading(
        registerButton
      );
    }
  });
}


// ======================================================
// LOGIN
// ======================================================

const loginForm =
  document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const email =
        document
          .getElementById("loginEmail")
          .value.trim();

      const password =
        document.getElementById(
          "loginPassword"
        ).value;

      const message =
        document.getElementById(
          "loginMessage"
        );

      const loginButton =
        document.getElementById(
          "loginButton"
        );

      message.textContent =
        "Logging in...";

      try {
        // Show loading state
        setButtonLoading(
          loginButton,
          "Logging in..."
        );

        // Authenticate with Supabase
        const { data, error } =
          await supabaseClient.auth
            .signInWithPassword({
              email: email,
              password: password,
            });

        if (error) {
          throw error;
        }

        console.log(
          "Logged in user:",
          data.user
        );

        // Get platform profile and role
        const response =
          await fetch(
            `${API_BASE_URL}/api/me`,
            {
              method: "GET",

              headers: {
                Authorization:
                  `Bearer ${data.session.access_token}`,
              },
            }
          );

        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(
            result.message ||
            "Failed to load user profile."
          );
        }

        const user =
          result.user;

        console.log(
          "Logged in role:",
          user.role
        );

        // Redirect based on role
        if (user.role === "ADMIN") {
          window.location.href =
            "admin-dashboard.html";

        } else if (
          user.role === "PROVIDER"
        ) {
          window.location.href =
            "provider-dashboard.html";

        } else if (
          user.role === "CLIENT"
        ) {
          window.location.href =
            "providers.html";

        } else {
          throw new Error(
            "Your account has an unsupported role."
          );
        }

      } catch (error) {
        console.error(
          "Login error:",
          error
        );

        message.textContent =
          error.message;

      } finally {
        resetButtonLoading(
          loginButton
        );
      }
    }
  );
}


// ======================================================
// GET MY PROFILE
// ======================================================

async function getMyProfile() {
  try {
    const {
      data: { session },
      error,
    } = await supabaseClient.auth.getSession();

    if (error) {
      throw error;
    }

    if (!session) {
      console.log("No logged-in session.");

      return;
    }

    console.log("Access token found.");

    const response = await fetch(`${API_BASE_URL}/api/me`, {
      method: "GET",

      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const result = await response.json();

    console.log("My profile:", result);
  } catch (error) {
    console.error("Could not retrieve profile:", error);
  }
}

getMyProfile();

// ======================================================
// PROVIDER DASHBOARD
// ======================================================

const dashboardPage = document.getElementById("welcomeMessage");

if (dashboardPage) {
  loadProviderDashboard();
  loadProviderServices();
  loadProviderMedia();
}

// ======================================================
// LOAD PROVIDER DASHBOARD
// ======================================================

async function loadProviderDashboard() {
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

    const response = await fetch(`${API_BASE_URL}/api/me`, {
      method: "GET",

      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Failed to load profile");
    }

    const user = result.user;

    // Provider-only dashboard
    if (user.role !== "PROVIDER") {
      window.location.href = "login.html";

      return;
    }

    // Save user globally
    // for profile completion
    window.currentProviderUser = user;

    // Public profile button
    const viewProfileButton = document.getElementById("viewProfileButton");

    if (viewProfileButton && user.provider_id) {
      viewProfileButton.href = `provider-profile.html?id=${user.provider_id}`;
    }

    // Populate profile form
    const businessNameInput = document.getElementById("profileBusinessName");

    if (businessNameInput) {
      businessNameInput.value = user.business_name || "";
    }

    const emailInput = document.getElementById("profileEmail");

    if (emailInput) {
      emailInput.value = user.email || "";
    }

    const phoneInput = document.getElementById("profilePhone");

    if (phoneInput) {
      phoneInput.value = user.phone || "";
    }

    const locationInput = document.getElementById("profileLocation");

    if (locationInput) {
      locationInput.value = user.location || "";
    }

    const addressInput = document.getElementById("profileAddress");

    if (addressInput) {
      addressInput.value = user.address || "";
    }

    const descriptionInput = document.getElementById("profileDescription");

    if (descriptionInput) {
      descriptionInput.value = user.description || "";
    }

    const websiteInput = document.getElementById("profileWebsite");

    if (websiteInput) {
      websiteInput.value = user.website_url || "";
    }

    const whatsappInput = document.getElementById("profileWhatsapp");

    if (whatsappInput) {
      whatsappInput.value = user.whatsapp_number || "";
    }

    const instagramInput = document.getElementById("profileInstagram");

    if (instagramInput) {
      instagramInput.value = user.instagram_url || "";
    }

    const facebookInput = document.getElementById("profileFacebook");

    if (facebookInput) {
      facebookInput.value = user.facebook_url || "";
    }

    const tiktokInput = document.getElementById("profileTiktok");

    if (tiktokInput) {
      tiktokInput.value = user.tiktok_url || "";
    }

    // Welcome message
    const welcomeMessage = document.getElementById("welcomeMessage");

    if (welcomeMessage) {
      welcomeMessage.textContent = `Welcome, ${user.business_name}`;
    }

    // Reputation
    const rating = document.getElementById("rating");

    if (rating) {
      rating.textContent = user.average_rating || "0";
    }

    const reviews = document.getElementById("reviews");

    if (reviews) {
      reviews.textContent = user.review_count || "0";
    }

    const reliability = document.getElementById("reliability");

    if (reliability) {
      reliability.textContent = user.reliability_score || "0";
    }

    // Update readiness
    updateProfileCompletion(
      user,
      window.currentProviderServices || [],
      window.currentProviderMedia || [],
    );
  } catch (error) {
    console.error("Dashboard error:", error);
  }
}

// ======================================================
// PROFILE COMPLETION
// ======================================================

function updateProfileCompletion() {
  const user = window.currentProviderUser || {};
  const services = window.currentProviderServices || [];
  const media = window.currentProviderMedia || [];

  let completed = 0;

  // Business information
  if (user.business_name && user.business_name.trim()) {
    completed += 15;
  }

  if (user.phone && user.phone.trim()) {
    completed += 10;
  }

  if (user.location && user.location.trim()) {
    completed += 10;
  }

  if (user.address && user.address.trim()) {
    completed += 10;
  }

  if (user.description && user.description.trim()) {
    completed += 15;
  }

  // Online/contact presence
  if (
    (user.website_url && user.website_url.trim()) ||
    (user.whatsapp_number && user.whatsapp_number.trim()) ||
    (user.instagram_url && user.instagram_url.trim()) ||
    (user.facebook_url && user.facebook_url.trim()) ||
    (user.tiktok_url && user.tiktok_url.trim())
  ) {
    completed += 10;
  }

  // Services
  if (services.length > 0) {
    completed += 15;
  }

  // Images
  const images = media.filter((item) => item.media_type === "IMAGE");

  if (images.length > 0) {
    completed += 10;
  }

  // Video
  const videos = media.filter((item) => item.media_type === "VIDEO");

  if (videos.length > 0) {
    completed += 5;
  }

  // Update progress bar
  const completionText = document.getElementById("profileCompletion");

  const completionBar = document.getElementById("profileCompletionBar");

  const completionMessage = document.getElementById("profileCompletionMessage");

  if (completionText) {
    completionText.textContent = `${completed}%`;
  }

  if (completionBar) {
    completionBar.style.width = `${completed}%`;
  }

  if (completionMessage) {
    if (completed === 100) {
      completionMessage.textContent = "Your profile is complete. Great job!";
    } else if (completed >= 75) {
      completionMessage.textContent =
        "Your profile is looking good. Add a few more details to make it stronger.";
    } else if (completed >= 50) {
      completionMessage.textContent =
        "You're halfway there. Complete more of your profile to build trust with clients.";
    } else {
      completionMessage.textContent =
        "Complete your profile so clients can better understand and trust your business.";
    }
  }
}

// ======================================================
// LOGOUT
// ======================================================

const logoutButton = document.getElementById("logoutButton");

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      console.error("Logout error:", error);

      return;
    }

    window.location.href = "login.html";
  });
}

// ======================================================
// LOAD PROVIDER SERVICES
// ======================================================

async function loadProviderServices() {
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

    // Get all available services
    const servicesResponse = await fetch(`${API_BASE_URL}/api/services`);

    const servicesResult = await servicesResponse.json();

    if (!servicesResponse.ok) {
      throw new Error(servicesResult.message || "Failed to load services.");
    }

    // Get provider's selected services
    const myServicesResponse = await fetch(
      `${API_BASE_URL}/api/providers/services`,
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      },
    );

    const myServicesResult = await myServicesResponse.json();

    if (!myServicesResponse.ok) {
      throw new Error(
        myServicesResult.message || "Failed to load your services.",
      );
    }

    // IDs of selected services
    const selectedServiceIds = myServicesResult.services.map(
      (service) => service.id,
    );

    // Full selected service objects
    const selectedServices = servicesResult.services.filter((service) =>
      selectedServiceIds.includes(service.id),
    );

    // Save globally
    window.currentProviderServices = selectedServices;

    // Display services
    const servicesList = document.getElementById("servicesList");

    if (servicesList) {
      servicesList.innerHTML = "";

      servicesResult.services.forEach((service) => {
        const label = document.createElement("label");

        label.className = "service-option";

        const checkbox = document.createElement("input");

        checkbox.type = "checkbox";

        checkbox.value = service.id;

        checkbox.checked = selectedServiceIds.includes(service.id);

        label.appendChild(checkbox);

        label.appendChild(
          document.createTextNode(
            ` ${service.name} (${service.category_name})`,
          ),
        );

        servicesList.appendChild(label);

        servicesList.appendChild(document.createElement("br"));
      });
    }

    // Update readiness
    updateProfileCompletion(
      window.currentProviderUser,
      window.currentProviderServices,
      window.currentProviderMedia || [],
    );
  } catch (error) {
    console.error("Services loading error:", error);
  }
}

// ======================================================
// SAVE PROVIDER SERVICES
// ======================================================

const saveServicesButton = document.getElementById("saveServicesButton");

if (saveServicesButton) {
  saveServicesButton.addEventListener("click", saveProviderServices);
}

async function saveProviderServices() {
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

    const checkboxes = document.querySelectorAll(
      "#servicesList input[type='checkbox']",
    );

    const selectedServiceIds = Array.from(checkboxes)
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => checkbox.value);

    const response = await fetch(
      `${API_BASE_URL}/api/providers/services`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          Authorization: `Bearer ${session.access_token}`,
        },

        body: JSON.stringify({
          service_ids: selectedServiceIds,
        }),
      },
    );

    const result = await response.json();

    const message = document.getElementById("servicesMessage");

    if (!response.ok) {
      throw new Error(result.message || "Failed to save services.");
    }

    if (message) {
      message.textContent = "Services saved successfully!";
    }

    await loadProviderServices();
  } catch (error) {
    console.error("Save services error:", error);

    const message = document.getElementById("servicesMessage");

    if (message) {
      message.textContent = error.message;
    }
  }
}

// ======================================================
// SAVE PROVIDER PROFILE
// ======================================================

const profileForm = document.getElementById("profileForm");

if (profileForm) {
  profileForm.addEventListener("submit", saveProviderProfile);
}

async function saveProviderProfile(event) {
  event.preventDefault();

  const message = document.getElementById("profileMessage");

  if (message) {
    message.textContent = "Saving profile...";
  }

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

    const profileData = {
      business_name: document
        .getElementById("profileBusinessName")
        .value.trim(),

      phone: document.getElementById("profilePhone").value.trim(),

      location: document.getElementById("profileLocation").value.trim(),

      address: document.getElementById("profileAddress").value.trim(),

      description: document.getElementById("profileDescription").value.trim(),

      website_url: document.getElementById("profileWebsite").value.trim(),

      whatsapp_number: document.getElementById("profileWhatsapp").value.trim(),

      instagram_url: document.getElementById("profileInstagram").value.trim(),

      facebook_url: document.getElementById("profileFacebook").value.trim(),

      tiktok_url: document.getElementById("profileTiktok").value.trim(),
    };

    const response = await fetch(
      `${API_BASE_URL}/api/providers/profile`,
      {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",

          Authorization: `Bearer ${session.access_token}`,
        },

        body: JSON.stringify(profileData),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Failed to update profile");
    }

    if (message) {
      message.textContent = "Profile updated successfully!";
    }

    await loadProviderDashboard();

    // Recalculate readiness
    updateProfileCompletion(
      window.currentProviderUser,
      window.currentProviderServices || [],
      window.currentProviderMedia || [],
    );
  } catch (error) {
    console.error("Profile update error:", error);

    if (message) {
      message.textContent = error.message;
    }
  }
}

// ======================================================
// PROVIDER MEDIA UPLOAD
// ======================================================

async function uploadProviderMedia(file, mediaType) {
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

    const userId = session.user.id;

    const fileExtension = file.name.split(".").pop();

    const fileName = `${userId}/${Date.now()}.${fileExtension}`;

    // Upload file
    const { error: uploadError } = await supabaseClient.storage
      .from("provider-media")
      .upload(fileName, file);

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: publicUrlData } = supabaseClient.storage
      .from("provider-media")
      .getPublicUrl(fileName);

    const mediaUrl = publicUrlData.publicUrl;

    // Save media record in backend
    const response = await fetch(`${API_BASE_URL}/api/providers/media`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",

        Authorization: `Bearer ${session.access_token}`,
      },

      body: JSON.stringify({
        media_type: mediaType,

        media_url: mediaUrl,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Failed to save media");
    }

    return result;
  } catch (error) {
    console.error("Media upload error:", error);

    throw error;
  }
}

// ======================================================
// UPLOAD IMAGES
// ======================================================

const uploadImagesButton = document.getElementById("uploadImagesButton");

const imageInput = document.getElementById("imageUpload");

const imageDropzone = document.getElementById("imageDropzone");

const imagePreview = document.getElementById("imagePreview");

const imageCountLabel = document.getElementById("imageCountLabel");

let selectedImageFiles = [];

if (uploadImagesButton) {
  uploadImagesButton.addEventListener("click", uploadProviderImages);
}

if (imageInput) {
  imageInput.addEventListener("change", () => {
    selectedImageFiles = Array.from(imageInput.files);

    renderImagePreview();
  });
}

function renderImagePreview() {
  if (!imagePreview) {
    return;
  }

  imagePreview.innerHTML = "";

  if (selectedImageFiles.length === 0) {
    return;
  }

  selectedImageFiles.forEach((file, index) => {
    const reader = new FileReader();

    reader.onload = function (event) {
      const item = document.createElement("div");

      item.className = "media-preview-item";

      item.innerHTML = `
                    <img
                        src="${event.target.result}"
                        alt="Photo preview"
                    >

                    <button
                        type="button"
                        class="media-preview-remove"
                        data-index="${index}"
                    >
                        ×
                    </button>
                `;

      item
        .querySelector(".media-preview-remove")
        .addEventListener("click", () => {
          selectedImageFiles = selectedImageFiles.filter(
            (_, fileIndex) => fileIndex !== index,
          );

          renderImagePreview();
        });

      imagePreview.appendChild(item);
    };

    reader.readAsDataURL(file);
  });

  if (imageCountLabel) {
    imageCountLabel.textContent = `${selectedImageFiles.length} / 4`;
  }
}

async function uploadProviderImages() {
  const message = document.getElementById("mediaMessage");

  if (selectedImageFiles.length === 0) {
    message.textContent = "Please select at least one photo.";

    return;
  }

  if (selectedImageFiles.length > 4) {
    message.textContent = "You can upload a maximum of 4 photos.";

    return;
  }

  try {
    message.textContent = "Uploading photos...";

    uploadImagesButton.disabled = true;

    for (const file of selectedImageFiles) {
      await uploadProviderMedia(file, "IMAGE");
    }

    message.textContent = "Photos uploaded successfully!";

    selectedImageFiles = [];

    if (imageInput) {
      imageInput.value = "";
    }

    renderImagePreview();

    await loadProviderMedia();
  } catch (error) {
    message.textContent = error.message;
  } finally {
    uploadImagesButton.disabled = false;
  }
}

async function uploadProviderImages() {
  const input = document.getElementById("imageUpload");

  const message = document.getElementById("mediaMessage");

  if (!input || !message) {
    return;
  }

  const files = Array.from(input.files);

  if (files.length === 0) {
    message.textContent = "Please select at least one photo.";

    return;
  }

  if (files.length > 4) {
    message.textContent = "You can upload a maximum of 4 photos.";

    return;
  }

  try {
    message.textContent = "Uploading photos...";

    for (const file of files) {
      await uploadProviderMedia(file, "IMAGE");
    }

    message.textContent = "Photos uploaded successfully!";

    input.value = "";

    await loadProviderMedia();
  } catch (error) {
    message.textContent = error.message;
  }
}

// ======================================================
// UPLOAD VIDEO
// ======================================================

const uploadVideoButton = document.getElementById("uploadVideoButton");

const videoInput = document.getElementById("videoUpload");

const videoDropzone = document.getElementById("videoDropzone");

const videoPreview = document.getElementById("videoPreview");

if (uploadVideoButton) {
  uploadVideoButton.addEventListener("click", uploadProviderVideo);
}

if (videoInput) {
  videoInput.addEventListener("change", previewSelectedVideo);
}

function previewSelectedVideo() {
  if (!videoPreview) {
    return;
  }

  videoPreview.innerHTML = "";

  const file = videoInput.files[0];

  if (!file) {
    return;
  }

  const videoUrl = URL.createObjectURL(file);

  const video = document.createElement("video");

  video.src = videoUrl;

  video.controls = true;

  video.preload = "metadata";

  videoPreview.appendChild(video);
}

async function uploadProviderVideo() {
  const message = document.getElementById("mediaMessage");

  const file = videoInput.files[0];

  if (!file) {
    message.textContent = "Please select a video.";

    return;
  }

  try {
    message.textContent = "Uploading video...";

    uploadVideoButton.disabled = true;

    await uploadProviderMedia(file, "VIDEO");

    message.textContent = "Video uploaded successfully!";

    videoInput.value = "";

    videoPreview.innerHTML = "";

    await loadProviderMedia();
  } catch (error) {
    message.textContent = error.message;
  } finally {
    uploadVideoButton.disabled = false;
  }
}

// ======================================================
// DRAG & DROP MEDIA
// ======================================================

function setupMediaDropzone(dropzone, input, fileHandler) {
  if (!dropzone || !input) {
    return;
  }

  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();

    dropzone.classList.add("drag-over");
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("drag-over");
  });

  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();

    dropzone.classList.remove("drag-over");

    const files = Array.from(event.dataTransfer.files);

    fileHandler(files);
  });
}

setupMediaDropzone(imageDropzone, imageInput, (files) => {
  const imageFiles = files.filter((file) => file.type.startsWith("image/"));

  selectedImageFiles = imageFiles.slice(0, 4);

  renderImagePreview();
});

setupMediaDropzone(videoDropzone, videoInput, (files) => {
  const videoFile = files.find((file) => file.type.startsWith("video/"));

  if (!videoFile) {
    return;
  }

  const dataTransfer = new DataTransfer();

  dataTransfer.items.add(videoFile);

  videoInput.files = dataTransfer.files;

  previewSelectedVideo();
});

// ======================================================
// LOAD PROVIDER MEDIA
// ======================================================

async function loadProviderMedia() {
  try {
    const {
      data: { session },
      error,
    } = await supabaseClient.auth.getSession();

    if (error) {
      throw error;
    }

    if (!session) {
      return;
    }

    const response = await fetch(`${API_BASE_URL}/api/providers/media`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || "Failed to load media.");
    }
    // Save media globally
    window.currentProviderMedia = result.media;

    renderProviderMedia(result.media);

    // Update readiness
    updateProfileCompletion(
      window.currentProviderUser,
      window.currentProviderServices || [],
      window.currentProviderMedia,
    );
  } catch (error) {
    console.error("Media loading error:", error);
  }
}

function renderProviderMedia(media) {
  const mediaGallery = document.getElementById("mediaGallery");

  if (!mediaGallery) {
    return;
  }

  mediaGallery.innerHTML = "";

  if (!media || media.length === 0) {
    mediaGallery.innerHTML = `
            <p class="empty-media-message">
                You haven't uploaded any media yet.
            </p>
        `;

    return;
  }

  media.forEach((item) => {
    const mediaItem = document.createElement("div");

    mediaItem.className = "media-item";

    // -----------------------------
    // IMAGE
    // -----------------------------

    if (item.media_type === "IMAGE") {
      const image = document.createElement("img");

      image.src = item.media_url;

      image.alt = "Business photo";

      mediaItem.appendChild(image);
    }

    // -----------------------------
    // VIDEO
    // -----------------------------

    if (item.media_type === "VIDEO") {
      const video = document.createElement("video");

      video.src = item.media_url;

      video.controls = true;

      mediaItem.appendChild(video);
    }

    // -----------------------------
    // DELETE BUTTON
    // -----------------------------

    const deleteButton = document.createElement("button");

    deleteButton.type = "button";

    deleteButton.className = "media-delete-button";

    deleteButton.textContent = "Delete";

    deleteButton.addEventListener("click", () => {
      deleteProviderMedia(item.id);
    });

    mediaItem.appendChild(deleteButton);

    // Add card to gallery
    mediaGallery.appendChild(mediaItem);
  });
}

async function deleteProviderMedia(mediaId) {
  const message = document.getElementById("mediaMessage");

  const confirmed = window.confirm(
    "Are you sure you want to delete this media?",
  );

  if (!confirmed) {
    return;
  }

  try {
    if (message) {
      message.textContent = "Deleting media...";
    }

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
      `${API_BASE_URL}/api/providers/media/${mediaId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      },
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Failed to delete media");
    }

    if (message) {
      message.textContent = "Media deleted successfully.";
    }

    // Refresh gallery
    await loadProviderMedia();
  } catch (error) {
    console.error("Delete provider media error:", error);

    if (message) {
      message.textContent = error.message;
    }
  }
}

// ======================================================
// LANDING PAGE — FEATURED PROVIDERS
// ======================================================

async function loadFeaturedProviders() {
  const featuredProvidersList = document.getElementById(
    "featuredProvidersList",
  );

  if (!featuredProvidersList) {
    return;
  }

  try {

    featuredProvidersList.innerHTML = createContentLoader(
        "Loading providers..."
    );
    const response = await fetch(`${API_BASE_URL}/api/providers`);

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Failed to load providers.");
    }

    const providers = result.providers || [];

    // Sort by rating first,
    // then by number of reviews.
    providers.sort((a, b) => {
      const ratingDifference =
        Number(b.average_rating || 0) - Number(a.average_rating || 0);

      if (ratingDifference !== 0) {
        return ratingDifference;
      }

      return Number(b.review_count || 0) - Number(a.review_count || 0);
    });

    // Show maximum 6 providers
    const featuredProviders = providers.slice(0, 6);

    if (featuredProviders.length === 0) {
      featuredProvidersList.innerHTML = `
        <p class="featured-loading">
          No providers available yet.
        </p>
      `;

      return;
    }

    featuredProvidersList.innerHTML = "";

    featuredProviders.forEach((provider) => {
      const card = document.createElement("div");

      card.className = "featured-provider-card";

      const rating = Number(provider.average_rating || 0).toFixed(1);

      const reviewCount = Number(provider.review_count || 0);

      // Provider cover image
      const imageHTML = provider.cover_image
        ? `
          <img
            src="${provider.cover_image}"
            alt="${provider.business_name}"
            class="featured-provider-image"
          >
        `
        : `
          <div class="featured-provider-placeholder">
            ${getProviderInitial(provider.business_name)}
          </div>
        `;

      // Provider services
      const servicesHTML =
        provider.services && provider.services.length > 0
          ? provider.services
              .slice(0, 3)
              .map((service) => service.name)
              .join(" • ")
          : "Event Services";

      // Verification badge
      const verifiedHTML =
        provider.verification_status === "VERIFIED"
          ? `
            <span class="verified-badge">
              ✓ Verified
            </span>
          `
          : "";

      card.innerHTML = `

        <div class="featured-provider-image-container">

          ${imageHTML}

        </div>

        <div class="featured-provider-content">

          <div class="featured-provider-name-row">

            <h3>
              ${provider.business_name}
            </h3>

            ${verifiedHTML}

          </div>

          <p class="featured-provider-services">
            ${servicesHTML}
          </p>

          <p class="featured-provider-location">
            📍 ${provider.location || "Location not specified"}
          </p>

          <div class="featured-provider-rating">

            <span class="rating-stars">
              ★
            </span>

            <strong>
              ${rating}
            </strong>

            <span>
              (${reviewCount} reviews)
            </span>

          </div>

          <a
            href="provider-profile.html?id=${provider.id}"
            class="featured-provider-button"
          >
            View Profile
          </a>

        </div>
      `;

      featuredProvidersList.appendChild(card);
    });
  } catch (error) {
    console.error("Featured providers error:", error);

    featuredProvidersList.innerHTML = `
      <p class="featured-loading">
        Unable to load providers right now.
      </p>
    `;
  }
}

// ======================================================
// PROVIDER INITIAL
// ======================================================

function getProviderInitial(businessName) {
  if (!businessName) {
    return "P";
  }

  return businessName.trim().charAt(0).toUpperCase();
}

loadFeaturedProviders();

fetch("footer.html")
  .then((response) => response.text())
  .then((data) => {
    document.getElementById("footer").innerHTML = data;
  });
