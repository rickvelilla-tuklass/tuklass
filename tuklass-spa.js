
window.TuklassCalendar = (function () {
const APPS_SCRIPT_URL =
    window.TUKLASS_CONFIG.apiUrl;


const ACCESS_CACHE_TIME =
    5 * 60 * 1000;


let currentUser =
    null;


let calendarData =
    null;


let displayedMonth =
    new Date();


displayedMonth.setDate(
    1
);



/* =========================================================
   START
========================================================= */

async function init() {

        /*
         * The Tuklass backend was recently moved to a new Apps Script
         * deployment. Keep the signed-in session, but clear cached data
         * from an older backend so Calendar does not inherit an old
         * registration state.
         */
        try {

            const backendMarkerKey =
                "tuklass_backend_endpoint";

            const previousBackend =
                localStorage.getItem(
                    backendMarkerKey
                );

            if (
                previousBackend !==
                APPS_SCRIPT_URL
            ) {

                const stalePrefixes = [
                    "writejot_access_",
                    "writejot_calendar_",
                    "writejot_reminders_",
                    "writejot_conversations_",
                    "writejot_chat_cache_"
                ];

                Object
                    .keys(localStorage)
                    .forEach(function(key) {

                        if (
                            stalePrefixes.some(
                                function(prefix) {
                                    return key.indexOf(prefix) === 0;
                                }
                            )
                        ) {

                            localStorage.removeItem(
                                key
                            );

                        }

                    });


                localStorage.setItem(
                    backendMarkerKey,
                    APPS_SCRIPT_URL
                );

            }

        }

        catch {}


        const saved =
            localStorage.getItem(
                "writejotUser"
            );


        if (!saved) {

            location.href =
                "index.html";

            return;

        }


        try {

            currentUser =
                JSON.parse(
                    saved
                );

        }

        catch {

            location.href =
                "index.html";

            return;

        }


        document
            .getElementById(
                "eventDate"
            )
            .value =
            localDateString(
                new Date()
            );


        const cachedAccess =
            getCachedAccess();


        if (
            cachedAccess &&
            cachedAccess.access === true
        ) {

            loadCalendarCache();


            if (
                calendarData
            ) {

                renderState();

            }


            refreshCalendar();

        }

        else {

            verifyAccessAndStart();

        }

}


/* =========================================================
   ACCESS
========================================================= */

function accessCacheKey() {

    return (
        "writejot_access_" +
        String(
            currentUser.email
        )
        .trim()
        .toLowerCase()
    );

}


function getCachedAccess() {

    try {

        const raw =
            localStorage.getItem(
                accessCacheKey()
            );


        if (!raw) {
            return null;
        }


        const data =
            JSON.parse(
                raw
            );


        if (
            Date.now() -
            Number(
                data.checkedAt || 0
            )
            >
            ACCESS_CACHE_TIME
        ) {

            return null;

        }


        return data;

    }

    catch {

        return null;

    }

}


function saveAccessCache(
    result
) {

    try {

        localStorage.setItem(

            accessCacheKey(),

            JSON.stringify({

                access:
                    result.access === true,

                status:
                    result.status ||
                    "",

                checkedAt:
                    Date.now()

            })

        );

    }

    catch {}

}


async function verifyAccessAndStart() {

    try {

        const response =
            await fetch(

                APPS_SCRIPT_URL +
                "?action=access&email=" +
                encodeURIComponent(
                    currentUser.email
                ),

                {
                    cache:
                        "no-store"
                }

            );


        const result =
            await response.json();


        saveAccessCache(
            result
        );


        if (
            !result.success ||
            result.access !== true
        ) {

            showLocked(
                "Your Tuklass trial or subscription has expired."
            );

            return;

        }


        loadCalendarCache();


        if (
            calendarData
        ) {

            renderState();

        }


        refreshCalendar();

    }

    catch {

        showLocked(
            "Tuklass could not verify your account right now."
        );

    }

}


/* =========================================================
   CACHE
========================================================= */

function calendarCacheKey() {

    return (
        "writejot_calendar_" +
        String(
            currentUser.email
        )
        .trim()
        .toLowerCase()
    );

}


function loadCalendarCache() {

    try {

        const raw =
            localStorage.getItem(
                calendarCacheKey()
            );


        if (!raw) {

            return;

        }


        calendarData =
            JSON.parse(
                raw
            );

    }

    catch {}

}


function saveCalendarCache() {

    try {

        if (
            calendarData
        ) {

            localStorage.setItem(

                calendarCacheKey(),

                JSON.stringify(
                    calendarData
                )

            );

        }

    }

    catch {}

}



/* =========================================================
   REFRESH
========================================================= */

async function refreshCalendar() {

    try {

        const response =
            await fetch(

                APPS_SCRIPT_URL +
                "?action=calendarStatus&email=" +
                encodeURIComponent(
                    currentUser.email
                ),

                {
                    cache:
                        "no-store"
                }

            );


        const result =
            await response.json();


        /*
         * EXPIRED = LOCK CALENDAR
         */

        if (
            result.accessDenied === true ||
            result.access === false
        ) {

            saveAccessCache({

                access:
                    false,

                status:
                    result.status ||
                    "expired"

            });


            showLocked(
                result.error ||
                "Your Tuklass trial or subscription has expired."
            );


            return;

        }


        if (
            !result.success
        ) {

            const registrationArea =
                document.getElementById(
                    "registrationArea"
                );

            const content =
                document.getElementById(
                    "calendarContent"
                );

            if (content) {
                content.style.display =
                    "none";
            }

            if (registrationArea) {

                registrationArea.innerHTML =
                    `
                    <div class="registration-card">
                        <h2>Calendar could not load</h2>
                        <p style="color:#718096;margin-bottom:0;">
                            ${escapeHtml(
                                result.error ||
                                "Tuklass could not load your class registration."
                            )}
                        </p>
                    </div>
                    `;

            }

            return;

        }


        saveAccessCache({

            access:
                true,

            status:
                result.status ||
                "active"

        });


        calendarData =
            result;


        saveCalendarCache();


        renderState();

    }

    catch {

        console.log(
            "Calendar refresh failed."
        );

    }

    finally {

        document
            .getElementById(
                "updateIndicator"
            )
            .style.display =
            "none";

    }

}



/* =========================================================
   LOCK
========================================================= */

function showLocked(
    message
) {

    document
        .getElementById(
            "calendarInterface"
        )
        .style.display =
        "none";


    document
        .getElementById(
            "lockScreen"
        )
        .style.display =
        "flex";


    document
        .getElementById(
            "lockMessage"
        )
        .textContent =
        message ||
        "Your Tuklass access has expired.";

}



/* =========================================================
   STATE
========================================================= */

function renderState() {

    if (
        !calendarData
    ) {

        return;

    }


    const registrationArea =
        document.getElementById(
            "registrationArea"
        );


    const content =
        document.getElementById(
            "calendarContent"
        );


    if (
        !calendarData.registered
    ) {

        content.style.display =
            "none";

        registrationArea.innerHTML =
        `
        <div class="registration-card">

            <h2>
                Finish your school setup
            </h2>

            <p
                style="
                    color:#718096;
                    margin-bottom:20px;
                "
            >
                Your Tuklass account does not have a school and section yet.
                School and section are now selected during account setup instead
                of inside Calendar.
            </p>

            <a
                href="index.html"
                class="primary-button"
                style="display:inline-flex;text-decoration:none;align-items:center;justify-content:center;"
            >
                Finish Account Setup
            </a>

        </div>
        `;

        return;

    }


    registrationArea.innerHTML =
        "";


    content.style.display =
        "block";


    if (
        !calendarData.approved
    ) {

        document
            .getElementById(
                "statusCard"
            )
            .className =
            "status-card pending";


        document
            .getElementById(
                "statusTitle"
            )
            .textContent =
            "Registration pending";


        document
            .getElementById(
                "statusText"
            )
            .innerHTML =

            `
            Your registration for
            <strong>
                ${escapeHtml(
                    calendarData.registration.section
                )}
            </strong>
            is waiting for approval.
            `;

    }

    else {

        document
            .getElementById(
                "statusCard"
            )
            .className =
            "status-card approved";


        document
            .getElementById(
                "statusTitle"
            )
            .textContent =
            "Class connected";


        document
            .getElementById(
                "statusText"
            )
            .innerHTML =

            `
            Your class is
            <strong>
                ${escapeHtml(
                    [
                        calendarData.registration.schoolName,
                        calendarData.registration.section
                    ]
                    .filter(Boolean)
                    .join(" · ")
                )}
            </strong>.
            `;

    }


    renderCalendar();

}



/* =========================================================
   CALENDAR RENDER
========================================================= */

function renderCalendar() {

    const grid =
        document.getElementById(
            "calendarGrid"
        );


    const year =
        displayedMonth.getFullYear();


    const month =
        displayedMonth.getMonth();


    document
        .getElementById(
            "monthTitle"
        )
        .textContent =
        displayedMonth.toLocaleDateString(
            undefined,
            {
                month:
                    "long",

                year:
                    "numeric"
            }
        );


    grid.innerHTML =
        "";


    const firstDay =
        new Date(
            year,
            month,
            1
        ).getDay();


    const daysInMonth =
        new Date(
            year,
            month + 1,
            0
        ).getDate();


    const total =
        Math.ceil(
            (
                firstDay +
                daysInMonth
            ) / 7
        ) * 7;


    for (
        let i = 0;
        i < total;
        i++
    ) {

        const date =
            new Date(
                year,
                month,
                i -
                firstDay +
                1
            );


        const cell =
            document.createElement(
                "div"
            );


        cell.className =
            "day";


        if (
            date.getMonth() !==
            month
        ) {

            cell.classList.add(
                "other-month"
            );

        }


        const dateString =
            localDateString(
                date
            );


        if (
            dateString ===
            localDateString(
                new Date()
            )
        ) {

            cell.classList.add(
                "today"
            );

        }


        const number =
            document.createElement(
                "div"
            );


        number.className =
            "day-number";


        number.textContent =
            date.getDate();


        cell.appendChild(
            number
        );


        if (
            calendarData.approved
        ) {

            getClassesForDate(
                date
            )
            .forEach(
                function(event) {

                    cell.appendChild(
                        makeChip(
                            event
                        )
                    );

                }
            );


            getTestsForDate(
                dateString
            )
            .forEach(
                function(test) {

                    cell.appendChild(
                        makeChip({

                            type:
                                "test",

                            title:
                                test.title,

                            time:
                                test.startTime

                        })
                    );

                }
            );

        }


        (
            calendarData.personalEvents ||
            []
        )
        .filter(
            function(event) {

                return (
                    event.date ===
                    dateString
                );

            }
        )
        .forEach(
            function(event) {

                cell.appendChild(
                    makeChip(
                        {

                            type:
                                "personal",

                            title:
                                event.title,

                            time:
                                event.startTime,

                            saving:
                                event.saving,

                            failed:
                                event.failed

                        }
                    )
                );

            }
        );


        cell.addEventListener(
            "click",
            function() {

                document
                    .getElementById(
                        "eventDate"
                    )
                    .value =
                    dateString;


                document
                    .getElementById(
                        "eventTitle"
                    )
                    .focus();

            }
        );


        grid.appendChild(
            cell
        );

    }


    renderUpcoming();

}



/* =========================================================
   CLASS EVENTS
========================================================= */

function getClassesForDate(
    date
) {

    const days = [

        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday"

    ];


    const weekday =
        days[
            date.getDay()
        ];


    return (
        calendarData.schedule ||
        []
    )
    .filter(
        function(event) {

            return (
                String(
                    event.day ||
                    ""
                )
                .trim()
                .toLowerCase()
                ===
                weekday.toLowerCase()
            );

        }
    )
    .map(
        function(event) {

            return {

                type:
                    "class",

                title:
                    event.subject,

                time:
                    event.startTime

            };

        }
    );

}


function getTestsForDate(
    date
) {

    return (
        calendarData.tests ||
        []
    )
    .filter(
        function(test) {

            return (
                test.date ===
                date
            );

        }
    );

}



/* =========================================================
   EVENT CHIP
========================================================= */

function makeChip(
    event
) {

    const chip =
        document.createElement(
            "div"
        );


    chip.className =
        "event-chip " +
        (
            event.type ===
                "test"

                ? "event-test"

                : event.type ===
                    "personal"

                    ? "event-personal"

                    : "event-class"
        );


    if (
        event.saving
    ) {

        chip.classList.add(
            "event-saving"
        );

    }


    if (
        event.failed
    ) {

        chip.classList.add(
            "event-failed"
        );

    }


    chip.textContent =
        (
            event.time
                ? event.time +
                  " "
                : ""
        ) +
        (
            event.title ||
            ""
        );


    return chip;

}



/* =========================================================
   UPCOMING
========================================================= */

function renderUpcoming() {

    const box =
        document.getElementById(
            "upcomingEvents"
        );


    const items =
        [];


    const today =
        localDateString(
            new Date()
        );


    if (
        calendarData.approved
    ) {

        (
            calendarData.tests ||
            []
        )
        .filter(
            function(test) {

                return (
                    test.date >=
                    today
                );

            }
        )
        .slice(
            0,
            5
        )
        .forEach(
            function(test) {

                items.push({

                    date:
                        test.date,

                    title:
                        test.title,

                    meta:
                        test.subject,

                    color:
                        "#dc2626"

                });

            }
        );

    }


    (
        calendarData.personalEvents ||
        []
    )
    .filter(
        function(event) {

            return (
                event.date >=
                today
            );

        }
    )
    .forEach(
        function(event) {

            items.push({

                date:
                    event.date,

                title:
                    event.title,

                meta:
                    event.startTime,

                color:
                    "#16834a",

                eventId:
                    event.eventId,

                saving:
                    event.saving

            });

        }
    );


    items.sort(
        function(a,b) {

            return (
                a.date.localeCompare(
                    b.date
                )
            );

        }
    );


    if (
        !items.length
    ) {

        box.innerHTML =

            `
            <div
                style="
                    color:#8a94a6;
                    font-size:13px;
                "
            >
                Nothing upcoming.
            </div>
            `;


        return;

    }


    box.innerHTML =
        items
            .slice(
                0,
                10
            )
            .map(
                function(item) {

                    return `

                    <div
                        class="upcoming-event"
                    >

                        <div
                            class="upcoming-date"
                        >
                            ${escapeHtml(
                                prettyDate(
                                    item.date
                                )
                            )}
                        </div>


                        <div
                            class="upcoming-title"
                            style="
                                color:${item.color};
                            "
                        >
                            ${escapeHtml(
                                item.title
                            )}
                        </div>


                        <div
                            class="upcoming-meta"
                        >
                            ${escapeHtml(
                                item.meta ||
                                ""
                            )}

                            ${
                                item.saving
                                    ? " · Saving..."
                                    : ""
                            }

                        </div>


                        ${
                            item.eventId
                                ? `
                                    <button
                                        class="personal-delete"
                                        type="button"
                                        onclick="deleteEvent(
                                            '${escapeHtml(
                                                item.eventId
                                            )}'
                                        )"
                                    >
                                        Delete
                                    </button>
                                  `
                                : ""
                        }

                    </div>

                    `;

                }
            )
            .join("");

}



/* =========================================================
   OPTIMISTIC ADD EVENT
========================================================= */

async function addEvent() {

    const title =
        document
            .getElementById(
                "eventTitle"
            )
            .value
            .trim();


    const date =
        document
            .getElementById(
                "eventDate"
            )
            .value;


    const startTime =
        document
            .getElementById(
                "eventStart"
            )
            .value;


    const endTime =
        document
            .getElementById(
                "eventEnd"
            )
            .value;


    const description =
        document
            .getElementById(
                "eventDescription"
            )
            .value
            .trim();


    const message =
        document.getElementById(
            "eventMessage"
        );


    if (
        !title ||
        !date
    ) {

        message.textContent =
            "Enter a title and date.";

        message.style.color =
            "#dc2626";

        return;

    }


    /*
     * Temporary event appears
     * immediately.
     */

    const temporaryId =
        "temp_" +
        Date.now();


    if (
        !calendarData.personalEvents
    ) {

        calendarData.personalEvents =
            [];

    }


    const temporaryEvent = {

        eventId:
            temporaryId,

        title:
            title,

        date:
            date,

        startTime:
            startTime,

        endTime:
            endTime,

        description:
            description,

        saving:
            true,

        temporary:
            true

    };


    calendarData.personalEvents.push(
        temporaryEvent
    );


    /*
     * Immediately update calendar.
     */

    renderCalendar();


    saveCalendarCache();


    /*
     * Clear fields immediately.
     */

    document
        .getElementById(
            "eventTitle"
        )
        .value =
        "";


    document
        .getElementById(
            "eventStart"
        )
        .value =
        "";


    document
        .getElementById(
            "eventEnd"
        )
        .value =
        "";


    document
        .getElementById(
            "eventDescription"
        )
        .value =
        "";


    try {

        const response =
            await fetch(

                APPS_SCRIPT_URL,

                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "text/plain;charset=utf-8"

                    },

                    body:
                        JSON.stringify({

                            action:
                                "addPersonalEvent",

                            email:
                                currentUser.email,

                            title:
                                title,

                            date:
                                date,

                            startTime:
                                startTime,

                            endTime:
                                endTime,

                            description:
                                description

                        })

                }

            );


        const result =
            await response.json();


        if (
            result.accessDenied ||
            result.access === false
        ) {

            showLocked(
                "Your Tuklass access has expired."
            );

            return;

        }


        if (
            !result.success
        ) {

            throw new Error(
                result.error ||
                "Could not save event."
            );

        }


        /*
         * Replace temporary event
         * with server-confirmed event.
         */

        calendarData.personalEvents =
            calendarData.personalEvents
                .filter(
                    function(event) {

                        return (
                            event.eventId !==
                            temporaryId
                        );

                    }
                );


        calendarData.personalEvents.push({

            eventId:
                result.eventId,

            title:
                result.title,

            date:
                result.date,

            startTime:
                result.startTime,

            endTime:
                result.endTime,

            description:
                result.description

        });


        saveCalendarCache();


        renderCalendar();

    }

    catch (error) {

        /*
         * Remove the optimistic event.
         */

        calendarData.personalEvents =
            calendarData.personalEvents
                .filter(
                    function(event) {

                        return (
                            event.eventId !==
                            temporaryId
                        );

                    }
                );


        saveCalendarCache();


        renderCalendar();


        message.textContent =
            error.message ||
            "Could not save event.";

        message.style.color =
            "#dc2626";

    }

}



/* =========================================================
   OPTIMISTIC DELETE
========================================================= */

async function deleteEvent(
    eventId
) {

    const existing =
        calendarData.personalEvents
            .find(
                function(event) {

                    return (
                        event.eventId ===
                        eventId
                    );

                }
            );


    if (!existing) {

        return;

    }


    const originalEvents =
        calendarData.personalEvents.slice();


    /*
     * Remove immediately.
     */

    calendarData.personalEvents =
        calendarData.personalEvents
            .filter(
                function(event) {

                    return (
                        event.eventId !==
                        eventId
                    );

                }
            );


    renderCalendar();


    saveCalendarCache();


    try {

        const response =
            await fetch(

                APPS_SCRIPT_URL,

                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "text/plain;charset=utf-8"

                    },

                    body:
                        JSON.stringify({

                            action:
                                "deletePersonalEvent",

                            email:
                                currentUser.email,

                            eventId:
                                eventId

                        })

                }

            );


        const result =
            await response.json();


        if (
            result.accessDenied ||
            result.access === false
        ) {

            showLocked(
                "Your Tuklass access has expired."
            );

            return;

        }


        if (
            !result.success
        ) {

            throw new Error(
                result.error ||
                "Could not delete event."
            );

        }

    }

    catch (error) {

        /*
         * Restore event if deletion failed.
         */

        calendarData.personalEvents =
            originalEvents;


        renderCalendar();


        saveCalendarCache();


        alert(
            error.message ||
            "Could not delete event."
        );

    }

}



/* =========================================================
   REGISTRATION
========================================================= */

async function submitRegistration() {

    const name =
        document
            .getElementById(
                "registrationName"
            )
            .value
            .trim();


    const section =
        document
            .getElementById(
                "registrationSection"
            )
            .value
            .trim();


    const message =
        document.getElementById(
            "registrationMessage"
        );


    if (
        !name ||
        !section
    ) {

        message.textContent =
            "Enter your name and section.";

        return;

    }


    const button =
        document.getElementById(
            "registerButton"
        );


    button.disabled =
        true;


    try {

        const response =
            await fetch(

                APPS_SCRIPT_URL,

                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "text/plain;charset=utf-8"

                    },

                    body:
                        JSON.stringify({

                            action:
                                "registerClass",

                            email:
                                currentUser.email,

                            name:
                                name,

                            section:
                                section

                        })

                }

            );


        const result =
            await response.json();


        if (
            result.accessDenied
        ) {

            showLocked(
                "Your Tuklass access has expired."
            );

            return;

        }


        if (
            !result.success
        ) {

            throw new Error(
                result.error
            );

        }


        await refreshCalendar();

    }

    catch (error) {

        message.textContent =
            error.message;

        message.style.color =
            "#dc2626";

    }

    finally {

        button.disabled =
            false;

    }

}



/* =========================================================
   NAVIGATION
========================================================= */

function changeMonth(
    amount
) {

    displayedMonth.setMonth(
        displayedMonth.getMonth() +
        amount
    );


    renderCalendar();

}


function goToToday() {

    displayedMonth =
        new Date();


    displayedMonth.setDate(
        1
    );


    renderCalendar();

}



/* =========================================================
   HELPERS
========================================================= */

function localDateString(
    date
) {

    return [

        date.getFullYear(),

        String(
            date.getMonth() + 1
        )
        .padStart(
            2,
            "0"
        ),

        String(
            date.getDate()
        )
        .padStart(
            2,
            "0"
        )

    ].join("-");

}


function prettyDate(
    value
) {

    const date =
        new Date(
            value +
            "T00:00:00"
        );


    if (
        isNaN(
            date.getTime()
        )
    ) {

        return value;

    }


    return date.toLocaleDateString(
        undefined,
        {

            weekday:
                "short",

            month:
                "short",

            day:
                "numeric"

        }
    );

}


function escapeHtml(
    value
) {

    return String(
        value ||
        ""
    )
    .replace(
        /&/g,
        "&amp;"
    )
    .replace(
        /</g,
        "&lt;"
    )
    .replace(
        />/g,
        "&gt;"
    )
    .replace(
        /"/g,
        "&quot;"
    )
    .replace(
        /'/g,
        "&#039;"
    );

}

    async function spaInit() {
        window.changeMonth = changeMonth;
        window.goToToday = goToToday;
        window.addEvent = addEvent;
        window.submitRegistration = submitRegistration;
        window.deleteEvent = deleteEvent;
        await init();
    }

    function cleanup() {
        try { delete window.changeMonth; } catch {}
        try { delete window.goToToday; } catch {}
        try { delete window.addEvent; } catch {}
        try { delete window.submitRegistration; } catch {}
        try { delete window.deleteEvent; } catch {}
    }

    return {
        init: spaInit,
        cleanup: cleanup
    };
})();



