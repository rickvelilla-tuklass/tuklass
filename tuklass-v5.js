(function () {
    "use strict";

    const APPS_SCRIPT_URL =
        window.TUKLASS_CONFIG.apiUrl;

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

    function toDateValue(date) {
        return [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, "0"),
            String(date.getDate()).padStart(2, "0")
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
       CALENDAR V5
    ===================================================== */

    window.TuklassCalendar = (function () {
        let user = null;
        let data = null;
        let shownMonth = new Date();
        let selectedDate = todayValue();
        let activeView = "all";
        let visible = new Set(["classes", "class-events"]);

        const builtIns = [
            {
                id: "classes",
                name: "Class schedule",
                color: "#1a73e8",
                locked: true
            },
            {
                id: "class-events",
                name: "Class events",
                color: "#7e57c2",
                locked: true
            }
        ];

        shownMonth.setDate(1);

        function allCalendars() {
            const personal = (data && data.personalCalendars || []).map(function (calendar) {
                return {
                    id: calendar.calendarId,
                    name: calendar.name,
                    color: calendar.color || "#34a853",
                    locked: false
                };
            });

            return builtIns.concat(personal);
        }

        function calendarById(id) {
            return allCalendars().find(function (item) {
                return item.id === id;
            }) || null;
        }

        function shouldShow(id) {
            if (activeView !== "all") {
                return activeView === id;
            }
            return visible.has(id);
        }

        function renderShell() {
            const root = document.querySelector(".route-calendar");
            if (!root) return;

            root.innerHTML = `
                <div class="route-head calendar-v5-head">
                    <div>
                        <div class="route-kicker">Calendar</div>
                        <h1>Calendar</h1>
                        <p>Class schedules, class events, and your own calendars in one place.</p>
                    </div>
                </div>

                <div id="calendarV5Status" class="calendar-v5-status">Loading calendar...</div>

                <div class="calendar-v5-shell">
                    <aside class="calendar-v5-sidebar">
                        <button
                            type="button"
                            id="calendarAllView"
                            class="calendar-v5-view-row active"
                            onclick="selectV5CalendarView('all')"
                        >
                            All calendars
                        </button>

                        <div class="calendar-v5-group-title">Main calendars</div>
                        <div id="calendarMainList"></div>

                        <div class="calendar-v5-group-title personal-title">Personal calendars</div>
                        <div id="calendarPersonalList"></div>

                        <button
                            type="button"
                            class="calendar-v5-new"
                            onclick="openV5CalendarCreator()"
                        >
                            + New calendar
                        </button>
                    </aside>

                    <main class="calendar-v5-main">
                        <div class="calendar-v5-toolbar">
                            <div class="calendar-v5-nav">
                                <button type="button" onclick="moveV5CalendarMonth(-1)" aria-label="Previous month">‹</button>
                                <button type="button" onclick="goV5CalendarToday()">Today</button>
                                <button type="button" onclick="moveV5CalendarMonth(1)" aria-label="Next month">›</button>
                            </div>
                            <div class="calendar-v5-toolbar-title">
                                <span id="calendarV5ViewName">All calendars</span>
                                <h2 id="calendarV5MonthTitle"></h2>
                            </div>
                        </div>

                        <div class="calendar-v5-weekdays">
                            <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                        </div>

                        <div id="calendarV5Grid" class="calendar-v5-grid"></div>
                    </main>

                    <aside class="calendar-v5-day-panel">
                        <div class="calendar-v5-day-head">
                            <div>
                                <span id="selectedV5Weekday"></span>
                                <h2 id="selectedV5DayTitle"></h2>
                            </div>
                            <button type="button" onclick="openV5EventComposer()">+ Add</button>
                        </div>
                        <div id="selectedV5DayItems" class="calendar-v5-day-items"></div>
                    </aside>
                </div>

                <div id="v5EventModal" class="calendar-modal" hidden>
                    <button type="button" class="calendar-modal-backdrop" aria-label="Close" onclick="closeV5EventComposer()"></button>
                    <div class="calendar-modal-card">
                        <div class="calendar-modal-head">
                            <h2>New event</h2>
                            <button type="button" onclick="closeV5EventComposer()">Close</button>
                        </div>

                        <label>
                            <span>Title</span>
                            <input id="v5EventTitle" type="text" maxlength="100" placeholder="Event title">
                        </label>

                        <div class="calendar-modal-row">
                            <label>
                                <span>Date</span>
                                <input id="v5EventDate" type="date">
                            </label>

                            <label>
                                <span>Calendar</span>
                                <select id="v5EventCalendar"></select>
                            </label>
                        </div>

                        <div class="calendar-modal-row">
                            <label>
                                <span>Start</span>
                                <input id="v5EventStart" type="time">
                            </label>

                            <label>
                                <span>End</span>
                                <input id="v5EventEnd" type="time">
                            </label>
                        </div>

                        <label>
                            <span>Description</span>
                            <textarea id="v5EventDescription" maxlength="500" placeholder="Optional"></textarea>
                        </label>

                        <div id="v5EventMessage" class="form-message"></div>
                        <button type="button" class="calendar-save-event" onclick="saveV5Event()">Save event</button>
                    </div>
                </div>

                <div id="v5CalendarModal" class="calendar-modal" hidden>
                    <button type="button" class="calendar-modal-backdrop" aria-label="Close" onclick="closeV5CalendarCreator()"></button>
                    <div class="calendar-modal-card calendar-list-modal-card">
                        <div class="calendar-modal-head">
                            <h2>New personal calendar</h2>
                            <button type="button" onclick="closeV5CalendarCreator()">Close</button>
                        </div>

                        <label>
                            <span>Name</span>
                            <input id="v5CalendarName" type="text" maxlength="40" placeholder="Study, Projects, Family...">
                        </label>

                        <span class="calendar-color-label">Color</span>
                        <div id="v5CalendarColors" class="calendar-color-choices"></div>
                        <input id="v5CalendarColor" type="hidden" value="#34a853">
                        <div id="v5CalendarMessage" class="form-message"></div>
                        <button type="button" class="calendar-save-event" onclick="saveV5Calendar()">Create calendar</button>
                    </div>
                </div>
            `;

            renderColorChoices();
        }

        function setStatus(message, isError) {
            const box = document.getElementById("calendarV5Status");
            if (!box) return;
            box.textContent = message || "";
            box.className = "calendar-v5-status" + (isError ? " error" : "");
            box.hidden = !message;
        }

        async function init() {
            user = getUser();
            renderShell();
            if (!user) return;

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
                visible = new Set(["classes", "class-events"]);
                (data.personalCalendars || []).forEach(function (calendar) {
                    visible.add(calendar.calendarId);
                });

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

        function renderEverything() {
            renderSidebar();
            renderMonth();
            renderDayPanel();
            renderCalendarSelect();
        }

        function renderSidebar() {
            if (!data) return;

            const main = document.getElementById("calendarMainList");
            const personal = document.getElementById("calendarPersonalList");
            const allButton = document.getElementById("calendarAllView");

            if (allButton) {
                allButton.classList.toggle("active", activeView === "all");
            }

            if (main) {
                main.innerHTML = builtIns.map(renderCalendarRow).join("");
            }

            if (personal) {
                const calendars = (data.personalCalendars || []).map(function (calendar) {
                    return {
                        id: calendar.calendarId,
                        name: calendar.name,
                        color: calendar.color || "#34a853",
                        locked: false
                    };
                });

                personal.innerHTML = calendars.length
                    ? calendars.map(renderCalendarRow).join("")
                    : '<div class="calendar-v5-empty-list">No personal calendars yet.</div>';
            }
        }

        function renderCalendarRow(item) {
            const checked = visible.has(item.id) ? "checked" : "";
            const active = activeView === item.id ? " active" : "";

            return `
                <div class="calendar-v5-row${active}">
                    <label class="calendar-v5-check" title="Show or hide in All calendars">
                        <input
                            type="checkbox"
                            style="accent-color:${escapeHtml(item.color)}"
                            ${checked}
                            onchange="toggleV5CalendarVisibility('${escapeJs(item.id)}', this.checked)"
                        >
                        <span style="--calendar-color:${escapeHtml(item.color)}"></span>
                    </label>

                    <button
                        type="button"
                        class="calendar-v5-name"
                        onclick="selectV5CalendarView('${escapeJs(item.id)}')"
                    >
                        ${escapeHtml(item.name)}
                    </button>

                    ${item.locked ? "" : `
                        <button
                            type="button"
                            class="calendar-v5-delete"
                            title="Delete calendar"
                            onclick="deleteV5Calendar('${escapeJs(item.id)}')"
                        >
                            ×
                        </button>
                    `}
                </div>
            `;
        }

        function selectView(id) {
            if (id !== "all" && !calendarById(id)) {
                return;
            }

            activeView = id;

            if (id !== "all") {
                visible.add(id);
            }

            renderEverything();
        }

        function toggleVisibility(id, checked) {
            if (checked) {
                visible.add(id);
            }
            else {
                visible.delete(id);
            }

            if (activeView === "all") {
                renderMonth();
                renderDayPanel();
            }

            renderSidebar();
        }

        function getEventsForDate(date, dateObj) {
            if (!data) return [];

            const events = [];
            const weekdays = [
                "Sunday",
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday"
            ];
            const weekday = weekdays[dateObj.getDay()];

            if (shouldShow("classes")) {
                (data.schedule || [])
                    .filter(function (event) {
                        return String(event.day || "").toLowerCase() === weekday.toLowerCase();
                    })
                    .forEach(function (event) {
                        events.push({
                            type: "auto-class",
                            calendarId: "classes",
                            calendarName: "Class schedule",
                            title: event.subject || "Class",
                            time: event.startTime || "",
                            endTime: event.endTime || "",
                            color: "#1a73e8"
                        });
                    });
            }

            if (shouldShow("class-events")) {
                (data.tests || [])
                    .filter(function (test) {
                        return test.date === date;
                    })
                    .forEach(function (test) {
                        events.push({
                            type: "auto-class-event",
                            calendarId: "class-events",
                            calendarName: "Class events",
                            title: test.title || test.subject || "Class event",
                            time: test.startTime || "",
                            color: "#7e57c2",
                            meta: test.subject || ""
                        });
                    });
            }

            (data.personalEvents || [])
                .filter(function (event) {
                    return event.date === date && shouldShow(event.calendarId || "");
                })
                .forEach(function (event) {
                    const calendar = calendarById(event.calendarId);
                    events.push({
                        type: "user-event",
                        eventId: event.eventId,
                        calendarId: event.calendarId,
                        calendarName: calendar ? calendar.name : (event.calendarName || "Calendar"),
                        title: event.title,
                        time: event.startTime || "",
                        endTime: event.endTime || "",
                        description: event.description || "",
                        color: calendar ? calendar.color : (event.calendarColor || "#34a853")
                    });
                });

            return events.sort(function (a, b) {
                return String(a.time || "99:99").localeCompare(String(b.time || "99:99"));
            });
        }

        function renderMonth() {
            if (!data) return;

            const title = document.getElementById("calendarV5MonthTitle");
            const viewName = document.getElementById("calendarV5ViewName");
            const grid = document.getElementById("calendarV5Grid");
            if (!title || !grid || !viewName) return;

            title.textContent = shownMonth.toLocaleDateString(undefined, {
                month: "long",
                year: "numeric"
            });

            viewName.textContent = activeView === "all"
                ? "All calendars"
                : ((calendarById(activeView) || {}).name || "Calendar");

            grid.innerHTML = "";

            const year = shownMonth.getFullYear();
            const month = shownMonth.getMonth();
            const first = new Date(year, month, 1).getDay();
            const total = Math.ceil((first + new Date(year, month + 1, 0).getDate()) / 7) * 7;

            for (let i = 0; i < total; i++) {
                const d = new Date(year, month, i - first + 1);
                const date = toDateValue(d);
                const cell = document.createElement("button");
                cell.type = "button";
                cell.className = "calendar-v5-day";

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
                cell.innerHTML =
                    `<span class="calendar-v5-day-number">${d.getDate()}</span>` +
                    events.slice(0, 3).map(function (event) {
                        return `
                            <span
                                class="calendar-v5-chip"
                                style="--chip-color:${escapeHtml(event.color)}"
                            >
                                ${escapeHtml((event.time ? event.time + " " : "") + event.title)}
                            </span>
                        `;
                    }).join("") +
                    (events.length > 3
                        ? `<span class="calendar-v5-more">+${events.length - 3} more</span>`
                        : "");

                grid.appendChild(cell);
            }
        }

        function renderDayPanel() {
            if (!data) return;

            const date = new Date(selectedDate + "T00:00:00");
            const weekday = document.getElementById("selectedV5Weekday");
            const title = document.getElementById("selectedV5DayTitle");
            const list = document.getElementById("selectedV5DayItems");
            if (!weekday || !title || !list) return;

            weekday.textContent = date.toLocaleDateString(undefined, {
                weekday: "long"
            });

            title.textContent = date.toLocaleDateString(undefined, {
                month: "long",
                day: "numeric"
            });

            const events = getEventsForDate(selectedDate, date);

            if (!events.length) {
                list.innerHTML = '<div class="calendar-v5-day-empty">Nothing scheduled for this day.</div>';
                return;
            }

            list.innerHTML = events.map(function (event) {
                return `
                    <article class="calendar-v5-day-item" style="--item-color:${escapeHtml(event.color)}">
                        <span class="calendar-v5-day-dot"></span>
                        <div class="calendar-v5-day-copy">
                            <strong>${escapeHtml(event.title)}</strong>
                            <span>${escapeHtml(event.time || "All day")}${event.endTime ? " – " + escapeHtml(event.endTime) : ""}</span>
                            <small>${escapeHtml(event.calendarName || "")}</small>
                            ${event.description ? `<p>${escapeHtml(event.description)}</p>` : ""}
                        </div>
                        ${event.type === "user-event" ? `
                            <button
                                type="button"
                                class="calendar-v5-day-delete"
                                onclick="deleteV5Event('${escapeJs(event.eventId)}')"
                            >
                                Delete
                            </button>
                        ` : ""}
                    </article>
                `;
            }).join("");
        }

        function renderCalendarSelect() {
            const select = document.getElementById("v5EventCalendar");
            if (!select || !data) return;

            const options = allCalendars();
            select.innerHTML = options.map(function (calendar) {
                return `<option value="${escapeHtml(calendar.id)}">${escapeHtml(calendar.name)}</option>`;
            }).join("");

            if (activeView !== "all" && calendarById(activeView)) {
                select.value = activeView;
            }
            else {
                select.value = "class-events";
            }
        }

        function openEventComposer() {
            const modal = document.getElementById("v5EventModal");
            if (!modal) return;

            const date = document.getElementById("v5EventDate");
            if (date) date.value = selectedDate || todayValue();

            renderCalendarSelect();

            modal.hidden = false;
            document.body.classList.add("modal-open");

            setTimeout(function () {
                const title = document.getElementById("v5EventTitle");
                if (title) title.focus();
            }, 40);
        }

        function closeEventComposer() {
            const modal = document.getElementById("v5EventModal");
            if (modal) modal.hidden = true;
            document.body.classList.remove("modal-open");
        }

        async function saveEvent() {
            const title = document.getElementById("v5EventTitle");
            const date = document.getElementById("v5EventDate");
            const calendar = document.getElementById("v5EventCalendar");
            const start = document.getElementById("v5EventStart");
            const end = document.getElementById("v5EventEnd");
            const description = document.getElementById("v5EventDescription");
            const message = document.getElementById("v5EventMessage");

            if (!title.value.trim() || !date.value || !calendar.value) {
                message.textContent = "Enter a title, date, and calendar.";
                return;
            }

            const selectedCalendar = calendarById(calendar.value);
            if (!selectedCalendar) {
                message.textContent = "Choose a calendar.";
                return;
            }

            const optimisticId = "pending_" + Date.now() + "_" + Math.random().toString(36).slice(2);
            const optimistic = {
                eventId: optimisticId,
                title: title.value.trim(),
                date: date.value,
                startTime: start.value,
                endTime: end.value,
                description: description.value.trim(),
                calendarId: selectedCalendar.id,
                calendarName: selectedCalendar.name,
                calendarColor: selectedCalendar.color,
                optimistic: true
            };

            data.personalEvents = Array.isArray(data.personalEvents) ? data.personalEvents : [];
            data.personalEvents.push(optimistic);
            visible.add(selectedCalendar.id);
            selectedDate = optimistic.date;

            title.value = "";
            description.value = "";
            closeEventComposer();
            renderEverything();

            try {
                const result = await postJson({
                    action: "addPersonalEvent",
                    email: user.email,
                    title: optimistic.title,
                    date: optimistic.date,
                    startTime: optimistic.startTime,
                    endTime: optimistic.endTime,
                    description: optimistic.description,
                    calendarId: optimistic.calendarId
                });

                if (!result.success) {
                    throw new Error(result.error || "Could not save event.");
                }

                const item = data.personalEvents.find(function (event) {
                    return event.eventId === optimisticId;
                });

                if (item) {
                    item.eventId = result.eventId;
                    item.calendarId = result.calendarId || optimistic.calendarId;
                    item.calendarName = result.calendarName || optimistic.calendarName;
                    item.calendarColor = result.calendarColor || optimistic.calendarColor;
                    delete item.optimistic;
                }

                renderEverything();
            }
            catch (error) {
                data.personalEvents = data.personalEvents.filter(function (event) {
                    return event.eventId !== optimisticId;
                });
                renderEverything();
                setStatus(error.message || "Could not save event.", true);
            }
        }

        async function deleteEvent(eventId) {
            const current = (data.personalEvents || []).find(function (event) {
                return event.eventId === eventId;
            });

            if (!current) return;

            data.personalEvents = data.personalEvents.filter(function (event) {
                return event.eventId !== eventId;
            });
            renderEverything();

            try {
                const result = await postJson({
                    action: "deletePersonalEvent",
                    email: user.email,
                    eventId: eventId
                });

                if (!result.success) {
                    throw new Error(result.error || "Could not delete event.");
                }
            }
            catch (error) {
                data.personalEvents.push(current);
                renderEverything();
                setStatus(error.message || "Could not delete event.", true);
            }
        }

        function renderColorChoices() {
            const box = document.getElementById("v5CalendarColors");
            if (!box) return;

            const colors = [
                "#34a853",
                "#1a73e8",
                "#7e57c2",
                "#f4511e",
                "#f9ab00",
                "#009688",
                "#d81b60",
                "#5c6bc0"
            ];

            box.innerHTML = colors.map(function (color, index) {
                return `
                    <button
                        type="button"
                        class="calendar-color-choice ${index === 0 ? "selected" : ""}"
                        style="--choice-color:${color}"
                        onclick="selectV5CalendarColor('${color}', this)"
                        aria-label="Choose color"
                    ></button>
                `;
            }).join("");
        }

        function openCalendarCreator() {
            const modal = document.getElementById("v5CalendarModal");
            if (!modal) return;
            modal.hidden = false;
            document.body.classList.add("modal-open");
            setTimeout(function () {
                const input = document.getElementById("v5CalendarName");
                if (input) input.focus();
            }, 40);
        }

        function closeCalendarCreator() {
            const modal = document.getElementById("v5CalendarModal");
            if (modal) modal.hidden = true;
            document.body.classList.remove("modal-open");
        }

        async function saveCalendar() {
            const name = document.getElementById("v5CalendarName");
            const color = document.getElementById("v5CalendarColor");
            const message = document.getElementById("v5CalendarMessage");

            if (!name.value.trim()) {
                message.textContent = "Give the calendar a name.";
                return;
            }

            message.textContent = "Creating...";

            try {
                const result = await postJson({
                    action: "createPersonalCalendar",
                    email: user.email,
                    name: name.value.trim(),
                    color: color.value
                });

                if (!result.success) {
                    throw new Error(result.error || "Could not create calendar.");
                }

                data.personalCalendars = Array.isArray(data.personalCalendars)
                    ? data.personalCalendars
                    : [];
                data.personalCalendars.push(result.calendar);
                visible.add(result.calendar.calendarId);
                activeView = result.calendar.calendarId;
                name.value = "";
                closeCalendarCreator();
                renderEverything();
            }
            catch (error) {
                message.textContent = error.message || "Could not create calendar.";
            }
        }

        async function deleteCalendar(calendarId) {
            const calendar = calendarById(calendarId);
            if (!calendar || calendar.locked) return;

            if (!window.confirm("Delete this personal calendar and its events?")) {
                return;
            }

            const oldCalendars = (data.personalCalendars || []).slice();
            const oldEvents = (data.personalEvents || []).slice();

            data.personalCalendars = oldCalendars.filter(function (item) {
                return item.calendarId !== calendarId;
            });
            data.personalEvents = oldEvents.filter(function (event) {
                return event.calendarId !== calendarId;
            });
            visible.delete(calendarId);
            if (activeView === calendarId) activeView = "all";
            renderEverything();

            try {
                const result = await postJson({
                    action: "deletePersonalCalendar",
                    email: user.email,
                    calendarId: calendarId
                });

                if (!result.success) {
                    throw new Error(result.error || "Could not delete calendar.");
                }
            }
            catch (error) {
                data.personalCalendars = oldCalendars;
                data.personalEvents = oldEvents;
                visible.add(calendarId);
                renderEverything();
                setStatus(error.message || "Could not delete calendar.", true);
            }
        }

        function moveMonth(amount) {
            shownMonth = new Date(
                shownMonth.getFullYear(),
                shownMonth.getMonth() + amount,
                1
            );
            renderMonth();
        }

        function goToday() {
            const now = new Date();
            shownMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            selectedDate = todayValue();
            renderMonth();
            renderDayPanel();
        }

        function cleanup() {
            user = null;
            data = null;
            activeView = "all";
            visible = new Set(["classes", "class-events"]);
        }

        window.selectV5CalendarView = selectView;
        window.toggleV5CalendarVisibility = toggleVisibility;
        window.moveV5CalendarMonth = moveMonth;
        window.goV5CalendarToday = goToday;
        window.openV5EventComposer = openEventComposer;
        window.closeV5EventComposer = closeEventComposer;
        window.saveV5Event = saveEvent;
        window.deleteV5Event = deleteEvent;
        window.openV5CalendarCreator = openCalendarCreator;
        window.closeV5CalendarCreator = closeCalendarCreator;
        window.saveV5Calendar = saveCalendar;
        window.deleteV5Calendar = deleteCalendar;
        window.selectV5CalendarColor = function (color, button) {
            const input = document.getElementById("v5CalendarColor");
            if (input) input.value = color;
            document.querySelectorAll("#v5CalendarColors .calendar-color-choice").forEach(function (item) {
                item.classList.remove("selected");
            });
            if (button) button.classList.add("selected");
        };

        return {
            init: init,
            cleanup: cleanup
        };
    })();

    /* =====================================================
       REMINDERS V5
    ===================================================== */

    window.TuklassReminders = (function () {
        let user = null;
        let reminders = [];
        let activeView = "all";
        let visible = new Set(["class", "personal"]);

        function renderShell() {
            const root = document.querySelector(".route-reminders");
            if (!root) return;

            root.innerHTML = `
                <div class="route-head reminders-v5-head">
                    <div>
                        <div class="route-kicker">Reminders</div>
                        <h1>Reminders</h1>
                        <p>Keep automatic class reminders separate from your personal reminders.</p>
                    </div>
                </div>

                <div id="remindersV5Status" class="reminders-v5-status">Loading reminders...</div>

                <div class="reminders-v5-shell">
                    <aside class="reminders-v5-sidebar">
                        <button type="button" id="remindersAllView" class="reminders-v5-view active" onclick="selectV5ReminderView('all')">All reminders</button>
                        <div class="reminders-v5-group-title">Reminder lists</div>
                        ${renderReminderSidebarRow("class", "Class reminders", "#1a73e8")}
                        ${renderReminderSidebarRow("personal", "Personal reminders", "#7e57c2")}
                    </aside>

                    <main class="reminders-v5-main">
                        <div class="reminders-v5-toolbar">
                            <div>
                                <span id="remindersV5ViewName">All reminders</span>
                                <h2>Agenda</h2>
                            </div>
                            <button type="button" class="reminders-v5-add" onclick="openV5ReminderComposer()">+ New reminder</button>
                        </div>
                        <div id="remindersV5List" class="reminders-v5-list"></div>
                    </main>
                </div>

                <div id="v5ReminderModal" class="calendar-modal" hidden>
                    <button type="button" class="calendar-modal-backdrop" aria-label="Close" onclick="closeV5ReminderComposer()"></button>
                    <div class="calendar-modal-card">
                        <div class="calendar-modal-head">
                            <h2>New personal reminder</h2>
                            <button type="button" onclick="closeV5ReminderComposer()">Close</button>
                        </div>

                        <label>
                            <span>Title</span>
                            <input id="v5ReminderTitle" type="text" maxlength="100" placeholder="Reminder title">
                        </label>

                        <div class="calendar-modal-row">
                            <label>
                                <span>Date</span>
                                <input id="v5ReminderDate" type="date">
                            </label>
                            <label>
                                <span>Time</span>
                                <input id="v5ReminderTime" type="time">
                            </label>
                        </div>

                        <label>
                            <span>Description</span>
                            <textarea id="v5ReminderDescription" maxlength="500" placeholder="Optional"></textarea>
                        </label>

                        <div id="v5ReminderMessage" class="form-message"></div>
                        <button type="button" class="calendar-save-event" onclick="saveV5Reminder()">Save reminder</button>
                    </div>
                </div>
            `;
        }

        function renderReminderSidebarRow(id, name, color) {
            return `
                <div class="reminders-v5-row" data-reminder-row="${id}">
                    <label class="reminders-v5-check">
                        <input type="checkbox" style="accent-color:${color}" checked onchange="toggleV5ReminderVisibility('${id}', this.checked)">
                        <span style="--reminder-color:${color}"></span>
                    </label>
                    <button type="button" onclick="selectV5ReminderView('${id}')">${name}</button>
                </div>
            `;
        }

        async function init() {
            user = getUser();
            renderShell();
            if (!user) return;

            try {
                const result = await fetchJson(
                    APPS_SCRIPT_URL +
                    "?action=reminders&email=" +
                    encodeURIComponent(user.email),
                    {cache: "no-store"},
                    9000
                );

                if (!result.success) {
                    throw new Error(result.error || "Reminders could not load.");
                }

                reminders = Array.isArray(result.reminders) ? result.reminders : [];
                setStatus("");
                render();
            }
            catch (error) {
                setStatus(
                    error.name === "AbortError"
                        ? "Reminders took too long to load. Try again."
                        : (error.message || "Reminders could not load."),
                    true
                );
            }
        }

        function setStatus(message, error) {
            const box = document.getElementById("remindersV5Status");
            if (!box) return;
            box.textContent = message || "";
            box.className = "reminders-v5-status" + (error ? " error" : "");
            box.hidden = !message;
        }

        function selectedType(reminder) {
            return String(reminder.type || "personal").toLowerCase() === "class"
                ? "class"
                : "personal";
        }

        function shouldShow(type) {
            if (activeView !== "all") {
                return activeView === type;
            }
            return visible.has(type);
        }

        function selectView(view) {
            activeView = ["all", "class", "personal"].includes(view) ? view : "all";
            if (view !== "all") visible.add(view);
            render();
        }

        function toggleVisibility(type, checked) {
            if (checked) visible.add(type); else visible.delete(type);
            render();
        }

        function render() {
            const list = document.getElementById("remindersV5List");
            const viewName = document.getElementById("remindersV5ViewName");
            const allView = document.getElementById("remindersAllView");
            if (!list || !viewName || !allView) return;

            allView.classList.toggle("active", activeView === "all");
            document.querySelectorAll("[data-reminder-row]").forEach(function (row) {
                row.classList.toggle("active", row.dataset.reminderRow === activeView);
            });

            viewName.textContent = activeView === "class"
                ? "Class reminders"
                : (activeView === "personal" ? "Personal reminders" : "All reminders");

            const items = reminders
                .filter(function (reminder) {
                    return shouldShow(selectedType(reminder));
                })
                .slice()
                .sort(function (a, b) {
                    return (String(a.date || "") + " " + String(a.time || ""))
                        .localeCompare(String(b.date || "") + " " + String(b.time || ""));
                });

            if (!items.length) {
                list.innerHTML = `
                    <div class="reminders-v5-empty">
                        <strong>No reminders here yet.</strong>
                        <span>${activeView === "class" ? "Automatic class reminders will appear here." : "Create a personal reminder when you need one."}</span>
                    </div>
                `;
                return;
            }

            const groups = {};
            items.forEach(function (item) {
                const key = item.date || "No date";
                if (!groups[key]) groups[key] = [];
                groups[key].push(item);
            });

            list.innerHTML = Object.keys(groups).map(function (dateValue) {
                const date = new Date(dateValue + "T00:00:00");
                const valid = !Number.isNaN(date.getTime());
                const heading = valid
                    ? date.toLocaleDateString(undefined, {weekday: "long", month: "short", day: "numeric"})
                    : dateValue;

                return `
                    <section class="reminders-v5-day">
                        <h3>${escapeHtml(heading)}</h3>
                        <div class="reminders-v5-day-items">
                            ${groups[dateValue].map(function (item) {
                                const type = selectedType(item);
                                const color = type === "class" ? "#1a73e8" : "#7e57c2";
                                return `
                                    <article class="reminders-v5-item" style="--reminder-color:${color}">
                                        <span class="reminders-v5-dot"></span>
                                        <div>
                                            <strong>${escapeHtml(item.title)}</strong>
                                            <span>${escapeHtml(item.time || "All day")}</span>
                                            <small>${type === "class" ? "Automatic class reminder" : "Personal reminder"}</small>
                                            ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}
                                        </div>
                                        ${type === "personal" && item.reminderId ? `
                                            <button type="button" onclick="deleteV5Reminder('${escapeJs(item.reminderId)}')">Delete</button>
                                        ` : ""}
                                    </article>
                                `;
                            }).join("")}
                        </div>
                    </section>
                `;
            }).join("");
        }

        function openComposer() {
            const modal = document.getElementById("v5ReminderModal");
            if (!modal) return;
            const date = document.getElementById("v5ReminderDate");
            if (date && !date.value) date.value = todayValue();
            modal.hidden = false;
            document.body.classList.add("modal-open");
            setTimeout(function () {
                const title = document.getElementById("v5ReminderTitle");
                if (title) title.focus();
            }, 40);
        }

        function closeComposer() {
            const modal = document.getElementById("v5ReminderModal");
            if (modal) modal.hidden = true;
            document.body.classList.remove("modal-open");
        }

        async function saveReminder() {
            const title = document.getElementById("v5ReminderTitle");
            const date = document.getElementById("v5ReminderDate");
            const time = document.getElementById("v5ReminderTime");
            const description = document.getElementById("v5ReminderDescription");
            const message = document.getElementById("v5ReminderMessage");

            if (!title.value.trim() || !date.value) {
                message.textContent = "Enter a title and date.";
                return;
            }

            const optimisticId = "pending_" + Date.now();
            const optimistic = {
                reminderId: optimisticId,
                title: title.value.trim(),
                date: date.value,
                time: time.value,
                description: description.value.trim(),
                type: "personal",
                optimistic: true
            };

            reminders.push(optimistic);
            visible.add("personal");
            if (activeView === "class") activeView = "all";

            title.value = "";
            description.value = "";
            closeComposer();
            render();

            try {
                const result = await postJson({
                    action: "addPersonalReminder",
                    email: user.email,
                    title: optimistic.title,
                    date: optimistic.date,
                    time: optimistic.time,
                    description: optimistic.description
                });

                if (!result.success) {
                    throw new Error(result.error || "Could not save reminder.");
                }

                const item = reminders.find(function (reminder) {
                    return reminder.reminderId === optimisticId;
                });
                if (item && result.reminder) {
                    Object.assign(item, result.reminder);
                    delete item.optimistic;
                }
                render();
            }
            catch (error) {
                reminders = reminders.filter(function (reminder) {
                    return reminder.reminderId !== optimisticId;
                });
                render();
                setStatus(error.message || "Could not save reminder.", true);
            }
        }

        async function deleteReminder(reminderId) {
            const current = reminders.find(function (reminder) {
                return reminder.reminderId === reminderId;
            });
            if (!current) return;

            reminders = reminders.filter(function (reminder) {
                return reminder.reminderId !== reminderId;
            });
            render();

            try {
                const result = await postJson({
                    action: "deletePersonalReminder",
                    email: user.email,
                    reminderId: reminderId
                });
                if (!result.success) {
                    throw new Error(result.error || "Could not delete reminder.");
                }
            }
            catch (error) {
                reminders.push(current);
                render();
                setStatus(error.message || "Could not delete reminder.", true);
            }
        }

        function cleanup() {
            user = null;
            reminders = [];
            activeView = "all";
            visible = new Set(["class", "personal"]);
        }

        window.selectV5ReminderView = selectView;
        window.toggleV5ReminderVisibility = toggleVisibility;
        window.openV5ReminderComposer = openComposer;
        window.closeV5ReminderComposer = closeComposer;
        window.saveV5Reminder = saveReminder;
        window.deleteV5Reminder = deleteReminder;

        return {
            init: init,
            cleanup: cleanup
        };
    })();

    /* =====================================================
       NOTES CATALOG FEEDBACK / SPEED PERCEPTION
    ===================================================== */

    let notesLoadingTimer = null;

    function clearNotesLoading() {
        if (notesLoadingTimer) {
            clearTimeout(notesLoadingTimer);
            notesLoadingTimer = null;
        }
        const overlay = document.getElementById("notesV5LoadingOverlay");
        if (overlay) overlay.remove();
        document.querySelectorAll(".notes-v5-busy").forEach(function (button) {
            button.classList.remove("notes-v5-busy");
            if (button.dataset.oldText) {
                button.textContent = button.dataset.oldText;
                delete button.dataset.oldText;
            }
        });
    }

    function showNotesLoading(message) {
        const content = document.getElementById("notesV4Content");
        if (!content) return;

        clearNotesLoading();

        const overlay = document.createElement("div");
        overlay.id = "notesV5LoadingOverlay";
        overlay.className = "notes-v5-loading-overlay";
        overlay.innerHTML = `
            <div class="notes-v5-loading-card">
                <span class="notes-v5-spinner"></span>
                <strong>${escapeHtml(message || "Loading...")}</strong>
                <small>This should only take a moment.</small>
            </div>
        `;
        content.appendChild(overlay);

        notesLoadingTimer = setTimeout(clearNotesLoading, 10000);
    }

    document.addEventListener(
        "click",
        function (event) {
            const collectionButton = event.target.closest(".collection-open-v4");
            if (collectionButton) {
                showNotesLoading("Opening collection...");
                return;
            }

            const catalogButton = event.target.closest(".notes-v4-card button");
            if (catalogButton) {
                if (!catalogButton.dataset.oldText) {
                    catalogButton.dataset.oldText = catalogButton.textContent;
                }
                catalogButton.textContent = "Opening...";
                catalogButton.classList.add("notes-v5-busy");
                setTimeout(clearNotesLoading, 1500);
                return;
            }

            const actionButton = event.target.closest(
                ".catalog-picker-list-v4 button, .material-catalog-v4 button"
            );
            if (actionButton) {
                if (!actionButton.dataset.oldText) {
                    actionButton.dataset.oldText = actionButton.textContent;
                }
                actionButton.textContent = "Adding...";
                actionButton.classList.add("notes-v5-busy");
                setTimeout(clearNotesLoading, 5000);
            }
        },
        true
    );

    const originalNotes = window.TuklassNotes;
    if (originalNotes) {
        window.TuklassNotes = {
            init: async function () {
                clearNotesLoading();
                await originalNotes.init();
            },
            cleanup: function () {
                clearNotesLoading();
                if (originalNotes.cleanup) originalNotes.cleanup();
            }
        };
    }
})();
