/**
 * Data Loader - Loads book data and handles timeline positioning
 */

const DATA_PATH = './data';

/**
 * Era definitions for biblical history
 */
// Current year for "You are here" feature (dynamic)
export const CURRENT_YEAR = new Date().getFullYear();

export const ERAS = {
    PRIMEVAL: { id: 'primeval', name: 'Primeval History', start: -4000, end: -2100 },
    PATRIARCHS: { id: 'patriarchs', name: 'Patriarchal Era', start: -2100, end: -1450 },
    EXODUS: { id: 'exodus', name: 'Exodus & Conquest', start: -1450, end: -1380 },
    JUDGES: { id: 'judges', name: 'Age of Judges', start: -1380, end: -1050 },
    UNITED_KINGDOM: { id: 'united-kingdom', name: 'United Kingdom', start: -1050, end: -930 },
    DIVIDED_KINGDOM: { id: 'divided-kingdom', name: 'Divided Kingdom', start: -930, end: -586 },
    EXILE: { id: 'exile', name: 'Babylonian Exile', start: -586, end: -538 },
    POST_EXILE: { id: 'post-exile', name: 'Post-Exile', start: -538, end: -400 },
    INTERTESTAMENTAL: { id: 'intertestamental', name: 'Intertestamental', start: -400, end: -5 },
    GOSPELS: { id: 'gospels', name: 'Life of Christ', start: -5, end: 33 },
    APOSTOLIC: { id: 'apostolic', name: 'Apostolic Age', start: 33, end: 100 },
    CHURCH_AGE: { id: 'church-age', name: 'Age of the Church', start: 100, end: CURRENT_YEAR + 1 },
    WISDOM: { id: 'wisdom', name: 'Wisdom Literature', start: null, end: null }
};

/**
 * Milestones for Bible canonization history
 * Each milestone has a display range (for scroll speed calculation)
 * The Living Tradition is treated as the first "milestone" spanning the early Church period
 */
export const MILESTONES = [
    {
        id: 'living-tradition',
        year: 100,  // Starts at beginning of Church Age
        name: 'The Living Tradition',
        description: 'Before these books were formally collected into the "Bible", their importance was preserved through Apostolic Tradition, the living teaching handed down from the Apostles.',
        displayStart: 96,
        displayEnd: 382,  // Ends when Council of Rome begins
        isLargeMilestone: true  // Flag for special styling
    },
    {
        id: 'rome-382',
        year: 382,
        name: 'Council of Rome',
        description: 'Pope Damasus I promulgates the 73-book canon',
        displayStart: 370,
        displayEnd: 393
    },
    {
        id: 'hippo-393',
        year: 393,
        name: 'Synod of Hippo',
        description: 'Augustine reaffirms the canon',
        displayStart: 388,
        displayEnd: 397
    },
    {
        id: 'carthage-397',
        year: 397,
        name: 'Council of Carthage',
        description: 'Formally accepts the Biblical canon',
        displayStart: 393,
        displayEnd: 405
    },
    {
        id: 'innocent-405',
        year: 405,
        name: 'Pope Innocent I',
        description: 'Sends authoritative canon list to Gaul',
        displayStart: 400,
        displayEnd: 500
    },
    {
        id: 'trent-1546',
        year: 1546,
        name: 'Council of Trent',
        description: 'Dogmatically defines the canon',
        displayStart: 1500,
        displayEnd: 1650
    }
];

/**
 * Messages that appear during specific time periods
 * (Currently empty - Living Tradition moved to milestones)
 */
export const MESSAGES = [];

/**
 * Load book metadata with dates
 */
export async function loadBooks() {
    const response = await fetch(`${DATA_PATH}/books.json`);
    if (!response.ok) {
        throw new Error(`Failed to load books.json: ${response.status}`);
    }
    return response.json();
}

/**
 * Get display date for a book (events date or writing date fallback)
 */
