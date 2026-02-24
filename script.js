// Toggle dark mode theme
const toggle = document.getElementById("darkToggle");
if (toggle) {
    toggle.addEventListener("change", () => document.body.classList.toggle("dark"));
}

// Mobile navigation toggle handling
const navToggle = document.querySelector(".nav-toggle");
const header = document.querySelector(".site-header");
const navLinks = document.querySelectorAll(".site-nav a");

if (navToggle && header) {
    navToggle.addEventListener("click", () => {
        const isOpen = header.classList.toggle("nav-open");
        navToggle.setAttribute("aria-expanded", String(isOpen));
    });

    navLinks.forEach((link) => {
        link.addEventListener("click", () => {
            if (window.innerWidth <= 600) {
                header.classList.remove("nav-open");
                navToggle.setAttribute("aria-expanded", "false");
            }
        });
    });
}

// Sections that will be populated with the shared registration form
const tourSections = document.querySelectorAll(".tour-register");

// Shared form template injected into each article page
const tourFormTemplate = (destination, title, note, headingId) => `
    <h2 id="${headingId}">${title}</h2>
    <p class="form-note">${note}</p>
    <form class="tour-form" data-destination="${destination}" novalidate>
        <div class="form-grid">
            <label>
                Full name
                <input type="text" name="fullName" required minlength="2" maxlength="60" autocomplete="name"
                    placeholder="Enter your full name">
            </label>
            <label>
                Sex
                <select name="sex" required>
                    <option value="" disabled selected>Select your sex</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="nonbinary">Non-binary</option>
                    <option value="prefer-not">Prefer not to say</option>
                </select>
            </label>
            <label>
                Phone number
                <input type="tel" name="phone" required inputmode="tel"
                    pattern="^\\+\\d{1,3}-\\d{3}-\\d{3}-\\d{4}$" placeholder="+234-801-234-5678"
                    title="Format: +234-801-234-5678">
            </label>
            <label>
                Email address
                <input type="email" name="email" required autocomplete="email" placeholder="you@example.com">
            </label>
            <label>
                Destination Country
                <input type="text" name="destination" readonly placeholder="Destination country">
            </label>
            <label>
                City
                <input type="text" name="city" required minlength="2" maxlength="60" autocomplete="address-level2"
                    placeholder="Enter city">
            </label>
            <label>
                Number of persons
                <input type="number" name="persons" min="1" max="20" step="1" required
                    placeholder="1 to 20">
            </label>
            <label>
                Preferred travel time
                <input type="datetime-local" name="travelTime" required placeholder="Select date & time">
            </label>
            <label class="full">
                Any other message
                <textarea name="message" rows="4" maxlength="500"
                    placeholder="Dietary needs, accessibility requests, or pickup notes."></textarea>
            </label>
        </div>
        <button type="submit" class="primary-btn">Submit registration</button>
        <p class="form-status" role="status" aria-live="polite"></p>
    </form>
`;

// Inject the form into each tour section and configure heading metadata
tourSections.forEach((section) => {
    const destination = section.dataset.destination || "Tour";
    const title = section.dataset.title || `Register for the ${destination} tour`;
    const note = section.dataset.note || "Share your travel details to reserve your spot.";
    const sectionId = section.id || destination.toLowerCase().replace(/\s+/g, "-");
    const headingId = `${sectionId}-title`;

    section.id = sectionId;
    section.setAttribute("aria-labelledby", headingId);
    section.innerHTML = tourFormTemplate(destination, title, note, headingId);
});

// Attach validation + submission handlers to each generated form
const tourForms = document.querySelectorAll(".tour-form");

// Helper to show validation feedback styling
const setFormStatus = (statusEl, message, type = "info") => {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.remove("is-error", "is-success");
    if (type === "error") statusEl.classList.add("is-error");
    if (type === "success") statusEl.classList.add("is-success");
};

tourForms.forEach((form) => {
    const status = form.querySelector(".form-status");
    const destinationInput = form.querySelector('input[name="destination"]');
    const destination = form.dataset.destination;
    const phoneInput = form.querySelector('input[name="phone"]');
    const phoneRegex = /^\+\d{1,3}-\d{3}-\d{3}-\d{4}$/;
    // Format input to +CCC-123-123-1234 as the user types
    const formatPhoneNumber = (value) => {
        const digits = value.replace(/\D/g, "");
        if (!digits) {
            return "";
        }
        const maxDigits = digits.slice(0, 13);
        const countryLength = Math.max(1, Math.min(3, maxDigits.length - 10));
        const country = maxDigits.slice(0, countryLength);
        const local = maxDigits.slice(countryLength);
        const part1 = local.slice(0, 3);
        const part2 = local.slice(3, 6);
        const part3 = local.slice(6, 10);
        let formatted = `+${country}`;
        if (part1) {
            formatted += `-${part1}`;
        }
        if (part2) {
            formatted += `-${part2}`;
        }
        if (part3) {
            formatted += `-${part3}`;
        }
        return formatted;
    };

    // Pre-fill the destination field
    if (destinationInput && destination) {
        destinationInput.value = destination;
    }

    // Validate and submit registration to the backend
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        form.classList.add("was-validated");

        if (!form.checkValidity()) {
            if (status) {
                setFormStatus(status, "Please complete the required fields with valid details.", "error");
            }
            return;
        }

        const formData = new FormData(form);
        const name = (formData.get("fullName") || "Traveler").toString().trim();
        const destinationName = (formData.get("destination") || destination || "the tour").toString().trim();

        const payload = {
            fullName: formData.get("fullName"),
            sex: formData.get("sex"),
            phone: formData.get("phone"),
            email: formData.get("email"),
            destination: formData.get("destination"),
            city: formData.get("city"),
            persons: formData.get("persons"),
            travelTime: formData.get("travelTime"),
            message: formData.get("message")
        };

        try {
            const response = await fetch("/api/registrations", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || "Submission failed.");
            }

            if (status) {
                setFormStatus(status, `Thanks ${name}! Your request for ${destinationName} was sent.`, "success");
            }

            form.reset();
            if (destinationInput && destination) {
                destinationInput.value = destination;
            }
            form.classList.remove("was-validated");
            setTimeout(() => {
                window.location.href = "index.html";
            }, 800);
        } catch (error) {
            if (status) {
                setFormStatus(status, error.message || "Submission failed. Please try again.", "error");
            }
        }
    });

    // Clear status message while editing
    form.addEventListener("input", () => {
        if (status) {
            setFormStatus(status, "");
        }
    });

    // Keep phone input formatted + validated
    if (phoneInput) {
        phoneInput.addEventListener("input", () => {
            const formatted = formatPhoneNumber(phoneInput.value);
            phoneInput.value = formatted;
            if (phoneInput.value && !phoneRegex.test(phoneInput.value)) {
                phoneInput.setCustomValidity("Use the format +234-801-234-5678.");
            } else {
                phoneInput.setCustomValidity("");
            }
        });
    }
});