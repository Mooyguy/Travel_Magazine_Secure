// Admin dashboard DOM references
const loginForm = document.getElementById("admin-login");
const statusEl = document.getElementById("admin-status");
const dataPanel = document.getElementById("admin-data");
const logoutBtn = document.getElementById("logout-btn");
const tableBody = document.getElementById("admin-table-body");

// Display login / error feedback messages
const setStatus = (message, isError = false) => {
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.style.color = isError ? "#dc2626" : "#0f1724";
    }
};

// Render registration rows in the admin table
const renderRows = (rows = []) => {
    if (!tableBody) return;
    tableBody.innerHTML = rows
        .map(
            (row) => `
      <tr data-id="${row.id}"
          data-full-name="${row.full_name}"
          data-sex="${row.sex}"
          data-phone="${row.phone}"
          data-email="${row.email}"
          data-destination="${row.destination}"
          data-city="${row.city}"
          data-persons="${row.persons}"
          data-travel-time="${row.travel_time}"
          data-message="${row.message || ""}">
        <td>${row.id}</td>
        <td>${row.full_name}</td>
        <td>${row.sex}</td>
        <td>${row.phone}</td>
        <td>${row.email}</td>
        <td>${row.destination}</td>
        <td>${row.city}</td>
        <td>${row.persons}</td>
        <td>${new Date(row.travel_time).toLocaleString()}</td>
        <td>${row.message || ""}</td>
        <td>${new Date(row.created_at).toLocaleString()}</td>
        <td>
            <button class="secondary-btn edit-btn" type="button">Edit</button>
            <button class="danger-btn delete-btn" type="button">Delete</button>
        </td>
      </tr>`
        )
        .join("");
};

// Fetch registrations from the backend API
const loadRegistrations = async () => {
    const response = await fetch("/api/admin/registrations", {
        credentials: "include"
    });

    if (!response.ok) {
        throw new Error("Unable to load registrations.");
    }

    const payload = await response.json();
    renderRows(payload.data || []);
};

// Determine whether the admin is already logged in
const checkSession = async () => {
    const response = await fetch("/api/admin/me", {
        credentials: "include"
    });

    if (response.ok) {
        dataPanel?.classList.remove("hidden");
        loginForm?.classList.add("hidden");
        await loadRegistrations();
    }
};

// Handle admin login form submission
loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("");

    const formData = new FormData(loginForm);
    const payload = {
        username: formData.get("username"),
        password: formData.get("password")
    };

    const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setStatus(data.message || "Login failed.", true);
        return;
    }

    loginForm.reset();
    loginForm.classList.add("hidden");
    dataPanel?.classList.remove("hidden");
    await loadRegistrations();
});

// Handle admin logout
logoutBtn?.addEventListener("click", async () => {
    await fetch("/api/admin/logout", {
        method: "POST",
        credentials: "include"
    });
    dataPanel?.classList.add("hidden");
    loginForm?.classList.remove("hidden");
    setStatus("Logged out.");
});

// Handle edit/delete actions via event delegation
tableBody?.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const row = target.closest("tr");
    if (!row) return;

    const id = row.dataset.id;
    if (!id) return;

    if (target.classList.contains("delete-btn")) {
        if (!confirm("Delete this registration?")) return;

        const response = await fetch(`/api/admin/registrations/${id}`, {
            method: "DELETE",
            credentials: "include"
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            setStatus(data.message || "Delete failed.", true);
            return;
        }
        setStatus("Registration deleted.");
        await loadRegistrations();
        return;
    }

    if (target.classList.contains("edit-btn")) {
        const promptField = (label, value) => {
            const result = prompt(label, value ?? "");
            return result === null ? null : result.trim();
        };

        const updated = {
            fullName: promptField("Full name:", row.dataset.fullName),
            sex: promptField("Sex (female/male/nonbinary/prefer-not):", row.dataset.sex),
            phone: promptField("Phone (+CCC-123-123-1234):", row.dataset.phone),
            email: promptField("Email:", row.dataset.email),
            destination: promptField("Destination Country:", row.dataset.destination),
            city: promptField("City:", row.dataset.city),
            persons: promptField("Number of persons (1-20):", row.dataset.persons),
            travelTime: promptField("Travel time (YYYY-MM-DDTHH:mm):", row.dataset.travelTime),
            message: promptField("Message:", row.dataset.message)
        };

        if (Object.values(updated).some((value) => value === null)) {
            return;
        }

        const response = await fetch(`/api/admin/registrations/${id}`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include",
                body: JSON.stringify(updated)
            }
        );

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            setStatus(data.message || "Update failed.", true);
            return;
        }

        await loadRegistrations();
    }
});

// Auto-check session when the page loads
checkSession().catch(() => undefined);