window.TuklassReminders = (function () {
const APPS_SCRIPT_URL =
    window.TUKLASS_CONFIG.apiUrl;


let currentUser =
    null;

let data =
    null;

let reminders =
    [];

let refreshTimer =
    null;


let conversationSearchQuery =
    "";


/* =========================================================
   START
========================================================= */

function init() {

        const saved =
            localStorage.getItem(
                "writejotUser"
            );


        if (!saved) {

            showMessage(
                "Please sign in to Tuklass first."
            );

            return;

        }


        try {

            currentUser =
                JSON.parse(
                    saved
                );

        }

        catch {

            showMessage(
                "Your Tuklass session could not be loaded."
            );

            return;

        }


        /*
         * Load cached reminders instantly.
         */

        loadCache();


        /*
         * Render cached information immediately.
         */

        if (
            data
        ) {

            render();

        }


        /*
         * Refresh from server.
         */

        verifyAccess();

}


/* =========================================================
   ACCESS CACHE
========================================================= */

function accessCacheKey() {

    return (
        "writejot_access_" +
        currentUser.email
            .trim()
            .toLowerCase()
    );

}


function getAccessCache() {

    try {

        const raw =
            localStorage.getItem(
                accessCacheKey()
            );


        if (!raw) {
            return null;
        }


        const result =
            JSON.parse(
                raw
            );


        if (
            Date.now() -
            Number(
                result.checkedAt ||
                0
            )
            >
            5 * 60 * 1000
        ) {

            return null;

        }


        return result;

    }

    catch {

        return null;

    }

}


function saveAccessCache(
    result
) {

    try {

        localStorage.setItem(

            accessCacheKey(),

            JSON.stringify({

                access:
                    result.access === true,

                status:
                    result.status ||
                    "",

                checkedAt:
                    Date.now()

            })

        );

    }

    catch {}

}


/* =========================================================
   ACCESS
========================================================= */

async function verifyAccess() {

    const cached =
        getAccessCache();


    /*
     * Don't blank a cached page while
     * checking the server.
     */

    if (
        cached &&
        cached.access === true
    ) {

        if (
            data
        ) {

            render();

        }

    }


    try {

        const response =
            await fetch(

                APPS_SCRIPT_URL +
                "?action=access&email=" +
                encodeURIComponent(
                    currentUser.email
                ),

                {
                    cache:
                        "no-store"
                }

            );


        const result =
            await response.json();


        saveAccessCache(
            result
        );


        if (
            !result.success ||
            result.access !== true
        ) {

            showLock(
                "Your Tuklass trial or subscription has expired."
            );

            return;

        }


        await refreshReminders();

    }

    catch {

        /*
         * Keep cached content visible if
         * the server is temporarily slow.
         */

        if (
            !data
        ) {

            showMessage(
                "Could not connect to Tuklass."
            );

        }

    }

}


/* =========================================================
   REFRESH REMINDERS
========================================================= */

async function refreshReminders() {

    try {

        const response =
            await fetch(

                APPS_SCRIPT_URL +
                "?action=reminders&email=" +
                encodeURIComponent(
                    currentUser.email
                ),

                {
                    cache:
                        "no-store"
                }

            );


        const result =
            await response.json();


        if (
            result.accessDenied === true ||
            result.access === false
        ) {

            saveAccessCache({

                access:
                    false,

                status:
                    result.status ||
                    "expired"

            });


            showLock(
                "Your Tuklass trial or subscription has expired."
            );


            return;

        }


        if (
            !result.success
        ) {

            return;

        }


        data =
            result;


        reminders =
            Array.isArray(
                result.reminders
            )
                ? result.reminders
                : [];


        saveCache();


        render();

        startRefreshTimer();

    }

    catch {

        console.log(
            "Reminder refresh failed."
        );

    }

}


/* =========================================================
   AUTO REFRESH
========================================================= */

function startRefreshTimer() {

    if (
        refreshTimer
    ) {

        clearInterval(
            refreshTimer
        );

    }


    refreshTimer =
        setInterval(
            function () {
                if (document.visibilityState === "visible") {
                    refreshReminders();
                }
            },
            Number(
                window.TUKLASS_CONFIG &&
                window.TUKLASS_CONFIG.polling &&
                window.TUKLASS_CONFIG.polling.remindersMs
            ) || 60000
        );

}



/* =========================================================
   CACHE
========================================================= */

function cacheKey() {

    return (
        "writejot_reminders_" +
        currentUser.email
            .trim()
            .toLowerCase()
    );

}


function loadCache() {

    try {

        const raw =
            localStorage.getItem(
                cacheKey()
            );


        if (!raw) {
            return;
        }


        const cached =
            JSON.parse(
                raw
            );


        if (
            !cached
        ) {

            return;

        }


        data =
            cached;


        reminders =
            Array.isArray(
                cached.reminders
            )
                ? cached.reminders
                : [];

    }

    catch {}

}


function saveCache() {

    try {

        if (
            !data
        ) {
            return;
        }


        localStorage.setItem(

            cacheKey(),

            JSON.stringify({

                ...data,

                reminders:
                    reminders

            })

        );

    }

    catch {}

}


/* =========================================================
   RENDER
========================================================= */

function render() {

    const content =
        document.getElementById(
            "content"
        );


    if (!data) {
        return;
    }


    /*
     * No school/class is attached to this account yet.
     */

    if (
        !data.registered
    ) {

        content.innerHTML =
        `
        <div class="center">

            <div
                style="
                    margin-bottom:10px;
                "
            >
                <img src="images/CalendarA.png" alt="" style="width:44px;height:44px;object-fit:contain;">
            </div>

            <h2>
                Finish your school setup
            </h2>

            <p>
                Tuklass now saves your school and section directly on your
                account. Finish setup once and Calendar and Reminders will use
                your class automatically.
            </p>

            <a
                href="index.html"
                class="center-button"
            >
                Finish Account Setup
            </a>

        </div>
        `;

        return;

    }


    /*
     * Legacy pending state. New school/class accounts are ready immediately.
     */

    if (
        !data.approved
    ) {

        content.innerHTML =

        `
        <div class="center">

            <div
                style="
                    font-size:48px;
                    margin-bottom:10px;
                "
            >
                <img src="images/CalendarA.png" alt="" style="width:44px;height:44px;object-fit:contain;">
            </div>


            <h2>
                Class registration pending
            </h2>


            <p>
                Your registered section is
                <strong>
                    ${escapeHtml(
                        data.registration.section
                    )}
                </strong>.
                Reminders will appear after your
                registration is approved.
            </p>


            <a
                href="calendar.html"
                class="center-button"
            >
                Open Calendar
            </a>

        </div>
        `;


        return;

    }


    /*
     * Main page.
     */

    content.innerHTML =

    `
    <div class="class-card">

        <div class="class-label">
            Your class
        </div>


        <div class="class-name">
            ${escapeHtml(
                [
                    data.registration.schoolName,
                    data.registration.section
                ]
                .filter(Boolean)
                .join(" · ")
            )}
        </div>

    </div>


    <div class="layout">


        <div class="card">

            <div class="list-header">

                <strong>
                    <img src="images/BelleA.png" alt="" style="width:26px;height:26px;object-fit:contain;vertical-align:middle;margin-right:8px;"> Reminders
                </strong>


                <span
                    style="
                        color:#8a94a6;
                        font-size:12px;
                    "
                >
                    ${reminders.length}
                </span>

            </div>


            <div
                id="reminderList"
            ></div>

        </div>



        <div class="card form-card">

            <h2>
                Add Personal Reminder
            </h2>


            <div class="field">

                <label>
                    Title
                </label>


                <input
                    id="reminderTitle"
                    type="text"
                    maxlength="100"
                    placeholder="e.g. Finish math homework"
                >

            </div>


            <div class="field">

                <label>
                    Date
                </label>


                <input
                    id="reminderDate"
                    type="date"
                >

            </div>


            <div class="field">

                <label>
                    Time
                </label>


                <input
                    id="reminderTime"
                    type="time"
                >

            </div>


            <div class="field">

                <label>
                    Description
                </label>


                <textarea
                    id="reminderDescription"
                    maxlength="500"
                    placeholder="Optional"
                ></textarea>

            </div>


            <button
                id="addReminderButton"
                class="primary-button"
                type="button"
                onclick="addPersonalReminder()"
            >
                + Add Reminder
            </button>


            <div
                id="formMessage"
                class="form-message"
            ></div>

        </div>

    </div>
    `;


    const dateInput =
        document.getElementById(
            "reminderDate"
        );


    if (
        dateInput &&
        !dateInput.value
    ) {

        dateInput.value =
            getToday();

    }


    renderReminderList();

}



/* =========================================================
   RENDER REMINDERS
========================================================= */

function renderReminderList(){const list=document.getElementById("reminderList");if(!list)return;if(!reminders.length){list.innerHTML='<div class="agenda-empty"><strong>Nothing scheduled</strong><span>Your class and personal reminders will appear here.</span></div>';return;}const sorted=reminders.slice().sort((a,b)=>(String(a.date||"")+" "+String(a.time||"23:59")).localeCompare(String(b.date||"")+" "+String(b.time||"23:59")));const groups={};sorted.forEach(r=>{const k=r.date||"No date";(groups[k]||(groups[k]=[])).push(r);});list.innerHTML=Object.keys(groups).map(date=>{const d=new Date(date+"T00:00:00"),ok=!Number.isNaN(d.getTime()),dl=ok?d.toLocaleDateString(undefined,{month:"short",day:"numeric"}):date,dn=ok?d.toLocaleDateString(undefined,{weekday:"long"}):"";const items=groups[date].map(r=>{const c=String(r.type||"").toLowerCase()==="class";return `<div class="agenda-item ${c?"class-item":"personal-item"}"><div class="agenda-time">${escapeHtml(r.time||"All day")}</div><div class="agenda-line"><span class="agenda-dot"></span><div class="agenda-copy"><div class="agenda-title">${escapeHtml(r.title)}</div>${r.description?`<div class="agenda-description">${escapeHtml(r.description)}</div>`:""}<span class="agenda-type">${c?"Class":"Personal"}</span></div>${r.optimistic?'<span class="agenda-saving">Saving...</span>':(!c&&r.reminderId?`<button class="agenda-delete" onclick="deletePersonalReminder('${escapeHtml(r.reminderId)}')">Delete</button>`:"")}</div></div>`;}).join("");return `<section class="agenda-day"><div class="agenda-date"><strong>${escapeHtml(dl)}</strong><span>${escapeHtml(dn)}</span></div><div class="agenda-items">${items}</div></section>`;}).join("");}


/* =========================================================
   ADD PERSONAL REMINDER
========================================================= */

async function addPersonalReminder() {

    const title =
        document
            .getElementById(
                "reminderTitle"
            )
            .value
            .trim();


    const date =
        document
            .getElementById(
                "reminderDate"
            )
            .value;


    const time =
        document
            .getElementById(
                "reminderTime"
            )
            .value;


    const description =
        document
            .getElementById(
                "reminderDescription"
            )
            .value
            .trim();


    const button =
        document.getElementById(
            "addReminderButton"
        );


    const message =
        document.getElementById(
            "formMessage"
        );


    if (
        !title ||
        !date
    ) {

        message.textContent =
            "Please enter a title and date.";

        message.style.color =
            "#dc2626";

        return;

    }


    const temporaryId =
        "temp_" +
        Date.now();


    /*
     * OPTIMISTIC UI:
     * show it immediately.
     */

    const optimisticReminder = {

        reminderId:
            temporaryId,

        title:
            title,

        date:
            date,

        time:
            time,

        description:
            description,

        type:
            "personal",

        section:
            data.registration.section,

        optimistic:
            true

    };


    reminders.push(
        optimisticReminder
    );


    renderReminderList();


    saveCache();


    /*
     * Clear the form immediately.
     */

    document
        .getElementById(
            "reminderTitle"
        )
        .value =
        "";


    document
        .getElementById(
            "reminderTime"
        )
        .value =
        "";


    document
        .getElementById(
            "reminderDescription"
        )
        .value =
        "";


    message.textContent =
        "Reminder added.";

    message.style.color =
        "#16834a";


    button.disabled =
        true;


    try {

        const response =
            await fetch(

                APPS_SCRIPT_URL,

                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "text/plain;charset=utf-8"

                    },

                    body:
                        JSON.stringify({

                            action:
                                "addPersonalReminder",

                            email:
                                currentUser.email,

                            title:
                                title,

                            date:
                                date,

                            time:
                                time,

                            description:
                                description

                        })

                }

            );


        const result =
            await response.json();


        if (
            result.accessDenied ||
            result.access === false
        ) {

            throw new Error(
                "Your Tuklass access has expired."
            );

        }


        if (
            !result.success
        ) {

            throw new Error(
                result.error ||
                "Could not save reminder."
            );

        }


        reminders =
            reminders.filter(
                function(reminder) {

                    return (
                        reminder.reminderId !==
                        temporaryId
                    );

                }
            );


        reminders.push(
            result.reminder
        );


        saveCache();


        renderReminderList();

    }

    catch (error) {

        /*
         * Remove optimistic reminder
         * if save failed.
         */

        reminders =
            reminders.filter(
                function(reminder) {

                    return (
                        reminder.reminderId !==
                        temporaryId
                    );

                }
            );


        saveCache();


        renderReminderList();


        message.textContent =
            error.message ||
            "Could not save reminder.";

        message.style.color =
            "#dc2626";

    }

    finally {

        button.disabled =
            false;

    }

}



/* =========================================================
   DELETE PERSONAL REMINDER
========================================================= */

async function deletePersonalReminder(
    reminderId
) {

    const previous =
        reminders.slice();


    /*
     * Remove immediately.
     */

    reminders =
        reminders.filter(
            function(reminder) {

                return (
                    reminder.reminderId !==
                    reminderId
                );

            }
        );


    renderReminderList();


    saveCache();


    try {

        const response =
            await fetch(

                APPS_SCRIPT_URL,

                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "text/plain;charset=utf-8"

                    },

                    body:
                        JSON.stringify({

                            action:
                                "deletePersonalReminder",

                            email:
                                currentUser.email,

                            reminderId:
                                reminderId

                        })

                }

            );


        const result =
            await response.json();


        if (
            !result.success
        ) {

            throw new Error(
                result.error ||
                "Could not delete reminder."
            );

        }

    }

    catch (error) {

        reminders =
            previous;


        renderReminderList();


        saveCache();


        alert(
            error.message ||
            "Could not delete reminder."
        );

    }

}



/* =========================================================
   LOCK
========================================================= */

function showLock(
    message
) {

    if (
        refreshTimer
    ) {

        clearInterval(
            refreshTimer
        );

    }


    document
        .getElementById(
            "content"
        )
        .innerHTML =

        `
        <div class="center">

            <div
                style="
                    font-size:50px;
                    margin-bottom:10px;
                "
            >
                <img src="images/BelleB.png" alt="" style="width:44px;height:44px;object-fit:contain;">
            </div>


            <h2>
                Reminders unavailable
            </h2>


            <p>
                ${escapeHtml(
                    message
                )}
            </p>


            <a
                class="center-button"
                href="index.html"
            >
                Back to Dashboard
            </a>

        </div>
        `;

}


function showMessage(
    message
) {

    document
        .getElementById(
            "content"
        )
        .innerHTML =

        `
        <div class="center">

            <p>
                ${escapeHtml(
                    message
                )}
            </p>


            <a
                class="center-button"
                href="index.html"
            >
                Back to Dashboard
            </a>

        </div>
        `;

}



/* =========================================================
   DATE HELPERS
========================================================= */

function getDateParts(
    value
) {

    if (!value) {

        return {

            month:
                "",

            day:
                ""

        };

    }


    const date =
        new Date(
            value +
            "T00:00:00"
        );


    if (
        isNaN(
            date.getTime()
        )
    ) {

        return {

            month:
                "",

            day:
                ""

        };

    }


    return {

        month:
            date.toLocaleDateString(
                undefined,
                {
                    month:
                        "short"
                }
            ),

        day:
            date.toLocaleDateString(
                undefined,
                {
                    day:
                        "numeric"
                }
            )

    };

}


function getToday() {

    const date =
        new Date();


    return [

        date.getFullYear(),

        String(
            date.getMonth() + 1
        )
        .padStart(
            2,
            "0"
        ),

        String(
            date.getDate()
        )
        .padStart(
            2,
            "0"
        )

    ].join("-");

}



/* =========================================================
   ESCAPE
========================================================= */

function escapeHtml(
    value
) {

    return String(
        value ||
        ""
    )
    .replace(
        /&/g,
        "&amp;"
    )
    .replace(
        /</g,
        "&lt;"
    )
    .replace(
        />/g,
        "&gt;"
    )
    .replace(
        /"/g,
        "&quot;"
    )
    .replace(
        /'/g,
        "&#039;"
    );

}

    function spaInit() {
        window.addPersonalReminder = addPersonalReminder;
        window.deletePersonalReminder = deletePersonalReminder;
        init();
    }

    function cleanup() {
        if (refreshTimer) {
            clearInterval(refreshTimer);
            refreshTimer = null;
        }
        try { delete window.addPersonalReminder; } catch {}
        try { delete window.deletePersonalReminder; } catch {}
    }

    return {
        init: spaInit,
        cleanup: cleanup
    };
})();



window.TuklassMessages = (function () {
/* =========================================================
   CONFIG
========================================================= */

const APPS_SCRIPT_URL =
    window.TUKLASS_CONFIG.apiUrl;


const CACHE_PREFIX =
    "writejot_conversations_";


const REFRESH_INTERVAL =
    Number(
        window.TUKLASS_CONFIG &&
        window.TUKLASS_CONFIG.polling &&
        window.TUKLASS_CONFIG.polling.conversationsMs
    ) || 20000;


let currentUser =
    null;


let conversations =
    [];


let refreshTimer =
    null;

let conversationsRequestInFlight =
    false;


/* =========================================================
   START
========================================================= */

async function initialize() {

    const savedUser =
        localStorage.getItem(
            "writejotUser"
        );


    if (
        !savedUser
    ) {

        showError(
            "Please sign in to Tuklass first."
        );

        return;

    }


    try {

        currentUser =
            JSON.parse(
                savedUser
            );

    }

    catch {

        localStorage.removeItem(
            "writejotUser"
        );


        showError(
            "Your Tuklass session could not be loaded."
        );


        return;

    }


    bindConversationSearch();


    /*
     * CACHE FIRST.
     *
     * This means conversations can appear
     * immediately without waiting for Apps Script.
     */

    loadCache();


    if (
        conversations.length
    ) {

        renderConversations();

    }


    /*
     * Fresh data in background.
     */

    await loadConversations();


    startRefresh();

}


/* =========================================================
   CACHE
========================================================= */

function getCacheKey() {

    return (
        CACHE_PREFIX +
        normalizeEmail(
            currentUser.email
        )
    );

}


function loadCache() {

    try {

        const raw =
            localStorage.getItem(
                getCacheKey()
            );


        if (
            !raw
        ) {

            return;

        }


        const cached =
            JSON.parse(
                raw
            );


        if (
            !Array.isArray(
                cached.conversations
            )
        ) {

            return;

        }


        conversations =
            cached.conversations.slice();

    }

    catch {

        conversations =
            [];

    }

}


function saveCache() {

    try {

        localStorage.setItem(

            getCacheKey(),

            JSON.stringify({

                savedAt:
                    Date.now(),

                conversations:
                    conversations

            })

        );

    }

    catch {}

}


/* =========================================================
   LOAD CONVERSATIONS
========================================================= */

async function loadConversations() {

    if (conversationsRequestInFlight) {
        return;
    }

    conversationsRequestInFlight = true;

    try {

        const response =
            await fetch(

                APPS_SCRIPT_URL +
                "?action=conversations" +
                "&email=" +
                encodeURIComponent(
                    currentUser.email
                ),

                {
                    cache:
                        "no-store"
                }

            );


        if (
            !response.ok
        ) {

            throw new Error(
                "Server returned " +
                response.status
            );

        }


        const result =
            await response.json();


        if (
            result.accessDenied ===
            true
        ) {

            showError(
                result.error ||
                "Your Tuklass access has expired."
            );

            return;

        }


        if (
            !result.success
        ) {

            throw new Error(
                result.error ||
                "Could not load conversations."
            );

        }


        conversations =
            Array.isArray(
                result.conversations
            )
                ? result.conversations
                : [];


        saveCache();


        renderConversations();

    }

    catch (error) {

        console.error(
            "Conversation loading error:",
            error
        );


        /*
         * If cache exists, KEEP IT.
         */

        if (
            conversations.length
        ) {

            renderConversations();

            return;

        }


        showError(
            "Could not load your messages."
        );

    }

    finally {
        conversationsRequestInFlight = false;
    }
}


/* =========================================================
   AUTO REFRESH
========================================================= */

function startRefresh() {

    if (
        refreshTimer
    ) {

        clearInterval(
            refreshTimer
        );

    }


    refreshTimer =
        setInterval(
            function() {

                if (
                    document.visibilityState ===
                    "visible"
                ) {

                    loadConversations();

                }

            },

            REFRESH_INTERVAL
        );

}


/* =========================================================
   RENDER
========================================================= */

function bindConversationSearch() {

    const input =
        document.getElementById(
            "conversationSearch"
        );

    if (!input || input.dataset.bound === "true") {
        return;
    }

    input.dataset.bound =
        "true";

    input.addEventListener(
        "input",
        function () {
            conversationSearchQuery =
                String(input.value || "")
                    .trim()
                    .toLowerCase();

            renderConversations();
        }
    );

}


function renderConversations() {

    const list =
        document.getElementById(
            "conversationList"
        );

    if (!list) {
        return;
    }

    list.style.height =
        "auto";

    list.style.maxHeight =
        "none";

    list.style.overflow =
        "visible";


    const visibleConversations =
        conversations.filter(
            function (conversation) {

                if (!conversationSearchQuery) {
                    return true;
                }

                const haystack =
                    [
                        conversation.name,
                        conversation.username,
                        conversation.lastMessage
                    ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();

                return haystack.includes(
                    conversationSearchQuery
                );
            }
        );


    if (!conversations.length) {

        list.innerHTML =
            `
            <div class="messages-empty">
                <img
                    src="images/MessageA.png"
                    alt=""
                    style="width:48px;height:48px;object-fit:contain;margin-bottom:12px;"
                >
                <strong>No conversations yet.</strong>
                <div style="margin-top:6px;">
                    Open Search to find a student and start a conversation.
                </div>
            </div>
            `;

        updateUnreadTotal();
        return;
    }


    if (!visibleConversations.length) {

        list.innerHTML =
            `
            <div class="messages-empty">
                <strong>No matching conversations.</strong>
                <div style="margin-top:6px;">
                    Try a different name or username.
                </div>
            </div>
            `;

        updateUnreadTotal();
        return;
    }


    list.innerHTML =
        visibleConversations
            .map(
                function (conversation) {
                    return buildConversation(
                        conversation
                    );
                }
            )
            .join("");


    updateUnreadTotal();

}


/* =========================================================
   BUILD CONVERSATION
========================================================= */

function buildConversation(
    conversation
) {

    const username =
        normalizeUsername(
            conversation.username
        );


    const name =
        conversation.name ||
        "Tuklass User";


    const picture =
        conversation.profilePicture ||
        "images/Logo3.1.png";


    const preview =
        conversation.lastMessage ||
        "No messages yet.";


    const unread =
        Math.max(
            0,
            Number(
                conversation.unreadCount ||
                0
            )
        );


    const unreadClass =
        unread > 0
            ? "unread"
            : "";


    const time =
        formatConversationTime(
            conversation.timestamp
        );


    return `

        <div
            class="
                conversation
                ${unreadClass}
            "
            role="button"
            tabindex="0"

            onclick="
                openConversation(
                    '${escapeJs(
                        username
                    )}'
                )
            "

            onkeydown="
                conversationKey(
                    event,
                    '${escapeJs(
                        username
                    )}'
                )
            "
        >


            <img
                class="conversation-picture"
                src="${escapeHtml(
                    picture
                )}"
                alt=""
                loading="lazy"

                onerror="
                    this.src='images/Logo3.1.png';
                "
            >


            <div
                class="conversation-content"
            >

                <div
                    class="conversation-top"
                >

                    <div
                        class="conversation-name"
                    >
                        ${escapeHtml(
                            name
                        )}
                    </div>


                    <div
                        class="
                            conversation-username
                        "
                    >
                        @${escapeHtml(
                            username
                        )}
                    </div>

                </div>


                <div
                    class="
                        conversation-preview
                    "
                >
                    ${escapeHtml(
                        preview
                    )}
                </div>

            </div>


            <div
                class="conversation-right"
            >

                <div
                    class="conversation-time"
                >
                    ${escapeHtml(
                        time
                    )}
                </div>


                <div
                    class="
                        unread-badge
                        ${
                            unread > 0
                                ? ""
                                : "hidden"
                        }
                    "
                >
                    ${
                        unread > 99
                            ? "99+"
                            : unread
                    }
                </div>

            </div>

        </div>

    `;

}


/* =========================================================
   OPEN CHAT
========================================================= */

function openConversation(
    username
) {

    const cleaned =
        normalizeUsername(
            username
        );


    if (
        !cleaned
    ) {

        return;

    }


    window.location.href =
        "chat.html?username=" +
        encodeURIComponent(
            cleaned
        );

}


function conversationKey(
    event,
    username
) {

    if (
        event.key ===
            "Enter" ||
        event.key ===
            " "
    ) {

        event.preventDefault();


        openConversation(
            username
        );

    }

}


/* =========================================================
   TOTAL UNREAD
========================================================= */

function updateUnreadTotal() {

    const badge =
        document.getElementById(
            "unreadTotal"
        );


    let total =
        0;


    conversations.forEach(
        function(
            conversation
        ) {

            const count =
                Number(
                    conversation.unreadCount ||
                    0
                );


            if (
                Number.isFinite(
                    count
                ) &&
                count > 0
            ) {

                total +=
                    count;

            }

        }
    );


    if (
        total <= 0
    ) {

        badge.textContent =
            "";

        badge.classList.add(
            "hidden"
        );

        return;

    }


    badge.classList.remove(
        "hidden"
    );


    badge.textContent =
        total > 99
            ? "99+"
            : String(
                total
            );

}


/* =========================================================
   TIME
========================================================= */

function formatConversationTime(
    timestamp
) {

    if (
        !timestamp
    ) {

        return "";

    }


    const date =
        new Date(
            timestamp
        );


    if (
        isNaN(
            date.getTime()
        )
    ) {

        return "";

    }


    const now =
        new Date();


    if (
        date.toDateString() ===
        now.toDateString()
    ) {

        return date.toLocaleTimeString(
            [],
            {
                hour:
                    "numeric",

                minute:
                    "2-digit"
            }
        );

    }


    const difference =
        now.getTime() -
        date.getTime();


    const day =
        24 *
        60 *
        60 *
        1000;


    if (
        difference >= 0 &&
        difference <
            7 * day
    ) {

        return date.toLocaleDateString(
            [],
            {
                weekday:
                    "short"
            }
        );

    }


    return date.toLocaleDateString(
        [],
        {
            month:
                "short",

            day:
                "numeric"
        }
    );

}


/* =========================================================
   HELPERS
========================================================= */

function normalizeUsername(
    username
) {

    return String(
        username ||
        ""
    )
    .trim()
    .toLowerCase()
    .replace(
        /^@/,
        ""
    );

}


function normalizeEmail(
    email
) {

    return String(
        email ||
        ""
    )
    .trim()
    .toLowerCase();

}


function escapeHtml(
    value
) {

    return String(
        value ||
        ""
    )
    .replace(
        /&/g,
        "&amp;"
    )
    .replace(
        /</g,
        "&lt;"
    )
    .replace(
        />/g,
        "&gt;"
    )
    .replace(
        /"/g,
        "&quot;"
    )
    .replace(
        /'/g,
        "&#039;"
    );

}


function escapeJs(
    value
) {

    return String(
        value ||
        ""
    )
    .replace(
        /\\/g,
        "\\\\"
    )
    .replace(
        /'/g,
        "\\'"
    )
    .replace(
        /"/g,
        '\\"'
    )
    .replace(
        /\r/g,
        "\\r"
    )
    .replace(
        /\n/g,
        "\\n"
    );

}


/* =========================================================
   ERROR
========================================================= */

function showError(
    message
) {

    document
        .getElementById(
            "conversationList"
        )
        .innerHTML =

        `
        <div
            class="messages-error"
        >

            ${escapeHtml(
                message
            )}

            <br><br>

            <a
                href="index.html"
                class="dashboard-link"
            >
                Back to Dashboard
            </a>

        </div>
        `;

}

    async function spaInit() {

        /*
         * Keep conversation cards on the same mounted Tuklass shell.
         * No white/blank page reload when a conversation is opened.
         */
        window.openConversation =
            function (
                username
            ) {

                const cleaned =
                    normalizeUsername(
                        username
                    );


                if (
                    !cleaned
                ) {

                    return;

                }


                if (
                    window.TuklassSPA &&
                    window.TuklassSPA.navigateToChat
                ) {

                    window.TuklassSPA.navigateToChat(
                        cleaned
                    );

                    return;

                }


                openConversation(
                    cleaned
                );

            };


        window.conversationKey =
            conversationKey;


        await initialize();

    }

    function cleanup() {
        if (refreshTimer) {
            clearInterval(refreshTimer);
            refreshTimer = null;
        }
        try { delete window.openConversation; } catch {}
        try { delete window.conversationKey; } catch {}
    }

    return {
        init: spaInit,
        cleanup: cleanup
    };
})();




/* =========================================================
   CHAT ROUTE MODULE
   Preserves the existing Tuklass chat backend/cache/send logic.
========================================================= */

window.TuklassChat = (function () {

const APPS_SCRIPT_URL =
    window.TUKLASS_CONFIG.apiUrl;

const CHAT_CACHE_TTL =
    24 * 60 * 60 * 1000;

let currentUser = null;
let otherUsername = "";
let refreshTimer = null;
let selectedImage = null;
let loadRequestId = 0;
let messagesRequestInFlight = false;
let serverMessages = [];
let pendingMessages = new Map();


function normalizeUsername(value) {
    return String(value || "")
        .trim()
        .replace(/^@+/, "")
        .toLowerCase();
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


function getChatCacheKey() {

    if (!currentUser || !otherUsername) {
        return "writejot_chat_cache_unknown";
    }

    return (
        "writejot_chat_cache_" +
        normalizeUsername(currentUser.username) +
        "__" +
        normalizeUsername(otherUsername)
    );
}


function loadCachedMessages() {

    try {

        const raw =
            localStorage.getItem(
                getChatCacheKey()
            );

        if (!raw) {
            return;
        }

        const cached =
            JSON.parse(raw);

        if (
            !cached ||
            !Array.isArray(cached.messages)
        ) {
            return;
        }

        if (
            cached.savedAt &&
            Date.now() - Number(cached.savedAt) >
                CHAT_CACHE_TTL
        ) {
            localStorage.removeItem(
                getChatCacheKey()
            );
            return;
        }

        serverMessages =
            cached.messages.slice();

        renderMessages();

    }
    catch {}

}


function saveMessagesToCache(messages) {

    try {

        localStorage.setItem(
            getChatCacheKey(),
            JSON.stringify({
                savedAt: Date.now(),
                messages:
                    Array.isArray(messages)
                        ? messages
                        : []
            })
        );

    }
    catch {}
}


async function initializeChat() {

    const savedUser =
        localStorage.getItem(
            "writejotUser"
        );

    if (!savedUser) {
        window.location.href =
            "index.html";
        return;
    }

    try {
        currentUser =
            JSON.parse(savedUser);
    }
    catch {
        localStorage.removeItem(
            "writejotUser"
        );
        window.location.href =
            "index.html";
        return;
    }

    const params =
        new URLSearchParams(
            window.location.search
        );

    otherUsername =
        normalizeUsername(
            params.get("username")
        );

    if (!otherUsername) {
        window.location.href =
            "messages.html";
        return;
    }

    loadCachedMessages();
    setupMessageInput();
    loadRecipient();
    markConversationRead();
    loadMessages();
    startRefreshTimer();

    document.addEventListener(
        "visibilitychange",
        handleChatVisibilityChange
    );

}


function handleChatVisibilityChange() {
    if (document.visibilityState === "visible") {
        loadMessages();
    }
}


function startRefreshTimer() {

    if (refreshTimer) {
        clearInterval(refreshTimer);
    }

    refreshTimer =
        setInterval(
            function () {
                if (
                    document.visibilityState ===
                    "visible"
                ) {
                    loadMessages();
                }
            },
            Number(
                window.TUKLASS_CONFIG &&
                window.TUKLASS_CONFIG.polling &&
                window.TUKLASS_CONFIG.polling.chatForegroundMs
            ) || 7000
        );
}


async function loadRecipient() {

    try {

        const response =
            await fetch(
                APPS_SCRIPT_URL +
                "?action=profile&username=" +
                encodeURIComponent(
                    otherUsername
                ),
                {cache: "no-store"}
            );

        const result =
            await response.json();

        const profile =
            result &&
            result.success &&
            result.profile
                ? result.profile
                : null;

        const name =
            profile && profile.name
                ? profile.name
                : "Tuklass User";

        const username =
            profile && profile.username
                ? profile.username
                : otherUsername;

        const picture =
            profile &&
            profile.profilePicture
                ? profile.profilePicture
                : "images/Logo3.1.png";

        const nameNode =
            document.getElementById(
                "recipientName"
            );

        const usernameNode =
            document.getElementById(
                "recipientUsername"
            );

        const pictureNode =
            document.getElementById(
                "recipientPicture"
            );

        if (nameNode) {
            nameNode.textContent =
                name;
        }

        if (usernameNode) {
            usernameNode.textContent =
                "@" + username;
        }

        if (pictureNode) {
            pictureNode.src =
                picture;
            pictureNode.onerror =
                function () {
                    this.src =
                        "images/Logo3.1.png";
                };
        }

    }
    catch (error) {

        console.log(
            "Recipient load failed.",
            error
        );

    }
}


async function markConversationRead() {

    if (!currentUser) {
        return;
    }

    try {

        await fetch(
            APPS_SCRIPT_URL,
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "text/plain;charset=utf-8"
                },
                body:
                    JSON.stringify({
                        action:
                            "markConversationRead",
                        email:
                            currentUser.email,
                        username:
                            otherUsername
                    })
            }
        );

    }
    catch {}
}


async function loadMessages() {

    if (
        !currentUser ||
        !otherUsername ||
        messagesRequestInFlight
    ) {
        return;
    }

    messagesRequestInFlight = true;

    const requestId =
        ++loadRequestId;

    try {

        const response =
            await fetch(
                APPS_SCRIPT_URL +
                "?action=messages" +
                "&email=" +
                encodeURIComponent(
                    currentUser.email
                ) +
                "&username=" +
                encodeURIComponent(
                    otherUsername
                ),
                {cache: "no-store"}
            );

        if (!response.ok) {
            throw new Error(
                "Could not load messages."
            );
        }

        const result =
            await response.json();

        if (
            requestId !==
            loadRequestId
        ) {
            return;
        }

        if (!result.success) {
            throw new Error(
                result.error ||
                "Could not load messages."
            );
        }

        serverMessages =
            Array.isArray(result.messages)
                ? result.messages
                : [];

        const serverIds =
            new Set(
                serverMessages
                    .map(
                        function (message) {
                            return String(
                                message.id ||
                                message.messageId ||
                                ""
                            );
                        }
                    )
                    .filter(Boolean)
            );

        pendingMessages
            .forEach(
                function (pending, id) {

                    if (
                        pending.messageId &&
                        serverIds.has(
                            String(
                                pending.messageId
                            )
                        )
                    ) {
                        if (
                            pending.previewUrl &&
                            String(pending.previewUrl)
                                .startsWith("blob:")
                        ) {
                            try {
                                URL.revokeObjectURL(
                                    pending.previewUrl
                                );
                            }
                            catch {}
                        }

                        pendingMessages.delete(
                            id
                        );
                    }

                }
            );

        saveMessagesToCache(
            serverMessages
        );

        renderMessages();

    }
    catch (error) {

        console.log(
            "Chat refresh failed.",
            error
        );

        if (!serverMessages.length) {
            showMessageError(
                "Could not load messages."
            );
        }

    }
    finally {
        messagesRequestInFlight = false;
    }
}


function dayKey(value) {

    const date =
        new Date(value || 0);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "";
    }

    return [
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
    ].join("-");
}


function formatDayDivider(value) {

    const date =
        new Date(value || 0);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "";
    }

    const now =
        new Date();

    const today =
        dayKey(now);

    const yesterday =
        new Date(now);

    yesterday.setDate(
        now.getDate() - 1
    );

    if (
        dayKey(date) === today
    ) {
        return "Today";
    }

    if (
        dayKey(date) ===
        dayKey(yesterday)
    ) {
        return "Yesterday";
    }

    return date.toLocaleDateString(
        undefined,
        {
            month: "short",
            day: "numeric",
            year:
                date.getFullYear() ===
                now.getFullYear()
                    ? undefined
                    : "numeric"
        }
    );
}