export function getDisplayDate(book) {
    if (book.dateEventsStart !== null) {
        return {
            start: book.dateEventsStart,
            end: book.dateEventsEnd,
            isWritingDate: false
        };
    }
    return {
        start: book.dateWrittenStart,
        end: book.dateWrittenEnd,
        isWritingDate: true
    };
}

/**
 * Get the era for a given year
 */
export function getEraForYear(year) {
    if (year === null) return ERAS.WISDOM;

    for (const era of Object.values(ERAS)) {
        if (era.start === null) continue;
        if (year >= era.start && year < era.end) {
            return era;
        }
    }

    if (year < -2100) return ERAS.PRIMEVAL;
    if (year >= 100) return ERAS.CHURCH_AGE;
    if (year >= 33) return ERAS.APOSTOLIC;
    return ERAS.WISDOM;
}

/**
 * Format year parts for display
 */
export function formatYearParts(year) {
    if (year === null || year === undefined) {
        return { number: '?', suffix: '' };
    }
    if (year < 0) {
        return { number: Math.abs(year).toString(), suffix: 'BC' };
    }
    if (year === 0) {
        return { number: '1', suffix: 'BC' };
    }
    return { number: year.toString(), suffix: 'AD' };
}

/**
 * Format a date range for display
 */
export function formatDateRange(start, end) {
    if (start === null && end === null) return 'Unknown';

    const formatYear = (y) => {
        const p = formatYearParts(y);
        return `${p.number} ${p.suffix}`.trim();
    };

    if (start === end || end === null) return formatYear(start);
    if (start === null) return formatYear(end);

    const startParts = formatYearParts(start);
    const endParts = formatYearParts(end);

    if (startParts.suffix === endParts.suffix) {
        return `${startParts.number}–${endParts.number} ${startParts.suffix}`;
    }

    return `${formatYear(start)} – ${formatYear(end)}`;
}

/**
 * Group books by overlapping time periods
 * Books are considered concurrent if their date ranges overlap significantly
 */
export function groupBooksByTime(books) {
    // Sort by start date first
    const sorted = [...books].sort((a, b) => {
        const dateA = getDisplayDate(a);
        const dateB = getDisplayDate(b);

        if (dateA.start === null && dateB.start === null) return 0;
        if (dateA.start === null) return 1;
        if (dateB.start === null) return -1;

        return dateA.start - dateB.start;
    });

    const groups = [];
    let currentGroup = null;

    sorted.forEach(book => {
        const date = getDisplayDate(book);

        // Books without dates go in their own group at the end
        if (date.start === null) {
            groups.push({
                books: [book],
                startDate: null,
                endDate: null,
                centerDate: null,
                era: ERAS.WISDOM
            });
            return;
        }

        const bookCenter = Math.round((date.start + date.end) / 2);

        // Check if this book overlaps with current group
        if (currentGroup && currentGroup.startDate !== null) {
            const groupCenter = currentGroup.centerDate;
            const overlap = Math.abs(bookCenter - groupCenter) < 50; // Within 50 years

            if (overlap && currentGroup.books.length < 4) {
                // Add to current group
                currentGroup.books.push(book);
                currentGroup.endDate = Math.max(currentGroup.endDate, date.end);
                currentGroup.centerDate = Math.round((currentGroup.startDate + currentGroup.endDate) / 2);
                return;
            }
        }

        // Start new group
        currentGroup = {
            books: [book],
            startDate: date.start,
            endDate: date.end,
            centerDate: bookCenter,
            era: getEraForYear(bookCenter)
        };
        groups.push(currentGroup);
    });

    // Sort books within each group by their center date (chronological order)
    groups.forEach(group => {
        if (group.books.length > 1) {
            group.books.sort((a, b) => {
                const dateA = getDisplayDate(a);
                const dateB = getDisplayDate(b);
                const centerA = dateA.start !== null ? (dateA.start + dateA.end) / 2 : Infinity;
                const centerB = dateB.start !== null ? (dateB.start + dateB.end) / 2 : Infinity;
                return centerA - centerB;
            });
        }
    });

    return groups;
}

