/**
 * Theme System for Set Card Game
 * Supports configurable properties and symbols for different themes
 */

export interface ThemeProperty {
    name: string;
    values: string[];
}

export interface Theme {
    id: string;
    name: string;
    properties: [ThemeProperty, ThemeProperty, ThemeProperty, ThemeProperty];
}

export interface Card {
    id: number;
    properties: [number, number, number, number]; // Indices into theme property values
}

export class ThemeSystem {
    private static readonly CLASSIC_THEME: Theme = {
        id: 'classic',
        name: 'Classic Set',
        properties: [
            { name: 'shape', values: ['diamond', 'oval', 'squiggle'] },
            { name: 'color', values: ['red', 'green', 'purple'] },
            { name: 'count', values: ['1', '2', '3'] },
            { name: 'fill', values: ['solid', 'striped', 'empty'] }
        ]
    };

    private static readonly THEMES: Map<string, Theme> = new Map([
        ['classic', ThemeSystem.CLASSIC_THEME]
    ]);

    /**
     * Get a theme by ID
     */
    static getTheme(themeId: string): Theme {
        return ThemeSystem.THEMES.get(themeId) || ThemeSystem.CLASSIC_THEME;
    }

    /**
     * Generate all 81 cards for a given theme
     */
    static generateDeck(themeId: string = 'classic'): Card[] {
        const cards: Card[] = [];
        let id = 0;

        // Generate all combinations (3^4 = 81 cards)
        for (let p0 = 0; p0 < 3; p0++) {
            for (let p1 = 0; p1 < 3; p1++) {
                for (let p2 = 0; p2 < 3; p2++) {
                    for (let p3 = 0; p3 < 3; p3++) {
                        cards.push({
                            id: id++,
                            properties: [p0, p1, p2, p3]
                        });
                    }
                }
            }
        }

        return cards;
    }

    /**
     * Validate if three cards form a valid Set
     * A valid set has all properties either all same or all different
     */
    static isValidSet(card1: Card, card2: Card, card3: Card): boolean {
        for (let propIndex = 0; propIndex < 4; propIndex++) {
            const p1 = card1.properties[propIndex];
            const p2 = card2.properties[propIndex];
            const p3 = card3.properties[propIndex];

            // All same or all different
            const allSame = (p1 === p2 && p2 === p3);
            const allDifferent = (p1 !== p2 && p2 !== p3 && p1 !== p3);

            if (!allSame && !allDifferent) {
                return false;
            }
        }

        return true;
    }

    /**
     * Get a human-readable description of a card
     */
    static describeCard(card: Card, theme: Theme): string {
        return theme.properties
            .map((prop, index) => prop.values[card.properties[index]])
            .join(' ');
    }

    /**
     * Shuffle an array (Fisher-Yates algorithm)
     */
    static shuffle<T>(array: T[]): T[] {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
}