function formatMessageTime(value) {

    const date =
        new Date(value || 0);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "";
    }

    return date.toLocaleTimeString(
        undefined,
        {
            hour: "numeric",
            minute: "2-digit"
        }
    );
}


function shouldShowTime(
    message,
    previousMessage
) {

    if (!previousMessage) {
        return true;
    }

    const currentTime =
        new Date(
            message.timestamp || 0
        ).getTime();

    const previousTime =
        new Date(
            previousMessage.timestamp || 0
        ).getTime();

    if (
        !Number.isFinite(currentTime) ||
        !Number.isFinite(previousTime)
    ) {
        return true;
    }

    return (
        currentTime -
        previousTime
    ) >= 5 * 60 * 1000;
}


function renderServerMessage(
    message,
    previousMessage,
    firstInDay
) {

    const currentUsername =
        normalizeUsername(
            currentUser &&
            currentUser.username
        );

    const mine =
        normalizeUsername(
            message.sender
        ) ===
        currentUsername;

    const time =
        formatMessageTime(
            message.timestamp
        );

    /*
     * The first message time is already displayed next to the
     * day heading ("Today · 1:30 PM"). Other timestamps only
     * show automatically after a 5+ minute gap. Any hidden
     * timestamp can still be revealed by clicking the row.
     */
    const showTime =
        !firstInDay &&
        shouldShowTime(
            message,
            previousMessage
        );

    const hasImage =
        message.attachmentType === "image" &&
        Boolean(message.attachmentUrl);

    const hasText =
        Boolean(message.message);

    let content = "";

    /*
     * Images sit directly in the conversation instead of inside
     * the black/grey text bubble. If a message also has text, the
     * caption gets its own normal text bubble below the image.
     */
    if (hasImage) {
        content +=
            `
            <img
                class="tk-chat-image"
                src="${escapeHtml(
                    message.attachmentUrl
                )}"
                alt="Photo"
                loading="lazy"
                onclick="event.stopPropagation();openImage('${escapeJs(message.attachmentUrl)}')"
                onerror="this.style.display='none';"
            >
            `;
    }

    if (hasText) {
        content +=
            `
            <div class="tk-chat-bubble">
                <span class="tk-chat-text">${escapeHtml(
                    message.message
                )}</span>
            </div>
            `;
    }

    return `
        <div
            class="tk-chat-row ${mine ? "is-mine" : "is-theirs"} ${hasImage ? "has-image" : ""}"
            data-message-id="${escapeHtml(
                message.id ||
                message.messageId ||
                ""
            )}"
            onclick="toggleChatTimestamp(this)"
        >
            <div class="tk-chat-wrap">
                ${content}

                <div
                    class="tk-chat-time ${showTime ? "" : "is-collapsed"}"
                >
                    ${escapeHtml(time)}
                </div>
            </div>
        </div>
    `;

}


function renderPendingMessage(
    pending
) {

    const hasImage =
        Boolean(pending.previewUrl);

    const hasText =
        Boolean(pending.text);

    let content = "";

    if (hasImage) {
        content +=
            `
            <img
                class="tk-chat-image"
                src="${escapeHtml(
                    pending.previewUrl
                )}"
                alt="Photo"
            >
            `;
    }

    if (hasText) {
        content +=
            `
            <div class="tk-chat-bubble">
                <span class="tk-chat-text">${escapeHtml(
                    pending.text
                )}</span>
            </div>
            `;
    }

    const sending =
        pending.status === "sending";

    const failed =
        pending.status === "failed";

    /*
     * Once the backend says the message was sent, the optimistic
     * message immediately looks sent. The server copy replaces it
     * on refresh. Images stay bubble-free while delivery state is
     * shown underneath the image/text content.
     */
    return `
        <div
            class="tk-chat-row is-mine ${hasImage ? "has-image" : ""} ${sending ? "is-sending" : ""} ${failed ? "is-failed" : ""}"
            data-pending-id="${escapeHtml(
                pending.pendingId
            )}"
        >
            <div class="tk-chat-wrap">
                ${content}

                ${
                    sending
                        ? `
                            <div class="tk-chat-delivery">
                                <span class="tk-chat-spinner" aria-hidden="true"></span>
                                <span>Sending</span>
                            </div>
                          `
                        : (
                            failed
                                ? `
                                    <div class="tk-chat-delivery is-failed">
                                        <span>Not sent</span>
                                        <button
                                            type="button"
                                            class="tk-chat-retry"
                                            onclick="event.stopPropagation();retryPendingMessage('${escapeJs(pending.pendingId)}')"
                                        >
                                            Retry
                                        </button>
                                    </div>
                                  `
                                : ""
                          )
                }
            </div>
        </div>
    `;

}


function renderMessages() {

    const container =
        document.getElementById(
            "messages"
        );

    if (!container) {
        return;
    }

    const rows =
        [];

    let previousMessage =
        null;
    let currentDay =
        "";

    serverMessages
        .forEach(
            function (message) {

                const messageDay =
                    dayKey(
                        message.timestamp
                    );

                const firstInDay =
                    messageDay !==
                    currentDay;

                if (firstInDay) {

                    currentDay =
                        messageDay;

                    rows.push(
                        `
                        <div class="tk-chat-day-divider">
                            <span>
                                ${escapeHtml(
                                    formatDayDivider(
                                        message.timestamp
                                    )
                                )}
                            </span>
                            <span class="tk-chat-day-time">
                                ${escapeHtml(
                                    formatMessageTime(
                                        message.timestamp
                                    )
                                )}
                            </span>
                        </div>
                        `
                    );

                    previousMessage =
                        null;
                }

                rows.push(
                    renderServerMessage(
                        message,
                        previousMessage,
                        firstInDay
                    )
                );

                previousMessage =
                    message;
            }
        );

    let pendingDividerAdded =
        false;

    pendingMessages
        .forEach(
            function (pending) {

                /*
                 * If the conversation contains only optimistic
                 * messages, still give them the same day/time
                 * header as normal server messages.
                 */
                if (
                    !serverMessages.length &&
                    !pendingDividerAdded
                ) {

                    rows.push(
                        `
                        <div class="tk-chat-day-divider">
                            <span>
                                ${escapeHtml(
                                    formatDayDivider(
                                        pending.createdAt
                                    )
                                )}
                            </span>
                            <span class="tk-chat-day-time">
                                ${escapeHtml(
                                    formatMessageTime(
                                        pending.createdAt
                                    )
                                )}
                            </span>
                        </div>
                        `
                    );

                    pendingDividerAdded =
                        true;
                }

                rows.push(
                    renderPendingMessage(
                        pending
                    )
                );
            }
        );

    if (!rows.length) {

        container.innerHTML =
            `
            <div id="empty" class="chat-empty">
                <strong>No messages yet</strong>
                <span>Start the conversation.</span>
            </div>
            `;

    }
    else {

        container.innerHTML =
            rows.join("");

    }

    container.scrollTop =
        container.scrollHeight;

}


function toggleChatTimestamp(
    row
) {

    if (!row) {
        return;
    }

    const time =
        row.querySelector(
            ".tk-chat-time"
        );

    if (!time) {
        return;
    }

    time.classList.toggle(
        "is-expanded"
    );
}



function openImage(url) {

    if (!url) {
        return;
    }

    window.open(
        url,
        "_blank",
        "noopener"
    );
}


function openImagePicker() {

    const input =
        document.getElementById(
            "imageInput"
        );

    if (input) {
        input.click();
    }
}


function handleImageSelection(
    event
) {

    const file =
        event &&
        event.target &&
        event.target.files
            ? event.target.files[0]
            : null;

    if (!file) {
        return;
    }

    if (
        !String(file.type || "")
            .startsWith("image/")
    ) {
        alert(
            "Please choose an image file."
        );
        event.target.value =
            "";
        return;
    }

    if (
        file.size >
        10 * 1024 * 1024
    ) {
        alert(
            "Please choose an image smaller than 10 MB."
        );
        event.target.value =
            "";
        return;
    }

    selectedImage =
        file;

    const preview =
        document.getElementById(
            "previewImage"
        );

    const wrapper =
        document.getElementById(
            "imagePreview"
        );

    if (preview) {

        const reader =
            new FileReader();

        reader.onload =
            function () {
                preview.src =
                    reader.result;
            };

        reader.readAsDataURL(
            file
        );
    }

    if (wrapper) {
        wrapper.style.display =
            "block";
    }
}


function removeSelectedImage() {

    selectedImage =
        null;

    const input =
        document.getElementById(
            "imageInput"
        );

    const preview =
        document.getElementById(
            "previewImage"
        );

    const wrapper =
        document.getElementById(
            "imagePreview"
        );

    if (input) {
        input.value = "";
    }

    if (preview) {
        preview.src = "";
    }

    if (wrapper) {
        wrapper.style.display =
            "none";
    }
}


function resetTextareaHeight() {

    const input =
        document.getElementById(
            "messageInput"
        );

    if (!input) {
        return;
    }

    input.style.height =
        "auto";
}


function resizeTextarea() {

    const input =
        document.getElementById(
            "messageInput"
        );

    if (!input) {
        return;
    }

    input.style.height =
        "auto";

    input.style.height =
        Math.min(
            input.scrollHeight,
            132
        ) +
        "px";
}


function setupMessageInput() {

    const input =
        document.getElementById(
            "messageInput"
        );

    if (!input) {
        return;
    }

    input.addEventListener(
        "input",
        resizeTextarea
    );

    input.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendMessage();
            }

        }
    );
}


function makePreviewUrl(
    file
) {

    if (!file) {
        return "";
    }

    try {
        return URL.createObjectURL(
            file
        );
    }
    catch {
        return "";
    }
}


async function sendMessage() {

    const input =
        document.getElementById(
            "messageInput"
        );

    if (!input) {
        return;
    }

    const message =
        String(
            input.value || ""
        ).trim();

    const imageFile =
        selectedImage;

    if (
        !message &&
        !imageFile
    ) {
        return;
    }

    const pendingId =
        "pending_" +
        Date.now() +
        "_" +
        Math.random()
            .toString(36)
            .slice(2);

    const pending = {
        pendingId: pendingId,
        text: message,
        imageFile: imageFile,
        previewUrl:
            makePreviewUrl(
                imageFile
            ),
        status: "sending",
        messageId: "",
        createdAt:
            Date.now()
    };

    pendingMessages.set(
        pendingId,
        pending
    );

    input.value = "";
    resetTextareaHeight();
    removeSelectedImage();
    renderMessages();

    /*
     * Do not wait before returning control to the composer.
     * Multiple messages can be queued while previous requests
     * are still sending.
     */
    performPendingSend(
        pendingId
    );

    input.focus();

}


async function performPendingSend(
    pendingId
) {

    const pending =
        pendingMessages.get(
            pendingId
        );

    if (!pending) {
        return;
    }

    pending.status =
        "sending";

    renderMessages();

    try {

        let imageData = "";
        let imageType = "";
        let imageName = "";

        if (pending.imageFile) {

            const compressed =
                await compressImage(
                    pending.imageFile
                );

            imageData =
                compressed.dataUrl;

            imageType =
                compressed.mimeType;

            imageName =
                compressed.fileName;

        }

        const response =
            await fetch(
                APPS_SCRIPT_URL,
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "text/plain;charset=utf-8"
                    },
                    body:
                        JSON.stringify({
                            action:
                                "sendMessage",
                            email:
                                currentUser.email,
                            receiver:
                                otherUsername,
                            message:
                                pending.text,
                            attachmentType:
                                imageData
                                    ? "image"
                                    : "",
                            attachmentData:
                                imageData,
                            attachmentMime:
                                imageType,
                            attachmentName:
                                imageName
                        })
                }
            );

        if (!response.ok) {
            throw new Error(
                "Server returned " +
                response.status
            );
        }

        const result =
            await response.json();

        if (!result.success) {
            throw new Error(
                result.error ||
                "Could not send the message."
            );
        }

        pending.status =
            "sent";

        pending.messageId =
            result.messageId ||
            "";

        renderMessages();

        await loadMessages();

        /*
         * If the server's refreshed message list is delayed by
         * a moment, keep the optimistic sent bubble instead of
         * making it disappear.
         */
        setTimeout(
            function () {
                loadMessages();
            },
            650
        );

    }
    catch (error) {

        console.error(
            "Send message error:",
            error
        );

        pending.status =
            "failed";

        renderMessages();

    }
}


function retryPendingMessage(
    pendingId
) {

    const pending =
        pendingMessages.get(
            pendingId
        );

    if (!pending) {
        return;
    }

    performPendingSend(
        pendingId
    );
}


function compressImage(
    file
) {

    return new Promise(
        function (
            resolve,
            reject
        ) {

            const reader =
                new FileReader();

            reader.onerror =
                reject;

            reader.onload =
                function () {

                    const image =
                        new Image();

                    image.onerror =
                        reject;

                    image.onload =
                        function () {

                            const maxDimension =
                                1600;

                            let width =
                                image.width;

                            let height =
                                image.height;

                            if (
                                width >
                                maxDimension ||
                                height >
                                maxDimension
                            ) {

                                const ratio =
                                    Math.min(
                                        maxDimension / width,
                                        maxDimension / height
                                    );

                                width =
                                    Math.round(
                                        width * ratio
                                    );

                                height =
                                    Math.round(
                                        height * ratio
                                    );
                            }

                            const canvas =
                                document.createElement(
                                    "canvas"
                                );

                            canvas.width =
                                width;

                            canvas.height =
                                height;

                            const context =
                                canvas.getContext(
                                    "2d"
                                );

                            context.drawImage(
                                image,
                                0,
                                0,
                                width,
                                height
                            );

                            const mimeType =
                                "image/jpeg";

                            const dataUrl =
                                canvas.toDataURL(
                                    mimeType,
                                    .82
                                );

                            resolve({
                                dataUrl: dataUrl,
                                mimeType: mimeType,
                                fileName:
                                    (
                                        file.name
                                            ? file.name.replace(/\.[^.]+$/, "")
                                            : "photo"
                                    ) +
                                    ".jpg"
                            });

                        };

                    image.src =
                        reader.result;
                };

            reader.readAsDataURL(
                file
            );
        }
    );
}


function showMessageError(
    text
) {

    const container =
        document.getElementById(
            "messages"
        );

    if (
        !container ||
        container.querySelector(
            ".tk-chat-row"
        )
    ) {
        return;
    }

    container.innerHTML =
        `
        <div class="chat-empty">
            <strong>Messages unavailable</strong>
            <span>${escapeHtml(text || "Please try again.")}</span>
        </div>
        `;
}


function spaInit() {

    window.openImage =
        openImage;

    window.openImagePicker =
        openImagePicker;

    window.handleImageSelection =
        handleImageSelection;

    window.removeSelectedImage =
        removeSelectedImage;

    window.sendMessage =
        sendMessage;

    window.retryPendingMessage =
        retryPendingMessage;

    window.toggleChatTimestamp =
        toggleChatTimestamp;

    return initializeChat();

}


function cleanup() {

    if (refreshTimer) {
        clearInterval(
            refreshTimer
        );
        refreshTimer = null;
    }

    document.removeEventListener(
        "visibilitychange",
        handleChatVisibilityChange
    );

    try { delete window.openImage; } catch {}
    try { delete window.openImagePicker; } catch {}
    try { delete window.handleImageSelection; } catch {}
    try { delete window.removeSelectedImage; } catch {}
    try { delete window.sendMessage; } catch {}
    try { delete window.retryPendingMessage; } catch {}
    try { delete window.toggleChatTimestamp; } catch {}

    pendingMessages
        .forEach(
            function (pending) {
                if (
                    pending.previewUrl &&
                    String(pending.previewUrl)
                        .startsWith("blob:")
                ) {
                    try {
                        URL.revokeObjectURL(
                            pending.previewUrl
                        );
                    }
                    catch {}
                }
            }
        );

    pendingMessages.clear();

    currentUser = null;
    otherUsername = "";
    selectedImage = null;
    serverMessages = [];
    loadRequestId = 0;
    messagesRequestInFlight = false;

}


return {
    init: spaInit,
    cleanup: cleanup
};

})();