/**
 * Calculate scroll positions for groups with gap compression
 * Returns array of groups with scrollPosition (0-1) added
 */
export function calculateScrollPositions(groups) {
    // Filter groups with dates
    const datedGroups = groups.filter(g => g.centerDate !== null);
    const undatedGroups = groups.filter(g => g.centerDate === null);

    if (datedGroups.length === 0) {
        return groups.map((g, i) => ({ ...g, scrollPosition: i / groups.length }));
    }

    // Find date range
    const minDate = Math.min(...datedGroups.map(g => g.startDate));
    const maxDate = Math.max(...datedGroups.map(g => g.endDate));
    const totalYears = maxDate - minDate;

    // Calculate positions with gap compression
    // We use sqrt to compress large gaps while preserving small ones
    const positions = [];
    let accumulatedPosition = 0;

    for (let i = 0; i < datedGroups.length; i++) {
        const group = datedGroups[i];

        if (i === 0) {
            positions.push({ ...group, scrollPosition: 0.05 }); // Start at 5%
            continue;
        }

        const prevGroup = datedGroups[i - 1];
        const gap = group.centerDate - prevGroup.centerDate;

        // Compress gaps: sqrt scaling
        // Small gaps (< 100 years) stay roughly linear
        // Large gaps (> 500 years) get compressed
        const normalizedGap = gap / totalYears;
        const compressedGap = Math.sqrt(Math.abs(normalizedGap)) * Math.sign(normalizedGap) * 0.5;

        accumulatedPosition += Math.max(0.02, compressedGap); // Minimum 2% spacing

        positions.push({
            ...group,
            scrollPosition: Math.min(0.85, 0.05 + accumulatedPosition) // Cap at 85%
        });
    }

    // Normalize positions to 0.05-0.85 range
    const maxPos = Math.max(...positions.map(p => p.scrollPosition));
    const scale = 0.8 / maxPos;

    positions.forEach(p => {
        p.scrollPosition = 0.05 + (p.scrollPosition - 0.05) * scale;
    });

    // Add undated groups at the end
    const undatedStart = 0.88;
    undatedGroups.forEach((g, i) => {
        positions.push({
            ...g,
            scrollPosition: undatedStart + (i * 0.03)
        });
    });

    return positions;
}

/**
 * Build a mapping from scroll position to year for continuous scrolling
 * Returns array of { scrollPosition, year } waypoints
 */
export function buildScrollToYearMap(groups) {
    const waypoints = [{ scrollPosition: 0, year: -4000 }];

    groups.forEach(group => {
        if (group.centerDate !== null) {
            waypoints.push({
                scrollPosition: group.scrollPosition,
                year: group.centerDate
            });
        }
    });

    // End waypoint
    waypoints.push({ scrollPosition: 1, year: 100 });

    // Sort by scroll position
    waypoints.sort((a, b) => a.scrollPosition - b.scrollPosition);

    return waypoints;
}

/**
 * Interpolate year from scroll position using waypoints
 */
export function interpolateYear(scrollPosition, waypoints) {
    if (waypoints.length === 0) return -4000;
    if (scrollPosition <= waypoints[0].scrollPosition) return waypoints[0].year;
    if (scrollPosition >= waypoints[waypoints.length - 1].scrollPosition) {
        return waypoints[waypoints.length - 1].year;
    }

    // Find surrounding waypoints
    for (let i = 0; i < waypoints.length - 1; i++) {
        const current = waypoints[i];
        const next = waypoints[i + 1];

        if (scrollPosition >= current.scrollPosition && scrollPosition <= next.scrollPosition) {
            // Linear interpolation between waypoints
            const t = (scrollPosition - current.scrollPosition) /
                      (next.scrollPosition - current.scrollPosition);
            return Math.round(current.year + t * (next.year - current.year));
        }
    }

    return waypoints[waypoints.length - 1].year;
}

