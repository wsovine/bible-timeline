/**
 * Timeline Renderer - Handles year and era display for continuous scroll
 */

import { formatYearParts, getEraForYear, getDisplayDate, CURRENT_YEAR, ERAS, MILESTONES } from './data-loader.js';

export class TimelineRenderer {
    constructor(options = {}) {
        // Elements
        this.yearNumber = document.querySelector('.year-number');
        this.yearSuffix = document.querySelector('.year-suffix');
        this.eraText = document.querySelector('.era-text');
        this.timelineDot = document.querySelector('.timeline-dot');
        this.timelineTrack = document.querySelector('.timeline-track');
        this.youAreHereMarker = document.querySelector('.timeline-you-are-here');
        this.eraContainer = document.getElementById('timeline-eras');

        // State
        this.currentYear = null;
        this.currentEra = null;
        this.isHighlighted = false;
        this.youAreHereVisible = false;

        // Year range for dot positioning
        this.minYear = -4000;
        this.maxYear = CURRENT_YEAR;

        // Tick marks for book start dates
        this.ticks = []; // Array of { year, element, visible }

        // Era dividers
        this.eraDividers = []; // Array of { era, year, element, visible }

        // Milestones (canonization events)
        this.milestones = []; // Array of { year, name, element, visible }

        // Track canonization level for tick glow effect
        this.canonizationLevel = 0;
        this.tickContainer = null;
    }

    /**
     * Set the year range for dot positioning
     * @param {number} minYear - Start year (e.g., -4000)
     * @param {number} maxYear - End year (e.g., 100)
     */
    setYearRange(minYear, maxYear) {
        this.minYear = minYear;
        this.maxYear = maxYear;
    }

    /**
     * Initialize tick marks for each book's start date
     * @param {Array} books - Array of book objects
     */
    initTicks(books) {
        if (!this.timelineTrack) return;

        // Create a container for ticks
        this.tickContainer = document.createElement('div');
        this.tickContainer.className = 'timeline-ticks';
        this.timelineTrack.appendChild(this.tickContainer);

        // Get unique start years and create ticks
        const startYears = new Map(); // year -> count of books starting

        books.forEach(book => {
            const date = getDisplayDate(book);
            if (date.start !== null) {
                const count = startYears.get(date.start) || 0;
                startYears.set(date.start, count + 1);
            }
        });

        // Create tick elements
        for (const [year, count] of startYears) {
            const tick = document.createElement('div');
            tick.className = 'timeline-tick';
            tick.dataset.year = year;

            // Position tick based on year
            const progress = (year - this.minYear) / (this.maxYear - this.minYear);
            const topPercent = 15 + Math.max(0, Math.min(1, progress)) * 70;
            tick.style.top = `${topPercent}%`;

            this.tickContainer.appendChild(tick);

            this.ticks.push({
                year,
                element: tick,
                visible: false
            });
        }

        // Sort ticks by year for efficient updates
        this.ticks.sort((a, b) => a.year - b.year);

        console.log(`Created ${this.ticks.length} timeline ticks`);
    }

    /**
     * Initialize era dividers along the timeline
     */
    initEraDividers() {
        if (!this.eraContainer) return;

        // Get all eras with valid start dates (skip WISDOM which has null)
        const erasWithDates = Object.values(ERAS)
            .filter(era => era.start !== null)
            .sort((a, b) => a.start - b.start);

        for (const era of erasWithDates) {
            const divider = document.createElement('div');
            divider.className = 'era-divider';
            divider.dataset.era = era.id;

            // Position based on era start year
            const progress = (era.start - this.minYear) / (this.maxYear - this.minYear);
            const topPercent = 15 + Math.max(0, Math.min(1, progress)) * 70;
            divider.style.top = `${topPercent}%`;

            // Create label (left side)
            const label = document.createElement('span');
            label.className = 'era-divider__label';
            label.textContent = era.name;
            divider.appendChild(label);

            // Create tick mark (right side, next to timeline)
            const tick = document.createElement('span');
            tick.className = 'era-divider__tick';
            divider.appendChild(tick);

            this.eraContainer.appendChild(divider);

            this.eraDividers.push({
                era,
                year: era.start,
                element: divider,
                visible: false
            });
        }

        console.log(`Created ${this.eraDividers.length} era dividers`);
    }

