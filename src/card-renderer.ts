/**
 * Card Renderer
 * Renders Set cards to canvas for Stream Deck buttons and dials
 */

import { createCanvas } from "@napi-rs/canvas";
import { Card, Theme, ThemeSystem } from "./theme-system";
import { GamePhase } from "./game-state-manager";

export interface RenderOptions {
    isButton: boolean; // true for button (square), false for dial (wider aspect)
    isSelected: boolean;
    showScoreCorners?: boolean;
    successfulSets?: number;
    unsuccessfulSets?: number;
    gamePhase?: GamePhase;
    playerColor?: string;
}

export class CardRenderer {
    private static readonly BUTTON_SIZE = 144;
    private static readonly DIAL_WIDTH = 200;
    private static readonly DIAL_HEIGHT = 100;

    /**
     * Render a card to a canvas
     */
    static renderCard(card: Card, theme: Theme, options: RenderOptions): string {
        const { isButton } = options;
        const canvas = createCanvas(
            isButton ? CardRenderer.BUTTON_SIZE : CardRenderer.DIAL_WIDTH,
            isButton ? CardRenderer.BUTTON_SIZE : CardRenderer.DIAL_HEIGHT
        );

        const ctx = canvas.getContext("2d");

        // Background
        this.drawBackground(ctx, canvas, options);

        // Draw the card symbols
        this.drawCardSymbols(ctx, canvas, card, theme, isButton);

        // Draw score corners if needed
        if (options.showScoreCorners) {
            this.drawScoreCorners(ctx, canvas, options);
        }

        // Draw selection highlight
        if (options.isSelected) {
            this.drawSelectionHighlight(ctx, canvas, options.playerColor);
        }

        // Draw live game indicator border
        if (options.gamePhase === 'live') {
            this.drawLiveBorder(ctx, canvas);
        }

        return canvas.toDataURL("image/png");
    }

    /**
     * Draw background
     */
    private static drawBackground(ctx: any, canvas: any, options: RenderOptions): void {
        // Dark background
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Card area with slight lighter background
        ctx.fillStyle = '#2a2a2a';
        const margin = 4;
        ctx.fillRect(margin, margin, canvas.width - margin * 2, canvas.height - margin * 2);
    }

    /**
     * Draw card symbols based on properties
     */
    private static drawCardSymbols(
        ctx: any,
        canvas: any,
        card: Card,
        theme: Theme,
        isButton: boolean
    ): void {
        const [shapeIndex, colorIndex, countIndex, fillIndex] = card.properties;

        // Get property values
        const shape = theme.properties[0].values[shapeIndex];
        const colorName = theme.properties[1].values[colorIndex];
        const count = parseInt(theme.properties[2].values[countIndex]);
        const fill = theme.properties[3].values[fillIndex];

        // Get actual color
        const color = this.getColor(colorName);

        // Calculate layout
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const symbolWidth = isButton ? 30 : 40;
        const symbolHeight = isButton ? 50 : 40;
        const spacing = 10;

        // Draw symbols based on count
        const startY = count === 1
            ? centerY - symbolHeight / 2
            : count === 2
                ? centerY - symbolHeight - spacing / 2
                : centerY - symbolHeight - spacing - symbolHeight / 2;

        for (let i = 0; i < count; i++) {
            const y = startY + i * (symbolHeight + spacing);
            this.drawSymbol(ctx, centerX, y, symbolWidth, symbolHeight, shape, color, fill);
        }
    }

    /**
     * Draw a single symbol
     */
    private static drawSymbol(
        ctx: any,
        x: number,
        y: number,
        width: number,
        height: number,
        shape: string,
        color: string,
        fill: string
    ): void {
        ctx.save();
        ctx.translate(x, y);

        // Set up styling based on fill
        if (fill === 'solid') {
            ctx.fillStyle = color;
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
        } else if (fill === 'striped') {
            ctx.fillStyle = 'transparent';
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
        } else { // empty
            ctx.fillStyle = 'transparent';
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
        }

        // Draw shape
        ctx.beginPath();
        if (shape === 'diamond') {
            this.drawDiamond(ctx, width, height);
        } else if (shape === 'oval') {
            this.drawOval(ctx, width, height);
        } else if (shape === 'squiggle') {
            this.drawSquiggle(ctx, width, height);
        }

        // Fill and stroke
        if (fill === 'solid') {
            ctx.fill();
        } else if (fill === 'striped') {
            ctx.stroke();
            // Draw stripes
            this.drawStripes(ctx, width, height, color);
        } else { // empty
            ctx.stroke();
        }

        ctx.restore();
    }