/**
 * Build a continuous scroll-to-year mapping with gap compression
 * This is the core of the new architecture - maps scroll position (0-1) to year
 *
 * Features:
 * - Compresses large gaps (empty periods scroll faster)
 * - Slows down during "busy" periods with many active books
 * - Short-timespan books get more scroll time
 * - Includes milestones as additional waypoints with scroll weight
 *
 * @param {Array} books - Array of book objects with date properties
 * @param {Array} milestones - Optional array of milestone objects (defaults to MILESTONES)
 * @returns {Object} { scrollToYear, yearToScroll, minYear, maxYear, events }
 */
export function buildYearMapping(books, milestones = MILESTONES) {
    // Collect all date events (book starts and ends)
    const events = [];
    const bookRanges = []; // For calculating density
    const milestoneRanges = []; // For milestone density

    books.forEach(book => {
        const date = getDisplayDate(book);
        if (date.start !== null) {
            events.push({ year: date.start, type: 'start', bookId: book.id, book });
            events.push({ year: date.end, type: 'end', bookId: book.id, book });
            bookRanges.push({ start: date.start, end: date.end });
        }
    });

    // Add milestone events
    milestones.forEach(milestone => {
        events.push({ year: milestone.displayStart, type: 'milestone-start', milestoneId: milestone.id, milestone });
        events.push({ year: milestone.displayEnd, type: 'milestone-end', milestoneId: milestone.id, milestone });
        milestoneRanges.push({ start: milestone.displayStart, end: milestone.displayEnd, year: milestone.year });
    });

    // Sort events by year
    events.sort((a, b) => a.year - b.year);

    if (events.length === 0) {
        // No dated books - return identity mapping
        return {
            scrollToYear: (scroll) => Math.round(-4000 + scroll * 4100),
            yearToScroll: (year) => (year + 4000) / 4100,
            minYear: -4000,
            maxYear: 100,
            events: []
        };
    }

    const minYear = events[0].year;
    const lastBookYear = events[events.length - 1].year;
    // Extend timeline to present day
    const maxYear = CURRENT_YEAR;

    // Build compressed scroll positions for each unique year
    // Include current year as a waypoint for "You are here"
    const uniqueYears = [...new Set(events.map(e => e.year)), CURRENT_YEAR].sort((a, b) => a - b);

    /**
     * Get active books at a given year with their durations
     */
    function getActiveBooksInfo(year) {
        const active = bookRanges.filter(r => year >= r.start && year <= r.end);
        return {
            count: active.length,
            books: active,
            // Find shortest duration among active books
            minDuration: active.length > 0
                ? Math.min(...active.map(r => r.end - r.start))
                : Infinity
        };
    }

    /**
     * Get active milestones at a given year
     */
    function getActiveMilestonesInfo(year) {
        const active = milestoneRanges.filter(r => year >= r.start && year <= r.end);
        return {
            count: active.length,
            milestones: active
        };
    }

    // Calculate compressed positions with density and duration weighting
    const yearPositions = new Map();
    let accumulatedPosition = 0;

    for (let i = 0; i < uniqueYears.length; i++) {
        const year = uniqueYears[i];

        if (i === 0) {
            yearPositions.set(year, 0);
            continue;
        }

        const prevYear = uniqueYears[i - 1];
        const gap = year - prevYear;

        // Base compression: sqrt scaling for gaps
        let scrollWeight = Math.sqrt(Math.abs(gap));

        // Check activity at the midpoint of this gap
        const midYear = Math.round((prevYear + year) / 2);
        const activeInfo = getActiveBooksInfo(midYear);
        const activeMilestones = getActiveMilestonesInfo(midYear);

        if (activeInfo.count > 0) {
            // Density bonus: more active books = slower scroll
            // Base multiplier of 4x when any book is active
            // Additional 1.5x per active book
            let densityMultiplier = 4 + (activeInfo.count * 1.5);

            // Short book bonus: if shortest active book is < 100 years, slow down more
            // This ensures short books don't fly by
            if (activeInfo.minDuration < 100) {
                // Shorter duration = more slowdown (up to 4x extra for very short books)
                const durationBonus = Math.max(1, 4 - (activeInfo.minDuration / 33));
                densityMultiplier *= durationBonus;
            }

            scrollWeight *= densityMultiplier;
        } else if (activeMilestones.count > 0) {
            // Milestone bonus: slow down significantly for milestones (when no books are active)
            // This ensures milestones get proper attention in the post-biblical period
            // Use high multiplier since these are key historical events
            const milestoneMultiplier = 40 + (activeMilestones.count * 20);
            scrollWeight *= milestoneMultiplier;
        }

        accumulatedPosition += scrollWeight;
        yearPositions.set(year, accumulatedPosition);
    }

    // Normalize to 0-1 range (with small margins)
    const totalAccumulated = accumulatedPosition;
    const marginStart = 0.02; // 2% margin at start
    const marginEnd = 0.02;   // 2% margin at end
    const usableRange = 1 - marginStart - marginEnd;

    // Convert to normalized positions
    const normalizedPositions = new Map();
    for (const [year, pos] of yearPositions) {
        const normalized = marginStart + (pos / totalAccumulated) * usableRange;
        normalizedPositions.set(year, normalized);
    }

    // Build sorted array for interpolation
    const sortedYears = [...normalizedPositions.entries()]
        .sort((a, b) => a[1] - b[1]); // Sort by scroll position

    /**
     * Convert scroll position (0-1) to year
     */
    function scrollToYear(scrollPos) {
        // Clamp to valid range
        scrollPos = Math.max(0, Math.min(1, scrollPos));

        // Handle edge cases
        if (scrollPos <= sortedYears[0][1]) {
            return sortedYears[0][0];
        }
        if (scrollPos >= sortedYears[sortedYears.length - 1][1]) {
            return sortedYears[sortedYears.length - 1][0];
        }

        // Find surrounding years and interpolate
        for (let i = 0; i < sortedYears.length - 1; i++) {
            const [year1, pos1] = sortedYears[i];
            const [year2, pos2] = sortedYears[i + 1];

            if (scrollPos >= pos1 && scrollPos <= pos2) {
                // Linear interpolation between known years
                const t = (scrollPos - pos1) / (pos2 - pos1);
                return Math.round(year1 + t * (year2 - year1));
            }
        }

        return sortedYears[sortedYears.length - 1][0];
    }

    /**
     * Convert year to scroll position (0-1)
     */
    function yearToScroll(year) {
        // Exact match
        if (normalizedPositions.has(year)) {
            return normalizedPositions.get(year);
        }

        // Interpolate
        const sortedByYear = [...normalizedPositions.entries()]
            .sort((a, b) => a[0] - b[0]);

        // Handle edge cases
        if (year <= sortedByYear[0][0]) {
            return sortedByYear[0][1];
        }
        if (year >= sortedByYear[sortedByYear.length - 1][0]) {
            return sortedByYear[sortedByYear.length - 1][1];
        }

        // Find surrounding years
        for (let i = 0; i < sortedByYear.length - 1; i++) {
            const [year1, pos1] = sortedByYear[i];
            const [year2, pos2] = sortedByYear[i + 1];

            if (year >= year1 && year <= year2) {
                const t = (year - year1) / (year2 - year1);
                return pos1 + t * (pos2 - pos1);
            }
        }

        return sortedByYear[sortedByYear.length - 1][1];
    }

    return {
        scrollToYear,
        yearToScroll,
        minYear,
        maxYear,
        events,
        // Expose for debugging
        _yearPositions: normalizedPositions,
        _sortedYears: sortedYears
    };
}
