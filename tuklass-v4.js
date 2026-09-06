(function () {
    "use strict";

    const APPS_SCRIPT_URL =
        "https://script.google.com/macros/s/AKfycbybWxbR34bbA6VlAbaI1qBn21iCqisr0-Mww6WzTVxUZdTJ-q7-jPP2TfZ3XrO5uMXVgw/exec";

    function getUser() {
        try {
            const raw = localStorage.getItem("writejotUser");
            return raw ? JSON.parse(raw) : null;
        }
        catch {
            return null;
        }
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function escapeJs(value) {
        return String(value || "")
            .replace(/\\/g, "\\\\")
            .replace(/'/g, "\\'");
    }

    function todayValue() {
        const d = new Date();
        return [
            d.getFullYear(),
            String(d.getMonth() + 1).padStart(2, "0"),
            String(d.getDate()).padStart(2, "0")
        ].join("-");
    }

    async function fetchJson(url, options, timeoutMs) {
        const controller = new AbortController();
        const timer = setTimeout(function () {
            controller.abort();
        }, timeoutMs || 9000);

        try {
            const response = await fetch(
                url,
                Object.assign({}, options || {}, {
                    signal: controller.signal
                })
            );

            if (!response.ok) {
                throw new Error("Server returned " + response.status);
            }

            return await response.json();
        }
        finally {
            clearTimeout(timer);
        }
    }

    async function postJson(payload, timeoutMs) {
        return fetchJson(
            APPS_SCRIPT_URL,
            {
                method: "POST",
                headers: {
                    "Content-Type": "text/plain;charset=utf-8"
                },
                body: JSON.stringify(payload)
            },
            timeoutMs || 12000
        );
    }

    /* =====================================================
       ACCOUNT CREATION MODAL
    ===================================================== */

    function renderModalGoogleButton() {
        const target = document.getElementById("googleLoginModal");
        if (!target) return;

        if (
            !window.google ||
            !google.accounts ||
            !google.accounts.id
        ) {
            target.textContent = "Loading Google...";
            setTimeout(renderModalGoogleButton, 250);
            return;
        }

        target.innerHTML = "";

        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse
        });

        google.accounts.id.renderButton(
            target,
            {
                theme: "outline",
                size: "large",
                text: "signup_with",
                shape: "rectangular",
                width: 280
            }
        );
    }

    window.openCreateAccountModal = function () {
        const modal = document.getElementById("createAccountModal");
        if (!modal) return;
        modal.hidden = false;
        document.body.classList.add("modal-open");
        renderModalGoogleButton();
    };

    window.closeCreateAccountModal = function () {
        const modal = document.getElementById("createAccountModal");
        if (!modal) return;
        modal.hidden = true;
        document.body.classList.remove("modal-open");
    };

    /* =====================================================
       SEARCHABLE SECTION PICKER
    ===================================================== */

    window.initializeSchoolSetup = function () {
        const schoolSearch = document.getElementById("schoolSearch");
        const sectionSearch = document.getElementById("sectionSearch");
        const sectionId = document.getElementById("sectionSelect");

        if (!schoolSearch || !sectionSearch || !sectionId) return;

        schoolSearch.addEventListener("input", function () {
            document.getElementById("schoolIdInput").value = "";
            setupPreferredSchoolId = "";
            setupPreferredClassId = "";
            sectionSearch.value = "";
            sectionSearch.disabled = true;
            sectionId.value = "";
            const sectionOptions = document.getElementById("sectionOptions");
            if (sectionOptions) sectionOptions.hidden = true;
            renderSchoolOptions(schoolSearch.value);
        });

        schoolSearch.addEventListener("focus", function () {
            renderSchoolOptions(schoolSearch.value);
        });

        sectionSearch.addEventListener("input", function () {
            sectionId.value = "";
            setupPreferredClassId = "";
            renderSectionOptions(sectionSearch.value);
        });

        sectionSearch.addEventListener("focus", function () {
            if (!sectionSearch.disabled) {
                renderSectionOptions(sectionSearch.value);
            }
        });

        document.addEventListener("click", function (event) {
            const schoolPicker = document.querySelector(".setup-school-picker");
            const sectionPicker = document.querySelector(".setup-section-picker");

            if (schoolPicker && !schoolPicker.contains(event.target)) {
                const options = document.getElementById("schoolOptions");
                if (options) options.hidden = true;
            }

            if (sectionPicker && !sectionPicker.contains(event.target)) {
                const options = document.getElementById("sectionOptions");
                if (options) options.hidden = true;
            }
        });

        loadTuklassSchools();
    };

    window.loadTuklassClasses = async function (schoolId, preferredClassId) {
        const search = document.getElementById("sectionSearch");
        const hidden = document.getElementById("sectionSelect");
        const message = document.getElementById("classMessage");
        const options = document.getElementById("sectionOptions");

        if (!search || !hidden) return;

        search.value = "";
        hidden.value = "";
        search.disabled = true;
        if (options) options.hidden = true;
        if (message) message.textContent = "Loading sections...";

        try {
            const result = await fetchJson(
                APPS_SCRIPT_URL +
                "?action=classes&schoolId=" +
                encodeURIComponent(schoolId),
                {cache: "no-store"},
                9000
            );

            if (!result.success) {
                throw new Error(result.error || "Could not load sections.");
            }

            tuklassSetupClasses = Array.isArray(result.classes)
                ? result.classes
                : [];

            search.disabled = !tuklassSetupClasses.length;

            if (preferredClassId) {
                chooseSection(preferredClassId);
            }
            else if (message) {
                message.textContent = tuklassSetupClasses.length
                    ? "Type to search your section."
                    : "No sections are available for this school yet.";
            }
        }
        catch (error) {
            if (message) {
                message.textContent = "Could not load sections for this school.";
            }
        }
    };

    function renderSectionOptions(query) {
        const options = document.getElementById("sectionOptions");
        if (!options) return;

        const wanted = String(query || "").trim().toLowerCase();
        const matches = (tuklassSetupClasses || [])
            .filter(function (classInfo) {
                return !wanted ||
                    String(classInfo.section || "")
                        .toLowerCase()
                        .includes(wanted);
            })
            .slice(0, 12);

        options.innerHTML = "";
        options.hidden = false;

        if (!matches.length) {
            options.innerHTML = '<div class="setup-school-empty">No matching sections</div>';
            return;
        }

        matches.forEach(function (classInfo) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "setup-school-option";
            button.textContent = classInfo.section;
            button.addEventListener("click", function () {
                chooseSection(classInfo.classId);
            });
            options.appendChild(button);
        });
    }

    function chooseSection(classId) {
        const classInfo = (tuklassSetupClasses || []).find(function (item) {
            return String(item.classId) === String(classId);
        });

        if (!classInfo) return;

        setupPreferredClassId = classInfo.classId;
        document.getElementById("sectionSelect").value = classInfo.classId;
        document.getElementById("sectionSearch").value = classInfo.section;

        const options = document.getElementById("sectionOptions");
        if (options) options.hidden = true;

        const message = document.getElementById("classMessage");
        if (message) message.textContent = "Section selected.";
    }

    window.chooseSection = chooseSection;

    /* =====================================================
       QUICK CREATE
    ===================================================== */

    window.toggleQuickCreateMenu = function () {
        const menu = document.getElementById("quickCreateMenu");
        if (!menu) return;
        menu.hidden = !menu.hidden;
    };

    window.quickCreateTuklass = function (type) {
        try {
            sessionStorage.setItem("tuklass_quick_create", type);
        }
        catch {}

        const targets = {
            event: 'a.sidebar-link[data-page="calendar"]',
            reminder: 'a.sidebar-link[data-page="reminders"]',
            collection: 'a.sidebar-link[data-page="catalog"]'
        };

        const link = document.querySelector(targets[type] || "");
        if (link) {
            link.click();
        }
    };

    /* =====================================================
       LOGOUT CONFIRMATION
    ===================================================== */

    function ensureLogoutModal() {
        if (document.getElementById("logoutConfirmModal")) return;

        const modal = document.createElement("div");
        modal.id = "logoutConfirmModal";
        modal.className = "logout-confirm-modal";
        modal.hidden = true;
        modal.innerHTML = `
            <button class="logout-confirm-backdrop" type="button" aria-label="Cancel" onclick="closeTuklassLogoutConfirm()"></button>
            <div class="logout-confirm-card" role="dialog" aria-modal="true" aria-labelledby="logoutConfirmTitle">
                <h2 id="logoutConfirmTitle">Log out of Tuklass?</h2>
                <p>You will need to continue with Google again to get back into your account.</p>
                <div class="logout-confirm-actions">
                    <button type="button" class="secondary-action" onclick="closeTuklassLogoutConfirm()">Cancel</button>
                    <button type="button" class="danger-action" onclick="confirmTuklassLogout()">Log out</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    window.requestTuklassLogout = function () {
        ensureLogoutModal();
        const modal = document.getElementById("logoutConfirmModal");
        modal.hidden = false;
        document.body.classList.add("modal-open");
    };

    window.closeTuklassLogoutConfirm = function () {
        const modal = document.getElementById("logoutConfirmModal");
        if (modal) modal.hidden = true;
        document.body.classList.remove("modal-open");
    };

    window.confirmTuklassLogout = function () {
        window.closeTuklassLogoutConfirm();
        if (typeof logout === "function") logout();
    };

    /* =====================================================
       CALENDAR V4
    ===================================================== */

    window.TuklassCalendar = (function () {
        let user = null;
        let data = null;
        let shownMonth = new Date();
        let selectedDate = todayValue();
        let filters = new Set(["classes", "class-events", "personal-default"]);

        shownMonth.setDate(1);

        function renderShell() {
            const root = document.querySelector(".route-calendar");
            if (!root) return;

            root.innerHTML = `
                <div class="route-head calendar-v4-head">
                    <div>
                        <div class="route-kicker">Calendar</div>
                        <h1>Calendar</h1>
                        <p>See your class schedule, class events, and personal calendars together.</p>
                    </div>
                    <button class="calendar-primary-create" type="button" onclick="openV4EventComposer()">Create event</button>
                </div>

                <div id="calendarV4Status" class="calendar-v4-status">Loading calendar...</div>

                <div class="calendar-v4-shell">
                    <aside class="calendar-v4-sidebar">
                        <button class="calendar-all-button active" type="button" onclick="showAllV4Calendars()">All calendars</button>

                        <div class="calendar-filter-title">Calendars</div>
                        <div id="calendarFilterList"></div>

                        <button class="calendar-new-list" type="button" onclick="openV4CalendarCreator()">+ New calendar</button>
                    </aside>

                    <main class="calendar-v4-main">
                        <div class="calendar-v4-toolbar">
                            <div class="calendar-v4-nav">
                                <button type="button" onclick="moveV4CalendarMonth(-1)" aria-label="Previous month">‹</button>
                                <button type="button" onclick="goV4CalendarToday()">Today</button>
                                <button type="button" onclick="moveV4CalendarMonth(1)" aria-label="Next month">›</button>
                            </div>
                            <h2 id="calendarV4MonthTitle"></h2>
                        </div>
                        <div class="calendar-v4-weekdays">
                            <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                        </div>
                        <div id="calendarV4Grid" class="calendar-v4-grid"></div>
                    </main>

                    <aside class="calendar-day-panel">
                        <div class="calendar-day-panel-head">
                            <div>
                                <span id="selectedDayWeekday" class="calendar-selected-weekday"></span>
                                <h2 id="selectedDayTitle"></h2>
                            </div>
                            <button type="button" class="calendar-day-add" onclick="openV4EventComposer()">+ Add</button>
                        </div>
                        <div id="selectedDayItems" class="calendar-day-items"></div>
                    </aside>
                </div>

                <div id="v4EventModal" class="calendar-modal" hidden>
                    <button type="button" class="calendar-modal-backdrop" aria-label="Close" onclick="closeV4EventComposer()"></button>
                    <div class="calendar-modal-card">
                        <div class="calendar-modal-head">
                            <h2>New event</h2>
                            <button type="button" onclick="closeV4EventComposer()">Close</button>
                        </div>
                        <label><span>Title</span><input id="v4EventTitle" type="text" maxlength="100" placeholder="Event title"></label>
                        <div class="calendar-modal-row">
                            <label><span>Date</span><input id="v4EventDate" type="date"></label>
                            <label><span>Calendar</span><select id="v4EventCalendar"></select></label>
                        </div>
                        <div class="calendar-modal-row">
                            <label><span>Start</span><input id="v4EventStart" type="time"></label>
                            <label><span>End</span><input id="v4EventEnd" type="time"></label>
                        </div>
                        <label><span>Description</span><textarea id="v4EventDescription" maxlength="500" placeholder="Optional"></textarea></label>
                        <div id="v4EventMessage" class="form-message"></div>
                        <button type="button" class="calendar-save-event" onclick="saveV4Event()">Save event</button>
                    </div>
                </div>

                <div id="v4CalendarModal" class="calendar-modal" hidden>
                    <button type="button" class="calendar-modal-backdrop" aria-label="Close" onclick="closeV4CalendarCreator()"></button>
                    <div class="calendar-modal-card calendar-list-modal-card">
                        <div class="calendar-modal-head">
                            <h2>New calendar</h2>
                            <button type="button" onclick="closeV4CalendarCreator()">Close</button>
                        </div>
                        <label><span>Name</span><input id="v4CalendarName" type="text" maxlength="40" placeholder="Study, Family, Projects..."></label>
                        <span class="calendar-color-label">Color</span>
                        <div id="v4CalendarColors" class="calendar-color-choices"></div>
                        <input id="v4CalendarColor" type="hidden" value="#f4511e">
                        <div id="v4CalendarMessage" class="form-message"></div>
                        <button type="button" class="calendar-save-event" onclick="saveV4Calendar()">Create calendar</button>
                    </div>
                </div>
            `;

            renderColorChoices();
        }

        async function init() {
            user = getUser();
            renderShell();
            if (!user) return;

            const quick = sessionStorage.getItem("tuklass_quick_create");
            if (quick === "event") {
                sessionStorage.removeItem("tuklass_quick_create");
                const select = document.getElementById("v4EventCalendar");
                if (select) {
                    select.innerHTML = '<option value="personal-default">Personal</option>';
                }
                setTimeout(openEventComposer, 40);
            }

            try {
                const result = await fetchJson(
                    APPS_SCRIPT_URL +
                    "?action=calendarStatus&email=" +
                    encodeURIComponent(user.email),
                    {cache: "no-store"},
                    10000
                );

                if (!result.success) {
                    throw new Error(result.error || "Calendar could not load.");
                }

                data = result;
                ensureFilters();
                renderEverything();
                setStatus("");

            }
            catch (error) {
                setStatus(
                    error.name === "AbortError"
                        ? "Calendar took too long to load. Try again."
                        : (error.message || "Calendar could not load."),
                    true
                );
            }
        }

        function setStatus(message, error) {
            const box = document.getElementById("calendarV4Status");
            if (!box) return;
            box.textContent = message || "";
            box.className = "calendar-v4-status" + (error ? " error" : "");
            box.hidden = !message;
        }

        function ensureFilters() {
            const all = ["classes", "class-events"]
                .concat((data.personalCalendars || []).map(function (c) { return c.calendarId; }));
            all.forEach(function (id) { filters.add(id); });
        }

        function renderEverything() {
            renderFilters();
            renderMonth();
            renderDayPanel();
            renderCalendarSelect();
        }

        function renderFilters() {
            const box = document.getElementById("calendarFilterList");
            if (!box) return;

            const builtIns = [
                {id: "classes", name: "Class schedule", color: "#1a73e8", locked: true},
                {id: "class-events", name: "Class events", color: "#7e57c2", locked: true}
            ];

            const personal = (data.personalCalendars || []).map(function (c) {
                return {
                    id: c.calendarId,
                    name: c.name,
                    color: c.color || "#34a853",
                    locked: c.builtIn === true
                };
            });

            box.innerHTML = builtIns.concat(personal).map(function (item) {
                return `
                    <div class="calendar-filter-row">
                        <button type="button" class="calendar-filter-toggle ${filters.has(item.id) ? "on" : ""}" onclick="toggleV4CalendarFilter('${escapeJs(item.id)}')">
                            <span class="calendar-filter-dot" style="--calendar-color:${escapeHtml(item.color)}"></span>
                            <span>${escapeHtml(item.name)}</span>
                        </button>
                        ${(!item.locked && item.id !== "personal-default") ? `<button type="button" class="calendar-filter-delete" title="Delete calendar" onclick="deleteV4Calendar('${escapeJs(item.id)}')">×</button>` : ""}
                    </div>
                `;
            }).join("");
        }

        function renderMonth() {
            if (!data) return;
            const title = document.getElementById("calendarV4MonthTitle");
            const grid = document.getElementById("calendarV4Grid");
            if (!title || !grid) return;

            title.textContent = shownMonth.toLocaleDateString(undefined, {month: "long", year: "numeric"});
            grid.innerHTML = "";

            const year = shownMonth.getFullYear();
            const month = shownMonth.getMonth();
            const first = new Date(year, month, 1).getDay();
            const total = Math.ceil((first + new Date(year, month + 1, 0).getDate()) / 7) * 7;

            for (let i = 0; i < total; i++) {
                const d = new Date(year, month, i - first + 1);
                const date = [d.getFullYear(), String(d.getMonth() + 1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-");
                const cell = document.createElement("button");
                cell.type = "button";
                cell.className = "calendar-v4-day";
                if (d.getMonth() !== month) cell.classList.add("other-month");
                if (date === todayValue()) cell.classList.add("today");
                if (date === selectedDate) cell.classList.add("selected");
                cell.addEventListener("click", function () {
                    selectedDate = date;
                    if (d.getMonth() !== shownMonth.getMonth()) {
                        shownMonth = new Date(d.getFullYear(), d.getMonth(), 1);
                    }
                    renderMonth();
                    renderDayPanel();
                });

                const events = getEventsForDate(date, d);
                cell.innerHTML = `<span class="calendar-v4-day-number">${d.getDate()}</span>` +
                    events.slice(0, 3).map(function (event) {
                        return `<span class="calendar-v4-chip" style="--chip-color:${escapeHtml(event.color)}">${escapeHtml((event.time ? event.time + " " : "") + event.title)}</span>`;
                    }).join("") +
                    (events.length > 3 ? `<span class="calendar-v4-more">+${events.length - 3} more</span>` : "");
                grid.appendChild(cell);
            }
        }

        function getEventsForDate(date, dateObj) {
            const events = [];
            const weekdays = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
            const weekday = weekdays[dateObj.getDay()];

            if (filters.has("classes")) {
                (data.schedule || []).filter(function (event) {
                    return String(event.day || "").toLowerCase() === weekday.toLowerCase();
                }).forEach(function (event) {
                    events.push({type:"class", title:event.subject || "Class", time:event.startTime || "", color:"#1a73e8"});
                });
            }

            if (filters.has("class-events")) {
                (data.tests || []).filter(function (test) { return test.date === date; }).forEach(function (test) {
                    events.push({type:"class-event", title:test.title || test.subject || "Class event", time:test.startTime || "", color:"#7e57c2", meta:test.subject || ""});
                });
            }

            (data.personalEvents || []).filter(function (event) {
                return event.date === date && filters.has(event.calendarId || "personal-default");
            }).forEach(function (event) {
                events.push({
                    type:"personal",
                    eventId:event.eventId,
                    title:event.title,
                    time:event.startTime || "",
                    endTime:event.endTime || "",
                    description:event.description || "",
                    color:event.calendarColor || "#34a853",
                    calendarName:event.calendarName || "Personal"
                });
            });

            return events.sort(function (a,b) { return String(a.time || "99:99").localeCompare(String(b.time || "99:99")); });
        }

        function renderDayPanel() {
            if (!data) return;
            const date = new Date(selectedDate + "T00:00:00");
            const weekday = document.getElementById("selectedDayWeekday");
            const title = document.getElementById("selectedDayTitle");
            const list = document.getElementById("selectedDayItems");
            if (!weekday || !title || !list) return;

            weekday.textContent = date.toLocaleDateString(undefined, {weekday:"long"});
            title.textContent = date.toLocaleDateString(undefined, {month:"long", day:"numeric"});

            const events = getEventsForDate(selectedDate, date);
            if (!events.length) {
                list.innerHTML = '<div class="calendar-day-empty">Nothing scheduled for this day.</div>';
                return;
            }

            list.innerHTML = events.map(function (event) {
                return `
                    <article class="calendar-day-item" style="--item-color:${escapeHtml(event.color)}">
                        <span class="calendar-day-item-dot"></span>
                        <div class="calendar-day-item-copy">
                            <strong>${escapeHtml(event.title)}</strong>
                            <span>${escapeHtml(event.time || "All day")}${event.endTime ? " – " + escapeHtml(event.endTime) : ""}</span>
                            ${event.calendarName ? `<small>${escapeHtml(event.calendarName)}</small>` : (event.meta ? `<small>${escapeHtml(event.meta)}</small>` : "")}
                            ${event.description ? `<p>${escapeHtml(event.description)}</p>` : ""}
                        </div>
                        ${event.type === "personal" ? `<button type="button" class="calendar-day-delete" onclick="deleteV4Event('${escapeJs(event.eventId)}')">Delete</button>` : ""}
                    </article>
                `;
            }).join("");
        }

        function renderCalendarSelect() {
            const select = document.getElementById("v4EventCalendar");
            if (!select || !data) return;
            select.innerHTML = (data.personalCalendars || []).map(function (c) {
                return `<option value="${escapeHtml(c.calendarId)}">${escapeHtml(c.name)}</option>`;
            }).join("");
        }

        function openEventComposer() {
            const modal = document.getElementById("v4EventModal");
            if (!modal) return;
            document.getElementById("v4EventDate").value = selectedDate || todayValue();
            modal.hidden = false;
            document.body.classList.add("modal-open");
            setTimeout(function () {
                const title = document.getElementById("v4EventTitle");
                if (title) title.focus();
            }, 40);
        }

        function closeEventComposer() {
            const modal = document.getElementById("v4EventModal");
            if (modal) modal.hidden = true;
            document.body.classList.remove("modal-open");
        }

        async function saveEvent() {
            const title = document.getElementById("v4EventTitle");
            const date = document.getElementById("v4EventDate");
            const calendar = document.getElementById("v4EventCalendar");
            const start = document.getElementById("v4EventStart");
            const end = document.getElementById("v4EventEnd");
            const description = document.getElementById("v4EventDescription");
            const message = document.getElementById("v4EventMessage");

            if (!title.value.trim() || !date.value) {
                message.textContent = "Title and date are required.";
                return;
            }

            message.textContent = "Saving...";
            try {
                const result = await postJson({
                    action:"addPersonalEvent",
                    email:user.email,
                    title:title.value.trim(),
                    date:date.value,
                    startTime:start.value,
                    endTime:end.value,
                    description:description.value.trim(),
                    calendarId:calendar.value || "personal-default"
                });

                if (!result.success) throw new Error(result.error || "Could not save event.");

                if (!data) {
                    data = {
                        schedule: [],
                        tests: [],
                        personalEvents: [],
                        personalCalendars: [
                            {calendarId:"personal-default", name:"Personal", color:"#34a853", builtIn:true}
                        ]
                    };
                }
                data.personalEvents = data.personalEvents || [];
                data.personalEvents.push(result);
                selectedDate = result.date;
                title.value = "";
                description.value = "";
                start.value = "";
                end.value = "";
                closeEventComposer();
                renderEverything();
            }
            catch (error) {
                message.textContent = error.message || "Could not save event.";
            }
        }

        async function deleteEvent(eventId) {
            if (!eventId || !window.confirm("Delete this event?")) return;
            try {
                const result = await postJson({action:"deletePersonalEvent", email:user.email, eventId:eventId});
                if (!result.success) throw new Error(result.error || "Could not delete event.");
                data.personalEvents = (data.personalEvents || []).filter(function (event) { return event.eventId !== eventId; });
                renderEverything();
            }
            catch (error) {
                setStatus(error.message || "Could not delete event.", true);
            }
        }

        function openCalendarCreator() {
            const modal = document.getElementById("v4CalendarModal");
            if (modal) {
                modal.hidden = false;
                document.body.classList.add("modal-open");
            }
        }

        function closeCalendarCreator() {
            const modal = document.getElementById("v4CalendarModal");
            if (modal) modal.hidden = true;
            document.body.classList.remove("modal-open");
        }

        function renderColorChoices() {
            const box = document.getElementById("v4CalendarColors");
            if (!box) return;
            const colors = ["#f4511e","#f9ab00","#009688","#d81b60","#5c6bc0","#7e57c2","#34a853"];
            box.innerHTML = colors.map(function (color, index) {
                return `<button type="button" class="calendar-color-choice ${index === 0 ? "selected" : ""}" style="--choice-color:${color}" onclick="selectV4CalendarColor('${color}', this)" aria-label="Choose color"></button>`;
            }).join("");
        }

        async function saveCalendar() {
            const name = document.getElementById("v4CalendarName");
            const color = document.getElementById("v4CalendarColor");
            const message = document.getElementById("v4CalendarMessage");
            if (!name.value.trim()) {
                message.textContent = "Give the calendar a name.";
                return;
            }
            message.textContent = "Creating...";
            try {
                const result = await postJson({action:"createPersonalCalendar", email:user.email, name:name.value.trim(), color:color.value});
                if (!result.success) throw new Error(result.error || "Could not create calendar.");
                data.personalCalendars.push(result.calendar);
                filters.add(result.calendar.calendarId);
                name.value = "";
                closeCalendarCreator();
                renderEverything();
            }
            catch (error) {
                message.textContent = error.message || "Could not create calendar.";
            }
        }

        async function deleteCalendar(calendarId) {
            if (!window.confirm("Delete this calendar? Its existing events will move to Personal.")) return;
            try {
                const result = await postJson({action:"deletePersonalCalendar", email:user.email, calendarId:calendarId});
                if (!result.success) throw new Error(result.error || "Could not delete calendar.");
                data.personalCalendars = data.personalCalendars.filter(function (c) { return c.calendarId !== calendarId; });
                data.personalEvents.forEach(function (event) {
                    if (event.calendarId === calendarId) {
                        event.calendarId = "personal-default";
                        event.calendarName = "Personal";
                        event.calendarColor = "#34a853";
                    }
                });
                filters.delete(calendarId);
                filters.add("personal-default");
                renderEverything();
            }
            catch (error) {
                setStatus(error.message || "Could not delete calendar.", true);
            }
        }

        function cleanup() {}

        window.moveV4CalendarMonth = function (amount) {
            shownMonth = new Date(shownMonth.getFullYear(), shownMonth.getMonth() + amount, 1);
            renderMonth();
        };
        window.goV4CalendarToday = function () {
            const d = new Date();
            shownMonth = new Date(d.getFullYear(), d.getMonth(), 1);
            selectedDate = todayValue();
            renderMonth();
            renderDayPanel();
        };
        window.toggleV4CalendarFilter = function (id) {
            if (filters.has(id)) filters.delete(id); else filters.add(id);
            renderEverything();
        };
        window.showAllV4Calendars = function () {
            filters = new Set(["classes","class-events"]);
            (data.personalCalendars || []).forEach(function (c) { filters.add(c.calendarId); });
            renderEverything();
        };
        window.openV4EventComposer = openEventComposer;
        window.closeV4EventComposer = closeEventComposer;
        window.saveV4Event = saveEvent;
        window.deleteV4Event = deleteEvent;
        window.openV4CalendarCreator = openCalendarCreator;
        window.closeV4CalendarCreator = closeCalendarCreator;
        window.saveV4Calendar = saveCalendar;
        window.deleteV4Calendar = deleteCalendar;
        window.selectV4CalendarColor = function (color, button) {
            document.getElementById("v4CalendarColor").value = color;
            document.querySelectorAll(".calendar-color-choice").forEach(function (item) { item.classList.remove("selected"); });
            if (button) button.classList.add("selected");
        };

        return {init:init, cleanup:cleanup};
    })();

    /* =====================================================
       MESSAGES V4 - timeout-safe, searchable
    ===================================================== */

    window.TuklassMessages = (function () {
        let user = null;
        let conversations = [];
        let query = "";
        let timer = null;

        function cacheKey() {
            return "writejot_conversations_" + String(user && user.email || "").toLowerCase();
        }

        function renderShell() {
            const root = document.querySelector(".route-messages");
            if (!root) return;
            root.innerHTML = `
                <div class="route-head">
                    <div>
                        <div class="route-kicker">Conversations</div>
                        <h1>Messages</h1>
                        <p>Find a conversation by name and pick up where you left off.</p>
                    </div>
                    <div class="route-head-icon"><img src="images/MessageB.png" alt=""></div>
                </div>
                <div class="messages-v4-card">
                    <div class="messages-v4-search"><input id="conversationSearchV4" type="search" placeholder="Search conversations by name"></div>
                    <div id="conversationListV4" class="messages-v4-list"><div class="messages-v4-state">Loading conversations...</div></div>
                </div>
            `;

            const input = document.getElementById("conversationSearchV4");
            input.addEventListener("input", function () {
                query = input.value.trim().toLowerCase();
                render();
            });
        }

        function loadCache() {
            try {
                const cached = JSON.parse(localStorage.getItem(cacheKey()) || "null");
                if (cached && Array.isArray(cached.conversations)) {
                    conversations = cached.conversations;
                    render();
                }
            }
            catch {}
        }

        async function refresh() {
            try {
                const result = await fetchJson(
                    APPS_SCRIPT_URL + "?action=conversations&email=" + encodeURIComponent(user.email),
                    {cache:"no-store"},
                    8000
                );

                if (!result.success) throw new Error(result.error || "Could not load conversations.");
                conversations = Array.isArray(result.conversations) ? result.conversations : [];
                try {
                    localStorage.setItem(cacheKey(), JSON.stringify({savedAt:Date.now(), conversations:conversations}));
                }
                catch {}
                render();
            }
            catch (error) {
                if (!conversations.length) {
                    const list = document.getElementById("conversationListV4");
                    if (list) {
                        list.innerHTML = `<div class="messages-v4-state error"><strong>Messages could not load.</strong><span>${error.name === "AbortError" ? "The server took too long to respond." : escapeHtml(error.message || "Try again.")}</span><button type="button" onclick="retryV4Messages()">Retry</button></div>`;
                    }
                }
            }
        }

        function render() {
            const list = document.getElementById("conversationListV4");
            if (!list) return;
            const visible = conversations.filter(function (conversation) {
                if (!query) return true;
                return [conversation.name, conversation.username, conversation.lastMessage]
                    .filter(Boolean).join(" ").toLowerCase().includes(query);
            });

            if (!conversations.length) {
                list.innerHTML = '<div class="messages-v4-state"><strong>No conversations yet.</strong><span>Use Search to find a student and start one.</span></div>';
                return;
            }
            if (!visible.length) {
                list.innerHTML = '<div class="messages-v4-state"><strong>No matching conversations.</strong></div>';
                return;
            }

            list.innerHTML = visible.map(function (conversation) {
                const username = String(conversation.username || "").replace(/^@/, "");
                return `
                    <a class="messages-v4-row" href="chat.html?username=${encodeURIComponent(username)}">
                        <img src="${escapeHtml(conversation.profilePicture || "images/Logo3.1.png")}" alt="">
                        <div class="messages-v4-copy">
                            <div class="messages-v4-name-line"><strong>${escapeHtml(conversation.name || username || "Tuklass User")}</strong>${Number(conversation.unreadCount || 0) > 0 ? `<span class="messages-v4-unread">${Number(conversation.unreadCount)}</span>` : ""}</div>
                            <span>${escapeHtml(conversation.lastMessage || "No messages yet.")}</span>
                        </div>
                    </a>
                `;
            }).join("");
        }

        async function init() {
            user = getUser();
            renderShell();
            if (!user) return;
            loadCache();
            refresh();
            timer = setInterval(function () {
                if (document.visibilityState === "visible") refresh();
            }, 20000);
        }

        function cleanup() {
            if (timer) clearInterval(timer);
            timer = null;
        }

        window.retryV4Messages = refresh;
        return {init:init, cleanup:cleanup};
    })();

    /* =====================================================
       NOTES V4 - simple subpages + quick collections
    ===================================================== */

    window.TuklassNotes = (function () {
        const catalog = [
            {catalogId:"algebra", subject:"Mathematics", title:"Algebra Notes", description:"Algebra study notes and formulas."},
            {catalogId:"geometry", subject:"Mathematics", title:"Geometry Notes", description:"Geometry concepts and examples."},
            {catalogId:"biology", subject:"Science", title:"Biology Notes", description:"Biology concepts and study materials."},
            {catalogId:"chemistry", subject:"Science", title:"Chemistry Notes", description:"Chemistry formulas and concepts."}
        ];

        let user = null;
        let collections = [];
        let active = null;
        let selectedFile = null;
        let view = "catalog";

        function renderShell() {
            const root = document.querySelector(".route-notes");
            if (!root) return;
            root.innerHTML = `
                <div class="route-head">
                    <div>
                        <div class="route-kicker">Notes</div>
                        <h1>Notes</h1>
                        <p>Browse shared study material or build focused study collections.</p>
                    </div>
                    <div class="route-head-icon"><img src="images/CatalogB.png" alt=""></div>
                </div>

                <div class="notes-v4-shell">
                    <aside class="notes-v4-subnav">
                        <span>Notes</span>
                        <button type="button" data-notes-view="catalog" onclick="setV4NotesView('catalog')">Catalog</button>
                        <button type="button" data-notes-view="collections" onclick="setV4NotesView('collections')">Collections</button>
                    </aside>
                    <main id="notesV4Content" class="notes-v4-content"></main>
                </div>

                <div id="newCollectionModal" class="calendar-modal" hidden>
                    <button type="button" class="calendar-modal-backdrop" aria-label="Close" onclick="closeV4CollectionCreator()"></button>
                    <div class="calendar-modal-card">
                        <div class="calendar-modal-head"><h2>New collection</h2><button type="button" onclick="closeV4CollectionCreator()">Close</button></div>
                        <label><span>Name</span><input id="v4CollectionTitle" type="text" maxlength="80" placeholder="Midterms review"></label>
                        <label><span>Description</span><textarea id="v4CollectionDescription" maxlength="300" placeholder="Optional"></textarea></label>
                        <div id="v4CollectionMessage" class="form-message"></div>
                        <button type="button" class="calendar-save-event" onclick="saveV4Collection()">Create collection</button>
                    </div>
                </div>

                <div id="addMaterialModal" class="calendar-modal" hidden>
                    <button type="button" class="calendar-modal-backdrop" aria-label="Close" onclick="closeV4AddMaterial()"></button>
                    <div class="calendar-modal-card notes-add-material-card">
                        <div class="calendar-modal-head"><h2>Add material</h2><button type="button" onclick="closeV4AddMaterial()">Close</button></div>
                        <div class="notes-add-type-grid">
                            <button type="button" onclick="showV4MaterialPane('catalog')"><strong>From Catalog</strong><span>Add a Tuklass study material.</span></button>
                            <button type="button" onclick="showV4MaterialPane('text')"><strong>Write note</strong><span>Add your own text note.</span></button>
                            <button type="button" onclick="showV4MaterialPane('file')"><strong>Upload</strong><span>Add a document or picture.</span></button>
                        </div>
                        <div id="v4MaterialPane" class="notes-material-pane"></div>
                    </div>
                </div>

                <div id="catalogPickerModalV4" class="calendar-modal" hidden>
                    <button type="button" class="calendar-modal-backdrop" aria-label="Close" onclick="closeV4CatalogPicker()"></button>
                    <div class="calendar-modal-card">
                        <div class="calendar-modal-head"><h2>Add to collection</h2><button type="button" onclick="closeV4CatalogPicker()">Close</button></div>
                        <p class="notes-picker-help">Choose where you want to save this material.</p>
                        <div id="catalogPickerListV4" class="catalog-picker-list-v4"></div>
                    </div>
                </div>
            `;
        }

        async function init() {
            user = getUser();
            renderShell();
            if (!user) return;

            const params = new URLSearchParams(location.search);
            view = params.get("view") === "collections" ? "collections" : "catalog";
            setView(view, false);

            const quick = sessionStorage.getItem("tuklass_quick_create");
            if (quick === "collection") {
                sessionStorage.removeItem("tuklass_quick_create");
                setView("collections", false);
                setTimeout(openCollectionCreator, 40);
            }

            loadCollections().then(function () {
                if (!active) renderCurrentView();
            });
        }

        async function loadCollections() {
            try {
                const result = await fetchJson(
                    APPS_SCRIPT_URL + "?action=noteCollections&email=" + encodeURIComponent(user.email),
                    {cache:"no-store"},
                    9000
                );
                if (!result.success) throw new Error(result.error || "Could not load collections.");
                collections = Array.isArray(result.collections) ? result.collections : [];
            }
            catch {
                collections = [];
            }
        }

        function setView(next, updateUrl) {
            view = next === "collections" ? "collections" : "catalog";
            document.querySelectorAll("[data-notes-view]").forEach(function (button) {
                button.classList.toggle("active", button.dataset.notesView === view);
            });
            if (updateUrl !== false) {
                const url = new URL(location.href);
                if (view === "collections") url.searchParams.set("view", "collections"); else url.searchParams.delete("view");
                history.replaceState(history.state, "", url.pathname + url.search);
            }
            renderCurrentView();
        }

        function renderCurrentView() {
            const content = document.getElementById("notesV4Content");
            if (!content) return;
            if (active) {
                renderCollectionWorkspace();
                return;
            }
            if (view === "collections") renderCollections(); else renderCatalog();
        }

        function renderCatalog() {
            const content = document.getElementById("notesV4Content");
            content.innerHTML = `
                <div class="notes-v4-toolbar"><div><span>Catalog</span><h2>Study materials</h2></div><input id="notesV4Search" type="search" placeholder="Search notes and subjects"></div>
                <div id="notesV4CatalogGrid" class="notes-v4-grid"></div>
            `;
            const search = document.getElementById("notesV4Search");
            search.addEventListener("input", function () { renderCatalogGrid(search.value); });
            renderCatalogGrid("");
        }

        function renderCatalogGrid(query) {
            const grid = document.getElementById("notesV4CatalogGrid");
            if (!grid) return;
            const wanted = String(query || "").trim().toLowerCase();
            const items = catalog.filter(function (note) {
                return !wanted || [note.subject,note.title,note.description].join(" ").toLowerCase().includes(wanted);
            });
            grid.innerHTML = items.map(function (note) {
                return `<article class="notes-v4-card"><span>${escapeHtml(note.subject)}</span><h3>${escapeHtml(note.title)}</h3><p>${escapeHtml(note.description)}</p><button type="button" onclick="openV4CatalogPicker('${escapeJs(note.catalogId)}')">Add to collection</button></article>`;
            }).join("");
        }

        function renderCollections() {
            const content = document.getElementById("notesV4Content");
            content.innerHTML = `
                <div class="notes-v4-toolbar"><div><span>Your library</span><h2>Collections</h2></div><button type="button" class="notes-v4-new" onclick="openV4CollectionCreator()">+ New collection</button></div>
                <div class="notes-v4-grid collections-grid-v4">${collections.length ? collections.map(function (c) {
                    return `<article class="collection-card-v4"><button class="collection-open-v4" type="button" onclick="openV4Collection('${escapeJs(c.collectionId)}')"><span class="collection-folder-v4"></span><strong>${escapeHtml(c.title)}</strong><small>${Number(c.itemCount || 0)} item${Number(c.itemCount || 0) === 1 ? "" : "s"}</small></button><button type="button" class="collection-delete-v4" onclick="deleteV4Collection('${escapeJs(c.collectionId)}')">Delete</button></article>`;
                }).join("") : '<div class="notes-v4-empty"><strong>No collections yet.</strong><span>Create one for a test, unit, or study session.</span></div>'}</div>
            `;
        }

        async function openCollection(collectionId) {
            try {
                const result = await fetchJson(
                    APPS_SCRIPT_URL + "?action=noteCollection&email=" + encodeURIComponent(user.email) + "&collectionId=" + encodeURIComponent(collectionId),
                    {cache:"no-store"},
                    9000
                );
                if (!result.success) throw new Error(result.error || "Could not open collection.");
                active = result.collection;
                renderCollectionWorkspace();
            }
            catch (error) {
                alert(error.message || "Could not open collection.");
            }
        }

        function renderCollectionWorkspace() {
            const content = document.getElementById("notesV4Content");
            if (!content || !active) return;
            const items = Array.isArray(active.items) ? active.items : [];
            content.innerHTML = `
                <div class="collection-workspace-v4-head"><button type="button" onclick="closeV4CollectionWorkspace()">← Collections</button><div><span>Collection</span><h2>${escapeHtml(active.title)}</h2><p>${escapeHtml(active.description || "Build this collection with exactly what you need.")}</p></div><button type="button" class="notes-v4-new" onclick="openV4AddMaterial()">+ Add material</button></div>
                <div class="collection-items-v4">${items.length ? items.map(function (item, index) {
                    const type = String(item.type || "material");
                    return `<article class="collection-item-v4"><span class="collection-item-number-v4">${index + 1}</span><div><small>${escapeHtml(type)}</small><strong>${escapeHtml(item.title || "Material")}</strong>${type === "text" ? `<p>${escapeHtml(item.textContent || "")}</p>` : ""}</div><div class="collection-item-actions-v4">${(type === "file" || type === "image") ? `<button type="button" onclick="openV4CollectionFile('${escapeJs(item.itemId)}')">Open</button>` : ""}<button type="button" onclick="removeV4CollectionItem('${escapeJs(item.itemId)}')">Remove</button></div></article>`;
                }).join("") : '<div class="notes-v4-empty"><strong>This collection is empty.</strong><span>Use Add material to add catalog notes, your own text, files, or pictures.</span></div>'}</div>
            `;
        }

        function openCollectionCreator() {
            const modal = document.getElementById("newCollectionModal");
            if (modal) {
                modal.hidden = false;
                document.body.classList.add("modal-open");
                setTimeout(function () { document.getElementById("v4CollectionTitle").focus(); }, 40);
            }
        }

        function closeCollectionCreator() {
            const modal = document.getElementById("newCollectionModal");
            if (modal) modal.hidden = true;
            document.body.classList.remove("modal-open");
        }

        async function saveCollection() {
            const title = document.getElementById("v4CollectionTitle");
            const description = document.getElementById("v4CollectionDescription");
            const message = document.getElementById("v4CollectionMessage");
            if (!title.value.trim()) { message.textContent = "Give the collection a name."; return; }
            message.textContent = "Creating...";
            try {
                const result = await postJson({action:"createNoteCollection", email:user.email, title:title.value.trim(), description:description.value.trim()});
                if (!result.success) throw new Error(result.error || "Could not create collection.");
                title.value = "";
                description.value = "";
                closeCollectionCreator();
                await loadCollections();
                await openCollection(result.collectionId);
            }
            catch (error) { message.textContent = error.message || "Could not create collection."; }
        }

        async function deleteCollection(collectionId) {
            if (!window.confirm("Delete this collection?")) return;
            const result = await postJson({action:"deleteNoteCollection", email:user.email, collectionId:collectionId});
            if (!result.success) return alert(result.error || "Could not delete collection.");
            await loadCollections();
            renderCollections();
        }

        function openAddMaterial() {
            const modal = document.getElementById("addMaterialModal");
            if (modal) { modal.hidden = false; document.body.classList.add("modal-open"); }
            showMaterialPane("");
        }

        function closeAddMaterial() {
            const modal = document.getElementById("addMaterialModal");
            if (modal) modal.hidden = true;
            document.body.classList.remove("modal-open");
        }

        function showMaterialPane(type) {
            const pane = document.getElementById("v4MaterialPane");
            if (!pane) return;
            if (type === "catalog") {
                pane.innerHTML = '<div class="material-catalog-v4">' + catalog.map(function (note) { return `<button type="button" onclick="addV4CatalogItem('${escapeJs(note.catalogId)}')"><strong>${escapeHtml(note.title)}</strong><span>${escapeHtml(note.subject)}</span></button>`; }).join("") + '</div>';
            }
            else if (type === "text") {
                pane.innerHTML = '<label><span>Title</span><input id="v4TextTitle" type="text" placeholder="My note"></label><label><span>Note</span><textarea id="v4TextContent" placeholder="Write your note here"></textarea></label><button type="button" class="calendar-save-event" onclick="saveV4TextItem()">Add note</button>';
            }
            else if (type === "file") {
                pane.innerHTML = '<label><span>File title</span><input id="v4FileTitle" type="text" placeholder="Optional"></label><label><span>File</span><input id="v4FileInput" type="file" accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.txt"></label><div id="v4FileMessage" class="form-message"></div><button type="button" class="calendar-save-event" onclick="saveV4FileItem()">Upload</button>';
            }
            else pane.innerHTML = '<div class="notes-material-helper">Choose how you want to add material.</div>';
        }

        async function addCatalogItem(catalogId) {
            if (!active) return;
            const note = catalog.find(function (item) { return item.catalogId === catalogId; });
            if (!note) return;
            const result = await postJson({action:"addCollectionCatalogItem", email:user.email, collectionId:active.collectionId, catalogId:note.catalogId, title:note.title});
            if (!result.success) return alert(result.error || "Could not add material.");
            closeAddMaterial();
            await openCollection(active.collectionId);
            await loadCollections();
        }

        async function saveTextItem() {
            if (!active) return;
            const title = document.getElementById("v4TextTitle");
            const content = document.getElementById("v4TextContent");
            if (!content.value.trim()) return;
            const result = await postJson({action:"addCollectionTextItem", email:user.email, collectionId:active.collectionId, title:title.value.trim() || "Personal note", textContent:content.value.trim()});
            if (!result.success) return alert(result.error || "Could not add note.");
            closeAddMaterial();
            await openCollection(active.collectionId);
            await loadCollections();
        }

        function fileToDataUrl(file) {
            return new Promise(function (resolve, reject) {
                const reader = new FileReader();
                reader.onload = function () { resolve(reader.result); };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }

        async function saveFileItem() {
            if (!active) return;
            const input = document.getElementById("v4FileInput");
            const title = document.getElementById("v4FileTitle");
            const message = document.getElementById("v4FileMessage");
            const file = input.files && input.files[0];
            if (!file) { message.textContent = "Choose a file first."; return; }
            if (file.size > 4 * 1024 * 1024) { message.textContent = "Files can be up to 4 MB."; return; }
            message.textContent = "Uploading...";
            try {
                const dataUrl = await fileToDataUrl(file);
                const result = await postJson({action:"addCollectionFileItem", email:user.email, collectionId:active.collectionId, title:title.value.trim() || file.name, fileData:dataUrl, fileName:file.name, mimeType:file.type || "application/octet-stream"}, 20000);
                if (!result.success) throw new Error(result.error || "Could not upload file.");
                closeAddMaterial();
                await openCollection(active.collectionId);
                await loadCollections();
            }
            catch (error) { message.textContent = error.message || "Could not upload file."; }
        }

        async function removeItem(itemId) {
            const result = await postJson({action:"deleteCollectionItem", email:user.email, itemId:itemId});
            if (!result.success) return alert(result.error || "Could not remove item.");
            await openCollection(active.collectionId);
            await loadCollections();
        }

        async function openFile(itemId) {
            try {
                const result = await fetchJson(APPS_SCRIPT_URL + "?action=collectionFileData&email=" + encodeURIComponent(user.email) + "&itemId=" + encodeURIComponent(itemId), {cache:"no-store"}, 12000);
                if (!result.success) throw new Error(result.error || "Could not open file.");
                const link = document.createElement("a");
                link.href = "data:" + (result.mimeType || "application/octet-stream") + ";base64," + result.base64;
                link.download = result.fileName || "tuklass-file";
                document.body.appendChild(link);
                link.click();
                link.remove();
            }
            catch (error) { alert(error.message || "Could not open file."); }
        }

        let pickerCatalogId = "";

        function openCatalogPicker(catalogId) {
            pickerCatalogId = catalogId;
            if (!collections.length) {
                setView("collections");
                openCollectionCreator();
                return;
            }
            const modal = document.getElementById("catalogPickerModalV4");
            const list = document.getElementById("catalogPickerListV4");
            if (!modal || !list) return;
            list.innerHTML = collections.map(function (c) {
                return `<button type="button" onclick="addV4CatalogToCollection('${escapeJs(c.collectionId)}')"><strong>${escapeHtml(c.title)}</strong><span>${Number(c.itemCount || 0)} items</span></button>`;
            }).join("");
            modal.hidden = false;
            document.body.classList.add("modal-open");
        }

        function closeCatalogPicker() {
            const modal = document.getElementById("catalogPickerModalV4");
            if (modal) modal.hidden = true;
            document.body.classList.remove("modal-open");
            pickerCatalogId = "";
        }

        async function addCatalogToCollection(collectionId) {
            const note = catalog.find(function (item) { return item.catalogId === pickerCatalogId; });
            if (!note) return;
            const result = await postJson({action:"addCollectionCatalogItem", email:user.email, collectionId:collectionId, catalogId:note.catalogId, title:note.title});
            if (!result.success) return alert(result.error || "Could not add material.");
            closeCatalogPicker();
            await loadCollections();
        }


        window.setV4NotesView = function (next) { active = null; setView(next); };
        window.openV4CollectionCreator = openCollectionCreator;
        window.closeV4CollectionCreator = closeCollectionCreator;
        window.saveV4Collection = saveCollection;
        window.openV4Collection = openCollection;
        window.deleteV4Collection = deleteCollection;
        window.closeV4CollectionWorkspace = function () { active = null; renderCollections(); };
        window.openV4AddMaterial = openAddMaterial;
        window.closeV4AddMaterial = closeAddMaterial;
        window.showV4MaterialPane = showMaterialPane;
        window.addV4CatalogItem = addCatalogItem;
        window.saveV4TextItem = saveTextItem;
        window.saveV4FileItem = saveFileItem;
        window.removeV4CollectionItem = removeItem;
        window.openV4CollectionFile = openFile;
        window.openV4CatalogPicker = openCatalogPicker;
        window.closeV4CatalogPicker = closeCatalogPicker;
        window.addV4CatalogToCollection = addCatalogToCollection;

        return {init:init, cleanup:function(){}};
    })();

    /* =====================================================
       PROFILE: move logout into Profile tab
    ===================================================== */

    const originalProfile = window.TuklassProfile;
    if (originalProfile) {
        window.TuklassProfile = {
            init: async function () {
                await originalProfile.init();
                const user = getUser();
                if (!user) return;
                const params = new URLSearchParams(location.search);
                const viewed = String(params.get("username") || user.username || "").replace(/^@/, "").toLowerCase();
                if (viewed !== String(user.username || "").replace(/^@/, "").toLowerCase()) return;
                const root = document.querySelector(".route-profile");
                if (!root || root.querySelector(".profile-account-v4")) return;
                const card = document.createElement("section");
                card.className = "profile-account-v4";
                card.innerHTML = '<div><span>Account</span><h2>Account controls</h2><p>Edit your profile or log out of Tuklass.</p></div><div class="profile-account-actions-v4"><a href="edit-profile.html" class="profile-edit-v4">Edit profile</a><button type="button" class="profile-logout-v4" onclick="requestTuklassLogout()">Log out</button></div>';
                root.appendChild(card);
            },
            cleanup: function () {
                if (originalProfile.cleanup) originalProfile.cleanup();
            }
        };
    }

    /* Quick-create reminder focus */
    const originalReminders = window.TuklassReminders;
    if (originalReminders) {
        window.TuklassReminders = {
            init: async function () {
                await originalReminders.init();
                const quick = sessionStorage.getItem("tuklass_quick_create");
                if (quick === "reminder") {
                    sessionStorage.removeItem("tuklass_quick_create");
                    let attempts = 0;
                    const focusReminder = function () {
                        const field = document.getElementById("reminderTitle");
                        if (field) {
                            field.scrollIntoView({behavior:"smooth", block:"center"});
                            field.focus();
                            return;
                        }
                        attempts += 1;
                        if (attempts < 20) setTimeout(focusReminder, 150);
                    };
                    setTimeout(focusReminder, 60);
                }
            },
            cleanup: function () {
                if (originalReminders.cleanup) originalReminders.cleanup();
            }
        };
    }

    document.addEventListener("DOMContentLoaded", ensureLogoutModal);
})();
