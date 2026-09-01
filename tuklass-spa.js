
window.TuklassCalendar = (function () {
const APPS_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbybWxbR34bbA6VlAbaI1qBn21iCqisr0-Mww6WzTVxUZdTJ-q7-jPP2TfZ3XrO5uMXVgw/exec";


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
        window.deletePersonalEvent = deletePersonalEvent;
        await init();
    }

    function cleanup() {
        try { delete window.changeMonth; } catch {}
        try { delete window.goToToday; } catch {}
        try { delete window.addEvent; } catch {}
        try { delete window.submitRegistration; } catch {}
        try { delete window.deletePersonalEvent; } catch {}
    }

    return {
        init: spaInit,
        cleanup: cleanup
    };
})();



window.TuklassReminders = (function () {
const APPS_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbybWxbR34bbA6VlAbaI1qBn21iCqisr0-Mww6WzTVxUZdTJ-q7-jPP2TfZ3XrO5uMXVgw/exec";


let currentUser =
    null;

let data =
    null;

let reminders =
    [];

let refreshTimer =
    null;


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
            refreshReminders,
            30000
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

function renderReminderList() {

    const list =
        document.getElementById(
            "reminderList"
        );


    if (!list) {
        return;
    }


    if (
        !reminders.length
    ) {

        list.innerHTML =

        `
        <div class="empty">
            No reminders yet.
        </div>
        `;


        return;

    }


    list.innerHTML =
        reminders
            .map(
                function(reminder) {

                    const parts =
                        getDateParts(
                            reminder.date
                        );


                    const isClass =
                        String(
                            reminder.type ||
                            ""
                        )
                        .toLowerCase()
                        ===
                        "class";


                    return `

                    <div
                        class="
                            reminder
                            ${
                                reminder.optimistic
                                    ? "saving"
                                    : ""
                            }
                        "
                    >

                        <div class="date-box">

                            <span
                                class="date-month"
                            >
                                ${escapeHtml(
                                    parts.month
                                )}
                            </span>


                            <span
                                class="date-day"
                            >
                                ${escapeHtml(
                                    parts.day
                                )}
                            </span>

                        </div>


                        <div
                            class="reminder-main"
                        >

                            <div
                                class="reminder-title"
                            >
                                ${escapeHtml(
                                    reminder.title
                                )}
                            </div>


                            <div
                                class="reminder-meta"
                            >
                                ${
                                    reminder.time
                                        ? escapeHtml(
                                            reminder.time
                                        )
                                        : "All day"
                                }
                            </div>


                            ${
                                reminder.description
                                    ? `
                                        <div
                                            class="
                                                reminder-description
                                            "
                                        >
                                            ${escapeHtml(
                                                reminder.description
                                            )}
                                        </div>
                                      `
                                    : ""
                            }


                            <span
                                class="
                                    tag
                                    ${
                                        isClass
                                            ? "tag-class"
                                            : "tag-personal"
                                    }
                                "
                            >
                                ${
                                    isClass
                                        ? "CLASS"
                                        : "PERSONAL"
                                }
                            </span>

                        </div>


                        <div>

                            ${
                                reminder.optimistic

                                    ? `
                                        <span
                                            style="
                                                color:#8a94a6;
                                                font-size:10px;
                                            "
                                        >
                                            Saving...
                                        </span>
                                      `

                                    : (
                                        !isClass &&
                                        reminder.reminderId
                                    )

                                        ? `
                                            <button
                                                type="button"
                                                class="delete-button"
                                                onclick="deletePersonalReminder(
                                                    '${escapeHtml(
                                                        reminder.reminderId
                                                    )}'
                                                )"
                                            >
                                                Delete
                                            </button>
                                          `

                                        : ""
                            }

                        </div>

                    </div>

                    `;

                }
            )
            .join("");

}



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
    "https://script.google.com/macros/s/AKfycbybWxbR34bbA6VlAbaI1qBn21iCqisr0-Mww6WzTVxUZdTJ-q7-jPP2TfZ3XrO5uMXVgw/exec";