window.TuklassProfile = (function () {

const APPS_SCRIPT_URL =
    window.TUKLASS_CONFIG.apiUrl;


let viewedUsername =
    "";


async function loadProfile() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    let fallbackUsername =
        "";

    try {
        const saved =
            localStorage.getItem(
                "writejotUser"
            );
        const savedUser =
            saved
                ? JSON.parse(saved)
                : null;
        fallbackUsername =
            savedUser && savedUser.username
                ? savedUser.username
                : "";
    }
    catch {}


    viewedUsername =
        String(
            params.get(
                "username"
            ) ||
            fallbackUsername ||
            ""
        )
        .trim()
        .toLowerCase()
        .replace(
            /^@/,
            ""
        );


    const container =
        document.getElementById(
            "profileContainer"
        );


    if (
        !viewedUsername
    ) {

        showError(
            "No username was provided."
        );

        return;

    }


    try {

        const response =
            await fetch(

                APPS_SCRIPT_URL +
                "?action=profile&username=" +
                encodeURIComponent(
                    viewedUsername
                ),

                {
                    cache:
                        "no-store"
                }

            );


        if (
            !response.ok
        ) {

            throw new Error(
                "Server error"
            );

        }


        const result =
            await response.json();


        if (
            !result.success ||
            !result.profile
        ) {

            showError(
                "Profile not found."
            );

            return;

        }


        renderProfile(
            result.profile
        );

    }

    catch (error) {

        console.error(
            error
        );


        showError(
            "Could not load this profile."
        );

    }

}


function renderProfile(
    profile
) {

    const container =
        document.getElementById(
            "profileContainer"
        );


    const picture =
        profile.profilePicture ||
        "images/Logo3.1.png";


    const currentUser =
        getCurrentUser();


    const isOwnProfile =
        currentUser &&
        normalizeUsername(
            currentUser.username
        ) ===
        normalizeUsername(
            profile.username
        );


    container.innerHTML =

    `
    <div class="profile-card">

        <img
            class="profile-picture"
            src="${escapeHtml(
                picture
            )}"
            alt="Profile picture"
            onerror="
                this.src='images/Logo3.1.png'
            "
        >


        <h1
            class="profile-name"
        >
            ${escapeHtml(
                (
                    window.TuklassSPA &&
                    window.TuklassSPA.displayName
                )
                    ? (
                        window.TuklassSPA.displayName(
                            profile.name
                        ) ||
                        "Tuklass User"
                    )
                    : (
                        profile.name ||
                        "Tuklass User"
                    )
            )}
        </h1>


        <div
            class="profile-username"
        >
            @${escapeHtml(
                profile.username ||
                viewedUsername
            )}
        </div>


        ${
            profile.bio
                ? `
                    <div
                        class="profile-bio"
                    >
                        ${escapeHtml(
                            profile.bio
                        )}
                    </div>
                  `
                : ""
        }


        <div
            class="profile-actions"
        >

            ${
                isOwnProfile

                    ? `
                        <a
                            href="edit-profile.html"
                            class="button primary"
                        >
                            <img class="profile-action-icon" src="images/ProfileA.png" alt="">Edit Profile
                        </a>
                      `

                    : `
                        <a
                            href="
                                chat.html?username=${encodeURIComponent(
                                    normalizeUsername(
                                        profile.username
                                    )
                                )}
                            "
                            class="button primary"
                        >
                            <img class="profile-action-icon" src="images/MessageA.png" alt="">Message
                        </a>
                      `
            }

        </div>

    </div>
    `;

}


function getCurrentUser() {

    try {

        const saved =
            localStorage.getItem(
                "writejotUser"
            );


        if (!saved) {

            return null;

        }


        return JSON.parse(
            saved
        );

    }

    catch {

        return null;

    }

}


function normalizeUsername(
    username
) {

    return String(
        username ||
        ""
    )
    .trim()
    .toLowerCase()
    .replace(
        /^@/,
        ""
    );

}


function escapeHtml(
    value
) {

    return String(
        value ||
        ""
    )
    .replace(
        /&/g,
        "&amp;"
    )
    .replace(
        /</g,
        "&lt;"
    )
    .replace(
        />/g,
        "&gt;"
    )
    .replace(
        /"/g,
        "&quot;"
    )
    .replace(
        /'/g,
        "&#039;"
    );

}


function showError(
    message
) {

    document
        .getElementById(
            "profileContainer"
        )
        .innerHTML =

        `
        <div class="profile-card">

            <div class="error">
                ${escapeHtml(
                    message
                )}
            </div>

            <a
                href="index.html"
                class="button primary"
            >
                Back to Dashboard
            </a>

        </div>
        `;

}

    async function spaInit() {
        await loadProfile();
    }

    function cleanup() {
        viewedUsername = "";
    }

    return {
        init: spaInit,
        cleanup: cleanup
    };

})();


/* =========================================================
   EDIT PROFILE ROUTE MODULE
========================================================= */

window.TuklassEditProfile = (function () {

/* =========================================================
   CONFIG
========================================================= */

const APPS_SCRIPT_URL =
    window.TUKLASS_CONFIG.apiUrl;


const USERNAME_CHECK_DELAY =
    300;


let currentUser =
    null;


let originalProfile =
    null;


let selectedImage =
    null;


let usernameTimer =
    null;


let usernameCheckNumber =
    0;


let usernameAvailable =
    true;


let lastCheckedUsername =
    "";


/* =========================================================
   START
========================================================= */

function init() {


        const saved =
            localStorage.getItem(
                "writejotUser"
            );


        if (!saved) {

            if (
                window.TuklassSPA
            ) {
                window.TuklassSPA.navigate(
                    "home",
                    "index.html"
                );
            }
            else {
                location.href =
                    "index.html";
            }

            return;

        }


        try {

            currentUser =
                JSON.parse(
                    saved
                );

        }

        catch {

            localStorage.removeItem(
                "writejotUser"
            );

            if (
                window.TuklassSPA
            ) {
                window.TuklassSPA.navigate(
                    "home",
                    "index.html"
                );
            }
            else {
                location.href =
                    "index.html";
            }

            return;

        }


        /*
         * Show local information immediately.
         */

        loadLocalProfile();


        /*
         * Check the current username so
         * the save button starts in a
         * known state.
         */

        checkUsernameAvailability(
            document
                .getElementById(
                    "usernameInput"
                )
                .value
                .trim()
        );


        /*
         * Refresh from server in background.
         */

        refreshProfile();

    
}


/* =========================================================
   LOAD LOCAL PROFILE
========================================================= */

function loadLocalProfile() {

    const picture =
        currentUser.profilePicture ||
        currentUser.googlePicture ||
        currentUser.picture ||
        "images/Logo3.1.png";


    document
        .getElementById(
            "profilePicture"
        )
        .src =
        picture;


    document
        .getElementById(
            "previewPicture"
        )
        .src =
        picture;


    document
        .getElementById(
            "nameInput"
        )
        .value =
        currentUser.name ||
        "";


    document
        .getElementById(
            "usernameInput"
        )
        .value =
        currentUser.username ||
        "";


    document
        .getElementById(
            "bioInput"
        )
        .value =
        currentUser.bio ||
        "";


    updatePreview();

}



/* =========================================================
   BACKGROUND PROFILE REFRESH
========================================================= */

async function refreshProfile() {

    try {

        /*
         * We use the local username first.
         */

        const username =
            String(
                currentUser.username ||
                ""
            )
            .trim()
            .replace(
                /^@/,
                ""
            );


        if (!username) {
            return;
        }


        const response =
            await fetch(

                APPS_SCRIPT_URL +
                "?action=profile&username=" +
                encodeURIComponent(
                    username
                ),

                {
                    cache:
                        "no-store"
                }

            );


        if (
            !response.ok
        ) {

            return;

        }


        const result =
            await response.json();


        if (
            !result.success ||
            !result.profile
        ) {

            return;

        }


        originalProfile =
            {
                ...result.profile
            };


        /*
         * Refresh the saved user object
         * with authoritative data.
         */

        currentUser.name =
            result.profile.name ||
            (
            window.TuklassSPA &&
            window.TuklassSPA.displayName
        )
            ? window.TuklassSPA.displayName(
                currentUser.name
            )
            : (
                currentUser.name ||
                ""
            );


        currentUser.username =
            result.profile.username ||
            currentUser.username ||
            "";


        currentUser.bio =
            result.profile.bio ||
            currentUser.bio ||
            "";


        currentUser.profilePicture =
            result.profile.profilePicture ||
            currentUser.profilePicture ||
            "images/Logo3.1.png";


        localStorage.setItem(

            "writejotUser",

            JSON.stringify(
                currentUser
            )

        );


        /*
         * Don't overwrite active edits.
         */

        if (
            !hasUnsavedChanges()
        ) {

            loadLocalProfile();

        }

    }

    catch (error) {

        console.log(
            "Profile refresh failed."
        );

    }

}



/* =========================================================
   LIVE PREVIEW
========================================================= */

document.addEventListener(
    "input",
    function(event) {

        if (
            event.target.id ===
                "nameInput" ||

            event.target.id ===
                "usernameInput" ||

            event.target.id ===
                "bioInput"
        ) {

            updatePreview();

        }


        if (
            event.target.id ===
            "usernameInput"
        ) {

            queueUsernameCheck();

        }

    }
);


function updatePreview() {

    const name =
        document
            .getElementById(
                "nameInput"
            )
            .value
            .trim();


    const username =
        document
            .getElementById(
                "usernameInput"
            )
            .value
            .trim()
            .replace(
                /^@/,
                ""
            );


    const bio =
        document
            .getElementById(
                "bioInput"
            )
            .value
            .trim();


    document
        .getElementById(
            "previewName"
        )
        .textContent =
        name ||
        "Your Name";


    document
        .getElementById(
            "previewUsername"
        )
        .textContent =
        "@" +
        (
            username ||
            "username"
        );


    document
        .getElementById(
            "previewBio"
        )
        .textContent =
        bio ||
        "Your bio";

}



/* =========================================================
   USERNAME CHECK
========================================================= */

function queueUsernameCheck() {

    clearTimeout(
        usernameTimer
    );


    const username =
        document
            .getElementById(
                "usernameInput"
            )
            .value
            .trim()
            .toLowerCase()
            .replace(
                /^@/,
                ""
            );


    /*
     * Empty username.
     */

    if (!username) {

        setUsernameStatus(
            "Enter a username.",
            "#dc2626"
        );


        usernameAvailable =
            false;


        lastCheckedUsername =
            "";


        return;

    }


    /*
     * Basic validation before
     * making a server request.
     */

    if (
        username.length <
            3 ||
        username.length >
            20
    ) {

        setUsernameStatus(
            "Username must be 3–20 characters.",
            "#dc2626"
        );


        usernameAvailable =
            false;


        lastCheckedUsername =
            "";


        return;

    }


    if (
        !/^[a-z0-9_]+$/i.test(
            username
        )
    ) {

        setUsernameStatus(
            "Use only letters, numbers, and underscores.",
            "#dc2626"
        );


        usernameAvailable =
            false;


        lastCheckedUsername =
            "";


        return;

    }


    /*
     * If the username hasn't changed from
     * the saved username, it's automatically okay.
     */

    const originalUsername =
        String(
            currentUser.username ||
            ""
        )
        .trim()
        .toLowerCase()
        .replace(
            /^@/,
            ""
        );


    if (
        username ===
        originalUsername
    ) {

        usernameAvailable =
            true;


        lastCheckedUsername =
            username;


        setUsernameStatus(
            "✓ Current username",
            "#16834a"
        );


        return;

    }


    usernameAvailable =
        false;


    lastCheckedUsername =
        "";


    setUsernameStatus(
        "Checking username...",
        "#718096"
    );


    usernameTimer =
        setTimeout(
            function() {

                checkUsernameAvailability(
                    username
                );

            },
            USERNAME_CHECK_DELAY
        );

}


async function checkUsernameAvailability(
    username
) {

    const cleaned =
        String(
            username ||
            ""
        )
        .trim()
        .toLowerCase()
        .replace(
            /^@/,
            ""
        );


    const requestId =
        ++usernameCheckNumber;


    if (!cleaned) {

        usernameAvailable =
            false;

        return;

    }


    const originalUsername =
        String(
            currentUser.username ||
            ""
        )
        .trim()
        .toLowerCase()
        .replace(
            /^@/,
            ""
        );


    if (
        cleaned ===
        originalUsername
    ) {

        usernameAvailable =
            true;


        lastCheckedUsername =
            cleaned;


        setUsernameStatus(
            "✓ Current username",
            "#16834a"
        );


        return;

    }


    setUsernameStatus(
        "Checking username...",
        "#718096"
    );


    try {

        const response =
            await fetch(

                APPS_SCRIPT_URL +
                "?action=usernameAvailable" +
                "&username=" +
                encodeURIComponent(
                    cleaned
                ) +
                "&email=" +
                encodeURIComponent(
                    currentUser.email
                ),

                {
                    cache:
                        "no-store"
                }

            );


        const result =
            await response.json();


        /*
         * Ignore an old request.
         */

        if (
            requestId !==
            usernameCheckNumber
        ) {

            return;

        }


        /*
         * Make sure the user hasn't changed
         * the field while the request was running.
         */

        const currentValue =
            document
                .getElementById(
                    "usernameInput"
                )
                .value
                .trim()
                .toLowerCase()
                .replace(
                    /^@/,
                    ""
                );


        if (
            currentValue !==
            cleaned
        ) {

            return;

        }


        if (
            result.success &&
            result.available === true
        ) {

            usernameAvailable =
                true;


            lastCheckedUsername =
                cleaned;


            setUsernameStatus(
                "✓ Username available",
                "#16834a"
            );

        }

        else {

            usernameAvailable =
                false;


            lastCheckedUsername =
                cleaned;


            setUsernameStatus(
                result.error ||
                "✗ Username is already taken",
                "#dc2626"
            );

        }

    }

    catch {

        /*
         * Don't assume availability if
         * the server couldn't be reached.
         */

        usernameAvailable =
            false;


        lastCheckedUsername =
            "";


        setUsernameStatus(
            "Couldn't check username. Try again.",
            "#dc2626"
        );

    }

}


function setUsernameStatus(
    text,
    color
) {

    const element =
        document.getElementById(
            "usernameStatus"
        );


    element.textContent =
        text;


    element.style.color =
        color;

}



/* =========================================================
   IMAGE PICKER
========================================================= */

function openImagePicker() {

    document
        .getElementById(
            "imageInput"
        )
        .click();

}


function handleImageSelection(
    event
) {

    const file =
        event.target.files &&
        event.target.files[0];


    if (!file) {

        return;

    }


    if (
        !file.type.startsWith(
            "image/"
        )
    ) {

        alert(
            "Please choose an image."
        );

        event.target.value =
            "";

        return;

    }


    if (
        file.size >
        10 * 1024 * 1024
    ) {

        alert(
            "Please choose an image smaller than 10 MB."
        );

        event.target.value =
            "";

        return;

    }


    selectedImage =
        file;


    /*
     * Show photo immediately.
     */

    const reader =
        new FileReader();


    reader.onload =
        function() {

            document
                .getElementById(
                    "profilePicture"
                )
                .src =
                reader.result;


            document
                .getElementById(
                    "previewPicture"
                )
                .src =
                reader.result;

        };


    reader.readAsDataURL(
        file
    );

}



/* =========================================================
   SAVE PROFILE
========================================================= */

async function saveProfile() {

    const name =
        document
            .getElementById(
                "nameInput"
            )
            .value
            .trim();


    const username =
        document
            .getElementById(
                "usernameInput"
            )
            .value
            .trim()
            .toLowerCase()
            .replace(
                /^@/,
                ""
            );


    const bio =
        document
            .getElementById(
                "bioInput"
            )
            .value
            .trim();


    const button =
        document.getElementById(
            "saveButton"
        );


    const status =
        document.getElementById(
            "statusMessage"
        );


    /*
     * Basic validation.
     */

    if (!name) {

        status.textContent =
            "Please enter a display name.";

        status.style.color =
            "#dc2626";

        return;

    }


    if (
        username.length <
            3 ||
        username.length >
            20
    ) {

        status.textContent =
            "Username must be 3–20 characters.";

        status.style.color =
            "#dc2626";

        return;

    }


    if (
        !/^[a-z0-9_]+$/i.test(
            username
        )
    ) {

        status.textContent =
            "Username can only contain letters, numbers, and underscores.";

        status.style.color =
            "#dc2626";

        return;

    }


    /*
     * =====================================================
     * IMPORTANT:
     *
     * CHECK USERNAME BEFORE OPTIMISTIC UPDATE
     * =====================================================
     */

    const originalUsername =
        String(
            currentUser.username ||
            ""
        )
        .trim()
        .toLowerCase()
        .replace(
            /^@/,
            ""
        );


    if (
        username !==
        originalUsername
    ) {

        /*
         * If this exact username hasn't
         * been confirmed yet, check it now.
         */

        if (
            !usernameAvailable ||
            lastCheckedUsername !==
                username
        ) {

            button.disabled =
                true;


            button.textContent =
                "Checking...";


            setUsernameStatus(
                "Checking username...",
                "#718096"
            );


            try {

                const response =
                    await fetch(

                        APPS_SCRIPT_URL +
                        "?action=usernameAvailable" +
                        "&username=" +
                        encodeURIComponent(
                            username
                        ) +
                        "&email=" +
                        encodeURIComponent(
                            currentUser.email
                        ),

                        {
                            cache:
                                "no-store"
                        }

                    );


                const result =
                    await response.json();


                if (
                    !result.success ||
                    result.available !== true
                ) {

                    usernameAvailable =
                        false;


                    lastCheckedUsername =
                        username;


                    setUsernameStatus(
                        result.error ||
                        "Username is already taken.",
                        "#dc2626"
                    );


                    status.textContent =
                        result.error ||
                        "Username is already taken.";

                    status.style.color =
                        "#dc2626";


                    button.disabled =
                        false;

                    button.textContent =
                        "Save Changes";


                    return;

                }


                usernameAvailable =
                    true;


                lastCheckedUsername =
                    username;


                setUsernameStatus(
                    "✓ Username available",
                    "#16834a"
                );

            }

            catch {

                usernameAvailable =
                    false;


                lastCheckedUsername =
                    "";


                setUsernameStatus(
                    "Couldn't check username. Try again.",
                    "#dc2626"
                );


                status.textContent =
                    "Couldn't verify username.";

                status.style.color =
                    "#dc2626";


                button.disabled =
                    false;

                button.textContent =
                    "Save Changes";


                return;

            }

            finally {

                if (
                    button.textContent ===
                    "Checking..."
                ) {

                    button.disabled =
                        false;

                    button.textContent =
                        "Save Changes";

                }

            }

        }


        /*
         * Final local check.
         */

        if (
            !usernameAvailable ||
            lastCheckedUsername !==
                username
        ) {

            status.textContent =
                "Username is already taken or couldn't be verified.";

            status.style.color =
                "#dc2626";

            return;

        }

    }


    /*
     * =====================================================
     * STORE OLD PROFILE FOR ROLLBACK
     * =====================================================
     */

    const previousUser =
        {
            ...currentUser
        };


    /*
     * =====================================================
     * OPTIMISTIC UPDATE
     * =====================================================
     */

    currentUser.name =
        name;


    currentUser.username =
        username;


    currentUser.bio =
        bio;


    /*
     * Keep existing picture until
     * new picture gets uploaded.
     */

    if (
        !selectedImage
    ) {

        currentUser.profilePicture =
            currentUser.profilePicture ||
            currentUser.picture ||
            "images/Logo3.1.png";

    }


    /*
     * Update local storage immediately.
     */

    localStorage.setItem(

        "writejotUser",

        JSON.stringify(
            currentUser
        )

    );


    /*
     * Show immediate feedback.
     */

    status.textContent =
        "Changes applied.";

    status.style.color =
        "#16834a";


    button.disabled =
        true;

    button.textContent =
        "Saving...";


    try {

        let imageData =
            "";

        let imageType =
            "";

        let imageName =
            "";


        /*
         * Compress the selected photo
         * before sending it to Drive.
         */

        if (
            selectedImage
        ) {

            const compressed =
                await compressImage(
                    selectedImage
                );


            imageData =
                compressed.dataUrl;


            imageType =
                compressed.mimeType;


            imageName =
                compressed.fileName;

        }


        /*
         * Save profile.
         */

        const response =
            await fetch(

                APPS_SCRIPT_URL,

                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "text/plain;charset=utf-8"

                    },

                    body:
                        JSON.stringify({

                            action:
                                "updateProfile",

                            email:
                                currentUser.email,

                            name:
                                name,

                            username:
                                username,

                            bio:
                                bio,

                            profileImageData:
                                imageData,

                            profileImageType:
                                imageType,

                            profileImageName:
                                imageName

                        })

                }

            );


        const result =
            await response.json();


        /*
         * The server still gets the
         * final say.
         */

        if (
            !result.success
        ) {

            throw new Error(
                result.error ||
                "Could not save profile."
            );

        }


        /*
         * Server confirmed the change.
         */

        currentUser.name =
            result.name ||
            name;


        currentUser.username =
            result.username ||
            username;


        currentUser.bio =
            result.bio ||
            bio;


        currentUser.profilePicture =
            result.profilePicture ||
            currentUser.profilePicture ||
            "images/Logo3.1.png";


        localStorage.setItem(

            "writejotUser",

            JSON.stringify(
                currentUser
            )

        );


        /*
         * Replace local image preview
         * with the real Drive image.
         */

        document
            .getElementById(
                "profilePicture"
            )
            .src =
            currentUser.profilePicture;


        document
            .getElementById(
                "previewPicture"
            )
            .src =
            currentUser.profilePicture;


        updatePreview();


        selectedImage =
            null;


        document
            .getElementById(
                "imageInput"
            )
            .value =
            "";


        status.textContent =
            "Changes saved.";

        status.style.color =
            "#16834a";


        /*
         * Go back to dashboard after
         * confirmation.
         */

        setTimeout(
            function() {

                if (
                    window.TuklassSPA
                ) {
                    window.TuklassSPA.navigate(
                        "home",
                        "index.html"
                    );
                }
                else {
                    window.location.href =
                        "index.html";
                }

            },
            350
        );

    }

    catch (error) {

        /*
         * =================================================
         * ROLLBACK
         * =================================================
         */

        currentUser =
            previousUser;


        localStorage.setItem(

            "writejotUser",

            JSON.stringify(
                currentUser
            )

        );


        loadLocalProfile();


        selectedImage =
            null;


        document
            .getElementById(
                "imageInput"
            )
            .value =
            "";


        status.textContent =
            error.message ||
            "Could not save changes.";

        status.style.color =
            "#dc2626";

    }

    finally {

        button.disabled =
            false;

        button.textContent =
            "Save Changes";

    }

}



/* =========================================================
   COMPRESS IMAGE
========================================================= */

function compressImage(
    file
) {

    return new Promise(
        function(
            resolve,
            reject
        ) {

            const reader =
                new FileReader();


            reader.onerror =
                reject;


            reader.onload =
                function() {

                    const image =
                        new Image();


                    image.onerror =
                        reject;


                    image.onload =
                        function() {

                            const maxSize =
                                1200;


                            let width =
                                image.width;


                            let height =
                                image.height;


                            if (
                                width >
                                maxSize ||
                                height >
                                maxSize
                            ) {

                                if (
                                    width >
                                    height
                                ) {

                                    height =
                                        Math.round(
                                            height *
                                            maxSize /
                                            width
                                        );


                                    width =
                                        maxSize;

                                }

                                else {

                                    width =
                                        Math.round(
                                            width *
                                            maxSize /
                                            height
                                        );


                                    height =
                                        maxSize;

                                }

                            }


                            const canvas =
                                document
                                    .createElement(
                                        "canvas"
                                    );


                            canvas.width =
                                width;


                            canvas.height =
                                height;


                            const context =
                                canvas
                                    .getContext(
                                        "2d"
                                    );


                            context.drawImage(

                                image,

                                0,
                                0,

                                width,
                                height

                            );


                            resolve({

                                dataUrl:
                                    canvas.toDataURL(
                                        "image/jpeg",
                                        .82
                                    ),

                                mimeType:
                                    "image/jpeg",

                                fileName:
                                    "profile-" +
                                    Date.now() +
                                    ".jpg"

                            });

                        };


                    image.src =
                        reader.result;

                };


            reader.readAsDataURL(
                file
            );

        }
    );

}



/* =========================================================
   UNSAVED CHANGE DETECTION
========================================================= */

function hasUnsavedChanges() {

    const name =
        document
            .getElementById(
                "nameInput"
            )
            .value
            .trim();


    const username =
        document
            .getElementById(
                "usernameInput"
            )
            .value
            .trim()
            .toLowerCase()
            .replace(
                /^@/,
                ""
            );


    const bio =
        document
            .getElementById(
                "bioInput"
            )
            .value
            .trim();


    return (

        name !==
            String(
                currentUser.name ||
                ""
            ).trim()

        ||

        username !==
            String(
                currentUser.username ||
                ""
            )
            .trim()
            .toLowerCase()
            .replace(
                /^@/,
                ""
            )

        ||

        bio !==
            String(
                currentUser.bio ||
                ""
            ).trim()

        ||

        !!selectedImage

    );

}

    function spaInit() {

        window.openImagePicker =
            openImagePicker;

        window.handleImageSelection =
            handleImageSelection;

        window.saveProfile =
            saveProfile;

        init();
    }

    function cleanup() {

        if (
            usernameTimer
        ) {
            clearTimeout(
                usernameTimer
            );

            usernameTimer =
                null;
        }

        selectedImage =
            null;

        try {
            delete window.openImagePicker;
        }
        catch {}

        try {
            delete window.handleImageSelection;
        }
        catch {}

        try {
            delete window.saveProfile;
        }
        catch {}
    }

    return {
        init: spaInit,
        cleanup: cleanup
    };

})();


/* =========================================================
   VERIFIED ADMIN AUTH
========================================================= */