    /**
     * Update era divider visibility based on current year
     * Only shows the current era label to avoid overlap
     * @param {number} year - Current year
     */
    updateEraDividers(year) {
        // Find which era we're currently in
        const currentEra = getEraForYear(year);

        for (const divider of this.eraDividers) {
            // Show tick if we've passed this era's start year
            const tickVisible = year >= divider.year;
            // Show label only if this is the current era
            const labelVisible = currentEra && currentEra.id === divider.era.id;

            // Update tick visibility
            if (tickVisible) {
                divider.element.classList.add('tick-visible');
            } else {
                divider.element.classList.remove('tick-visible');
            }

            // Update label visibility
            if (labelVisible) {
                divider.element.classList.add('label-visible');
            } else {
                divider.element.classList.remove('label-visible');
            }

            // Overall visibility (for backwards compat)
            const shouldBeVisible = tickVisible;
            if (shouldBeVisible !== divider.visible) {
                divider.visible = shouldBeVisible;
                if (shouldBeVisible) {
                    divider.element.classList.add('visible');
                } else {
                    divider.element.classList.remove('visible');
                }
            }
        }
    }

    /**
     * Update tick visibility based on current year
     * Ticks appear when we reach their year, disappear when scrolling back
     * @param {number} year - Current year
     */
    updateTicks(year) {
        for (const tick of this.ticks) {
            const shouldBeVisible = year >= tick.year;

            if (shouldBeVisible !== tick.visible) {
                tick.visible = shouldBeVisible;
                if (shouldBeVisible) {
                    tick.element.classList.add('visible');
                } else {
                    tick.element.classList.remove('visible');
                }
            }
        }
    }

    /**
     * Initialize milestone markers along the timeline
     * Milestones are key events in Bible canonization history
     * Excludes large milestones (like Living Tradition) which only show as cards
     */
    initMilestones() {
        if (!this.eraContainer) return;

        // Filter out large milestones - they only appear as cards, not timeline markers
        const timelineMilestones = MILESTONES.filter(m => !m.isLargeMilestone);

        for (const milestone of timelineMilestones) {
            const marker = document.createElement('div');
            marker.className = 'milestone-marker';
            marker.dataset.year = milestone.year;

            // Position based on milestone year
            const progress = (milestone.year - this.minYear) / (this.maxYear - this.minYear);
            const topPercent = 15 + Math.max(0, Math.min(1, progress)) * 70;
            marker.style.top = `${topPercent}%`;

            // Create label
            const label = document.createElement('span');
            label.className = 'milestone-marker__label';
            label.textContent = milestone.name;
            marker.appendChild(label);

            // Create year badge
            const year = document.createElement('span');
            year.className = 'milestone-marker__year';
            year.textContent = `${milestone.year} AD`;
            marker.appendChild(year);

            this.eraContainer.appendChild(marker);

            this.milestones.push({
                year: milestone.year,
                name: milestone.name,
                description: milestone.description,
                element: marker,
                visible: false
            });
        }

        // Sort by year
        this.milestones.sort((a, b) => a.year - b.year);

        console.log(`Created ${this.milestones.length} milestone markers`);
    }

    /**
     * Update milestone visibility based on current year
     * Only shows the current milestone label (like eras), ticks remain visible once passed
     * When "You are here" appears, the last milestone label should hide
     * @param {number} year - Current year
     */
    updateMilestones(year) {
        // Check if "You are here" is visible (near present day)
        const youAreHereVisible = year >= (CURRENT_YEAR - 50);

        // Find which milestone we're currently at (the most recent one we've passed)
        let currentMilestone = null;
        for (const milestone of this.milestones) {
            if (year >= milestone.year) {
                currentMilestone = milestone;
            }
        }

        for (const milestone of this.milestones) {
            // Show tick if we've passed this milestone's year
            const tickVisible = year >= milestone.year;
            // Show label only if this is the current milestone AND "You are here" isn't showing
            const labelVisible = currentMilestone &&
                                 currentMilestone.year === milestone.year &&
                                 !youAreHereVisible;

            // Update tick visibility
            if (tickVisible) {
                milestone.element.classList.add('tick-visible');
            } else {
                milestone.element.classList.remove('tick-visible');
            }

            // Update label visibility
            if (labelVisible) {
                milestone.element.classList.add('label-visible');
            } else {
                milestone.element.classList.remove('label-visible');
            }

            // Track overall visibility state
            milestone.visible = tickVisible;
        }
    }