const CACHE_PREFIX =
    "writejot_conversations_";


const REFRESH_INTERVAL =
    15000;


let currentUser =
    null;


let conversations =
    [];


let refreshTimer =
    null;


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

function renderConversations() {

    const list =
        document.getElementById(
            "conversationList"
        );


    /*
     * Explicitly remove any accidental
     * height restriction.
     */

    list.style.height =
        "auto";


    list.style.maxHeight =
        "none";


    list.style.overflow =
        "visible";


    if (
        !conversations.length
    ) {

        list.innerHTML =

            `
            <div
                class="messages-empty"
            >

                <div
                    style="
                        font-size:42px;
                        margin-bottom:12px;
                    "
                >
                    <img src="images/MessageA.png" alt="" style="width:48px;height:48px;object-fit:contain;">
                </div>


                <strong>
                    No conversations yet.
                </strong>


                <div
                    style="
                        margin-top:6px;
                    "
                >
                    Search for a student to
                    start a conversation.
                </div>

            </div>
            `;


        updateUnreadTotal();


        return;

    }


    list.innerHTML =
        conversations
            .map(
                function(
                    conversation
                ) {

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

/* =========================================================
   CONFIG
========================================================= */

const APPS_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbybWxbR34bbA6VlAbaI1qBn21iCqisr0-Mww6WzTVxUZdTJ-q7-jPP2TfZ3XrO5uMXVgw/exec";


let currentUser =
    null;


let otherUsername =
    "";


let refreshTimer =
    null;


let selectedImage =
    null;


let loadRequestId =
    0;


let pageInitialized =
    false;


let sendInProgress =
    false;


/* =========================================================
   CHAT CACHE
========================================================= */

const CHAT_CACHE_TTL =
    24 * 60 * 60 * 1000;


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
            return false;
        }

        const cached =
            JSON.parse(raw);

        if (
            !cached ||
            !Array.isArray(cached.messages)
        ) {
            return false;
        }

        if (
            cached.savedAt &&
            Date.now() - Number(cached.savedAt) >
                CHAT_CACHE_TTL
        ) {
            localStorage.removeItem(
                getChatCacheKey()
            );
            return false;
        }

        renderMessages(
            cached.messages
        );

        return true;

    }
    catch (error) {

        console.log(
            "Chat cache could not be read."
        );

        return false;

    }

}


function saveMessagesToCache(
    messages
) {

    try {

        localStorage.setItem(

            getChatCacheKey(),

            JSON.stringify({

                savedAt:
                    Date.now(),

                messages:
                    Array.isArray(messages)
                        ? messages
                        : []

            })

        );

    }
    catch (error) {

        console.log(
            "Chat cache could not be saved."
        );

    }

}


/* =========================================================
   START
========================================================= */

async function initializeChat() {

    const savedUser =
        localStorage.getItem(
            "writejotUser"
        );


    if (
        !savedUser
    ) {

        window.location.href =
            "index.html";

        return;

    }


    try {

        currentUser =
            JSON.parse(
                savedUser
            );

    }

    catch (error) {

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
            params.get(
                "username"
            )
        );


    if (
        !otherUsername
    ) {

        window.location.href =
            "messages.html";

        return;

    }


    pageInitialized =
        true;


    /*
     * Show cached conversation immediately.
     * The server refresh happens in the background.
     */

    loadCachedMessages();


    loadRecipient();

    markConversationRead();

    loadMessages();


    startRefreshTimer();


    setupMessageInput();

}


/* =========================================================
   REFRESH / BFCACHE FIX
========================================================= */

