// Bide Hub - Supabase password recovery

const SUPABASE_URL = "https://uainkysoifpgvqxcnpde.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhaW5reXNvaWZwZ3ZxeGNwZGUiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc4OTQyMDE5MywiZXhwIjoyMTA0OTk2MTkzfQ.5mvpz4XVX64S9AwcmGeDtvynyawGEbuC0MfweNB63rM";

const recoverySupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const PRODUCTION_RESET_URL = "https://events-platform-weld.vercel.app/reset-password.html";

function setMessage(el, text, type) {
  if (!el) return;
  el.textContent = text;
  el.className = type || "";
}

function setupPasswordToggles() {
  document.querySelectorAll(".password-toggle").forEach((toggle) => {
    const activate = () => {
      const input = document.getElementById(toggle.dataset.target);
      if (!input) return;
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      toggle.setAttribute("aria-label", showing ? "Show password" : "Hide password");
    };
    toggle.addEventListener("click", activate);
    toggle.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activate();
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupPasswordToggles();

  const forgotForm = document.getElementById("forgotPasswordForm");
  if (forgotForm) setupForgotPassword(forgotForm);

  const resetForm = document.getElementById("resetPasswordForm");
  if (resetForm) setupResetPassword(resetForm);
});

function setupForgotPassword(form) {
  const email = document.getElementById("forgotPasswordEmail");
  const message = document.getElementById("forgotPasswordMessage");
  const button = document.getElementById("forgotPasswordButton");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const address = email.value.trim().toLowerCase();
    if (!address) return;

    button.disabled = true;
    button.textContent = "Sending...";

    const redirectTo =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
        ? `${window.location.origin}/reset-password.html`
        : PRODUCTION_RESET_URL;

    const { error } = await recoverySupabase.auth.resetPasswordForEmail(address, {
      redirectTo
    });

    button.disabled = false;
    button.textContent = "Send Reset Link";

    if (error) {
      setMessage(message, "We couldn't send the reset email right now. Please try again.", "error");
      console.error("Password reset request error:", error);
      return;
    }

    setMessage(
      message,
      "If an account exists for that email, we've sent you a password reset link. Check your inbox and spam folder.",
      "success"
    );
    email.value = "";
  });
}

async function setupResetPassword(form) {
  const status = document.getElementById("recoveryStatus");
  const message = document.getElementById("resetPasswordMessage");
  const button = document.getElementById("resetPasswordButton");
  const newPassword = document.getElementById("newPassword");
  const confirmPassword = document.getElementById("confirmPassword");
  let recoveryReady = false;

  const showForm = () => {
    recoveryReady = true;
    status.hidden = true;
    form.hidden = false;
  };

  const invalidLink = () => {
    recoveryReady = false;
    form.hidden = true;
    status.hidden = false;
    status.textContent = "This password reset link is invalid or has expired. Please request a new reset link.";
    status.className = "error";
  };

  recoverySupabase.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" && session) showForm();
  });

  const { data, error } = await recoverySupabase.auth.getSession();
  if (!error && data?.session) {
    showForm();
  } else {
    setTimeout(() => {
      if (!recoveryReady) invalidLink();
    }, 1500);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!recoveryReady) {
      invalidLink();
      return;
    }

    const password = newPassword.value;
    if (password.length < 8) {
      setMessage(message, "Your password must be at least 8 characters long.", "error");
      return;
    }
    if (password !== confirmPassword.value) {
      setMessage(message, "The passwords do not match.", "error");
      return;
    }

    button.disabled = true;
    button.textContent = "Updating...";

    const { error: updateError } = await recoverySupabase.auth.updateUser({ password });

    if (updateError) {
      button.disabled = false;
      button.textContent = "Update Password";
      setMessage(message, "We couldn't update your password. Please request a new reset link and try again.", "error");
      console.error("Password update error:", updateError);
      return;
    }

    setMessage(message, "Your password has been updated successfully. Redirecting you to login...", "success");
    await recoverySupabase.auth.signOut();

    setTimeout(() => {
      window.location.href = "login.html?passwordReset=success";
    }, 1200);
  });
}