window.TuklassAdminAuth = (function () {

    const API_URL = window.TUKLASS_CONFIG.apiUrl;
    const STORAGE_KEY = "tuklassAdminSession";
    const GOOGLE_TOKEN_KEY = "tuklassGoogleIdToken";
    let memorySession = null;

    function readStoredSession() {
        if (memorySession) return memorySession;

        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (
                !parsed ||
                !parsed.adminSession ||
                Number(parsed.expiresAt || 0) <= Date.now() + 15000
            ) {
                sessionStorage.removeItem(STORAGE_KEY);
                return null;
            }
            memorySession = parsed;
            return parsed;
        }
        catch {
            return null;
        }
    }

    function storeSession(result) {
        const session = {
            adminSession: result.adminSession,
            email: result.email || "",
            masterAdmin: result.masterAdmin === true,
            expiresAt:
                Date.now() +
                Math.max(60, Number(result.expiresIn || 1800) - 30) * 1000
        };

        memorySession = session;

        try {
            sessionStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(session)
            );
        }
        catch {}

        return session;
    }

    function clear() {
        memorySession = null;
        try {
            sessionStorage.removeItem(STORAGE_KEY);
        }
        catch {}
    }

    async function rawPost(payload) {
        const response = await fetch(
            API_URL,
            {
                method: "POST",
                headers: {
                    "Content-Type": "text/plain;charset=utf-8"
                },
                cache: "no-store",
                body: JSON.stringify(payload)
            }
        );

        return response.json();
    }

    async function ensureSession(force) {
        if (!force) {
            const existing = readStoredSession();
            if (existing) return existing;
        }

        clear();

        let idToken = "";
        try {
            idToken = sessionStorage.getItem(GOOGLE_TOKEN_KEY) || "";
        }
        catch {}

        if (!idToken) {
            throw new Error(
                "Admin access requires a fresh Google verification. Sign out, then sign in again with your authorized Google account."
            );
        }

        const result = await rawPost({
            action: "createAdminSession",
            idToken: idToken
        });

        if (!result.success || !result.adminSession) {
            throw new Error(
                result.error ||
                "This Google account is not authorized for Tuklass Admin."
            );
        }

        return storeSession(result);
    }

    async function post(payload, allowRetry) {
        const retry = allowRetry !== false;
        const session = await ensureSession(false);

        const result = await rawPost({
            ...payload,
            adminSession: session.adminSession
        });

        if (
            retry &&
            result &&
            (
                result.sessionExpired === true ||
                result.adminAccessDenied === true
            )
        ) {
            clear();

            if (result.sessionExpired === true) {
                const renewed = await ensureSession(true);
                return rawPost({
                    ...payload,
                    adminSession: renewed.adminSession
                });
            }
        }

        return result;
    }

    return {
        ensureSession: ensureSession,
        post: post,
        clear: clear
    };

})();


/* =========================================================
   ADMIN HOME ROUTE MODULE
========================================================= */

window.TuklassAdminHome = (function () {

    let dashboardData = null;

    function setStatus(text, error, success) {
        const target = document.getElementById("adminHomeStatus");
        if (!target) return;
        target.textContent = text || "";
        target.className =
            "admin-home-status" +
            (error ? " error" : (success ? " success" : ""));
    }

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function renderAdmins() {
        const panel = document.getElementById("masterAdminPanel");
        const list = document.getElementById("authorizedAdminList");
        const identity = document.getElementById("adminVerifiedIdentity");
        const badge = document.getElementById("adminRoleBadge");

        if (identity && dashboardData) {
            identity.textContent = dashboardData.email || "Verified admin";
        }

        if (badge && dashboardData) {
            badge.textContent = dashboardData.masterAdmin
                ? "Master admin"
                : "Authorized admin";
        }

        if (!panel || !dashboardData) return;

        panel.hidden = dashboardData.masterAdmin !== true;

        if (!dashboardData.masterAdmin || !list) return;

        const masterEmail = String(dashboardData.masterEmail || "").toLowerCase();
        const admins = Array.isArray(dashboardData.admins)
            ? dashboardData.admins
            : [];

        list.innerHTML = admins.map(function (email) {
            const normalized = String(email || "").toLowerCase();
            const master = normalized === masterEmail;

            return `
                <div class="authorized-admin-row">
                    <div>
                        <strong>${escapeHtml(email)}</strong>
                        <span>${master ? "Master admin · permanent" : "Authorized admin"}</span>
                    </div>
                    ${master
                        ? '<span class="master-lock-chip">Master</span>'
                        : `<button type="button" class="remove-admin-button" data-admin-email="${escapeHtml(email)}">Remove</button>`
                    }
                </div>
            `;
        }).join("");

        list.querySelectorAll(".remove-admin-button").forEach(function (button) {
            button.addEventListener("click", function () {
                removeAdmin(button.dataset.adminEmail || "");
            });
        });
    }

    async function refresh() {
        setStatus("Verifying admin access...");

        try {
            const result = await window.TuklassAdminAuth.post({
                action: "adminDashboard"
            });

            if (!result.success) {
                throw new Error(result.error || "Admin access required.");
            }

            dashboardData = result;
            renderAdmins();
            setStatus("Google-verified admin session active.", false, true);
        }
        catch (error) {
            setStatus(error.message || "Could not verify admin access.", true);
        }
    }

    async function addAdmin() {
        const input = document.getElementById("newAdminEmail");
        const button = document.getElementById("addAuthorizedAdminButton");
        const email = input ? input.value.trim().toLowerCase() : "";

        if (!email || !email.includes("@")) {
            setStatus("Enter a valid email address.", true);
            return;
        }

        if (button) button.disabled = true;

        try {
            const result = await window.TuklassAdminAuth.post({
                action: "addAuthorizedAdmin",
                adminEmail: email
            });

            if (!result.success) {
                throw new Error(result.error || "Could not add administrator.");
            }

            if (input) input.value = "";
            await refresh();
            setStatus("Administrator added.", false, true);
        }
        catch (error) {
            setStatus(error.message || "Could not add administrator.", true);
        }
        finally {
            if (button) button.disabled = false;
        }
    }

    async function removeAdmin(email) {
        if (!email) return;

        if (!window.confirm("Remove admin access for " + email + "?")) {
            return;
        }

        try {
            const result = await window.TuklassAdminAuth.post({
                action: "removeAuthorizedAdmin",
                adminEmail: email
            });

            if (!result.success) {
                throw new Error(result.error || "Could not remove administrator.");
            }

            await refresh();
            setStatus("Administrator removed.", false, true);
        }
        catch (error) {
            setStatus(error.message || "Could not remove administrator.", true);
        }
    }

    function init() {
        window.addAuthorizedTuklassAdmin = addAdmin;
        refresh();
    }

    function cleanup() {
        try { delete window.addAuthorizedTuklassAdmin; } catch {}
        dashboardData = null;
    }

    return {
        init: init,
        cleanup: cleanup
    };

})();


/* =========================================================
   ADMIN REMINDERS ROUTE MODULE
========================================================= */

window.TuklassAdminReminders = (function () {

const APPS_SCRIPT_URL =
    window.TUKLASS_CONFIG.apiUrl;

let currentUser = null;
let adminSchools = [];
let adminClasses = [];


async function init() {

    const saved =
        localStorage.getItem(
            "writejotUser"
        );

    if (!saved) {
        setMessage("Please sign in first.", true);
        return;
    }

    try {
        currentUser = JSON.parse(saved);
    }
    catch {
        setMessage("Could not load your account.", true);
        return;
    }

    const dateInput =
        document.getElementById("date");

    if (dateInput) {
        dateInput.value = getToday();
    }

    await loadAdminClasses();

}


async function loadAdminClasses() {

    setMessage("Loading classes...", false);

    try {

        const result = await window.TuklassAdminAuth.post({
            action: "adminDirectory"
        });

        if (!result.success) {
            throw new Error(result.error || "Admin access required.");
        }

        adminSchools = Array.isArray(result.schools) ? result.schools : [];
        adminClasses = Array.isArray(result.classes) ? result.classes : [];

        const schoolSelect = document.getElementById("adminReminderSchool");
        if (!schoolSelect) return;

        schoolSelect.innerHTML = '<option value="">Choose a school</option>';

        adminSchools.forEach(function(school) {
            const option = document.createElement("option");
            option.value = school.schoolId;
            option.textContent = school.schoolName;
            schoolSelect.appendChild(option);
        });

        populateReminderClasses();
        setMessage("", false);

    }
    catch (error) {
        setMessage(error.message || "Could not load classes.", true);
    }

}


function populateReminderClasses() {

    const schoolSelect = document.getElementById("adminReminderSchool");
    const classSelect = document.getElementById("adminReminderClass");

    if (!schoolSelect || !classSelect) return;

    const schoolId = schoolSelect.value;

    classSelect.innerHTML = '<option value="">Choose a section</option>';

    const matches = adminClasses.filter(function(classInfo) {
        return classInfo.schoolId === schoolId;
    });

    matches.forEach(function(classInfo) {
        const option = document.createElement("option");
        option.value = classInfo.classId;
        option.textContent = classInfo.section;
        classSelect.appendChild(option);
    });

    classSelect.disabled = !schoolId || !matches.length;

}


async function createClassReminder() {

    if (!currentUser) return;

    const classId = document.getElementById("adminReminderClass").value;
    const title = document.getElementById("title").value.trim();
    const date = document.getElementById("date").value;
    const time = document.getElementById("time").value;
    const description = document.getElementById("description").value.trim();
    const button = document.getElementById("createButton");

    if (!classId || !title || !date) {
        setMessage("Class, title, and date are required.", true);
        return;
    }

    button.disabled = true;
    button.textContent = "Creating...";
    setMessage("", false);

    try {

        const result = await window.TuklassAdminAuth.post({
            action: "addClassReminder",
            classId: classId,
            title: title,
            date: date,
            time: time,
            description: description
        });

        if (!result.success) {
            throw new Error(result.error || "Could not create class reminder.");
        }

        setMessage("Class reminder created successfully.", false, true);
        document.getElementById("title").value = "";
        document.getElementById("time").value = "";
        document.getElementById("description").value = "";

    }
    catch (error) {
        setMessage(error.message || "Could not create reminder.", true);
    }
    finally {
        button.disabled = false;
        button.textContent = "Create Class Reminder";
    }

}


function setMessage(text, error, success) {
    const message = document.getElementById("message");
    if (!message) return;
    message.textContent = text || "";
    message.style.color = error ? "#dc2626" : (success ? "#16834a" : "#718096");
}


function getToday() {
    const date = new Date();
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2,"0"),
        String(date.getDate()).padStart(2,"0")
    ].join("-");
}


function spaInit() {
    window.createClassReminder = createClassReminder;
    window.adminReminderSchoolChanged = populateReminderClasses;
    init();
}

function cleanup() {
    try { delete window.createClassReminder; } catch {}
    try { delete window.adminReminderSchoolChanged; } catch {}
    currentUser = null;
    adminSchools = [];
    adminClasses = [];
}

return {init:spaInit, cleanup:cleanup};

})();


/* =========================================================
   ADMIN SCHOOLS + CLASSES ROUTE MODULE
========================================================= */

window.TuklassAdminClasses = (function () {

const APPS_SCRIPT_URL =
    window.TUKLASS_CONFIG.apiUrl;

let currentUser = null;
let directory = {schools:[], classes:[], students:[]};
let searchBound = false;


async function init() {

    const saved = localStorage.getItem("writejotUser");

    if (!saved) {
        showDirectoryMessage("Please sign in first.", true);
        return;
    }

    try {
        currentUser = JSON.parse(saved);
    }
    catch {
        showDirectoryMessage("Could not load your account.", true);
        return;
    }

    bindSearch();
    await loadDirectory();

}


function bindSearch() {

    if (searchBound) return;

    const input = document.getElementById("adminDirectorySearch");
    if (!input) return;

    input.addEventListener("input", renderDirectory);
    searchBound = true;

}


async function loadDirectory() {

    showDirectoryMessage("Loading schools and classes...", false);

    try {

        const result = await window.TuklassAdminAuth.post({
            action: "adminDirectory"
        });

        if (!result.success) {
            throw new Error(result.error || "Admin access required.");
        }

        directory = {
            schools:Array.isArray(result.schools) ? result.schools : [],
            classes:Array.isArray(result.classes) ? result.classes : [],
            students:Array.isArray(result.students) ? result.students : []
        };

        populateClassSchoolSelect();
        renderDirectory();
        showDirectoryMessage("", false);

    }
    catch (error) {
        showDirectoryMessage(error.message || "Could not load admin directory.", true);
    }

}


function populateClassSchoolSelect() {

    const select = document.getElementById("adminClassSchool");
    if (!select) return;

    const previous = select.value;
    select.innerHTML = '<option value="">Choose a school</option>';

    directory.schools.forEach(function(school) {
        const option = document.createElement("option");
        option.value = school.schoolId;
        option.textContent = school.schoolName;
        select.appendChild(option);
    });

    if (directory.schools.some(function(school) { return school.schoolId === previous; })) {
        select.value = previous;
    }

}


async function addAdminSchool() {

    const input = document.getElementById("adminSchoolName");
    const button = document.getElementById("adminAddSchoolButton");
    const schoolName = input ? input.value.trim() : "";

    if (!schoolName) {
        showDirectoryMessage("Enter a school name.", true);
        return;
    }

    button.disabled = true;

    try {

        const result = await post({
            action:"addSchool",
            email:currentUser.email,
            schoolName:schoolName
        });

        if (!result.success) throw new Error(result.error || "Could not add school.");

        input.value = "";
        showDirectoryMessage("School added.", false, true);
        await loadDirectory();

    }
    catch (error) {
        showDirectoryMessage(error.message || "Could not add school.", true);
    }
    finally {
        button.disabled = false;
    }

}


async function addAdminClass() {

    const schoolSelect = document.getElementById("adminClassSchool");
    const sectionInput = document.getElementById("adminSectionName");
    const button = document.getElementById("adminAddClassButton");
    const schoolId = schoolSelect ? schoolSelect.value : "";
    const section = sectionInput ? sectionInput.value.trim() : "";

    if (!schoolId || !section) {
        showDirectoryMessage("Choose a school and enter a section.", true);
        return;
    }

    button.disabled = true;

    try {

        const result = await post({
            action:"addClass",
            email:currentUser.email,
            schoolId:schoolId,
            section:section
        });

        if (!result.success) throw new Error(result.error || "Could not add section.");

        sectionInput.value = "";
        showDirectoryMessage("Section added.", false, true);
        await loadDirectory();

    }
    catch (error) {
        showDirectoryMessage(error.message || "Could not add section.", true);
    }
    finally {
        button.disabled = false;
    }

}


async function post(payload) {
    const cleanPayload = {...payload};
    delete cleanPayload.email;
    return window.TuklassAdminAuth.post(cleanPayload);
}


function renderDirectory() {

    const target = document.getElementById("adminDirectory");
    if (!target) return;

    const input = document.getElementById("adminDirectorySearch");
    const query = String(input ? input.value : "").trim().toLowerCase();

    const blocks = [];

    directory.schools.forEach(function(school) {

        const schoolClasses = directory.classes.filter(function(classInfo) {
            return classInfo.schoolId === school.schoolId;
        });

        const classBlocks = [];

        schoolClasses.forEach(function(classInfo) {

            let students = directory.students.filter(function(student) {
                return student.classId === classInfo.classId;
            });

            if (query) {
                students = students.filter(function(student) {
                    const haystack = [
                        student.name,
                        student.username,
                        student.email,
                        school.schoolName,
                        classInfo.section
                    ].join(" ").toLowerCase();
                    return haystack.includes(query);
                });

                const classMatches = (
                    school.schoolName + " " + classInfo.section
                ).toLowerCase().includes(query);

                if (!students.length && !classMatches) return;
            }

            const studentRows = students.length
                ? students.map(function(student) {
                    return `
                        <div class="admin-student-row">
                            <div>
                                <strong>${escapeHtml(student.name || "Student")}</strong>
                                <span>@${escapeHtml(student.username || "username")}</span>
                            </div>
                            <span class="admin-student-email">${escapeHtml(student.email || "")}</span>
                        </div>
                    `;
                }).join("")
                : '<div class="admin-empty-roster">No students in this class yet.</div>';

            classBlocks.push(`
                <article class="admin-class-roster">
                    <div class="admin-class-roster-head">
                        <div>
                            <span>Section</span>
                            <h3>${escapeHtml(classInfo.section)}</h3>
                        </div>
                        <strong>${students.length} student${students.length === 1 ? "" : "s"}</strong>
                    </div>
                    <div class="admin-student-list">${studentRows}</div>
                </article>
            `);

        });

        if (!classBlocks.length && query) return;

        blocks.push(`
            <section class="admin-school-block">
                <div class="admin-school-block-head">
                    <div>
                        <span>School</span>
                        <h2>${escapeHtml(school.schoolName)}</h2>
                    </div>
                    <strong>${schoolClasses.length} section${schoolClasses.length === 1 ? "" : "s"}</strong>
                </div>
                <div class="admin-roster-grid">
                    ${classBlocks.length ? classBlocks.join("") : '<div class="route-empty"><strong>No sections yet</strong><span>Add a section above.</span></div>'}
                </div>
            </section>
        `);

    });

    const unassigned = directory.students.filter(function(student) {
        return !student.classId;
    }).filter(function(student) {
        if (!query) return true;
        return [student.name,student.username,student.email,"unassigned"]
            .join(" ").toLowerCase().includes(query);
    });

    if (unassigned.length) {
        blocks.push(`
            <section class="admin-school-block admin-unassigned-block">
                <div class="admin-school-block-head">
                    <div>
                        <span>Accounts</span>
                        <h2>Unassigned</h2>
                    </div>
                    <strong>${unassigned.length}</strong>
                </div>
                <div class="admin-student-list">
                    ${unassigned.map(function(student) {
                        return `
                            <div class="admin-student-row">
                                <div>
                                    <strong>${escapeHtml(student.name || "Student")}</strong>
                                    <span>@${escapeHtml(student.username || "username")}</span>
                                </div>
                                <span class="admin-student-email">${escapeHtml(student.email || "")}</span>
                            </div>
                        `;
                    }).join("")}
                </div>
            </section>
        `);
    }

    target.innerHTML = blocks.length
        ? blocks.join("")
        : '<div class="route-empty"><strong>No matching classes</strong><span>Try another search or add your first school above.</span></div>';

}


function escapeHtml(value) {
    return String(value == null ? "" : value)
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;")
        .replace(/'/g,"&#039;");
}


function showDirectoryMessage(text, error, success) {
    const message = document.getElementById("adminDirectoryMessage");
    if (!message) return;
    message.textContent = text || "";
    message.className = error ? "admin-directory-message error" : (success ? "admin-directory-message success" : "admin-directory-message");
}


function spaInit() {
    window.addAdminSchool = addAdminSchool;
    window.addAdminClass = addAdminClass;
    window.refreshAdminDirectory = loadDirectory;
    init();
}

function cleanup() {
    try { delete window.addAdminSchool; } catch {}
    try { delete window.addAdminClass; } catch {}
    try { delete window.refreshAdminDirectory; } catch {}
    currentUser = null;
    directory = {schools:[], classes:[], students:[]};
    searchBound = false;
}

return {init:spaInit, cleanup:cleanup};

})();


/* =========================================================
   ADMIN CALENDAR ROUTE MODULE — V8.3
   Multi-day schedules + multi-section class events.
========================================================= */
window.TuklassAdminCalendar = (function () {

const APPS_SCRIPT_URL = window.TUKLASS_CONFIG.apiUrl;
let currentUser = null;
let schools = [];
let classes = [];
let schedule = [];
let tests = [];

const WEEKDAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday"
];

function msg(text, error, success) {
    const target = document.getElementById("adminCalendarMessage");
    if (!target) return;
    target.textContent = text || "";
    target.className =
        "admin-directory-message" +
        (error ? " error" : (success ? " success" : ""));
}

function currentClassId() {
    const select = document.getElementById("adminCalendarClass");
    return select ? String(select.value || "").trim() : "";
}

function currentSchoolId() {
    const select = document.getElementById("adminCalendarSchool");
    return select ? String(select.value || "").trim() : "";
}

function value(id) {
    const element = document.getElementById(id);
    return element ? String(element.value || "").trim() : "";
}

function classesForSelectedSchool() {
    const schoolId = currentSchoolId();
    return classes.filter(function (classInfo) {
        return String(classInfo.schoolId || "") === schoolId;
    });
}

function selectedTargetClassIds(kind) {
    const container = document.getElementById(
        kind === "schedule" ? "adminScheduleSections" : "adminEventSections"
    );
    if (!container) return [];

    return Array.from(
        container.querySelectorAll('input[type="checkbox"]:checked')
    ).map(function (input) {
        return String(input.value || "").trim();
    }).filter(Boolean);
}

function renderTargetSections(containerId, kind) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const schoolClasses = classesForSelectedSchool();
    const current = currentClassId();

    if (!currentSchoolId()) {
        container.innerHTML = '<div class="admin-target-empty">Choose a school first.</div>';
        return;
    }

    if (!schoolClasses.length) {
        container.innerHTML = '<div class="admin-target-empty">No sections are available for this school.</div>';
        return;
    }

    container.innerHTML = schoolClasses.map(function (classInfo) {
        const id = escapeHtml(String(classInfo.classId || ""));
        const section = escapeHtml(String(classInfo.section || "Section"));
        const checked =
            (schoolClasses.length === 1 || String(classInfo.classId || "") === current)
                ? " checked"
                : "";

        return `
            <label class="admin-target-chip">
                <input type="checkbox" value="${id}" data-target-kind="${kind}"${checked}>
                <span>${section}</span>
            </label>
        `;
    }).join("");
}

function renderAllTargetSections() {
    renderTargetSections("adminScheduleSections", "schedule");
    renderTargetSections("adminEventSections", "event");
}

function setSectionTargets(kind, mode) {
    const container = document.getElementById(
        kind === "schedule" ? "adminScheduleSections" : "adminEventSections"
    );
    if (!container) return;

    const current = currentClassId();
    const checkboxes = Array.from(
        container.querySelectorAll('input[type="checkbox"]')
    );

    checkboxes.forEach(function (input) {
        if (mode === "all") {
            input.checked = true;
        }
        else if (mode === "current") {
            input.checked = String(input.value || "") === current;
        }
        else {
            input.checked = false;
        }
    });
}

function selectedDays() {
    const container = document.getElementById("adminScheduleDays");
    if (!container) return [];
    return Array.from(
        container.querySelectorAll('input[type="checkbox"]:checked')
    ).map(function (input) {
        return String(input.value || "").trim();
    }).filter(Boolean);
}

function setDayPreset(preset) {
    let wanted = [];

    if (preset === "weekdays") {
        wanted = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    }
    else if (preset === "mon-thu") {
        wanted = ["Monday", "Tuesday", "Wednesday", "Thursday"];
    }
    else if (preset === "mwf") {
        wanted = ["Monday", "Wednesday", "Friday"];
    }
    else if (preset === "tth") {
        wanted = ["Tuesday", "Thursday"];
    }
    else if (preset === "everyday") {
        wanted = WEEKDAYS.slice();
    }

    const container = document.getElementById("adminScheduleDays");
    if (!container) return;

    container.querySelectorAll('input[type="checkbox"]').forEach(function (input) {
        input.checked = wanted.includes(String(input.value || ""));
    });
}

async function init() {
    const raw = localStorage.getItem("writejotUser");

    if (!raw) {
        msg("Please sign in first.", true);
        return;
    }

    try {
        currentUser = JSON.parse(raw);
    }
    catch {
        msg("Could not load your account.", true);
        return;
    }

    const dateInput = document.getElementById("adminTestDate");
    if (dateInput) {
        const now = new Date();
        dateInput.value = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, "0"),
            String(now.getDate()).padStart(2, "0")
        ].join("-");
    }

    await load();
}

async function load() {
    msg("Loading classes...");

    try {
        const result = await window.TuklassAdminAuth.post({
            action: "adminCalendarData"
        });

        if (!result.success) {
            throw new Error(result.error || "Admin access required.");
        }

        schools = Array.isArray(result.schools) ? result.schools : [];
        classes = Array.isArray(result.classes) ? result.classes : [];

        const schoolSelect = document.getElementById("adminCalendarSchool");
        if (schoolSelect) {
            schoolSelect.innerHTML = '<option value="">Choose a school</option>';
            schools.forEach(function (school) {
                const option = document.createElement("option");
                option.value = school.schoolId;
                option.textContent = school.schoolName;
                schoolSelect.appendChild(option);
            });
        }

        schoolChanged();
        msg("");
    }
    catch (error) {
        msg(error.message || "Could not load classes.", true);
    }
}

function schoolChanged() {
    const schoolSelect = document.getElementById("adminCalendarSchool");
    const classSelect = document.getElementById("adminCalendarClass");
    if (!schoolSelect || !classSelect) return;

    const matches = classesForSelectedSchool();
    classSelect.innerHTML = '<option value="">Choose a section to view</option>';

    matches.forEach(function (classInfo) {
        const option = document.createElement("option");
        option.value = classInfo.classId;
        option.textContent = classInfo.section;
        classSelect.appendChild(option);
    });

    classSelect.disabled = !schoolSelect.value || !matches.length;
    schedule = [];
    tests = [];
    renderAllTargetSections();
    render();
}

async function classChanged() {
    const classId = currentClassId();
    schedule = [];
    tests = [];

    if (classId) {
        ["schedule", "event"].forEach(function (kind) {
            const selected = selectedTargetClassIds(kind);
            if (!selected.length) setSectionTargets(kind, "current");
        });
    }

    render();
    if (!classId) return;

    msg("Loading calendar...");

    try {
        const result = await window.TuklassAdminAuth.post({
            action: "adminCalendarData",
            classId: classId
        });

        if (!result.success) {
            throw new Error(result.error || "Could not load calendar.");
        }

        schedule = Array.isArray(result.schedule) ? result.schedule : [];
        tests = Array.isArray(result.tests) ? result.tests : [];
        render();
        msg("");
    }
    catch (error) {
        msg(error.message || "Could not load calendar.", true);
    }
}

async function post(payload) {
    msg("Saving...");
    const clean = {...payload};
    delete clean.email;

    const result = await window.TuklassAdminAuth.post(clean);

    if (!result.success) {
        msg(result.error || "Could not save.", true);
        throw new Error(result.error || "Could not save.");
    }

    return result;
}