window.addEventListener(
    "pageshow",
    async function () {

        /*
         * Chrome can restore chat.html from its back/forward
         * cache. That restores the old DOM exactly as it was,
         * including a stale "Sending..." message.
         *
         * Always rebuild the conversation from the server when
         * the page becomes visible again.
         */

        if (
            !pageInitialized
        ) {

            return;

        }


        startRefreshTimer();


        /* Keep the restored/cached conversation visible and refresh in background. */
        loadCachedMessages();

        loadRecipient();

        markConversationRead();

        loadMessages();

    }
);


window.addEventListener(
    "focus",
    function () {

        if (
            pageInitialized
        ) {

            loadMessages();

        }

    }
);


window.addEventListener(
    "pagehide",
    function () {

        if (
            refreshTimer
        ) {

            clearInterval(
                refreshTimer
            );

            refreshTimer =
                null;

        }

    }
);


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

                if (
                    document.visibilityState ===
                    "visible"
                ) {

                    loadMessages();

                }

            },
            3000
        );

}


/* =========================================================
   RECIPIENT
========================================================= */

async function loadRecipient() {

    try {

        const response =
            await fetch(

                APPS_SCRIPT_URL +
                "?action=profile&username=" +
                encodeURIComponent(
                    otherUsername
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
            !result.success ||
            !result.profile
        ) {

            document
                .getElementById(
                    "recipientName"
                )
                .textContent =
                "User not found";


            document
                .getElementById(
                    "recipientUsername"
                )
                .textContent =
                "@" +
                otherUsername;


            return;

        }


        const profile =
            result.profile;


        document
            .getElementById(
                "recipientName"
            )
            .textContent =
            profile.name ||
            "Tuklass User";


        document
            .getElementById(
                "recipientUsername"
            )
            .textContent =
            "@" +
            (
                profile.username ||
                otherUsername
            );


        document
            .getElementById(
                "recipientPicture"
            )
            .src =
            profile.profilePicture ||
            "images/Logo3.1.png";


        document
            .getElementById(
                "recipientPicture"
            )
            .onerror =
            function () {

                this.src =
                    "images/Logo3.1.png";

            };

    }

    catch (error) {

        console.error(
            "Recipient loading error:",
            error
        );


        document
            .getElementById(
                "recipientName"
            )
            .textContent =
            "Tuklass User";


        document
            .getElementById(
                "recipientUsername"
            )
            .textContent =
            "@" +
            otherUsername;

    }

}


/* =========================================================
   MARK AS READ
========================================================= */

async function markConversationRead() {

    try {

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
                            "markConversationRead",

                        email:
                            currentUser.email,

                        username:
                            otherUsername

                    })

            }

        );

    }

    catch (error) {

        console.error(
            "Read status error:",
            error
        );

    }

}


/* =========================================================
   LOAD MESSAGES
========================================================= */

async function loadMessages() {

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


        /* Ignore an older request that finished late. */

        if (
            requestId !==
            loadRequestId
        ) {

            return;

        }


        if (
            !result.success
        ) {

            showMessageError(
                result.error ||
                "Could not load messages."
            );

            return;

        }


        /*
         * This is the source of truth. Re-rendering from the
         * server removes any old optimistic "Sending..." DOM
         * that the browser may have restored.
         */

        const serverMessages =
            result.messages ||
            [];


        saveMessagesToCache(
            serverMessages
        );


        renderMessages(
            serverMessages
        );

    }

    catch (error) {

        console.error(
            "Message loading error:",
            error
        );


        if (
            requestId ===
            loadRequestId
        ) {

            /*
             * Do not destroy a perfectly valid chat UI just
             * because a background refresh failed.
             */

            if (
                !document.querySelector(
                    ".message-row"
                )
            ) {

                showMessageError(
                    "Could not load messages."
                );

            }

        }

    }

}

/* =========================================================
   RENDER MESSAGES
========================================================= */

