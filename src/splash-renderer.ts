/**
 * Splash Screen Renderer
 * Renders splash screens for setup, player selection, countdown, and buzz winner states
 */

import { createCanvas } from "@napi-rs/canvas";
import { GamePhase, Player } from "./game-state-manager";

export class SplashRenderer {
    private static readonly BUTTON_SIZE = 144;
    private static readonly DIAL_WIDTH = 200;
    private static readonly DIAL_HEIGHT = 100;

    /**
     * Render setup splash screen ("X out of 12")
     */
    static renderSetupSplash(isButton: boolean, instanceCount: number): string {
        const canvas = createCanvas(
            isButton ? this.BUTTON_SIZE : this.DIAL_WIDTH,
            isButton ? this.BUTTON_SIZE : this.DIAL_HEIGHT
        );

        const ctx = canvas.getContext("2d");

        // Background
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Title
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Set Matching', canvas.width / 2, canvas.height / 2 - 20);
        ctx.fillText('Game', canvas.width / 2, canvas.height / 2 - 5);

        // Count
        ctx.fillStyle = '#00FF00';
        ctx.font = 'bold 32px Arial';
        ctx.fillText(`${instanceCount}/12`, canvas.width / 2, canvas.height / 2 + 25);

        // Need more message
        if (instanceCount < 12) {
            ctx.fillStyle = '#FF9933';
            ctx.font = '10px Arial';
            ctx.fillText(`Need ${12 - instanceCount} more`, canvas.width / 2, canvas.height / 2 + 50);
        }

        return canvas.toDataURL("image/png");
    }

    /**
     * Render player selection button (colored player button)
     */
    static renderPlayerButton(
        isButton: boolean,
        player: Player,
        isSelected: boolean
    ): string {
        const canvas = createCanvas(
            isButton ? this.BUTTON_SIZE : this.DIAL_WIDTH,
            isButton ? this.BUTTON_SIZE : this.DIAL_HEIGHT
        );

        const ctx = canvas.getContext("2d");

        // Background in player color
        ctx.fillStyle = player.color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Player name
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(player.name, canvas.width / 2, canvas.height / 2 - 10);

        // Click to swap text
        ctx.font = '10px Arial';
        ctx.fillText('Click to swap', canvas.width / 2, canvas.height / 2 + 15);

        // Selection highlight
        if (isSelected) {
            ctx.strokeStyle = '#FFFF00';
            ctx.lineWidth = 6;
            ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
        }

        return canvas.toDataURL("image/png");
    }

    /**
     * Render black card for player selection (non-player positions)
     */
    static renderBlackCard(isButton: boolean): string {
        const canvas = createCanvas(
            isButton ? this.BUTTON_SIZE : this.DIAL_WIDTH,
            isButton ? this.BUTTON_SIZE : this.DIAL_HEIGHT
        );

        const ctx = canvas.getContext("2d");

        // Black background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Subtle border
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);

        return canvas.toDataURL("image/png");
    }

    /**
     * Render "Start Game" button (center button in player selection)
     */
    static renderStartButton(isButton: boolean): string {
        const canvas = createCanvas(
            isButton ? this.BUTTON_SIZE : this.DIAL_WIDTH,
            isButton ? this.BUTTON_SIZE : this.DIAL_HEIGHT
        );

        const ctx = canvas.getContext("2d");

        // Green background
        ctx.fillStyle = '#00AA00';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('START', canvas.width / 2, canvas.height / 2 - 10);
        ctx.fillText('GAME', canvas.width / 2, canvas.height / 2 + 10);

        // Glow border
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

        return canvas.toDataURL("image/png");
    }

    /**
     * Render countdown screen with rules
     */
    static renderCountdown(isButton: boolean, timeRemaining: number, cardIndex: number): string {
        const canvas = createCanvas(
            isButton ? this.BUTTON_SIZE : this.DIAL_WIDTH,
            isButton ? this.BUTTON_SIZE : this.DIAL_HEIGHT
        );

        const ctx = canvas.getContext("2d");

        // Background
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Countdown number (center cards show countdown)
        if (cardIndex >= 4 && cardIndex <= 7) {
            ctx.fillStyle = '#FFFF00';
            ctx.font = 'bold 72px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(Math.ceil(timeRemaining).toString(), canvas.width / 2, canvas.height / 2);
        } else {
            // Other cards show rules snippets
            ctx.fillStyle = '#CCCCCC';
            ctx.font = '11px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const rules = [
                ['Find 3 cards', 'that form', 'a Set'],
                ['Each property:', 'All SAME or', 'All DIFFERENT'],
                ['Shape, Color,', 'Count, Fill', 'must match'],
                ['Race to find', 'Sets before', 'opponents!'],
                ['Valid Set =', '✓ Point', 'Invalid = ✗'],
                ['Buzz in to', 'lock others', 'out!'],
                ['Release buzz', 'to start', 'timer'],
                ['Select 3', 'cards before', 'timeout']
            ];

            const ruleIndex = cardIndex % rules.length;
            const lines = rules[ruleIndex];

            lines.forEach((line, i) => {
                ctx.fillText(line, canvas.width / 2, canvas.height / 2 + (i - 1) * 15);
            });
        }

        return canvas.toDataURL("image/png");
    }

    /**
     * Render buzz winner display (big player color)
     */
    static renderBuzzWinner(isButton: boolean, player: Player, timeRemaining?: number): string {
        const canvas = createCanvas(
            isButton ? this.BUTTON_SIZE : this.DIAL_WIDTH,
            isButton ? this.BUTTON_SIZE : this.DIAL_HEIGHT
        );

        const ctx = canvas.getContext("2d");

        // Player color background
        ctx.fillStyle = player.color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Player name
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(player.name, canvas.width / 2, canvas.height / 2 - 15);

        // Timer if provided (buzz hold or selection timer)
        if (timeRemaining !== undefined) {
            ctx.font = 'bold 48px Arial';
            ctx.fillText(Math.ceil(timeRemaining).toString(), canvas.width / 2, canvas.height / 2 + 25);
        }

        // Pulsing border
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);

        return canvas.toDataURL("image/png");
    }

    /**
     * Render black-out screen (when buzzer is held)
     */
    static renderBlackOut(isButton: boolean): string {
        const canvas = createCanvas(
            isButton ? this.BUTTON_SIZE : this.DIAL_WIDTH,
            isButton ? this.BUTTON_SIZE : this.DIAL_HEIGHT
        );

        const ctx = canvas.getContext("2d");

        // Pure black
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        return canvas.toDataURL("image/png");
    }
}
