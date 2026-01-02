/**
 * Milestone Card Manager - Displays milestone cards in the book grid area
 *
 * Milestones stack vertically - when a new milestone enters, previous ones
 * slide up but remain visible, creating a growing stack of milestones.
 */

import { MILESTONES } from './data-loader.js';

// Animation constants
const LEAD_YEARS = 15;  // Years before milestone appears for slide-in animation
const CARD_HEIGHT = 160; // Approximate height of a card in pixels for stacking

export class MilestoneCardManager {
    /**
     * @param {HTMLElement} container - Container element for milestone cards (same as book grid)
     */
    constructor(container) {
        this.container = container;
        this.milestones = MILESTONES;

        // Track visible milestones in order: milestoneId → { element, milestone, index }
        this.visibleMilestones = new Map();

        // Order of milestones that have appeared (for stacking)
        this.milestoneOrder = [];

        this.currentYear = null;
    }

    /**
     * Update milestone card visibility for a given year
     * @param {number} year - Current year in timeline
     */
    updateForYear(year) {
        this.currentYear = year;

        // Check each milestone
        for (let i = 0; i < this.milestones.length; i++) {
            const milestone = this.milestones[i];
            const entryStart = milestone.year - LEAD_YEARS;
            const shouldBeVisible = year >= entryStart;
            const isCurrentlyVisible = this.visibleMilestones.has(milestone.id);

            if (shouldBeVisible && !isCurrentlyVisible) {
                this.addMilestoneCard(milestone, i);
            } else if (!shouldBeVisible && isCurrentlyVisible) {
                this.removeMilestoneCard(milestone.id);
            }
        }

        // Update positions of all visible cards (for stacking and entry animation)
        this.updateAllPositions(year);
    }

    /**
     * Update positions of all visible milestone cards
     * Cards stack from bottom to top as more milestones are reached
     * @param {number} year - Current year
     */
    updateAllPositions(year) {
        // Get milestones in chronological order
        const visibleList = Array.from(this.visibleMilestones.values())
            .sort((a, b) => a.milestone.year - b.milestone.year);

        const totalVisible = visibleList.length;

        visibleList.forEach((data, index) => {
            const { element, milestone } = data;
            const entryStart = milestone.year - LEAD_YEARS;

            // Calculate stack position (0 = bottom/newest, higher = older/higher up)
            const stackIndex = totalVisible - 1 - index;

            // Entry animation: slide in from bottom
            let entryProgress = 1;
            if (year < milestone.year) {
                entryProgress = Math.max(0, (year - entryStart) / LEAD_YEARS);
            }

            // Base offset for stacking (each card stacks above the previous)
            const stackOffset = stackIndex * CARD_HEIGHT;

            // Entry slide: comes from below
            const entryOffset = (1 - entryProgress) * CARD_HEIGHT;

            // Total vertical offset (negative = up)
            const totalOffset = -stackOffset + entryOffset;

            // Opacity: fade in during entry
            const opacity = Math.min(1, entryProgress * 1.5);

            // Scale down older cards slightly for visual hierarchy
            const scale = 1 - (stackIndex * 0.05);

            element.style.transform = `translateY(${totalOffset}px) scale(${Math.max(0.85, scale)})`;
            element.style.opacity = opacity;
            element.style.zIndex = totalVisible - stackIndex; // Newest on top
        });
    }

    /**
     * Add a milestone card to the display
     * @param {Object} milestone - Milestone object
     * @param {number} index - Index in milestones array
     */
    addMilestoneCard(milestone, index) {
        const element = this.createMilestoneCard(milestone);

        // Position in center of grid (span 2 columns)
        element.style.gridColumn = '2 / 4';
        element.style.gridRow = '2';

        this.container.appendChild(element);
        this.visibleMilestones.set(milestone.id, { element, milestone, index });
    }

    /**
     * Remove a milestone card from the display
     * @param {string} milestoneId - Milestone ID to remove
     */
    removeMilestoneCard(milestoneId) {
        const data = this.visibleMilestones.get(milestoneId);
        if (!data) return;

        data.element.remove();
        this.visibleMilestones.delete(milestoneId);
    }

    /**
     * Create a milestone card element
     * @param {Object} milestone - Milestone object
     * @returns {HTMLElement} Milestone card element
     */
    createMilestoneCard(milestone) {
        const card = document.createElement('div');
        card.className = 'milestone-card';
        card.dataset.milestoneId = milestone.id;

        // Large milestones (like Living Tradition) get special styling and no year badge
        if (milestone.isLargeMilestone) {
            card.classList.add('milestone-card--large');
            card.innerHTML = `
                <h3 class="milestone-card__title">${milestone.name}</h3>
                <p class="milestone-card__description">${milestone.description}</p>
            `;
        } else {
            card.innerHTML = `
                <div class="milestone-card__year">${milestone.year} AD</div>
                <h3 class="milestone-card__title">${milestone.name}</h3>
                <p class="milestone-card__description">${milestone.description}</p>
            `;
        }

        return card;
    }

    /**
     * Get count of visible milestone cards
     * @returns {number} Number of visible milestone cards
     */
    getVisibleCount() {
        return this.visibleMilestones.size;
    }

    /**
     * Clear all visible milestone cards
     */
    clear() {
        for (const [milestoneId] of this.visibleMilestones) {
            this.removeMilestoneCard(milestoneId);
        }
        this.currentYear = null;
    }
}