function renderMessages(
    messages
) {

    /* Server data replaces any browser-restored pending DOM. */
    removeAllPendingMessages();


    const container =
        document.getElementById(
            "messages"
        );


    if (
        !messages.length
    ) {

        container.innerHTML =

            `
            <div
                id="empty"
            >
                No messages yet.
                Say hello!
            </div>
            `;


        return;

    }


    const currentUsername =
        normalizeUsername(
            currentUser.username
        );


    container.innerHTML =
        messages
            .map(

                function (
                    message
                ) {

                    const mine =
                        normalizeUsername(
                            message.sender
                        ) ===
                        currentUsername;


                    const time =
                        message.timestamp
                            ? new Date(
                                message.timestamp
                              )
                              .toLocaleString()
                            : "";


                    let content =
                        "";


                    /* =========================
                       IMAGE
                    ========================= */

                    if (
                        message.attachmentType ===
                            "image" &&
                        message.attachmentUrl
                    ) {

                        content +=

                            `
                            <img
                                class="message-image"
                                src="${escapeHtml(
                                    message.attachmentUrl
                                )}"
                                alt="Photo"
                                loading="lazy"
                                onclick="openImage(
                                    '${escapeHtml(
                                        message.attachmentUrl
                                    )}'
                                )"
                                onerror="
                                    this.style.display='none';
                                "
                            >
                            `;

                    }


                    /* =========================
                       TEXT
                    ========================= */

                    if (
                        message.message
                    ) {

                        content +=

                            `
                            <div>
                                ${escapeHtml(
                                    message.message
                                )}
                            </div>
                            `;

                    }


                    const isImageOnly =
                        (
                            message.attachmentType ===
                            "image"
                        ) &&
                        !message.message;


                    return `

                        <div
                            class="message-row
                            ${
                                mine
                                    ? "mine"
                                    : "theirs"
                            }"
                        >

                            <div
                                class="bubble-wrapper"
                            >

                                <div
                                    class="bubble
                                    ${
                                        isImageOnly
                                            ? "image-message-bubble"
                                            : ""
                                    }"
                                >

                                    ${content}

                                </div>


                                <div
                                    class="time"
                                >
                                    ${escapeHtml(
                                        time
                                    )}
                                </div>

                            </div>

                        </div>

                    `;

                }

            )
            .join("");


    container.scrollTop =
        container.scrollHeight;

}


/* =========================================================
   OPEN IMAGE
========================================================= */

function openImage(
    url
) {

    window.open(
        url,
        "_blank"
    );

}


/* =========================================================
   OPEN FILE PICKER
========================================================= */

function openImagePicker() {

    document
        .getElementById(
            "imageInput"
        )
        .click();

}


/* =========================================================
   SELECT IMAGE
========================================================= */

function handleImageSelection(
    event
) {

    const file =
        event.target.files &&
        event.target.files[0];


    if (
        !file
    ) {

        return;

    }


    if (
        !file.type.startsWith(
            "image/"
        )
    ) {

        alert(
            "Please choose an image file."
        );


        event.target.value =
            "";


        return;

    }


    /*
     * Keep original file under 10 MB.
     * The image will be compressed before upload.
     */

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


    const reader =
        new FileReader();


    reader.onload =
        function () {

            document
                .getElementById(
                    "previewImage"
                )
                .src =
                reader.result;


            document
                .getElementById(
                    "imagePreview"
                )
                .style.display =
                "block";

        };


    reader.readAsDataURL(
        file
    );

}


/* =========================================================
   REMOVE SELECTED IMAGE
========================================================= */

function removeSelectedImage() {

    selectedImage =
        null;


    document
        .getElementById(
            "imageInput"
        )
        .value =
        "";


    document
        .getElementById(
            "previewImage"
        )
        .src =
        "";


    document
        .getElementById(
            "imagePreview"
        )
        .style.display =
        "none";

}


/* =========================================================
   SEND MESSAGE
========================================================= */

