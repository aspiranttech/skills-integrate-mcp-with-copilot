document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const searchInput = document.getElementById("search");
  const categoryFilter = document.getElementById("category-filter");
  const sortBy = document.getElementById("sort-by");
  const sortOrder = document.getElementById("sort-order");
  const teacherLoginBtn = document.getElementById("teacher-login-btn");
  const adminModal = document.getElementById("admin-modal");
  const closeAdminModal = document.getElementById("close-admin-modal");
  const teacherLoginForm = document.getElementById("teacher-login-form");
  const teacherUsernameInput = document.getElementById("teacher-username");
  const teacherPasswordInput = document.getElementById("teacher-password");

  const state = {
    teacherLoggedIn: false,
  };

  function getTeacherHeaders() {
    if (!state.teacherLoggedIn) {
      return {};
    }

    return {
      "x-teacher-username": teacherUsernameInput.value,
      "x-teacher-password": teacherPasswordInput.value,
    };
  }

  function showMessage(text, type = "success") {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  async function fetchActivities() {
    try {
      const params = new URLSearchParams();
      const categoryValue = categoryFilter.value || "all";
      const searchValue = searchInput.value.trim();
      const sortValue = sortBy.value || "name";
      const orderValue = sortOrder.value || "asc";

      if (categoryValue !== "all") {
        params.set("category", categoryValue);
      }
      if (searchValue) {
        params.set("search", searchValue);
      }
      params.set("sort", sortValue);
      params.set("order", orderValue);

      const response = await fetch(`/activities?${params.toString()}`);
      const activities = await response.json();

      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      const categorySet = new Set();
      Object.entries(activities).forEach(([name, details]) => {
        if (details.category) {
          categorySet.add(details.category);
        }
      });

      const currentCategories = Array.from(categorySet).sort();
      const currentCategoryOptions = new Set(Array.from(categoryFilter.options).map((option) => option.value));
      if (categoryFilter.children.length === 1) {
        currentCategories.forEach((category) => {
          const option = document.createElement("option");
          option.value = category;
          option.textContent = category;
          categoryFilter.appendChild(option);
        });
      }

      const selectedValue = categoryFilter.value;
      if (selectedValue && !currentCategories.includes(selectedValue) && selectedValue !== "all") {
        categoryFilter.value = "all";
      }

      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = Math.max(details.max_participants - details.participants.length, 0);
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
                <h5>Participants:</h5>
                <ul class="participants-list">
                  ${details.participants
                    .map(
                      (email) =>
                        `<li><span class="participant-email">${email}</span><button class="delete-btn" data-activity="${name}" data-email="${email}" type="button">❌</button></li>`
                    )
                    .join("")}
                </ul>
              </div>`
            : `<p><em>No participants yet</em></p>`;

        const mascotMarkup = details.mascot
          ? `<img src="${details.mascot}" alt="${name} mascot" />`
          : "";

        activityCard.innerHTML = `
          ${mascotMarkup}
          <div class="activity-meta">
            <h4>${name}</h4>
            <span class="activity-tag">${details.category || "General"}</span>
          </div>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <button class="register-btn" type="button" data-activity="${name}">Register student</button>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });

      document.querySelectorAll(".register-btn").forEach((button) => {
        button.addEventListener("click", () => {
          const activityName = button.getAttribute("data-activity");
          const email = prompt("Enter the student email to register:");
          if (!email) return;
          registerStudent(activityName, email.trim());
        });
      });
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  async function registerStudent(activity, email) {
    try {
      const headers = getTeacherHeaders();
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers,
        }
      );
      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        document.getElementById("email").value = email;
        document.getElementById("activity").value = activity;
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  }

  async function handleUnregister(event) {
    const button = event.target.closest(".delete-btn");
    if (!button) return;

    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: getTeacherHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const activity = document.getElementById("activity").value;

    await registerStudent(activity, email);
  });

  searchInput.addEventListener("input", fetchActivities);
  categoryFilter.addEventListener("change", fetchActivities);
  sortBy.addEventListener("change", fetchActivities);
  sortOrder.addEventListener("change", fetchActivities);

  teacherLoginBtn.addEventListener("click", () => {
    adminModal.classList.remove("hidden");
    adminModal.setAttribute("aria-hidden", "false");
  });

  closeAdminModal.addEventListener("click", () => {
    adminModal.classList.add("hidden");
    adminModal.setAttribute("aria-hidden", "true");
  });

  adminModal.addEventListener("click", (event) => {
    if (event.target === adminModal) {
      adminModal.classList.add("hidden");
      adminModal.setAttribute("aria-hidden", "true");
    }
  });

  teacherLoginForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const username = teacherUsernameInput.value.trim();
    const password = teacherPasswordInput.value.trim();

    if (!username || !password) {
      showMessage("Please enter your teacher username and password.", "error");
      return;
    }

    state.teacherLoggedIn = true;
    teacherLoginBtn.textContent = `Logged in as ${username}`;
    adminModal.classList.add("hidden");
    adminModal.setAttribute("aria-hidden", "true");
    teacherLoginForm.reset();
    showMessage(`Teacher ${username} logged in.`, "success");
  });

  fetchActivities();
});