async function addSchedule() {
    const classIds = selectedTargetClassIds("schedule");
    const days = selectedDays();
    const subject = value("adminScheduleSubject");
    const startTime = value("adminScheduleStart");

    if (!classIds.length || !subject || !days.length || !startTime) {
        msg("Choose at least one section and day, then enter the subject and start time.", true);
        return;
    }

    try {
        const result = await post({
            action: "addClassScheduleEntries",
            classIds: classIds,
            subject: subject,
            days: days,
            startTime: startTime,
            endTime: value("adminScheduleEnd")
        });

        const input = document.getElementById("adminScheduleSubject");
        if (input) input.value = "";

        if (currentClassId()) {
            await classChanged();
        }

        msg(
            "Added " + Number(result.created || 0) +
            " class schedule entr" + (Number(result.created || 0) === 1 ? "y" : "ies") +
            " across " + classIds.length + " section" + (classIds.length === 1 ? "" : "s") + ".",
            false,
            true
        );
    }
    catch {}
}

async function addTest() {
    const classIds = selectedTargetClassIds("event");
    const subject = value("adminTestSubject");
    const title = value("adminTestTitle");
    const date = value("adminTestDate");

    if (!classIds.length || !subject || !title || !date) {
        msg("Choose at least one section and enter the subject, title, and date.", true);
        return;
    }

    try {
        const result = await post({
            action: "addClassTestEntries",
            classIds: classIds,
            subject: subject,
            title: title,
            date: date,
            startTime: value("adminTestStart")
        });

        const titleInput = document.getElementById("adminTestTitle");
        if (titleInput) titleInput.value = "";

        if (currentClassId()) {
            await classChanged();
        }

        msg(
            "Added the event to " + Number(result.created || 0) +
            " section" + (Number(result.created || 0) === 1 ? "" : "s") + ".",
            false,
            true
        );
    }
    catch {}
}

async function delSchedule(id) {
    try {
        await post({
            action: "deleteClassScheduleEntry",
            scheduleId: id
        });
        await classChanged();
        msg("Schedule entry deleted.", false, true);
    }
    catch {}
}

async function delTest(id) {
    try {
        await post({
            action: "deleteClassTestEntry",
            testId: id
        });
        await classChanged();
        msg("Event deleted.", false, true);
    }
    catch {}
}

function escapeHtml(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function jsEscape(value) {
    return String(value || "")
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'");
}

function render() {
    const scheduleList = document.getElementById("adminScheduleList");
    const eventList = document.getElementById("adminTestList");
    const classId = currentClassId();

    if (scheduleList) {
        if (!classId) {
            scheduleList.innerHTML = '<div class="admin-calendar-empty">Choose a section above to view its existing weekly schedule.</div>';
        }
        else if (!schedule.length) {
            scheduleList.innerHTML = '<div class="admin-calendar-empty">No weekly classes yet.</div>';
        }
        else {
            scheduleList.innerHTML = schedule.map(function (entry) {
                return `
                    <div class="admin-calendar-row">
                        <div class="admin-calendar-day">${escapeHtml(entry.day)}</div>
                        <div class="admin-calendar-row-main">
                            <strong>${escapeHtml(entry.subject)}</strong>
                            <span>${escapeHtml(entry.startTime || "")}${entry.endTime ? " – " + escapeHtml(entry.endTime) : ""}</span>
                        </div>
                        <button class="admin-calendar-delete" onclick="deleteAdminSchedule('${jsEscape(entry.scheduleId)}')">Delete</button>
                    </div>
                `;
            }).join("");
        }
    }

    if (eventList) {
        if (!classId) {
            eventList.innerHTML = '<div class="admin-calendar-empty">Choose a section above to view its existing events.</div>';
        }
        else if (!tests.length) {
            eventList.innerHTML = '<div class="admin-calendar-empty">No events, tests, or exams yet.</div>';
        }
        else {
            eventList.innerHTML = tests.map(function (entry) {
                return `
                    <div class="admin-calendar-row">
                        <div class="admin-calendar-date">${escapeHtml(entry.date)}</div>
                        <div class="admin-calendar-row-main">
                            <strong>${escapeHtml(entry.title)}</strong>
                            <span>${escapeHtml(entry.subject)}${entry.startTime ? " · " + escapeHtml(entry.startTime) : ""}</span>
                        </div>
                        <button class="admin-calendar-delete" onclick="deleteAdminTest('${jsEscape(entry.testId)}')">Delete</button>
                    </div>
                `;
            }).join("");
        }
    }
}

function spaInit() {
    window.adminCalendarSchoolChanged = schoolChanged;
    window.adminCalendarClassChanged = classChanged;
    window.setAdminScheduleDayPreset = setDayPreset;
    window.setAdminSectionTargets = setSectionTargets;
    window.addAdminSchedule = addSchedule;
    window.addAdminTest = addTest;
    window.deleteAdminSchedule = delSchedule;
    window.deleteAdminTest = delTest;
    return init();
}

function cleanup() {
    try {
        delete window.adminCalendarSchoolChanged;
        delete window.adminCalendarClassChanged;
        delete window.setAdminScheduleDayPreset;
        delete window.setAdminSectionTargets;
        delete window.addAdminSchedule;
        delete window.addAdminTest;
        delete window.deleteAdminSchedule;
        delete window.deleteAdminTest;
    }
    catch {}

    currentUser = null;
    schools = [];
    classes = [];
    schedule = [];
    tests = [];
}

return {
    init: spaInit,
    cleanup: cleanup
};

})();


/* =========================================================
   SEARCH ROUTE MODULE
========================================================= */

window.TuklassSearch = (function () {

const APPS_SCRIPT_URL =
    window.TUKLASS_CONFIG.apiUrl;

let timer = null;
let requestNumber = 0;
let boundInput = null;

function init() {

    const input =
        document.getElementById(
            "globalProfileSearch"
        );

    if (!input) {
        return;
    }

    boundInput = input;

    input.addEventListener(
        "input",
        queueSearch
    );

    input.focus();

    renderPrompt();

}

function queueSearch() {

    if (timer) {
        clearTimeout(timer);
    }

    timer = setTimeout(
        runSearch,
        180
    );

}

async function runSearch() {

    const input =
        document.getElementById(
            "globalProfileSearch"
        );

    const results =
        document.getElementById(
            "globalProfileResults"
        );

    if (!input || !results) {
        return;
    }

    const query =
        String(input.value || "").trim();

    if (query.length < 2) {
        renderPrompt();
        return;
    }

    const currentRequest =
        ++requestNumber;

    results.innerHTML =
        '<div class="search-state">Searching Tuklass...</div>';

    try {

        const response =
            await fetch(
                APPS_SCRIPT_URL +
                "?action=searchProfiles&q=" +
                encodeURIComponent(query),
                {cache:"no-store"}
            );

        const result =
            await response.json();

        if (currentRequest !== requestNumber) {
            return;
        }

        if (!result.success) {
            throw new Error(
                result.error ||
                "Search could not be completed."
            );
        }

        renderResults(
            Array.isArray(result.profiles)
                ? result.profiles
                : []
        );

    }
    catch (error) {

        results.innerHTML =
            '<div class="search-state error">' +
            escapeHtml(
                error.message ||
                "Search could not be completed."
            ) +
            '</div>';

    }

}

function renderPrompt() {

    const results =
        document.getElementById(
            "globalProfileResults"
        );

    if (!results) {
        return;
    }

    results.innerHTML = `
        <div class="search-state search-intro">
            <strong>Find people on Tuklass</strong>
            <span>Search by name or username.</span>
        </div>
    `;

}

function renderResults(profiles) {

    const results =
        document.getElementById(
            "globalProfileResults"
        );

    if (!results) {
        return;
    }

    if (!profiles.length) {
        results.innerHTML = `
            <div class="search-state">
                <strong>No profiles found</strong>
                <span>Try another name or username.</span>
            </div>
        `;
        return;
    }

    results.innerHTML =
        profiles
            .map(function (profile) {

                const username =
                    String(profile.username || "").replace(/^@/, "");

                const picture =
                    profile.profilePicture ||
                    "images/Logo3.1.png";

                return `
                    <a
                        class="profile-search-result"
                        href="profile.html?username=${encodeURIComponent(username)}"
                    >
                        <img
                            src="${escapeAttribute(picture)}"
                            alt=""
                            onerror="this.src='images/Logo3.1.png';"
                        >

                        <span class="profile-search-copy">
                            <strong>${escapeHtml(profile.name || username || "Tuklass student")}</strong>
                            <small>@${escapeHtml(username)}</small>
                        </span>

                        <span class="profile-search-open">View</span>
                    </a>
                `;

            })
            .join("");

}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;")
        .replace(/'/g,"&#039;");
}

function escapeAttribute(value) {
    return escapeHtml(value);
}

function cleanup() {

    if (timer) {
        clearTimeout(timer);
        timer = null;
    }

    if (boundInput) {
        boundInput.removeEventListener(
            "input",
            queueSearch
        );
    }

    boundInput = null;
    requestNumber++;

}

return {
    init:init,
    cleanup:cleanup
};

})();


/* =========================================================
   NOTES + COLLECTIONS ROUTE MODULE
========================================================= */

window.TuklassNotes = (function () {

const APPS_SCRIPT_URL =
    window.TUKLASS_CONFIG.apiUrl;

const CATALOG_NOTES = [
    {
        catalogId:"algebra",
        subject:"Mathematics",
        title:"Algebra Notes",
        description:"Algebra study notes and formulas."
    },
    {
        catalogId:"geometry",
        subject:"Mathematics",
        title:"Geometry Notes",
        description:"Geometry concepts and examples."
    },
    {
        catalogId:"biology",
        subject:"Science",
        title:"Biology Notes",
        description:"Biology concepts and study materials."
    },
    {
        catalogId:"chemistry",
        subject:"Science",
        title:"Chemistry Notes",
        description:"Chemistry formulas and concepts."
    }
];

let currentUser = null;
let collections = [];
let activeCollection = null;
let activeCatalogId = "";
let selectedFile = null;
let catalogQuery = "";

async function init() {

    currentUser = getUser();

    if (!currentUser) {
        return;
    }

    registerGlobals();

    const search =
        document.getElementById(
            "notesCatalogSearch"
        );

    if (search) {
        search.addEventListener(
            "input",
            function () {
                catalogQuery =
                    search.value.trim().toLowerCase();
                renderCatalog();
            }
        );
    }

    const fileInput =
        document.getElementById(
            "collectionFileInput"
        );

    if (fileInput) {
        fileInput.addEventListener(
            "change",
            handleFileSelection
        );
    }

    renderCatalog();
    setTab("catalog");

    await loadCollections();

}

function getUser() {
    try {
        const raw = localStorage.getItem("writejotUser");
        return raw ? JSON.parse(raw) : null;
    }
    catch {
        return null;
    }
}

function setTab(tab) {

    const catalogPanel =
        document.getElementById(
            "notesCatalogPanel"
        );

    const collectionsPanel =
        document.getElementById(
            "notesCollectionsPanel"
        );

    document
        .querySelectorAll(".notes-tab-button")
        .forEach(function (button) {
            button.classList.toggle(
                "active",
                button.dataset.notesTab === tab
            );
        });

    if (catalogPanel) {
        catalogPanel.hidden = tab !== "catalog";
    }

    if (collectionsPanel) {
        collectionsPanel.hidden = tab !== "collections";
    }

    if (tab === "collections") {
        loadCollections();
    }

}

function renderCatalog() {

    const grid =
        document.getElementById(
            "notesCatalogGrid"
        );

    if (!grid) {
        return;
    }

    const visible =
        CATALOG_NOTES.filter(function (note) {

            if (!catalogQuery) {
                return true;
            }

            return (
                note.subject + " " +
                note.title + " " +
                note.description
            )
            .toLowerCase()
            .includes(catalogQuery);

        });

    if (!visible.length) {
        grid.innerHTML = `
            <div class="notes-empty-card">
                <strong>No materials found</strong>
                <span>Try another search.</span>
            </div>
        `;
        return;
    }

    grid.innerHTML =
        visible.map(function (note) {
            return `
                <article class="notes-material-card">
                    <div class="notes-material-type">
                        ${escapeHtml(note.subject)}
                    </div>
                    <h3>${escapeHtml(note.title)}</h3>
                    <p>${escapeHtml(note.description)}</p>
                    <div class="notes-material-actions">
                        <button
                            type="button"
                            class="button secondary notes-action-button"
                            onclick="previewCatalogNote('${escapeJs(note.catalogId)}')"
                        >
                            Preview
                        </button>
                        <button
                            type="button"
                            class="button primary notes-action-button"
                            onclick="chooseCollectionForCatalog('${escapeJs(note.catalogId)}')"
                        >
                            Add to collection
                        </button>
                    </div>
                </article>
            `;
        }).join("");

}

async function loadCollections() {

    if (!currentUser) {
        return;
    }

    const grid =
        document.getElementById(
            "collectionGrid"
        );

    if (grid) {
        grid.innerHTML =
            '<div class="notes-loading">Loading collections...</div>';
    }

    try {

        const response = await fetch(
            APPS_SCRIPT_URL +
            "?action=noteCollections&email=" +
            encodeURIComponent(currentUser.email),
            {cache:"no-store"}
        );

        const result = await response.json();

        if (!result.success) {
            throw new Error(
                result.error ||
                "Collections could not be loaded."
            );
        }

        collections =
            Array.isArray(result.collections)
                ? result.collections
                : [];

        renderCollections();

        if (activeCollection) {
            const stillExists = collections.some(function (item) {
                return item.collectionId === activeCollection.collectionId;
            });
            if (!stillExists) {
                closeCollection();
            }
        }

    }
    catch (error) {
        if (grid) {
            grid.innerHTML =
                '<div class="notes-empty-card error">' +
                escapeHtml(error.message || "Collections could not be loaded.") +
                '</div>';
        }
    }

}

function renderCollections() {

    const grid =
        document.getElementById(
            "collectionGrid"
        );

    if (!grid) {
        return;
    }

    if (!collections.length) {
        grid.innerHTML = `
            <div class="notes-empty-card">
                <strong>No collections yet</strong>
                <span>Create one for an exam, unit, or study session.</span>
            </div>
        `;
        return;
    }

    grid.innerHTML =
        collections.map(function (collection) {

            const count = Number(collection.itemCount || 0);

            return `
                <article class="study-collection-card">
                    <button
                        type="button"
                        class="study-collection-open"
                        onclick="openStudyCollection('${escapeJs(collection.collectionId)}')"
                    >
                        <span class="collection-folder-mark"></span>
                        <span>
                            <strong>${escapeHtml(collection.title)}</strong>
                            <small>${count} ${count === 1 ? "material" : "materials"}</small>
                        </span>
                    </button>

                    <button
                        type="button"
                        class="collection-more-button"
                        aria-label="Delete collection"
                        onclick="deleteStudyCollection('${escapeJs(collection.collectionId)}')"
                    >
                        Delete
                    </button>
                </article>
            `;

        }).join("");

}

async function createCollection() {

    const title = value("newCollectionTitle");
    const description = value("newCollectionDescription");

    if (!title) {
        setCollectionMessage(
            "Give the collection a name.",
            true
        );
        return;
    }

    try {
        const result = await post({
            action:"createNoteCollection",
            email:currentUser.email,
            title:title,
            description:description
        });

        document.getElementById("newCollectionTitle").value = "";
        document.getElementById("newCollectionDescription").value = "";

        setCollectionMessage("Collection created.", false);
        await loadCollections();
        await openCollection(result.collectionId);
    }
    catch {}

}

async function openCollection(collectionId) {

    setCollectionMessage("Opening collection...", false);

    try {

        const response = await fetch(
            APPS_SCRIPT_URL +
            "?action=noteCollection&email=" +
            encodeURIComponent(currentUser.email) +
            "&collectionId=" +
            encodeURIComponent(collectionId),
            {cache:"no-store"}
        );

        const result = await response.json();

        if (!result.success) {
            throw new Error(
                result.error ||
                "Collection could not be opened."
            );
        }

        activeCollection = result.collection;
        renderWorkspace();
        setCollectionMessage("", false);

        const workspace =
            document.getElementById(
                "collectionWorkspace"
            );

        if (workspace) {
            workspace.scrollIntoView({
                behavior:"smooth",
                block:"start"
            });
        }

    }
    catch (error) {
        setCollectionMessage(
            error.message ||
            "Collection could not be opened.",
            true
        );
    }

}

function renderWorkspace() {

    const workspace =
        document.getElementById(
            "collectionWorkspace"
        );

    if (!workspace) {
        return;
    }

    if (!activeCollection) {
        workspace.hidden = true;
        return;
    }

    workspace.hidden = false;

    const title = document.getElementById("collectionWorkspaceTitle");
    const description = document.getElementById("collectionWorkspaceDescription");
    const list = document.getElementById("collectionItemList");

    if (title) {
        title.textContent = activeCollection.title || "Study collection";
    }

    if (description) {
        description.textContent =
            activeCollection.description ||
            "Build this collection with catalog materials and your own notes.";
    }

    const items =
        Array.isArray(activeCollection.items)
            ? activeCollection.items
            : [];

    if (!list) {
        return;
    }

    if (!items.length) {
        list.innerHTML = `
            <div class="collection-items-empty">
                <strong>This collection is empty</strong>
                <span>Add something from the catalog, write a note, or upload a file.</span>
            </div>
        `;
        return;
    }

    list.innerHTML =
        items.map(function (item, index) {

            const type = String(item.type || "").toLowerCase();
            const catalogNote = CATALOG_NOTES.find(function (note) {
                return note.catalogId === item.catalogId;
            });

            let body = "";
            let action = "";

            if (type === "text") {
                body = `
                    <div class="collection-text-preview">
                        ${escapeHtml(item.textContent || "")}
                    </div>
                `;
            }
            else if (type === "catalog") {
                body = `
                    <div class="collection-item-subtitle">
                        ${escapeHtml(catalogNote ? catalogNote.subject : "Tuklass Catalog")}
                    </div>
                `;
                action = `
                    <button
                        type="button"
                        class="collection-item-link"
                        onclick="previewCatalogNote('${escapeJs(item.catalogId)}')"
                    >
                        Preview
                    </button>
                `;
            }
            else {
                body = `
                    <div class="collection-item-subtitle">
                        ${escapeHtml(item.fileName || item.mimeType || "Uploaded file")}
                    </div>
                `;
                action = `
                    <button
                        type="button"
                        class="collection-item-link"
                        onclick="openCollectionUpload('${escapeJs(item.itemId)}')"
                    >
                        Open
                    </button>
                `;
            }

            return `
                <article class="collection-item-row">
                    <div class="collection-item-number">${index + 1}</div>
                    <div class="collection-item-main">
                        <span class="collection-item-kind">${escapeHtml(type || "material")}</span>
                        <strong>${escapeHtml(item.title || "Study material")}</strong>
                        ${body}
                    </div>
                    <div class="collection-item-actions">
                        ${action}
                        <button
                            type="button"
                            class="collection-item-delete"
                            onclick="removeCollectionItem('${escapeJs(item.itemId)}')"
                        >
                            Remove
                        </button>
                    </div>
                </article>
            `;

        }).join("");

}

async function deleteCollection(collectionId) {

    if (!window.confirm("Delete this collection and its uploaded items?")) {
        return;
    }

    try {
        await post({
            action:"deleteNoteCollection",
            email:currentUser.email,
            collectionId:collectionId
        });

        if (
            activeCollection &&
            activeCollection.collectionId === collectionId
        ) {
            closeCollection();
        }

        await loadCollections();
    }
    catch {}

}

function closeCollection() {
    activeCollection = null;
    const workspace = document.getElementById("collectionWorkspace");
    if (workspace) {
        workspace.hidden = true;
    }
}

async function addText() {

    if (!activeCollection) {
        return;
    }

    const title = value("collectionTextTitle") || "Personal note";
    const textContent = value("collectionTextContent");

    if (!textContent) {
        setCollectionMessage("Write something first.", true);
        return;
    }

    try {
        await post({
            action:"addCollectionTextItem",
            email:currentUser.email,
            collectionId:activeCollection.collectionId,
            title:title,
            textContent:textContent
        });

        document.getElementById("collectionTextTitle").value = "";
        document.getElementById("collectionTextContent").value = "";

        await openCollection(activeCollection.collectionId);
        await loadCollections();
    }
    catch {}

}

async function handleFileSelection(event) {

    const file =
        event && event.target && event.target.files
            ? event.target.files[0]
            : null;

    selectedFile = null;

    const label =
        document.getElementById(
            "collectionFileName"
        );

    if (!file) {
        if (label) label.textContent = "No file selected";
        return;
    }

    if (file.size > 8 * 1024 * 1024) {
        setCollectionMessage(
            "Choose a file smaller than 8 MB. Images are compressed before upload.",
            true
        );
        event.target.value = "";
        if (label) label.textContent = "No file selected";
        return;
    }

    try {
        selectedFile = await prepareFile(file);
        if (label) {
            label.textContent = file.name;
        }
        setCollectionMessage("Ready to upload.", false);
    }
    catch (error) {
        setCollectionMessage(
            error.message || "This file could not be prepared.",
            true
        );
        event.target.value = "";
    }

}

async function prepareFile(file) {

    if (
        String(file.type || "").startsWith("image/")
    ) {
        return compressImage(file);
    }

    if (file.size > 4 * 1024 * 1024) {
        throw new Error("Documents and other files can be up to 4 MB.");
    }

    return {
        dataUrl:await readDataUrl(file),
        fileName:file.name,
        mimeType:file.type || "application/octet-stream"
    };

}

async function compressImage(file) {

    const dataUrl = await readDataUrl(file);
    const image = await loadImage(dataUrl);

    const maxSide = 1600;
    const scale = Math.min(
        1,
        maxSide / Math.max(image.naturalWidth, image.naturalHeight)
    );

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    let quality = .86;
    let result = canvas.toDataURL("image/jpeg", quality);

    while (estimateDataUrlBytes(result) > 3.8 * 1024 * 1024 && quality > .48) {
        quality -= .08;
        result = canvas.toDataURL("image/jpeg", quality);
    }

    if (estimateDataUrlBytes(result) > 4 * 1024 * 1024) {
        throw new Error("This image is still too large after compression.");
    }

    const base = String(file.name || "image")
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-z0-9 _.-]/gi, "")
        .trim() || "image";

    return {
        dataUrl:result,
        fileName:base + ".jpg",
        mimeType:"image/jpeg"
    };

}

function estimateDataUrlBytes(dataUrl) {
    const base64 = String(dataUrl || "").split(",")[1] || "";
    return Math.floor(base64.length * 3 / 4);
}

function readDataUrl(file) {
    return new Promise(function (resolve, reject) {
        const reader = new FileReader();
        reader.onload = function () { resolve(reader.result); };
        reader.onerror = function () { reject(new Error("The file could not be read.")); };
        reader.readAsDataURL(file);
    });
}

function loadImage(src) {
    return new Promise(function (resolve, reject) {
        const image = new Image();
        image.onload = function () { resolve(image); };
        image.onerror = function () { reject(new Error("The image could not be opened.")); };
        image.src = src;
    });
}

async function uploadFile() {

    if (!activeCollection) {
        return;
    }

    if (!selectedFile) {
        setCollectionMessage("Choose a file first.", true);
        return;
    }

    const title = value("collectionFileTitle") || selectedFile.fileName;

    try {
        await post({
            action:"addCollectionFileItem",
            email:currentUser.email,
            collectionId:activeCollection.collectionId,
            title:title,
            fileData:selectedFile.dataUrl,
            fileName:selectedFile.fileName,
            mimeType:selectedFile.mimeType
        });

        selectedFile = null;
        document.getElementById("collectionFileTitle").value = "";
        document.getElementById("collectionFileInput").value = "";
        document.getElementById("collectionFileName").textContent = "No file selected";

        await openCollection(activeCollection.collectionId);
        await loadCollections();
    }
    catch {}

}

async function removeItem(itemId) {

    if (!activeCollection) {
        return;
    }

    try {
        await post({
            action:"deleteCollectionItem",
            email:currentUser.email,
            itemId:itemId
        });

        await openCollection(activeCollection.collectionId);
        await loadCollections();
    }
    catch {}

}

async function openUpload(itemId) {

    setCollectionMessage("Opening file...", false);

    try {
        const response = await fetch(
            APPS_SCRIPT_URL +
            "?action=collectionFileData&email=" +
            encodeURIComponent(currentUser.email) +
            "&itemId=" +
            encodeURIComponent(itemId),
            {cache:"no-store"}
        );

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || "File could not be opened.");
        }

        const binary = atob(result.base64 || "");
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }

        const blob = new Blob(
            [bytes],
            {type:result.mimeType || "application/octet-stream"}
        );

        const url = URL.createObjectURL(blob);
        window.open(url, "_blank", "noopener");
        setTimeout(function () {
            URL.revokeObjectURL(url);
        }, 60000);
        setCollectionMessage("", false);
    }
    catch (error) {
        setCollectionMessage(error.message || "File could not be opened.", true);
    }

}

function previewCatalog(catalogId) {

    const note = CATALOG_NOTES.find(function (item) {
        return item.catalogId === catalogId;
    });

    if (!note) {
        return;
    }

    const modal = document.getElementById("catalogPreviewModal");
    const title = document.getElementById("catalogPreviewTitle");
    const subject = document.getElementById("catalogPreviewSubject");
    const description = document.getElementById("catalogPreviewDescription");

    if (title) title.textContent = note.title;
    if (subject) subject.textContent = note.subject;
    if (description) description.textContent = note.description;
    if (modal) modal.hidden = false;

}

function closeCatalogPreview() {
    const modal = document.getElementById("catalogPreviewModal");
    if (modal) modal.hidden = true;
}