async function sendMessage() {

    if (
        sendInProgress
    ) {

        return;

    }


    const input =
        document.getElementById(
            "messageInput"
        );


    const button =
        document.getElementById(
            "sendButton"
        );


    const message =
        input
            .value
            .trim();


    if (
        !message &&
        !selectedImage
    ) {

        return;

    }


    sendInProgress =
        true;


    button.disabled =
        true;


    button.textContent =
        "Sending...";


    /*
     * Add a temporary message only for immediate feedback.
     * It has a unique class so it can be removed whenever the
     * real server conversation is rendered.
     */

    const pendingId =
        "sending-" +
        Date.now() +
        "-" +
        Math.random()
            .toString(36)
            .slice(2);


    appendPendingMessage(
        message,
        selectedImage,
        pendingId
    );


    try {

        let imageData =
            "";


        let imageType =
            "";


        let imageName =
            "";


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
                                "sendMessage",

                            email:
                                currentUser.email,

                            receiver:
                                otherUsername,

                            message:
                                message,

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
            !result.success
        ) {

            throw new Error(
                result.error ||
                "Could not send the message."
            );

        }


        input.value =
            "";


        resetTextareaHeight();


        removeSelectedImage();


        /*
         * Immediately remove the temporary bubble. The next
         * render will contain the real database message.
         */

        removePendingMessage(
            pendingId
        );


        /*
         * No artificial 400ms wait. Ask the server immediately.
         */

        await loadMessages();

    }

    catch (error) {

        console.error(
            "Send message error:",
            error
        );


        removePendingMessage(
            pendingId
        );


        alert(
            error.message ||
            "Could not send the message."
        );

    }


    finally {

        sendInProgress =
            false;


        button.disabled =
            false;


        button.textContent =
            "Send";


        input.focus();

    }

}


/* =========================================================
   OPTIMISTIC / PENDING MESSAGE
========================================================= */

function appendPendingMessage(
    text,
    imageFile,
    pendingId
) {

    const container =
        document.getElementById(
            "messages"
        );


    const row =
        document.createElement(
            "div"
        );


    row.className =
        "message-row mine sending-message";


    row.dataset.pendingId =
        pendingId;


    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "bubble-wrapper";


    const bubble =
        document.createElement(
            "div"
        );


    bubble.className =
        "bubble";


    if (
        imageFile
    ) {

        bubble.classList.add(
            "image-message-bubble"
        );


        const image =
            document.createElement(
                "img"
            );


        image.className =
            "message-image";


        image.alt =
            "Photo";


        const reader =
            new FileReader();


        reader.onload =
            function () {

                image.src =
                    reader.result;

            };


        reader.readAsDataURL(
            imageFile
        );


        bubble.appendChild(
            image
        );

    }


    if (
        text
    ) {

        const textNode =
            document.createElement(
                "div"
            );


        textNode.textContent =
            text;


        bubble.appendChild(
            textNode
        );

    }


    const time =
        document.createElement(
            "div"
        );


    time.className =
        "time";


    time.textContent =
        "Sending...";


    wrapper.appendChild(
        bubble
    );


    wrapper.appendChild(
        time
    );


    row.appendChild(
        wrapper
    );


    container.appendChild(
        row
    );


    container.scrollTop =
        container.scrollHeight;

}


function removePendingMessage(
    pendingId
) {

    const element =
        document.querySelector(
            '[data-pending-id="' +
            pendingId +
            '"]'
        );


    if (
        element
    ) {

        element.remove();

    }

}


function removeAllPendingMessages() {

    document
        .querySelectorAll(
            ".sending-message"
        )
        .forEach(
            function (
                element
            ) {

                element.remove();

            }
        );

}

