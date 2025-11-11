/**
 * Set Card Action
 * Main action for displaying and interacting with Set cards
 * Features auto-configuration and enhanced setup flow
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
import { SplashRenderer } from "../splash-renderer";
import { ThemeSystem } from "../theme-system";

type SetCardSettings = {
    // Settings are minimal - auto-configured by game manager
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
        const { action } = ev;
        streamDeck.logger.info(`Card action appeared: ${action.id}`);

        // Register this instance with game manager (auto-assigns card index)
        this.gameManager.registerInstance(action.id);

        // Watch for game state changes
        const unwatch = this.gameManager.watch((state) => {
            this.updateDisplay(action.id, state);
        });
        this.unwatchFunctions.set(action.id, unwatch);

        // Initial render
        this.updateDisplay(action.id, this.gameManager.getState());

        // Start periodic timer check
        this.startTimerCheck(action.id);
    }

    /**
     * Handle button/dial disappearing
     */
    override async onWillDisappear(ev: WillDisappearEvent<SetCardSettings>): Promise<void> {
        const { action } = ev;
        streamDeck.logger.info(`Card action disappeared: ${action.id}`);

        // Unregister this instance
        this.gameManager.unregisterInstance(action.id);

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
     * Handle settings change (no-op since auto-configured)
     */
    override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<SetCardSettings>): Promise<void> {
        // Settings are auto-managed, just refresh display
        this.updateDisplay(ev.action.id, this.gameManager.getState());
    }

    /**
     * Handle key/dial press down
     */
    override async onKeyDown(ev: KeyDownEvent<SetCardSettings>): Promise<void> {
        await this.handlePress(ev.action.id);
    }

    override async onDialDown(ev: DialDownEvent<SetCardSettings>): Promise<void> {
        await this.handlePress(ev.action.id);
    }

    /**
     * Handle key/dial press up (release)
     */
    override async onKeyUp(ev: KeyUpEvent<SetCardSettings>): Promise<void> {
        await this.handleRelease(ev.action.id);
    }

    override async onDialUp(ev: DialUpEvent<SetCardSettings>): Promise<void> {
        await this.handleRelease(ev.action.id);
    }

    /**
     * Handle button press (context-sensitive based on game phase)
     */
    private async handlePress(actionId: string): Promise<void> {
        this.buttonStates.set(actionId, true);
        const state = this.gameManager.getState();
        const cardIndex = this.gameManager.getCardIndexForContext(actionId);

        switch (state.gamePhase) {
            case 'setup':
                // No interaction in setup
                break;

            case 'playerSelection':
                // Check if this is a player position
                const playerId = this.gameManager.getPlayerAtPosition(cardIndex);

                if (playerId !== null) {
                    // Clicked a player button - select for swap
                    this.gameManager.selectPlayerForSwap(playerId);
                } else if (cardIndex === 5 || cardIndex === 6) {
                    // Center buttons - start game
                    this.gameManager.startCountdown();
                } else {
                    // Clicked a black card - assign selected player here
                    this.gameManager.assignPlayerPosition(cardIndex);
                }
                break;

            case 'countdown':
                // No interaction during countdown
                break;

            case 'live':
                // Buzz in!
                const playerAtPos = this.gameManager.getPlayerAtPosition(cardIndex);
                if (playerAtPos !== null) {
                    this.gameManager.buzzIn(playerAtPos);
                }
                break;

            case 'buzzHeld':
                // Already buzzed, no action
                break;

            case 'buzzed':
                // Waiting for selection phase, no action
                break;

            case 'selecting':
                // Select this card for the set
                if (!this.gameManager.isPlayerPosition(cardIndex)) {
                    this.gameManager.selectCard(cardIndex);
                }
                break;

            case 'validating':
            case 'cooldown':
                // No interaction during validation/cooldown
                break;
        }
    }

    /**
     * Handle button release
     */
    private async handleRelease(actionId: string): Promise<void> {
        const wasPressed = this.buttonStates.get(actionId);
        this.buttonStates.set(actionId, false);

        const state = this.gameManager.getState();
        const cardIndex = this.gameManager.getCardIndexForContext(actionId);

        // If this is a player position and buzzer was held, release it
        if (state.gamePhase === 'buzzHeld' && wasPressed) {
            const playerId = this.gameManager.getPlayerAtPosition(cardIndex);
            if (playerId === state.buzzedInPlayer) {
                this.gameManager.startSelectionTimer();
            }
        }
    }

    /**
     * Start periodic timer check
     */
    private startTimerCheck(actionId: string): void {
        const timer = setInterval(() => {
            const state = this.gameManager.getState();

            // Check buzz hold timeout
            if (state.gamePhase === 'buzzHeld' && this.gameManager.isBuzzHoldTimedOut()) {
                streamDeck.logger.info('Buzz hold timed out');
                this.gameManager.handleBuzzHoldTimeout();
            }

            // Check selection timeout
            if (state.gamePhase === 'selecting' && this.gameManager.isSelectionTimedOut()) {
                streamDeck.logger.info('Selection timed out');
                this.gameManager.handleTimeout();
            }
        }, 100); // Check every 100ms

        this.updateTimers.set(actionId, timer);
    }

    /**
     * Update the display for this action (phase-aware rendering)
     */
    private async updateDisplay(actionId: string, state: GameState): Promise<void> {
        const action = streamDeck.actions.getActionById(actionId);
        if (!action) return;

        const isButton = true; // Assume button (most common)
        const cardIndex = this.gameManager.getCardIndexForContext(actionId);
        let imageData: string;

        switch (state.gamePhase) {
            case 'setup':
                // Show "X out of 12" splash
                imageData = SplashRenderer.renderSetupSplash(
                    isButton,
                    this.gameManager.getInstanceCount()
                );
                break;

            case 'playerSelection':
                // Show player buttons, black cards, or start button
                const playerId = this.gameManager.getPlayerAtPosition(cardIndex);

                if (playerId !== null) {
                    // This is a player position - show colored player button
                    const player = this.gameManager.getPlayer(playerId);
                    if (player) {
                        const isSelected = state.selectedPlayerForSwap === playerId;
                        imageData = SplashRenderer.renderPlayerButton(isButton, player, isSelected);
                    } else {
                        imageData = SplashRenderer.renderBlackCard(isButton);
                    }
                } else if (cardIndex === 5 || cardIndex === 6) {
                    // Center position - start button
                    imageData = SplashRenderer.renderStartButton(isButton);
                } else {
                    // Regular position - black card
                    imageData = SplashRenderer.renderBlackCard(isButton);
                }
                break;

            case 'countdown':
                // Show countdown with rules
                const timeRemaining = this.gameManager.getCountdownRemaining();
                imageData = SplashRenderer.renderCountdown(isButton, timeRemaining, cardIndex);
                break;

            case 'buzzHeld':
                // Show black-out on non-player positions, buzz winner on player positions
                if (this.gameManager.isPlayerPosition(cardIndex)) {
                    const buzzerPlayerId = this.gameManager.getPlayerAtPosition(cardIndex);
                    if (buzzerPlayerId !== null && buzzerPlayerId === state.buzzedInPlayer) {
                        // Show buzz winner with hold timer
                        const player = this.gameManager.getPlayer(buzzerPlayerId);
                        if (player) {
                            const holdTime = this.gameManager.getBuzzHoldTimeRemaining();
                            imageData = SplashRenderer.renderBuzzWinner(isButton, player, holdTime);
                        } else {
                            imageData = SplashRenderer.renderBlackOut(isButton);
                        }
                    } else {
                        imageData = SplashRenderer.renderBlackOut(isButton);
                    }
                } else {
                    imageData = SplashRenderer.renderBlackOut(isButton);
                }
                break;

            case 'buzzed':
                // Show buzz winner briefly
                const buzzerPlayer = this.gameManager.getPlayer(state.buzzedInPlayer!);
                if (buzzerPlayer) {
                    imageData = SplashRenderer.renderBuzzWinner(isButton, buzzerPlayer);
                } else {
                    imageData = SplashRenderer.renderBlackOut(isButton);
                }
                break;

            case 'live':
            case 'selecting':
            case 'validating':
            case 'cooldown':
                // Show game cards
                imageData = await this.renderGameCard(isButton, cardIndex, state);
                break;

            default:
                imageData = SplashRenderer.renderBlackCard(isButton);
        }

        await action.setImage(imageData);
    }

    /**
     * Render normal game card
     */
    private async renderGameCard(isButton: boolean, cardIndex: number, state: GameState): Promise<string> {
        const theme = ThemeSystem.getTheme(state.themeId);

        // Check if this is a player position for score display
        let showScoreCorners = false;
        let successfulSets = 0;
        let unsuccessfulSets = 0;
        let playerColor: string | undefined;

        const playerId = this.gameManager.getPlayerAtPosition(cardIndex);
        if (playerId !== null) {
            const player = this.gameManager.getPlayer(playerId);
            if (player) {
                showScoreCorners = true;
                successfulSets = player.successfulSets;
                unsuccessfulSets = player.unsuccessfulSets;
                playerColor = player.color;
            }
        }

        // Get the card to display
        const card = this.gameManager.getCard(cardIndex);
        if (!card) {
            return CardRenderer.renderPlaceholder(isButton, 'No Card');
        }

        // Check if this card is selected
        const isSelected = this.gameManager.isCardSelected(cardIndex);

        // Render the card
        return CardRenderer.renderCard(card, theme, {
            isButton,
            isSelected,
            showScoreCorners,
            successfulSets,
            unsuccessfulSets,
            gamePhase: state.gamePhase,
            playerColor
        });
    }
}