async function chooseCollection(catalogId) {

    activeCatalogId = catalogId;

    if (!collections.length) {
        setTab("collections");
        setCollectionMessage(
            "Create a collection first, then add this material.",
            false
        );
        return;
    }

    const select = document.getElementById("catalogCollectionSelect");
    const modal = document.getElementById("collectionPickerModal");

    if (!select || !modal) {
        return;
    }

    select.innerHTML = collections.map(function (collection) {
        return '<option value="' + escapeAttribute(collection.collectionId) + '">' +
            escapeHtml(collection.title) +
            '</option>';
    }).join("");

    modal.hidden = false;

}

function closeCollectionPicker() {
    const modal = document.getElementById("collectionPickerModal");
    if (modal) modal.hidden = true;
    activeCatalogId = "";
}

async function confirmCatalogAdd() {

    const select = document.getElementById("catalogCollectionSelect");
    const collectionId = select ? select.value : "";
    const note = CATALOG_NOTES.find(function (item) {
        return item.catalogId === activeCatalogId;
    });

    if (!collectionId || !note) {
        return;
    }

    try {
        await post({
            action:"addCollectionCatalogItem",
            email:currentUser.email,
            collectionId:collectionId,
            catalogId:note.catalogId,
            title:note.title
        });

        closeCollectionPicker();
        setTab("collections");
        await loadCollections();
        await openCollection(collectionId);
    }
    catch {}

}

async function post(payload) {

    setCollectionMessage("Saving...", false);

    const response = await fetch(
        APPS_SCRIPT_URL,
        {
            method:"POST",
            headers:{
                "Content-Type":"text/plain;charset=utf-8"
            },
            body:JSON.stringify(payload)
        }
    );

    const result = await response.json();

    if (!result.success) {
        const error = result.error || "Tuklass could not save that change.";
        setCollectionMessage(error, true);
        throw new Error(error);
    }

    setCollectionMessage("Saved.", false);
    return result;

}

function setCollectionMessage(text, error) {
    const element = document.getElementById("collectionMessage");
    if (!element) return;
    element.textContent = text || "";
    element.className = "collection-message" + (error ? " error" : "");
}

function value(id) {
    const element = document.getElementById(id);
    return element ? String(element.value || "").trim() : "";
}

function registerGlobals() {
    window.setNotesTab = setTab;
    window.createStudyCollection = createCollection;
    window.openStudyCollection = openCollection;
    window.deleteStudyCollection = deleteCollection;
    window.closeStudyCollection = closeCollection;
    window.addCollectionText = addText;
    window.uploadCollectionFile = uploadFile;
    window.removeCollectionItem = removeItem;
    window.openCollectionUpload = openUpload;
    window.previewCatalogNote = previewCatalog;
    window.closeCatalogPreview = closeCatalogPreview;
    window.chooseCollectionForCatalog = chooseCollection;
    window.closeCollectionPicker = closeCollectionPicker;
    window.confirmCatalogAdd = confirmCatalogAdd;
}

function cleanup() {

    [
        "setNotesTab",
        "createStudyCollection",
        "openStudyCollection",
        "deleteStudyCollection",
        "closeStudyCollection",
        "addCollectionText",
        "uploadCollectionFile",
        "removeCollectionItem",
        "openCollectionUpload",
        "previewCatalogNote",
        "closeCatalogPreview",
        "chooseCollectionForCatalog",
        "closeCollectionPicker",
        "confirmCatalogAdd"
    ].forEach(function (name) {
        try { delete window[name]; } catch {}
    });

    currentUser = null;
    collections = [];
    activeCollection = null;
    activeCatalogId = "";
    selectedFile = null;
    catalogQuery = "";

}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;")
        .replace(/'/g,"&#039;");
}

function escapeAttribute(value) {
    return escapeHtml(value);
}

function escapeJs(value) {
    return String(value || "")
        .replace(/\\/g,"\\\\")
        .replace(/'/g,"\\'");
}

return {
    init:init,
    cleanup:cleanup
};

})();