    /**
     * Draw diamond shape
     */
    private static drawDiamond(ctx: any, width: number, height: number): void {
        ctx.moveTo(0, -height / 2);
        ctx.lineTo(width / 2, 0);
        ctx.lineTo(0, height / 2);
        ctx.lineTo(-width / 2, 0);
        ctx.closePath();
    }

    /**
     * Draw oval shape
     */
    private static drawOval(ctx: any, width: number, height: number): void {
        ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
    }

    /**
     * Draw squiggle shape (simplified as a wavy rectangle)
     */
    private static drawSquiggle(ctx: any, width: number, height: number): void {
        const w = width / 2;
        const h = height / 2;

        ctx.moveTo(-w, -h);
        ctx.bezierCurveTo(-w / 2, -h * 1.2, w / 2, -h * 0.8, w, -h);
        ctx.lineTo(w, h);
        ctx.bezierCurveTo(w / 2, h * 1.2, -w / 2, h * 0.8, -w, h);
        ctx.closePath();
    }

    /**
     * Draw stripes inside a shape
     */
    private static drawStripes(ctx: any, width: number, height: number, color: string): void {
        ctx.save();
        ctx.clip(); // Clip to the current path

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;

        for (let i = -width; i < width; i += 5) {
            ctx.beginPath();
            ctx.moveTo(i, -height / 2);
            ctx.lineTo(i, height / 2);
            ctx.stroke();
        }

        ctx.restore();
    }

    /**
     * Get RGB color from color name
     */
    private static getColor(colorName: string): string {
        const colors: { [key: string]: string } = {
            'red': '#FF3333',
            'green': '#33FF33',
            'purple': '#CC33FF',
            'blue': '#3333FF',
            'yellow': '#FFFF33',
            'orange': '#FF9933'
        };

        return colors[colorName] || '#FFFFFF';
    }

    /**
     * Draw score corners
     */
    private static drawScoreCorners(
        ctx: any,
        canvas: any,
        options: RenderOptions
    ): void {
        const { successfulSets = 0, unsuccessfulSets = 0 } = options;

        ctx.font = 'bold 16px Arial';

        // Top-left: Successful sets (green)
        ctx.fillStyle = '#33FF33';
        ctx.fillText(`✓${successfulSets}`, 8, 20);

        // Top-right: Unsuccessful sets (red)
        ctx.fillStyle = '#FF3333';
        const text = `✗${unsuccessfulSets}`;
        const metrics = ctx.measureText(text);
        ctx.fillText(text, canvas.width - metrics.width - 8, 20);
    }

    /**
     * Draw selection highlight
     */
    private static drawSelectionHighlight(
        ctx: any,
        canvas: any,
        playerColor?: string
    ): void {
        const color = playerColor || '#FFFF00';
        ctx.strokeStyle = color;
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
    }

    /**
     * Draw live game border (pulsing green border)
     */
    private static drawLiveBorder(ctx: any, canvas: any): void {
        // Simple green border for now (could be animated in the future)
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 3;
        ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
    }

    /**
     * Render empty/placeholder card
     */
    static renderPlaceholder(isButton: boolean, text: string = 'Empty'): string {
        const canvas = createCanvas(
            isButton ? CardRenderer.BUTTON_SIZE : CardRenderer.DIAL_WIDTH,
            isButton ? CardRenderer.BUTTON_SIZE : CardRenderer.DIAL_HEIGHT
        );

        const ctx = canvas.getContext("2d");

        // Background
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Text
        ctx.fillStyle = '#666666';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);

        return canvas.toDataURL("image/png");
    }
}
