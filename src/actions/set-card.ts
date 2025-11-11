/**
 * Set Card Action
 * Main action for displaying and interacting with Set cards
 */

import streamDeck, {
    action,
    DialDownEvent,
    DialUpEvent,
    KeyDownEvent,
    KeyUpEvent,
    SingletonAction,
    WillAppearEvent,
    WillDisappearEvent,
    DidReceiveSettingsEvent
} from "@elgato/streamdeck";

import { GameStateManager, GameState } from "../game-state-manager";
import { CardRenderer } from "../card-renderer";
import { ThemeSystem } from "../theme-system";

type SetCardSettings = {
    cardIndex?: number; // Which of the 12 cards this displays (0-11)
    isBuzzer?: boolean; // Is this a buzzer button?
    playerId?: number; // If buzzer, which player? (1-4)
};

@action({ UUID: "com.jw.set-matching-game-solo--multiplayer.card" })
export class SetCardAction extends SingletonAction<SetCardSettings> {
    private gameManager = GameStateManager.getInstance();
    private unwatchFunctions = new Map<string, () => void>();
    private updateTimers = new Map<string, NodeJS.Timeout>();
    private buttonStates = new Map<string, boolean>(); // Track if button is pressed

    /**
     * Handle button/dial appearing
     */
    override async onWillAppear(ev: WillAppearEvent<SetCardSettings>): Promise<void> {
        const { action, payload } = ev;
        streamDeck.logger.info(`Card action appeared: ${action.id}`);

        const settings = payload.settings;

        // Set default settings if not present
        settings.cardIndex ??= 0;
        settings.isBuzzer ??= false;

        await action.setSettings(settings);

        // Register this card with game manager
        if (!settings.isBuzzer) {
            this.gameManager.registerCard(action.id, settings.cardIndex);
        } else if (settings.playerId) {
            this.gameManager.registerBuzzer(action.id, settings.playerId);
        }

        // Watch for game state changes
        const unwatch = this.gameManager.watch((state) => {
            this.updateDisplay(action.id, settings, state);
        });
        this.unwatchFunctions.set(action.id, unwatch);

        // Initial render
        this.updateDisplay(action.id, settings, this.gameManager.getState());

        // Start periodic timer check (for selection timeout)
        this.startTimerCheck(action.id);
    }

    /**
     * Handle button/dial disappearing
     */
    override async onWillDisappear(ev: WillDisappearEvent<SetCardSettings>): Promise<void> {
        const { action } = ev;
        streamDeck.logger.info(`Card action disappeared: ${action.id}`);

        // Clean up watcher
        const unwatch = this.unwatchFunctions.get(action.id);
        if (unwatch) {
            unwatch();
            this.unwatchFunctions.delete(action.id);
        }

        // Clean up timer
        const timer = this.updateTimers.get(action.id);
        if (timer) {
            clearInterval(timer);
            this.updateTimers.delete(action.id);
        }

        // Clean up button state
        this.buttonStates.delete(action.id);
    }