(function () {
    "use strict";

    const ROUTE_URLS = {
        home: "index.html",
        search: "search.html",
        catalog: "notes.html",
        calendar: "calendar.html",
        reminders: "reminders.html",
        messages: "messages.html",
        chat: "chat.html",
        profile: "profile.html",
        editProfile: "edit-profile.html",
        admin: "admin.html",
        adminReminders: "admin-reminders.html",
        adminClasses: "admin-classes.html",
        adminCalendar: "admin-calendar.html"
    };

    const ROUTE_TITLES = {
        home: "Tuklass | Your class, organized.",
        search: "Tuklass | Search",
        catalog: "Tuklass | Notes",
        calendar: "Tuklass | Calendar",
        reminders: "Tuklass | Reminders",
        messages: "Tuklass | Messages",
        chat: "Tuklass | Chat",
        profile: "Tuklass | Profile",
        editProfile: "Tuklass | Edit Profile",
        admin: "Tuklass | Admin",
        adminReminders: "Tuklass | Admin Reminders",
        adminClasses: "Tuklass | Schools & Classes",
        adminCalendar: "Tuklass | Admin Calendar"
    };

    let homeMarkup = "";
    let currentRoute = "home";
    let started = false;
    let navigating = false;
    let originalShowDashboard = null;

    const ROUTE_TEMPLATES = {

        search: `
            <div class="tuklass-route route-search">
                <div class="route-head">
                    <div>
                        <div class="route-kicker">Discover</div>
                        <h1>Search</h1>
                        <p>Find classmates and other Tuklass students.</p>
                    </div>
                    <div class="route-head-icon search-route-icon">
                        <span class="route-search-glyph"></span>
                    </div>
                </div>

                <section class="global-search-card">
                    <div class="global-search-input-shell">
                        <span class="global-search-glyph"></span>
                        <input
                            id="globalProfileSearch"
                            type="search"
                            placeholder="Search by name or username"
                            autocomplete="off"
                        >
                    </div>

                    <div id="globalProfileResults" class="global-profile-results"></div>
                </section>
            </div>
        `,

        catalog: `
            <div class="tuklass-route route-notes">
                <div class="route-head">
                    <div>
                        <div class="route-kicker">Study workspace</div>
                        <h1>Notes</h1>
                        <p>Browse the Tuklass catalog or build study collections for exactly what you need.</p>
                    </div>
                    <div class="route-head-icon">
                        <img src="images/CatalogB.png" alt="">
                    </div>
                </div>

                <div class="notes-tabs" role="tablist" aria-label="Notes sections">
                    <button class="notes-tab-button active" data-notes-tab="catalog" type="button" onclick="setNotesTab('catalog')">
                        Catalog
                    </button>
                    <button class="notes-tab-button" data-notes-tab="collections" type="button" onclick="setNotesTab('collections')">
                        My Collections
                    </button>
                </div>

                <section id="notesCatalogPanel" class="notes-panel">
                    <div class="notes-catalog-toolbar">
                        <div>
                            <span class="notes-section-kicker">Catalog</span>
                            <h2>Study materials</h2>
                        </div>
                        <input id="notesCatalogSearch" type="search" placeholder="Search notes and subjects">
                    </div>
                    <div id="notesCatalogGrid" class="notes-material-grid"></div>
                </section>

                <section id="notesCollectionsPanel" class="notes-panel" hidden>
                    <div class="collections-layout">
                        <aside class="collections-sidebar-card">
                            <span class="notes-section-kicker">Create</span>
                            <h2>New collection</h2>
                            <p>Make a focused playlist of materials for an exam, unit, or study session.</p>

                            <label class="notes-field">
                                <span>Name</span>
                                <input id="newCollectionTitle" type="text" maxlength="80" placeholder="Midterms review">
                            </label>

                            <label class="notes-field">
                                <span>Description</span>
                                <textarea id="newCollectionDescription" maxlength="300" placeholder="Math topics 1, 2 and 4 plus my own notes"></textarea>
                            </label>

                            <button type="button" class="spa-black-button route-full-button" onclick="createStudyCollection()">
                                Create collection
                            </button>

                            <div id="collectionMessage" class="collection-message"></div>
                        </aside>

                        <div class="collections-main">
                            <div class="collections-heading">
                                <div>
                                    <span class="notes-section-kicker">Your library</span>
                                    <h2>Collections</h2>
                                </div>
                            </div>
                            <div id="collectionGrid" class="collection-grid"></div>
                        </div>
                    </div>

                    <section id="collectionWorkspace" class="collection-workspace" hidden>
                        <div class="collection-workspace-head">
                            <div>
                                <span class="notes-section-kicker">Collection</span>
                                <h2 id="collectionWorkspaceTitle">Study collection</h2>
                                <p id="collectionWorkspaceDescription"></p>
                            </div>
                            <button type="button" class="collection-close-button" onclick="closeStudyCollection()">Close</button>
                        </div>

                        <div class="collection-builder-grid">
                            <div class="collection-add-card">
                                <span class="collection-add-label">Write your own note</span>
                                <input id="collectionTextTitle" type="text" maxlength="80" placeholder="Title">
                                <textarea id="collectionTextContent" maxlength="12000" placeholder="Type or paste your notes here..."></textarea>
                                <button type="button" class="button primary" onclick="addCollectionText()">Add text note</button>
                            </div>

                            <div class="collection-add-card">
                                <span class="collection-add-label">Upload your material</span>
                                <input id="collectionFileTitle" type="text" maxlength="80" placeholder="Optional title">
                                <label class="collection-file-picker">
                                    <input id="collectionFileInput" type="file" accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.txt">
                                    <span>Choose file</span>
                                    <small id="collectionFileName">No file selected</small>
                                </label>
                                <button type="button" class="button primary" onclick="uploadCollectionFile()">Upload material</button>
                                <small class="collection-upload-help">Images are compressed automatically. Other files can be up to 4 MB.</small>
                            </div>
                        </div>

                        <div class="collection-items-heading">
                            <span class="notes-section-kicker">Study order</span>
                            <h3>Materials in this collection</h3>
                        </div>
                        <div id="collectionItemList" class="collection-item-list"></div>
                    </section>
                </section>

                <div id="catalogPreviewModal" class="notes-modal" hidden>
                    <button class="notes-modal-backdrop" type="button" aria-label="Close preview" onclick="closeCatalogPreview()"></button>
                    <div class="notes-modal-card">
                        <span id="catalogPreviewSubject" class="notes-section-kicker"></span>
                        <h2 id="catalogPreviewTitle"></h2>
                        <p id="catalogPreviewDescription"></p>
                        <div class="catalog-preview-notice">
                            This catalog reference is ready to use in collections. The actual lesson file or link still needs to be connected to the catalog by the Tuklass admin.
                        </div>
                        <button type="button" class="spa-black-button" onclick="closeCatalogPreview()">Close</button>
                    </div>
                </div>

                <div id="collectionPickerModal" class="notes-modal" hidden>
                    <button class="notes-modal-backdrop" type="button" aria-label="Close" onclick="closeCollectionPicker()"></button>
                    <div class="notes-modal-card">
                        <span class="notes-section-kicker">Add material</span>
                        <h2>Choose a collection</h2>
                        <select id="catalogCollectionSelect" class="notes-modal-select"></select>
                        <div class="notes-modal-actions">
                            <button type="button" class="button secondary" onclick="closeCollectionPicker()">Cancel</button>
                            <button type="button" class="button primary" onclick="confirmCatalogAdd()">Add</button>
                        </div>
                    </div>
                </div>
            </div>
        `,

        calendar: `
            <div class="tuklass-route route-calendar">
                <div class="route-head">
                    <div>
                        <div class="route-kicker">Schedule</div>
                        <h1>Calendar</h1>
                        <p>Classes, tests, and your personal events in one place.</p>
                    </div>
                    <div class="route-head-icon">
                        <img src="images/CalendarB.png" alt="">
                    </div>
                </div>

                <div id="updateIndicator" class="update-indicator">Updating...</div>
                <div id="registrationArea"></div>

                <div id="calendarContent" style="display:none;">
                    <div id="statusCard" class="status-card approved">
                        <strong id="statusTitle">Class Schedule Access</strong>
                        <div id="statusText" class="status-text"></div>
                    </div>

                    <div class="calendar-layout">
                        <div class="calendar-card">
                            <div class="calendar-toolbar">
                                <strong id="monthTitle"></strong>

                                <div class="month-buttons">
                                    <button class="month-button" type="button" onclick="changeMonth(-1)" aria-label="Previous month">‹</button>
                                    <button class="month-button today-button" type="button" onclick="goToToday()">Today</button>
                                    <button class="month-button" type="button" onclick="changeMonth(1)" aria-label="Next month">›</button>
                                </div>
                            </div>

                            <div class="weekdays">
                                <div class="weekday">Sun</div>
                                <div class="weekday">Mon</div>
                                <div class="weekday">Tue</div>
                                <div class="weekday">Wed</div>
                                <div class="weekday">Thu</div>
                                <div class="weekday">Fri</div>
                                <div class="weekday">Sat</div>
                            </div>

                            <div id="calendarGrid" class="calendar-grid"></div>
                        </div>

                        <aside class="side-card">
                            <h2>Upcoming</h2>
                            <div id="upcomingEvents"></div>

                            <div class="add-event">
                                <h3>Add Personal Event</h3>
                                <input id="eventTitle" class="event-input" type="text" placeholder="Event title">
                                <input id="eventDate" class="event-input" type="date">

                                <div class="event-row">
                                    <input id="eventStart" class="event-input" type="time">
                                    <input id="eventEnd" class="event-input" type="time">
                                </div>

                                <textarea id="eventDescription" class="event-textarea" placeholder="Description"></textarea>

                                <button id="addEventButton" class="spa-black-button route-full-button" type="button" onclick="addEvent()">
                                    Add Event
                                </button>

                                <div id="eventMessage" class="form-message"></div>
                            </div>
                        </aside>
                    </div>
                </div>

                <div id="lockScreen" class="route-lock" style="display:none;">
                    <div class="route-lock-card">
                        <div class="route-head-icon">
                            <img src="images/CalendarB.png" alt="">
                        </div>
                        <h2>Calendar unavailable</h2>
                        <p id="lockMessage">Your Tuklass access has expired.</p>
                        <a href="index.html" class="spa-black-button" data-spa-route="home">Back to Dashboard</a>
                    </div>
                </div>
            </div>
        `,

        reminders: `
            <div class="tuklass-route route-reminders">
                <div class="route-head">
                    <div>
                        <div class="route-kicker">Stay on track</div>
                        <h1>Reminders</h1>
                        <p>Class reminders and your personal reminders in one place.</p>
                    </div>
                    <div class="route-head-icon">
                        <img src="images/BelleB.png" alt="">
                    </div>
                </div>

                <div id="content">
                    <div class="route-loading-card">
                        <div class="route-spinner"></div>
                        <span>Loading reminders...</span>
                    </div>
                </div>
            </div>
        `,

        messages: `
            <div class="tuklass-route route-messages">
                <div class="route-head">
                    <div>
                        <div class="route-kicker">Conversations</div>
                        <div class="messages-title-row">
                            <h1>Messages</h1>
                            <div id="unreadTotal" class="unread-total hidden"></div>
                        </div>
                        <p>Talk with classmates and stay connected.</p>
                    </div>
                    <div class="route-head-icon">
                        <img src="images/MessageB.png" alt="">
                    </div>
                </div>

                <div class="message-search-shell">
                    <span class="message-search-glyph"></span>
                    <input
                        id="conversationSearch"
                        type="search"
                        placeholder="Search conversations by name"
                        autocomplete="off"
                    >
                </div>

                <div id="conversationList" class="conversation-list">
                    <div class="route-loading-card">
                        <div class="route-spinner"></div>
                        <span>Loading conversations...</span>
                    </div>
                </div>
            </div>
        `,

        chat: `
            <div class="tuklass-route route-chat">

                <section class="chat-shell">

                    <header class="chat-header">

                        <a
                            href="messages.html"
                            class="chat-back"
                            data-spa-route="messages"
                            aria-label="Back to messages"
                            title="Back to messages"
                        >
                            <span aria-hidden="true">‹</span>
                        </a>


                        <div class="chat-recipient">

                            <img
                                id="recipientPicture"
                                class="chat-recipient-picture"
                                src="images/Logo3.1.png"
                                alt="Profile picture"
                                onerror="this.src='images/Logo3.png';"
                            >


                            <div class="chat-recipient-copy">

                                <div
                                    id="recipientName"
                                    class="chat-recipient-name"
                                >
                                    Loading...
                                </div>


                                <div
                                    id="recipientUsername"
                                    class="chat-recipient-username"
                                >
                                    @username
                                </div>

                            </div>

                        </div>


                        <div
                            class="chat-header-mark"
                            title="Messages"
                        >
                            <img
                                src="images/MessageB.png"
                                alt=""
                            >
                        </div>

                    </header>


                    <div
                        id="messages"
                        class="chat-messages"
                    >

                        <div
                            id="empty"
                            class="chat-empty"
                        >
                            Loading messages...
                        </div>

                    </div>


                    <footer
                        id="composer"
                        class="chat-composer"
                    >

                        <div
                            id="imagePreview"
                            class="chat-image-preview"
                            style="display:none;"
                        >

                            <div class="preview-wrapper">

                                <img
                                    id="previewImage"
                                    src=""
                                    alt="Selected image"
                                >


                                <button
                                    id="removeImageButton"
                                    class="preview-remove"
                                    type="button"
                                    onclick="removeSelectedImage()"
                                    aria-label="Remove selected image"
                                >
                                    ×
                                </button>

                            </div>

                        </div>


                        <div class="chat-composer-inner">

                            <button
                                id="photoButton"
                                class="chat-photo-button"
                                type="button"
                                onclick="openImagePicker()"
                                title="Attach photo"
                                aria-label="Attach photo"
                            >
                                <span
                                    class="chat-photo-glyph"
                                    aria-hidden="true"
                                ></span>
                            </button>


                            <input
                                id="imageInput"
                                type="file"
                                accept="image/*"
                                onchange="handleImageSelection(event)"
                                hidden
                            >


                            <div class="chat-input-wrap">

                                <textarea
                                    id="messageInput"
                                    maxlength="2000"
                                    placeholder="Write a message..."
                                    rows="1"
                                ></textarea>

                            </div>


                            <button
                                id="sendButton"
                                class="chat-send-button"
                                type="button"
                                onclick="sendMessage()"
                                title="Send message"
                            >

                                <img
                                    class="chat-send-a"
                                    src="images/SendA.png"
                                    alt=""
                                >

                                <img
                                    class="chat-send-b"
                                    src="images/SendB.png"
                                    alt=""
                                >

                                <span>
                                    Send
                                </span>

                            </button>

                        </div>

                    </footer>

                </section>

            </div>
        `,

        profile: `
            <div class="tuklass-route route-profile">

                <div class="route-head">
                    <div>
                        <div class="route-kicker">Account</div>
                        <h1>Profile</h1>
                        <p>View a Tuklass student profile and start a conversation.</p>
                    </div>

                    <div class="route-head-icon">
                        <img src="images/ProfileB.png" alt="">
                    </div>
                </div>


                <div
                    id="profileContainer"
                    class="profile-route-container"
                >
                    <div class="profile-loading-card">
                        <div class="route-spinner"></div>
                        <span>Loading profile...</span>
                    </div>
                </div>

            </div>
        `,

        editProfile: `
            <div class="tuklass-route route-edit-profile">

                <div class="route-head">
                    <div>
                        <div class="route-kicker">Account settings</div>
                        <h1>Edit Profile</h1>
                        <p>Update your display name, username, bio, and profile picture.</p>
                    </div>

                    <div class="route-head-icon">
                        <img src="images/ProfileB.png" alt="">
                    </div>
                </div>


                <div class="edit-profile-layout">

                    <aside class="edit-preview-card">

                        <div class="edit-preview-label">
                            Live preview
                        </div>

                        <img
                            id="previewPicture"
                            class="edit-preview-picture"
                            src="images/Logo3.1.png"
                            alt="Profile picture"
                            onerror="this.src='images/Logo3.png';"
                        >

                        <div
                            id="previewName"
                            class="edit-preview-name"
                        >
                            Your Name
                        </div>

                        <div
                            id="previewUsername"
                            class="edit-preview-username"
                        >
                            @username
                        </div>

                        <div
                            id="previewBio"
                            class="edit-preview-bio"
                        >
                            Your bio
                        </div>

                    </aside>


                    <section class="edit-profile-card">

                        <div class="edit-photo-area">

                            <img
                                id="profilePicture"
                                class="edit-profile-picture"
                                src="images/Logo3.1.png"
                                alt="Profile picture"
                                onerror="this.src='images/Logo3.png';"
                            >

                            <div class="edit-photo-copy">

                                <strong>
                                    Profile picture
                                </strong>

                                <span>
                                    Choose an image to update your Tuklass profile.
                                </span>

                                <button
                                    type="button"
                                    class="edit-upload-button"
                                    onclick="openImagePicker()"
                                >
                                    Choose Photo
                                </button>

                                <input
                                    id="imageInput"
                                    type="file"
                                    accept="image/*"
                                    onchange="handleImageSelection(event)"
                                    hidden
                                >

                            </div>

                        </div>


                        <div class="route-field">
                            <label for="nameInput">
                                Display Name
                            </label>

                            <input
                                id="nameInput"
                                type="text"
                                maxlength="80"
                                placeholder="Your name"
                            >
                        </div>


                        <div class="route-field">
                            <label for="usernameInput">
                                Username
                            </label>

                            <div class="username-input-shell">
                                <span>@</span>

                                <input
                                    id="usernameInput"
                                    type="text"
                                    maxlength="20"
                                    placeholder="username"
                                    autocomplete="off"
                                >
                            </div>

                            <div id="usernameStatus"></div>
                        </div>


                        <div class="route-field">
                            <label for="bioInput">
                                Bio
                            </label>

                            <textarea
                                id="bioInput"
                                maxlength="500"
                                placeholder="Tell people a little about yourself..."
                            ></textarea>
                        </div>


                        <button
                            id="saveButton"
                            type="button"
                            class="spa-black-button route-full-button"
                            onclick="saveProfile()"
                        >
                            Save Changes
                        </button>


                        <div id="statusMessage"></div>

                    </section>

                </div>

            </div>
        `,

        admin: `
            <div class="tuklass-route route-admin-home">

                <div class="route-head">
                    <div>
                        <div class="route-kicker">Administration</div>
                        <h1>Admin</h1>
                        <p>Manage Tuklass schools, class tools, and authorized administrators.</p>
                    </div>

                    <div class="route-head-icon admin-route-head-icon">
                        <img src="images/adminB.png" alt="">
                    </div>
                </div>

                <section class="admin-security-strip">
                    <div>
                        <span>Verified identity</span>
                        <strong id="adminVerifiedIdentity">Checking Google account...</strong>
                    </div>
                    <div id="adminRoleBadge" class="admin-role-badge">Verifying...</div>
                </section>

                <div id="adminHomeStatus" class="admin-home-status">Verifying admin access...</div>

                <div class="admin-home-grid">
                    <a href="admin-classes.html" class="admin-home-card">
                        <div class="admin-home-card-icon">
                            <img src="images/ProfileB.png" alt="">
                        </div>
                        <div>
                            <span>Directory</span>
                            <h2>Schools & Classes</h2>
                            <p>Add schools and sections and review class rosters.</p>
                        </div>
                    </a>

                    <a href="admin-calendar.html" class="admin-home-card">
                        <div class="admin-home-card-icon">
                            <img src="images/CalendarB.png" alt="">
                        </div>
                        <div>
                            <span>Scheduling</span>
                            <h2>Class Calendar</h2>
                            <p>Manage weekly schedules, tests, and exams for sections.</p>
                        </div>
                    </a>

                    <a href="admin-reminders.html" class="admin-home-card">
                        <div class="admin-home-card-icon">
                            <img src="images/BelleB.png" alt="">
                        </div>
                        <div>
                            <span>Announcements</span>
                            <h2>Class Reminders</h2>
                            <p>Send reminders to students in a specific class.</p>
                        </div>
                    </a>
                </div>

                <section id="masterAdminPanel" class="master-admin-panel" hidden>
                    <div class="master-admin-head">
                        <div>
                            <span class="admin-management-kicker">Master controls</span>
                            <h2>Authorized administrators</h2>
                            <p>Only the master account can add or remove admin access.</p>
                        </div>
                        <div class="master-shield">Master</div>
                    </div>

                    <div class="master-admin-add-row">
                        <div class="route-field">
                            <label for="newAdminEmail">Employee or staff email</label>
                            <input
                                id="newAdminEmail"
                                type="email"
                                autocomplete="off"
                                placeholder="name@example.com"
                            >
                        </div>
                        <button
                            id="addAuthorizedAdminButton"
                            type="button"
                            class="spa-black-button"
                            onclick="addAuthorizedTuklassAdmin()"
                        >
                            Add Admin
                        </button>
                    </div>

                    <div id="authorizedAdminList" class="authorized-admin-list"></div>
                </section>

                <section class="admin-security-note">
                    <strong>Protected by server-side Google verification</strong>
                    <span>
                        The admin interface is only a visual entry point. Privileged requests are independently checked by the Tuklass backend using a short-lived verified admin session.
                    </span>
                </section>

            </div>
        `,

        adminReminders: `
            <div class="tuklass-route route-admin-reminders">

                <div class="route-head">
                    <div>
                        <div class="route-kicker">Admin tools</div>
                        <h1>Class Reminders</h1>
                        <p>Send one reminder to every Tuklass student in a specific school section.</p>
                    </div>

                    <div class="route-head-icon">
                        <img src="images/BelleB.png" alt="">
                    </div>
                </div>

                <div class="admin-route-links">
                    <a href="admin.html" class="admin-tab-link">Admin Home</a>
                    <a href="admin-classes.html" class="admin-tab-link">Schools & Classes</a>
                    <a href="admin-calendar.html" class="admin-tab-link">Class Calendar</a>
                    <a href="admin-reminders.html" class="admin-tab-link active">Class Reminders</a>
                </div>

                <section class="admin-reminder-card">

                    <div class="admin-warning">
                        <strong>Class-wide reminder</strong>
                        <span>
                            Select the school and section. Only students assigned to that exact Class ID will receive the class reminder.
                        </span>
                    </div>

                    <div class="admin-form-grid">

                        <div class="route-field">
                            <label for="adminReminderSchool">School</label>
                            <select id="adminReminderSchool" onchange="adminReminderSchoolChanged()">
                                <option value="">Choose a school</option>
                            </select>
                        </div>

                        <div class="route-field">
                            <label for="adminReminderClass">Section</label>
                            <select id="adminReminderClass" disabled>
                                <option value="">Choose a school first</option>
                            </select>
                        </div>

                        <div class="route-field">
                            <label for="title">Title</label>
                            <input id="title" type="text" maxlength="100" placeholder="e.g. Mathematics Test">
                        </div>

                        <div class="route-field">
                            <label for="date">Date</label>
                            <input id="date" type="date">
                        </div>

                        <div class="route-field">
                            <label for="time">Time</label>
                            <input id="time" type="time">
                        </div>

                    </div>

                    <div class="route-field">
                        <label for="description">Description</label>
                        <textarea id="description" maxlength="500" placeholder="Information for students"></textarea>
                    </div>

                    <button id="createButton" type="button" class="spa-black-button route-full-button" onclick="createClassReminder()">
                        Create Class Reminder
                    </button>

                    <div id="message"></div>

                </section>

            </div>
        `,

        adminCalendar: `
            <div class="tuklass-route route-admin-calendar">
                <div class="route-head">
                    <div>
                        <div class="route-kicker">Admin tools</div>
                        <h1>Class Calendar</h1>
                        <p>Create recurring class schedules and class events for one section or several sections at once.</p>
                    </div>
                    <div class="route-head-icon"><img src="images/CalendarB.png" alt=""></div>
                </div>

                <div class="admin-route-links">
                    <a href="admin.html" class="admin-tab-link">Admin Home</a>
                    <a href="admin-classes.html" class="admin-tab-link">Schools & Classes</a>
                    <a href="admin-calendar.html" class="admin-tab-link active">Class Calendar</a>
                    <a href="admin-reminders.html" class="admin-tab-link">Class Reminders</a>
                </div>

                <div id="adminCalendarMessage" class="admin-directory-message"></div>

                <section class="admin-calendar-picker">
                    <div class="route-field">
                        <label for="adminCalendarSchool">School</label>
                        <select id="adminCalendarSchool" onchange="adminCalendarSchoolChanged()">
                            <option value="">Choose a school</option>
                        </select>
                    </div>
                    <div class="route-field">
                        <label for="adminCalendarClass">View section</label>
                        <select id="adminCalendarClass" onchange="adminCalendarClassChanged()" disabled>
                            <option value="">Choose a school first</option>
                        </select>
                        <small class="admin-field-help">This only controls which section's existing calendar is shown below. You can target multiple sections when adding items.</small>
                    </div>
                </section>

                <div class="admin-calendar-grid">
                    <section class="admin-calendar-panel">
                        <span class="admin-management-kicker">Weekly schedule</span>
                        <h2>Classes</h2>
                        <p class="admin-panel-intro">Choose any combination of days and sections. Tuklass creates the schedule for every selected combination.</p>

                        <div class="admin-calendar-form-grid">
                            <div class="route-field admin-calendar-span-2">
                                <label>Target sections</label>
                                <div class="admin-choice-toolbar">
                                    <button type="button" onclick="setAdminSectionTargets('schedule','current')">Current section</button>
                                    <button type="button" onclick="setAdminSectionTargets('schedule','all')">All sections</button>
                                    <button type="button" onclick="setAdminSectionTargets('schedule','clear')">Clear</button>
                                </div>
                                <div id="adminScheduleSections" class="admin-target-picker">
                                    <div class="admin-target-empty">Choose a school first.</div>
                                </div>
                            </div>

                            <div class="route-field admin-calendar-span-2">
                                <label>Days</label>
                                <div class="admin-choice-toolbar admin-day-presets">
                                    <button type="button" onclick="setAdminScheduleDayPreset('weekdays')">Weekdays</button>
                                    <button type="button" onclick="setAdminScheduleDayPreset('mon-thu')">Mon–Thu</button>
                                    <button type="button" onclick="setAdminScheduleDayPreset('mwf')">M/W/F</button>
                                    <button type="button" onclick="setAdminScheduleDayPreset('tth')">Tue/Thu</button>
                                    <button type="button" onclick="setAdminScheduleDayPreset('everyday')">Every day</button>
                                    <button type="button" onclick="setAdminScheduleDayPreset('clear')">Clear</button>
                                </div>
                                <div id="adminScheduleDays" class="admin-day-picker">
                                    ${["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map(function(day){return `<label class="admin-day-chip"><input type="checkbox" value="${day}"><span>${day}</span></label>`;}).join("")}
                                </div>
                            </div>

                            <div class="route-field admin-calendar-span-2">
                                <label for="adminScheduleSubject">Subject</label>
                                <input id="adminScheduleSubject" placeholder="Mathematics">
                            </div>
                            <div class="route-field">
                                <label for="adminScheduleStart">Start</label>
                                <input id="adminScheduleStart" type="time">
                            </div>
                            <div class="route-field">
                                <label for="adminScheduleEnd">End</label>
                                <input id="adminScheduleEnd" type="time">
                            </div>
                        </div>

                        <button class="spa-black-button route-full-button" onclick="addAdminSchedule()">Add to Weekly Schedule</button>
                        <div id="adminScheduleList" class="admin-calendar-list"><div class="admin-calendar-empty">Choose a section above to view its existing weekly schedule.</div></div>
                    </section>

                    <section class="admin-calendar-panel">
                        <span class="admin-management-kicker">Important dates</span>
                        <h2>Events, Tests & Exams</h2>
                        <p class="admin-panel-intro">One event can be added to several sections at the same time.</p>

                        <div class="admin-calendar-form-grid">
                            <div class="route-field admin-calendar-span-2">
                                <label>Target sections</label>
                                <div class="admin-choice-toolbar">
                                    <button type="button" onclick="setAdminSectionTargets('event','current')">Current section</button>
                                    <button type="button" onclick="setAdminSectionTargets('event','all')">All sections</button>
                                    <button type="button" onclick="setAdminSectionTargets('event','clear')">Clear</button>
                                </div>
                                <div id="adminEventSections" class="admin-target-picker">
                                    <div class="admin-target-empty">Choose a school first.</div>
                                </div>
                            </div>

                            <div class="route-field">
                                <label for="adminTestSubject">Subject / category</label>
                                <input id="adminTestSubject" placeholder="Science">
                            </div>
                            <div class="route-field">
                                <label for="adminTestTitle">Event title</label>
                                <input id="adminTestTitle" placeholder="Quarterly Exam, Assembly, Deadline...">
                            </div>
                            <div class="route-field">
                                <label for="adminTestDate">Date</label>
                                <input id="adminTestDate" type="date">
                            </div>
                            <div class="route-field">
                                <label for="adminTestStart">Start</label>
                                <input id="adminTestStart" type="time">
                            </div>
                        </div>

                        <button class="spa-black-button route-full-button" onclick="addAdminTest()">Add Event to Selected Sections</button>
                        <div id="adminTestList" class="admin-calendar-list"><div class="admin-calendar-empty">Choose a section above to view its existing events.</div></div>
                    </section>
                </div>
            </div>
        `,

        adminClasses: `
            <div class="tuklass-route route-admin-classes">

                <div class="route-head">
                    <div>
                        <div class="route-kicker">Admin tools</div>
                        <h1>Schools & Classes</h1>
                        <p>Create schools and sections, then see exactly which Tuklass accounts belong to each class.</p>
                    </div>

                    <div class="route-head-icon">
                        <img src="images/ProfileB.png" alt="">
                    </div>
                </div>

                <div class="admin-route-links">
                    <a href="admin.html" class="admin-tab-link">Admin Home</a>
                    <a href="admin-classes.html" class="admin-tab-link active">Schools & Classes</a>
                    <a href="admin-calendar.html" class="admin-tab-link">Class Calendar</a>
                    <a href="admin-reminders.html" class="admin-tab-link">Class Reminders</a>
                </div>

                <div id="adminDirectoryMessage" class="admin-directory-message"></div>

                <div class="admin-management-grid">

                    <section class="admin-management-card">
                        <span class="admin-management-kicker">School</span>
                        <h2>Add a school</h2>
                        <p>Add each school once so student accounts always use one consistent name.</p>
                        <div class="route-field">
                            <label for="adminSchoolName">School name</label>
                            <input id="adminSchoolName" type="text" maxlength="120" placeholder="School name">
                        </div>
                        <button id="adminAddSchoolButton" type="button" class="spa-black-button route-full-button" onclick="addAdminSchool()">Add School</button>
                    </section>

                    <section class="admin-management-card">
                        <span class="admin-management-kicker">Section</span>
                        <h2>Add a section</h2>
                        <p>A section belongs to one school and receives its own permanent Class ID.</p>
                        <div class="route-field">
                            <label for="adminClassSchool">School</label>
                            <select id="adminClassSchool">
                                <option value="">Choose a school</option>
                            </select>
                        </div>
                        <div class="route-field">
                            <label for="adminSectionName">Section</label>
                            <input id="adminSectionName" type="text" maxlength="80" placeholder="Example: 10-A">
                        </div>
                        <button id="adminAddClassButton" type="button" class="spa-black-button route-full-button" onclick="addAdminClass()">Add Section</button>
                    </section>

                </div>

                <section class="admin-directory-card">
                    <div class="admin-directory-head">
                        <div>
                            <span class="admin-management-kicker">Directory</span>
                            <h2>Class rosters</h2>
                        </div>
                        <button type="button" class="admin-refresh-button" onclick="refreshAdminDirectory()">Refresh</button>
                    </div>

                    <input id="adminDirectorySearch" class="admin-directory-search" type="search" placeholder="Search students, schools, sections, or email..." autocomplete="off">

                    <div id="adminDirectory"></div>
                </section>

            </div>
        `
    };

    function displayName(name) {
        const clean = String(name || "").trim();
        const normalized = clean.replace(/\s+/g, " ").toLowerCase();

        if (
            normalized === "rick aldrei velilla" ||
            normalized === "rick aldrei a. velilla" ||
            normalized === "rick aldrei a velilla"
        ) {
            return "Rick Velilla";
        }

        return clean;
    }

    function routeFromPath(pathname) {
        const file = String(pathname || "")
            .split("/")
            .pop()
            .toLowerCase();

        if (!file || file === "index.html") return "home";
        if (file === "search.html") return "search";
        if (file === "catalog.html" || file === "notes.html") return "catalog";
        if (file === "calendar.html") return "calendar";
        if (file === "reminders.html") return "reminders";
        if (file === "messages.html") return "messages";
        if (file === "chat.html") return "chat";
        if (file === "profile.html") return "profile";
        if (file === "edit-profile.html") return "editProfile";
        if (file === "admin.html") return "admin";
        if (file === "admin-reminders.html") return "adminReminders";
        if (file === "admin-classes.html") return "adminClasses";
        if (file === "admin-calendar.html") return "adminCalendar";

        return null;
    }

    function routeFromHref(href) {
        if (!href) return null;

        try {
            const url = new URL(href, window.location.href);
            if (url.origin !== window.location.origin) return null;
            return routeFromPath(url.pathname);
        } catch {
            return null;
        }
    }

    function getMain() {
        return document.querySelector("#dashboard .dashboard-main");
    }

    function getSavedUser() {
        try {
            const raw = localStorage.getItem("writejotUser");
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    function syncShell(user) {
        if (!user) return;

        const picture =
            user.profilePicture ||
            user.googlePicture ||
            user.picture ||
            "images/Logo3.1.png";

        const sidebarPicture =
            document.getElementById("sidebarProfilePicture");

        const sidebarName =
            document.getElementById("sidebarProfileName");

        const sidebarUsername =
            document.getElementById("sidebarProfileUsername");

        if (sidebarPicture) {
            sidebarPicture.src = picture;
            sidebarPicture.onerror = function () {
                this.src = "images/Logo3.1.png";
            };
        }

        if (sidebarName) {
            sidebarName.textContent =
                displayName(user.name) ||
                user.email ||
                "Student";
        }

        if (sidebarUsername) {
            sidebarUsername.textContent =
                "@" + (user.username || "username");
        }

        /* V8.3: show a compact role label directly under the Tuklass logo. */
        const sidebarBrand = document.querySelector("#dashboard .sidebar-brand");
        let sidebarAdminLabel = document.getElementById("sidebarAdminLabel");

        if (sidebarBrand && !sidebarAdminLabel) {
            sidebarAdminLabel = document.createElement("div");
            sidebarAdminLabel.id = "sidebarAdminLabel";
            sidebarAdminLabel.className = "sidebar-admin-label";
            sidebarAdminLabel.textContent = "ADMIN";
            sidebarBrand.insertAdjacentElement("afterend", sidebarAdminLabel);
        }

        if (sidebarAdminLabel) {
            sidebarAdminLabel.hidden = user.admin !== true;
        }

        /*
         * Admin is a dedicated sidebar destination in V8.3. The link is only
         * shown for accounts the backend identifies as admins. This is UX
         * only; every admin request is still protected server-side.
         */
        const sidebarNav =
            document.querySelector("#dashboard .sidebar-nav");

        let adminLink =
            document.querySelector(
                '#dashboard .sidebar-link[data-page="admin"]'
            );

        if (sidebarNav && !adminLink) {
            adminLink = document.createElement("a");
            adminLink.href = "admin.html";
            adminLink.className = "sidebar-link admin-sidebar-link";
            adminLink.dataset.page = "admin";
            adminLink.title = "Admin";
            adminLink.innerHTML = `
                <img class="nav-icon icon-a" src="images/adminA.png" alt="">
                <img class="nav-icon icon-b" src="images/adminB.png" alt="">
                <span>Admin</span>
            `;
            sidebarNav.appendChild(adminLink);
        }

        if (adminLink) {
            adminLink.hidden = user.admin !== true;

            if (
                !adminLink.hidden &&
                (
                    currentRoute === "admin" ||
                    currentRoute === "adminReminders" ||
                    currentRoute === "adminClasses" ||
                    currentRoute === "adminCalendar"
                )
            ) {
                updateActiveNav(currentRoute);
            }
        }

        const oldAdminToolsCard =
            document.getElementById("adminToolsCard");

        if (oldAdminToolsCard) {
            oldAdminToolsCard.style.display = "none";
        }

        const shortcut =
            document.querySelector(".profile-shortcut, .sidebar-edit");

        if (shortcut && user.username) {
            shortcut.href =
                "profile.html?username=" +
                encodeURIComponent(user.username);
        }
    }

    function updateActiveNav(route) {

        let activePage =
            route;


        if (
            route === "chat"
        ) {
            activePage =
                "messages";
        }
        else if (route === "admin" || route === "adminReminders" || route === "adminCalendar" || route === "adminClasses") { activePage = "admin"; }
        else if (
            route === "profile" ||
            route === "editProfile"
        ) {
            activePage =
                "profile";
        }


        document
            .querySelectorAll("#dashboard .sidebar-link")
            .forEach(function (link) {

                const page =
                    String(
                        link.dataset.page ||
                        ""
                    );
                const isActive = page === activePage;
                link.classList.toggle("active", isActive);
                const iconA = link.querySelector(".icon-a");
                const iconB = link.querySelector(".icon-b");
                if (iconA && iconB) {
                    iconA.style.display = isActive ? "none" : "block";
                    iconB.style.display = isActive ? "block" : "none";
                }

            });

    }

    function cleanupRoute(route) {
        try {
            if (route === "catalog" && window.TuklassNotes) {
                window.TuklassNotes.cleanup();
            }

            if (route === "search" && window.TuklassSearch) {
                window.TuklassSearch.cleanup();
            }

            if (route === "calendar" && window.TuklassCalendar) {
                window.TuklassCalendar.cleanup();
            }

            if (route === "reminders" && window.TuklassReminders) {
                window.TuklassReminders.cleanup();
            }

            if (route === "messages" && window.TuklassMessages) {
                window.TuklassMessages.cleanup();
            }

            if (route === "chat" && window.TuklassChat) {
                window.TuklassChat.cleanup();
            }

            if (route === "profile" && window.TuklassProfile) {
                window.TuklassProfile.cleanup();
            }

            if (route === "editProfile" && window.TuklassEditProfile) {
                window.TuklassEditProfile.cleanup();
            }

            if (route === "admin" && window.TuklassAdminHome) {
                window.TuklassAdminHome.cleanup();
            }

            if (route === "adminReminders" && window.TuklassAdminReminders) {
                window.TuklassAdminReminders.cleanup();
            }

            if (route === "adminClasses" && window.TuklassAdminClasses) {
                window.TuklassAdminClasses.cleanup();
            }
            if (route === "adminCalendar" && window.TuklassAdminCalendar) {
                window.TuklassAdminCalendar.cleanup();
            }
        } catch (error) {
            console.log("Route cleanup skipped.", error);
        }
    }

    function initCatalog() {
        const input = document.getElementById("spaCatalogSearch");
        if (!input) return;

        input.addEventListener("input", function () {
            const query = input.value.trim().toLowerCase();
            let visible = 0;

            document.querySelectorAll(".catalog-card").forEach(function (card) {
                const haystack =
                    (card.dataset.catalog || "") +
                    " " +
                    card.textContent;

                const match =
                    haystack.toLowerCase().includes(query);

                card.style.display = match ? "flex" : "none";
                if (match) visible++;
            });

            document.querySelectorAll(".catalog-subject").forEach(function (section) {
                const anyVisible =
                    Array.from(section.querySelectorAll(".catalog-card"))
                        .some(function (card) {
                            return card.style.display !== "none";
                        });

                section.style.display = anyVisible ? "block" : "none";
            });

            const empty = document.getElementById("spaCatalogNoResults");
            if (empty) empty.hidden = visible !== 0;
        });
    }

    async function initRoute(route) {
        if (route === "catalog" && window.TuklassNotes) {
            await window.TuklassNotes.init();
            return;
        }

        if (route === "search" && window.TuklassSearch) {
            window.TuklassSearch.init();
            return;
        }

        if (route === "calendar" && window.TuklassCalendar) {
            await window.TuklassCalendar.init();
            return;
        }

        if (route === "reminders" && window.TuklassReminders) {
            window.TuklassReminders.init();
            return;
        }

        if (route === "messages" && window.TuklassMessages) {
            await window.TuklassMessages.init();
            return;
        }

        if (route === "chat" && window.TuklassChat) {
            await window.TuklassChat.init();
            return;
        }

        if (route === "profile" && window.TuklassProfile) {
            await window.TuklassProfile.init();
            return;
        }

        if (route === "editProfile" && window.TuklassEditProfile) {
            window.TuklassEditProfile.init();
            return;
        }

        if (route === "admin" && window.TuklassAdminHome) {
            window.TuklassAdminHome.init();
            return;
        }

        if (route === "adminReminders" && window.TuklassAdminReminders) {
            window.TuklassAdminReminders.init();
            return;
        }

        if (route === "adminClasses" && window.TuklassAdminClasses) {
            window.TuklassAdminClasses.init();
            return;
        }
        if (route === "adminCalendar" && window.TuklassAdminCalendar) {
            await window.TuklassAdminCalendar.init();
        }
    }

    function escapeAdminRouteMessage(value) {
        return String(value || "Admin verification failed.")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function renderHome(main) {
        main.innerHTML = homeMarkup;
        currentRoute = "home";
        updateActiveNav("home");

        const user = getSavedUser();
        if (user && originalShowDashboard) {
            originalShowDashboard(user);
        }

        syncShell(user);
    }

    async function renderRoute(route, options) {
        options = options || {};

        const main = getMain();
        if (!main || !route) return;

        const adminRoute =
            route === "admin" ||
            route === "adminReminders" ||
            route === "adminClasses" ||
            route === "adminCalendar";

        if (adminRoute) {
            try {
                await window.TuklassAdminAuth.ensureSession(false);
            }
            catch (error) {
                cleanupRoute(currentRoute);
                main.innerHTML = `
                    <div class="tuklass-route route-admin-denied">
                        <div class="route-head">
                            <div>
                                <div class="route-kicker">Protected area</div>
                                <h1>Admin access required</h1>
                                <p>${escapeAdminRouteMessage(error && error.message)}</p>
                            </div>
                            <div class="route-head-icon">
                                <img src="images/adminA.png" alt="">
                            </div>
                        </div>
                        <section class="admin-security-note">
                            <strong>Server-side verification blocked this request.</strong>
                            <span>Only Google-verified authorized Tuklass administrators can open admin tools. If you are an administrator and your verification expired, sign out and sign in again.</span>
                        </section>
                    </div>
                `;
                currentRoute = route;
                document.title = "Tuklass | Admin Access Required";
                document.documentElement.classList.remove("tuklass-route-boot");
                updateActiveNav(route);
                return;
            }
        }

        if (route === currentRoute && !options.force) {
            updateActiveNav(route);
            document.documentElement.classList.remove("tuklass-route-boot");
            return;
        }

        cleanupRoute(currentRoute);

        const swap = function () {
            if (route === "home") {
                renderHome(main);
                return;
            }

            main.innerHTML = ROUTE_TEMPLATES[route];
            currentRoute = route;
            updateActiveNav(route);
            syncShell(getSavedUser());
        };

        if (document.startViewTransition && !options.noTransition) {
            const transition = document.startViewTransition(swap);
            try {
                await transition.updateCallbackDone;
            } catch {}
        } else {
            swap();
        }

        document.documentElement.classList.remove("tuklass-route-boot");

        if (ROUTE_TITLES[route]) {
            document.title = ROUTE_TITLES[route];
        }

        if (!options.skipHistory) {
            history.pushState(
                { tuklassRoute: route },
                "",
                options.historyUrl ||
                ROUTE_URLS[route]
            );
        }

        await initRoute(route);
    }

    async function navigate(route, url) {

        if (typeof window.toggleTuklassMenu === "function") {
            window.toggleTuklassMenu(false);
        }

        if (!route || navigating) return;

        navigating = true;

        document.body.classList.add("tuklass-is-navigating");

        try {
            await renderRoute(route, {
                skipHistory: false,
                historyUrl:
                    url ||
                    ROUTE_URLS[route]
            });
        } finally {
            document.body.classList.remove("tuklass-is-navigating");
            navigating = false;
        }
    }

    function bindNavigation() {
        document.addEventListener(
            "click",
            function (event) {
                if (
                    event.defaultPrevented ||
                    event.button !== 0 ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey
                ) {
                    return;
                }

                const link = event.target.closest("a");
                if (!link) return;

                if (
                    link.target === "_blank" ||
                    link.hasAttribute("download")
                ) {
                    return;
                }

                const href = link.getAttribute("href");
                if (!href || href.startsWith("#")) return;

                const route = routeFromHref(href);
                if (!route) return;

                event.preventDefault();
                navigate(route, href);
            },
            true
        );

        window.addEventListener("popstate", function () {
            const route = routeFromPath(location.pathname) || "home";

            renderRoute(route, {
                skipHistory: true,
                force: true
            });
        });
    }

    function patchDashboardRefresh() {
        originalShowDashboard =
            typeof window.showDashboard === "function"
                ? window.showDashboard
                : null;

        if (!originalShowDashboard) return;

        window.showDashboard = function (user) {
            if (!started || currentRoute === "home") {
                return originalShowDashboard(user);
            }

            /*
             * If onboarding was visible while a background account check
             * discovered that the user is now class-ready (or is an admin),
             * allow the original function to reveal the persistent dashboard.
             * It does not replace the SPA route's main markup.
             */
            const dashboard =
                document.getElementById("dashboard");

            if (
                dashboard &&
                dashboard.style.display === "none" &&
                user &&
                (
                    user.classId ||
                    user.admin
                )
            ) {
                return originalShowDashboard(user);
            }

            /*
             * While another route is open, normal background account
             * refreshes update the persistent shell only.
             */
            syncShell(user);
        };
    }

    function init() {
        const user = getSavedUser();

        /*
         * The public logged-out landing page remains untouched.
         */
        if (!user) {
            document.documentElement.classList.remove("tuklass-route-boot");
            return;
        }

        const main = getMain();
        if (!main) {
            document.documentElement.classList.remove("tuklass-route-boot");
            return;
        }

        homeMarkup = main.innerHTML;

        /*
         * Initial showDashboard() from the original index code has
         * already run because its DOMContentLoaded listener was
         * registered first. Patch only future background refreshes.
         */
        patchDashboardRefresh();
        bindNavigation();

        started = true;

        const initialRoute =
            routeFromPath(location.pathname) || "home";

        currentRoute = "home";

        if (initialRoute === "home") {
            updateActiveNav("home");
            syncShell(user);
            document.title = ROUTE_TITLES.home;
            document.documentElement.classList.remove("tuklass-route-boot");
        } else {
            renderRoute(initialRoute, {
                skipHistory: true,
                force: true,
                noTransition: true
            });
        }
    }

    function navigateToChat(
        username
    ) {

        const cleaned =
            String(
                username ||
                ""
            )
            .trim()
            .replace(
                /^@+/,
                ""
            );


        if (
            !cleaned
        ) {

            return;

        }


        navigate(
            "chat",
            "chat.html?username=" +
            encodeURIComponent(
                cleaned
            )
        );

    }


    window.TuklassSPA = {
        init,
        navigate,
        navigateToChat,
        displayName,
        get route() {
            return currentRoute;
        }
    };

    document.addEventListener("DOMContentLoaded", init);
})();