    /**
     * Update the canonization glow level on book ticks
     * Each milestone passed increases the glow intensity
     * @param {number} year - Current year
     */
    updateCanonizationGlow(year) {
        if (!this.tickContainer) return;

        // Count how many canonization milestones we've passed
        // Only count the council milestones, not "Living Tradition"
        const canonMilestones = [382, 393, 397, 405, 1546];
        let newLevel = 0;
        for (const milestoneYear of canonMilestones) {
            if (year >= milestoneYear) {
                newLevel++;
            }
        }

        // Update if level changed
        if (newLevel !== this.canonizationLevel) {
            // Remove old level class
            this.tickContainer.classList.remove(`canon-level-${this.canonizationLevel}`);

            // Add new level class
            this.tickContainer.classList.add(`canon-level-${newLevel}`);

            // Trigger pulse animation on level increase
            if (newLevel > this.canonizationLevel) {
                this.tickContainer.classList.add('canon-pulse');
                setTimeout(() => {
                    this.tickContainer.classList.remove('canon-pulse');
                }, 600);
            }

            this.canonizationLevel = newLevel;
        }
    }

    /**
     * Initialize the renderer
     */
    init() {
        this.initEraDividers();
        this.initMilestones();
        console.log('TimelineRenderer initialized');
    }

    /**
     * Update the display for a given year
     * Called on every scroll frame
     * @param {number} year - The current year based on scroll position
     */
    update(year) {
        if (year === null || year === undefined) return;

        // Only update if year actually changed
        if (year !== this.currentYear) {
            this.updateYearDisplay(year);
            this.updateDotPosition(year);
            this.updateTicks(year);
            this.updateEraDividers(year);
            this.updateMilestones(year);
            this.updateCanonizationGlow(year);
            this.updateYouAreHere(year);
        }

        // Check if era changed
        const newEra = getEraForYear(year);
        if (!this.currentEra || newEra.id !== this.currentEra.id) {
            this.updateEraDisplay(newEra);
        }
    }

    /**
     * Update "You are here" marker visibility
     * Shows when the dot reaches the end of the timeline (near current year)
     * @param {number} year - Current year
     */
    updateYouAreHere(year) {
        if (!this.youAreHereMarker) return;

        // Show when we're near the end of the timeline (within 50 years of present)
        const shouldBeVisible = year >= (CURRENT_YEAR - 50);

        if (shouldBeVisible !== this.youAreHereVisible) {
            this.youAreHereVisible = shouldBeVisible;
            if (shouldBeVisible) {
                this.youAreHereMarker.classList.add('visible');
            } else {
                this.youAreHereMarker.classList.remove('visible');
            }
        }
    }

    /**
     * Update the dot position along the timeline
     * @param {number} year - Current year
     */
    updateDotPosition(year) {
        if (!this.timelineDot) return;

        // Calculate progress (0 at minYear, 1 at maxYear)
        const progress = (year - this.minYear) / (this.maxYear - this.minYear);
        const clampedProgress = Math.max(0, Math.min(1, progress));

        // Position dot along the line (15% to 85% of viewport height)
        // The line gradient fades at 10% and 90%, so we stay within visible range
        const topPercent = 15 + clampedProgress * 70;

        this.timelineDot.style.top = `${topPercent}%`;
    }

    /**
     * Update the year display
     * @param {number} year - Year to display
     */
    updateYearDisplay(year) {
        this.currentYear = year;
        const parts = formatYearParts(year);

        if (this.yearNumber) {
            this.yearNumber.textContent = parts.number;
        }
        if (this.yearSuffix) {
            this.yearSuffix.textContent = parts.suffix;
        }
    }

    /**
     * Update the era display
     * @param {Object} era - Era object with id and name
     */
    updateEraDisplay(era) {
        this.currentEra = era;
        if (this.eraText && era) {
            this.eraText.textContent = era.name;
        }
    }

    /**
     * Highlight the timeline (when books are visible)
     */
    highlight() {
        if (!this.isHighlighted) {
            document.body.classList.add('year-highlighted');
            this.isHighlighted = true;
        }
    }

    /**
     * Remove highlight (intro/outro states)
     */
    unhighlight() {
        if (this.isHighlighted) {
            document.body.classList.remove('year-highlighted');
            this.isHighlighted = false;
        }
    }

    /**
     * Get current year
     * @returns {number} Current year
     */
    getYear() {
        return this.currentYear;
    }

    /**
     * Get current era
     * @returns {Object} Current era
     */
    getEra() {
        return this.currentEra;
    }

    /**
     * Clean up
     */
    destroy() {
        this.unhighlight();
    }
}