    /**
     * Handle settings change
     */
    override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<SetCardSettings>): Promise<void> {
        const { action, payload } = ev;
        const settings = payload.settings;
        streamDeck.logger.info(`Settings changed for ${action.id}: ${JSON.stringify(settings)}`);

        // Re-register with game manager
        if (!settings.isBuzzer) {
            this.gameManager.registerCard(action.id, settings.cardIndex ?? 0);
        } else if (settings.playerId) {
            this.gameManager.registerBuzzer(action.id, settings.playerId);
        }

        // Update display
        this.updateDisplay(action.id, settings, this.gameManager.getState());
    }

    /**
     * Handle key/dial press down
     */
    override async onKeyDown(ev: KeyDownEvent<SetCardSettings>): Promise<void> {
        const settings = ev.payload.settings;
        await this.handlePress(ev.action.id, settings, true);
    }

    override async onDialDown(ev: DialDownEvent<SetCardSettings>): Promise<void> {
        const settings = ev.payload.settings;
        await this.handlePress(ev.action.id, settings, false);
    }

    /**
     * Handle key/dial press up (release)
     */
    override async onKeyUp(ev: KeyUpEvent<SetCardSettings>): Promise<void> {
        const settings = ev.payload.settings;
        await this.handleRelease(ev.action.id, settings);
    }

    override async onDialUp(ev: DialUpEvent<SetCardSettings>): Promise<void> {
        const settings = ev.payload.settings;
        await this.handleRelease(ev.action.id, settings);
    }

    /**
     * Handle button press
     */
    private async handlePress(actionId: string, settings: SetCardSettings, isButton: boolean): Promise<void> {
        this.buttonStates.set(actionId, true);
        const state = this.gameManager.getState();

        if (settings.isBuzzer && settings.playerId) {
            // This is a buzzer button
            if (state.gamePhase === 'live') {
                const success = this.gameManager.buzzIn(settings.playerId);
                if (success) {
                    streamDeck.logger.info(`Player ${settings.playerId} buzzed in successfully`);
                }
            } else if (state.gamePhase === 'selecting' && state.buzzedInPlayer === settings.playerId) {
                // Player pressed their buzzer again during selection - treat as card selection
                this.gameManager.selectCard(settings.cardIndex ?? 0);
            }
        } else {
            // This is a card button
            if (state.gamePhase === 'selecting') {
                this.gameManager.selectCard(settings.cardIndex ?? 0);
            }
        }
    }

    /**
     * Handle button release
     */
    private async handleRelease(actionId: string, settings: SetCardSettings): Promise<void> {
        const wasPressed = this.buttonStates.get(actionId);
        this.buttonStates.set(actionId, false);

        const state = this.gameManager.getState();

        // If this was a buzzer that just got released during "buzzed" phase, start timer
        if (settings.isBuzzer && settings.playerId && wasPressed) {
            if (state.gamePhase === 'buzzed' && state.buzzedInPlayer === settings.playerId) {
                this.gameManager.startSelectionTimer();
                streamDeck.logger.info(`Selection timer started for player ${settings.playerId}`);
            }
        }
    }

    /**
     * Start periodic timer check for selection timeout
     */
    private startTimerCheck(actionId: string): void {
        const timer = setInterval(() => {
            const state = this.gameManager.getState();
            if (state.gamePhase === 'selecting' && this.gameManager.isSelectionTimedOut()) {
                streamDeck.logger.info('Selection timed out');
                this.gameManager.handleTimeout();
            }
        }, 100); // Check every 100ms

        this.updateTimers.set(actionId, timer);
    }

    /**
     * Update the display for this action
     */
    private async updateDisplay(actionId: string, settings: SetCardSettings, state: GameState): Promise<void> {
        const action = streamDeck.actions.getActionById(actionId);
        if (!action) return;

        // Assume button by default (most common), can be refined later
        const isButton = true;
        const theme = ThemeSystem.getTheme(state.themeId);

        // Determine if this button should show score corners
        let showScoreCorners = false;
        let successfulSets = 0;
        let unsuccessfulSets = 0;
        let playerColor: string | undefined;

        if (settings.isBuzzer && settings.playerId) {
            const player = this.gameManager.getPlayer(settings.playerId);
            if (player) {
                showScoreCorners = true;
                successfulSets = player.successfulSets;
                unsuccessfulSets = player.unsuccessfulSets;
                playerColor = player.color;
            }
        } else if (state.playerCount === 1 && ((settings.cardIndex ?? 0) === 0 || (settings.cardIndex ?? 0) === 1)) {
            // Solo mode: show score on first two cards
            const player = state.players[0];
            showScoreCorners = true;
            successfulSets = player.successfulSets;
            unsuccessfulSets = player.unsuccessfulSets;
        }

        // Get the card to display
        const card = this.gameManager.getCard(settings.cardIndex ?? 0);
        if (!card) {
            // No card available
            const imageData = CardRenderer.renderPlaceholder(isButton, 'No Card');
            await action.setImage(imageData);
            return;
        }

        // Check if this card is selected
        const isSelected = this.gameManager.isCardSelected(settings.cardIndex ?? 0);

        // Render the card
        const imageData = CardRenderer.renderCard(card, theme, {
            isButton,
            isSelected,
            showScoreCorners,
            successfulSets,
            unsuccessfulSets,
            gamePhase: state.gamePhase,
            playerColor
        });

        await action.setImage(imageData);
    }
}