/* =========================================================
   COMPRESS IMAGE
========================================================= */

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

                            const maxSize =
                                1600;


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
                                            (
                                                maxSize /
                                                width
                                            )
                                        );


                                    width =
                                        maxSize;

                                }
                                else {

                                    width =
                                        Math.round(
                                            width *
                                            (
                                                maxSize /
                                                height
                                            )
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


                            const mimeType =
                                "image/jpeg";


                            const dataUrl =
                                canvas.toDataURL(

                                    mimeType,

                                    0.82

                                );


                            resolve({

                                dataUrl:
                                    dataUrl,

                                mimeType:
                                    mimeType,

                                fileName:
                                    "photo-" +
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
   ADAPTIVE TEXTBOX
========================================================= */

function setupMessageInput() {

    const input =
        document.getElementById(
            "messageInput"
        );


    input.addEventListener(
        "input",
        function () {

            input.style.height =
                "auto";


            const maxHeight =
                window.innerWidth <=
                    600
                    ? 120
                    : 140;


            input.style.height =
                Math.min(
                    input.scrollHeight,
                    maxHeight
                ) +
                "px";

        }
    );


    /*
     * Enter = send
     * Shift + Enter = new line
     */

    input.addEventListener(
        "keydown",
        function (
            event
        ) {

            if (
                event.key ===
                    "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();


                sendMessage();

            }

        }
    );

}


/* =========================================================
   RESET TEXTBOX
========================================================= */

function resetTextareaHeight() {

    const input =
        document.getElementById(
            "messageInput"
        );


    input.style.height =
        "44px";

}


/* =========================================================
   MESSAGE ERROR
========================================================= */

function showMessageError(
    message
) {

    const container =
        document.getElementById(
            "messages"
        );


    /* Keep existing messages visible during background failures. */

    if (
        container.querySelector(
            ".message-row"
        )
    ) {

        return;

    }


    container.innerHTML =

        `
        <div
            id="empty"
        >
            ${escapeHtml(
                message ||
                "Could not load messages."
            )}
        </div>
        `;

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


function sleep(
    milliseconds
) {

    return new Promise(
        function (
            resolve
        ) {

            setTimeout(
                resolve,
                milliseconds
            );

        }
    );

}

    async function spaInit() {

        /*
         * Inline onclick handlers in the original chat renderer still
         * call these names. Expose only while Chat is mounted.
         */
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


        selectedImage =
            null;

        sendInProgress =
            false;

        pageInitialized =
            false;


        await initializeChat();

    }


    function cleanup() {

        if (
            refreshTimer
        ) {

            clearInterval(
                refreshTimer
            );

            refreshTimer =
                null;

        }


        pageInitialized =
            false;

        selectedImage =
            null;

        sendInProgress =
            false;


        try {
            delete window.openImage;
        }
        catch {}


        try {
            delete window.openImagePicker;
        }
        catch {}


        try {
            delete window.handleImageSelection;
        }
        catch {}


        try {
            delete window.removeSelectedImage;
        }
        catch {}


        try {
            delete window.sendMessage;
        }
        catch {}

    }


    return {
        init:
            spaInit,

        cleanup:
            cleanup
    };

})();




/* =========================================================
   PROFILE ROUTE MODULE
========================================================= */

window.TuklassProfile = (function () {

const APPS_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbybWxbR34bbA6VlAbaI1qBn21iCqisr0-Mww6WzTVxUZdTJ-q7-jPP2TfZ3XrO5uMXVgw/exec";


let viewedUsername =
    "";


async function loadProfile() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    viewedUsername =
        String(
            params.get(
                "username"
            ) ||
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
    "https://script.google.com/macros/s/AKfycbybWxbR34bbA6VlAbaI1qBn21iCqisr0-Mww6WzTVxUZdTJ-q7-jPP2TfZ3XrO5uMXVgw/exec";


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
   ADMIN REMINDERS ROUTE MODULE
========================================================= */

window.TuklassAdminReminders = (function () {

const APPS_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbybWxbR34bbA6VlAbaI1qBn21iCqisr0-Mww6WzTVxUZdTJ-q7-jPP2TfZ3XrO5uMXVgw/exec";

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

        const response = await fetch(
            APPS_SCRIPT_URL +
            "?action=adminDirectory&email=" +
            encodeURIComponent(currentUser.email),
            {cache:"no-store"}
        );

        const result = await response.json();

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

        const response = await fetch(
            APPS_SCRIPT_URL,
            {
                method:"POST",
                headers:{"Content-Type":"text/plain;charset=utf-8"},
                body:JSON.stringify({
                    action:"addClassReminder",
                    email:currentUser.email,
                    classId:classId,
                    title:title,
                    date:date,
                    time:time,
                    description:description
                })
            }
        );

        const result = await response.json();

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
    "https://script.google.com/macros/s/AKfycbybWxbR34bbA6VlAbaI1qBn21iCqisr0-Mww6WzTVxUZdTJ-q7-jPP2TfZ3XrO5uMXVgw/exec";

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

        const response = await fetch(
            APPS_SCRIPT_URL +
            "?action=adminDirectory&email=" +
            encodeURIComponent(currentUser.email),
            {cache:"no-store"}
        );

        const result = await response.json();

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
    const response = await fetch(
        APPS_SCRIPT_URL,
        {
            method:"POST",
            headers:{"Content-Type":"text/plain;charset=utf-8"},
            body:JSON.stringify(payload)
        }
    );
    return response.json();
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


(function () {
    "use strict";

    const ROUTE_URLS = {
        home: "index.html",
        catalog: "catalog.html",
        calendar: "calendar.html",
        reminders: "reminders.html",
        messages: "messages.html",
        chat: "chat.html",
        profile: "profile.html",
        editProfile: "edit-profile.html",
        adminReminders: "admin-reminders.html",
        adminClasses: "admin-classes.html"
    };

    const ROUTE_TITLES = {
        home: "Tuklass | Your class, organized.",
        catalog: "Tuklass | Notes Catalog",
        calendar: "Tuklass | Calendar",
        reminders: "Tuklass | Reminders",
        messages: "Tuklass | Messages",
        chat: "Tuklass | Chat",
        profile: "Tuklass | Profile",
        editProfile: "Tuklass | Edit Profile",
        adminReminders: "Tuklass | Admin Reminders",
        adminClasses: "Tuklass | Schools & Classes"
    };

    let homeMarkup = "";
    let currentRoute = "home";
    let started = false;
    let navigating = false;
    let originalShowDashboard = null;

    const ROUTE_TEMPLATES = {

        catalog: `
            <div class="tuklass-route route-catalog">
                <div class="route-head">
                    <div>
                        <div class="route-kicker">Study materials</div>
                        <h1>Notes Catalog</h1>
                        <p>Browse notes and lesson materials shared through Tuklass.</p>
                    </div>
                    <div class="route-head-icon">
                        <img src="images/CatalogB.png" alt="">
                    </div>
                </div>

                <div class="catalog-search-wrap">
                    <input
                        id="spaCatalogSearch"
                        class="catalog-search"
                        type="text"
                        placeholder="Search notes, subjects, or topics..."
                        autocomplete="off"
                    >
                </div>

                <div id="spaCatalogNoResults" class="route-empty" hidden>
                    <strong>No notes found</strong>
                    <span>Try a different search term.</span>
                </div>

                <section class="catalog-subject">
                    <div class="catalog-subject-head">
                        <div class="catalog-subject-title">
                            <div class="route-small-icon">
                                <img src="images/CatalogA.png" alt="">
                            </div>
                            <h2>Mathematics</h2>
                        </div>
                        <span class="route-count">2 materials</span>
                    </div>

                    <div class="catalog-grid">
                        <article class="catalog-card" data-catalog="algebra mathematics">
                            <div class="catalog-card-top">
                                <div class="catalog-card-icon">
                                    <img src="images/CatalogA.png" alt="">
                                </div>
                                <div>
                                    <div class="catalog-label">Mathematics</div>
                                    <h3>Algebra Notes</h3>
                                </div>
                            </div>
                            <p>Algebra study notes and formulas.</p>
                            <a href="#" class="spa-black-button" onclick="event.preventDefault();">View Notes</a>
                        </article>

                        <article class="catalog-card" data-catalog="geometry mathematics">
                            <div class="catalog-card-top">
                                <div class="catalog-card-icon">
                                    <img src="images/CatalogA.png" alt="">
                                </div>
                                <div>
                                    <div class="catalog-label">Mathematics</div>
                                    <h3>Geometry Notes</h3>
                                </div>
                            </div>
                            <p>Geometry concepts and examples.</p>
                            <a href="#" class="spa-black-button" onclick="event.preventDefault();">View Notes</a>
                        </article>
                    </div>
                </section>

                <section class="catalog-subject">
                    <div class="catalog-subject-head">
                        <div class="catalog-subject-title">
                            <div class="route-small-icon">
                                <img src="images/CatalogA.png" alt="">
                            </div>
                            <h2>Science</h2>
                        </div>
                        <span class="route-count">2 materials</span>
                    </div>

                    <div class="catalog-grid">
                        <article class="catalog-card" data-catalog="biology science">
                            <div class="catalog-card-top">
                                <div class="catalog-card-icon">
                                    <img src="images/CatalogA.png" alt="">
                                </div>
                                <div>
                                    <div class="catalog-label">Science</div>
                                    <h3>Biology Notes</h3>
                                </div>
                            </div>
                            <p>Biology concepts and study materials.</p>
                            <a href="#" class="spa-black-button" onclick="event.preventDefault();">View Notes</a>
                        </article>

                        <article class="catalog-card" data-catalog="chemistry science">
                            <div class="catalog-card-top">
                                <div class="catalog-card-icon">
                                    <img src="images/CatalogA.png" alt="">
                                </div>
                                <div>
                                    <div class="catalog-label">Science</div>
                                    <h3>Chemistry Notes</h3>
                                </div>
                            </div>
                            <p>Chemistry formulas and concepts.</p>
                            <a href="#" class="spa-black-button" onclick="event.preventDefault();">View Notes</a>
                        </article>
                    </div>
                </section>
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
                    <a href="admin-classes.html" class="spa-black-button">Manage Schools & Classes</a>
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
                    <a href="admin-reminders.html" class="spa-black-button">Class Reminders</a>
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
        if (file === "catalog.html") return "catalog";
        if (file === "calendar.html") return "calendar";
        if (file === "reminders.html") return "reminders";
        if (file === "messages.html") return "messages";
        if (file === "chat.html") return "chat";
        if (file === "profile.html") return "profile";
        if (file === "edit-profile.html") return "editProfile";
        if (file === "admin-reminders.html") return "adminReminders";
        if (file === "admin-classes.html") return "adminClasses";

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
        else if (
            route === "adminReminders" ||
            route === "adminClasses"
        ) {
            activePage =
                "reminders";
        }
        else if (
            route === "profile" ||
            route === "editProfile"
        ) {
            activePage =
                "";
        }


        document
            .querySelectorAll("#dashboard .sidebar-link")
            .forEach(function (link) {

                const page =
                    String(
                        link.dataset.page ||
                        ""
                    );


                link.classList.toggle(
                    "active",
                    page === activePage
                );

            });

    }

    function cleanupRoute(route) {
        try {
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

            if (route === "adminReminders" && window.TuklassAdminReminders) {
                window.TuklassAdminReminders.cleanup();
            }

            if (route === "adminClasses" && window.TuklassAdminClasses) {
                window.TuklassAdminClasses.cleanup();
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
        if (route === "catalog") {
            initCatalog();
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

        if (route === "adminReminders" && window.TuklassAdminReminders) {
            window.TuklassAdminReminders.init();
            return;
        }

        if (route === "adminClasses" && window.TuklassAdminClasses) {
            window.TuklassAdminClasses.init();
        }
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
