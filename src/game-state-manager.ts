/**
 * Game State Manager
 * Manages shared game state across all plugin instances
 */

import streamDeck from "@elgato/streamdeck";
import * as fs from "fs";
import * as path from "path";
import { Card, ThemeSystem } from "./theme-system";

export interface Player {
    id: number;
    name: string;
    color: string;
    buzzerContext?: string; // Context ID of the buzzer button
    successfulSets: number;
    unsuccessfulSets: number;
}

export type GamePhase =
    | 'setup'            // Waiting for all 12 instances
    | 'playerSelection'  // Selecting player positions
    | 'countdown'        // Pre-game countdown with rules
    | 'live'             // Active game, can buzz in
    | 'buzzHeld'         // Buzzer pressed, waiting for release
    | 'buzzed'           // Buzzer released, showing winner
    | 'selecting'        // Player selecting their set
    | 'validating'       // Validating the selected set
    | 'cooldown';        // Post-validation cooldown

export interface TimerSettings {
    buzzHoldTimeout: number;      // Seconds to release buzzer (default 3)
    selectionTimeout: number;     // Seconds to select set (default 4)
    countdownDuration: number;    // Seconds for pre-game countdown (default 5)
}

export interface GameState {
    themeId: string;
    playerCount: 1 | 2 | 3 | 4;
    players: Player[];
    deck: Card[];
    activeCards: Card[]; // 12 cards currently displayed

    // Instance management
    registeredInstances: string[]; // Context IDs of all instances
    instanceCardMap: { [contextId: string]: number }; // Maps context to card index (0-11)

    // Player position selection
    playerPositions: { [playerId: number]: number }; // Maps player ID to card index
    selectedPlayerForSwap: number | null; // Player ID selected for position swap

    // Legacy compatibility
    cardContextMap: { [cardId: number]: string }; // Maps card ID to context ID

    // Game state
    selectedCards: number[]; // Card IDs of selected cards (max 3)
    gamePhase: GamePhase;
    buzzedInPlayer: number | null; // Player ID who buzzed in
    buzzPressTime: number | null; // Timestamp when buzzer was pressed
    selectionTimer: number | null; // Timestamp when selection timer started

    // Timer settings
    timerSettings: TimerSettings;
}

export class GameStateManager {
    private static instance: GameStateManager;
    private stateFilePath: string;
    private state: GameState;
    private watchers: Set<(state: GameState) => void> = new Set();

    private constructor() {
        // Get plugin data directory
        const pluginDataDir = process.env.APPDATA
            ? path.join(process.env.APPDATA, 'Elgato', 'StreamDeck', 'Plugins', 'com.jw.set-matching-game-solo--multiplayer.sdPlugin')
            : path.join(__dirname, '..');

        this.stateFilePath = path.join(pluginDataDir, 'game-state.json');

        // Initialize or load state
        this.state = this.loadState();
    }

    static getInstance(): GameStateManager {
        if (!GameStateManager.instance) {
            GameStateManager.instance = new GameStateManager();
        }
        return GameStateManager.instance;
    }

    /**
     * Load state from file or create new state
     */
    private loadState(): GameState {
        try {
            if (fs.existsSync(this.stateFilePath)) {
                const data = fs.readFileSync(this.stateFilePath, 'utf-8');
                const state = JSON.parse(data);
                streamDeck.logger.info(`Loaded game state from ${this.stateFilePath}`);
                return state;
            }
        } catch (error) {
            streamDeck.logger.error(`Failed to load game state: ${error}`);
        }

        // Create new state
        streamDeck.logger.info('Creating new game state');
        return this.createNewState();
    }

    /**
     * Save state to file
     */
    private saveState(): void {
        try {
            // Ensure directory exists
            const dir = path.dirname(this.stateFilePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(this.stateFilePath, JSON.stringify(this.state, null, 2));
            streamDeck.logger.trace(`Saved game state to ${this.stateFilePath}`);
        } catch (error) {
            streamDeck.logger.error(`Failed to save game state: ${error}`);
        }
    }

    /**
     * Create a new game state
     */
    private createNewState(): GameState {
        const deck = ThemeSystem.shuffle(ThemeSystem.generateDeck('classic'));

        return {
            themeId: 'classic',
            playerCount: 1,
            players: [
                { id: 1, name: 'Player 1', color: '#FF0000', successfulSets: 0, unsuccessfulSets: 0 }
            ],
            deck: deck,
            activeCards: deck.slice(0, 12),

            // Instance management
            registeredInstances: [],
            instanceCardMap: {},

            // Player positions (default corners for 4 players: 0, 3, 8, 11)
            playerPositions: { 1: 0, 2: 3, 3: 8, 4: 11 },
            selectedPlayerForSwap: null,

            // Legacy
            cardContextMap: {},

            // Game state
            selectedCards: [],
            gamePhase: 'setup',
            buzzedInPlayer: null,
            buzzPressTime: null,
            selectionTimer: null,

            // Timer settings
            timerSettings: {
                buzzHoldTimeout: 3,
                selectionTimeout: 4,
                countdownDuration: 5
            }
        };
    }

    /**
     * Watch for state changes
     */
    watch(callback: (state: GameState) => void): () => void {
        this.watchers.add(callback);
        return () => this.watchers.delete(callback);
    }

    /**
     * Notify all watchers of state change
     */
    private notifyWatchers(): void {
        this.watchers.forEach(callback => callback(this.state));
    }

    /**
     * Get current game state
     */
    getState(): GameState {
        return { ...this.state };
    }

    /**
     * Start a new game
     */
    newGame(playerCount: 1 | 2 | 3 | 4, themeId: string = 'classic'): void {
        streamDeck.logger.info(`Starting new game with ${playerCount} player(s)`);

        const players: Player[] = [];
        const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00'];

        for (let i = 0; i < playerCount; i++) {
            players.push({
                id: i + 1,
                name: `Player ${i + 1}`,
                color: colors[i],
                successfulSets: 0,
                unsuccessfulSets: 0
            });
        }

        const deck = ThemeSystem.shuffle(ThemeSystem.generateDeck(themeId));

        this.state = {
            themeId,
            playerCount,
            players,
            deck,
            activeCards: deck.slice(0, 12),

            // Instance management
            registeredInstances: [],
            instanceCardMap: {},

            // Player positions (default corners for 4 players: 0, 3, 8, 11)
            playerPositions: { 1: 0, 2: 3, 3: 8, 4: 11 },
            selectedPlayerForSwap: null,

            // Legacy
            cardContextMap: {},

            // Game state
            selectedCards: [],
            gamePhase: 'setup',
            buzzedInPlayer: null,
            buzzPressTime: null,
            selectionTimer: null,

            // Timer settings
            timerSettings: {
                buzzHoldTimeout: 3,
                selectionTimeout: 4,
                countdownDuration: 5
            }
        };

        this.saveState();
        this.notifyWatchers();
    }

    /**
     * Register a plugin instance
     */
    registerInstance(context: string): void {
        if (!this.state.registeredInstances.includes(context)) {
            this.state.registeredInstances.push(context);

            // Auto-assign card index (next available)
            let assignedIndex = -1;
            for (let i = 0; i < 12; i++) {
                const existingContext = Object.entries(this.state.instanceCardMap)
                    .find(([, idx]) => idx === i);
                if (!existingContext) {
                    assignedIndex = i;
                    break;
                }
            }

            if (assignedIndex >= 0) {
                this.state.instanceCardMap[context] = assignedIndex;
                streamDeck.logger.info(`Registered instance ${context} as card ${assignedIndex + 1}/12`);
            }

            // Check if we have all 12 instances
            if (this.state.registeredInstances.length === 12 && this.state.gamePhase === 'setup') {
                streamDeck.logger.info('All 12 instances registered, entering player selection');
                this.state.gamePhase = 'playerSelection';
            }

            this.saveState();
            this.notifyWatchers();
        }
    }

    /**
     * Unregister a plugin instance
     */
    unregisterInstance(context: string): void {
        const index = this.state.registeredInstances.indexOf(context);
        if (index >= 0) {
            this.state.registeredInstances.splice(index, 1);
            delete this.state.instanceCardMap[context];

            // If we drop below 12, go back to setup
            if (this.state.registeredInstances.length < 12) {
                this.state.gamePhase = 'setup';
            }

            streamDeck.logger.info(`Unregistered instance ${context}, now ${this.state.registeredInstances.length}/12`);
            this.saveState();
            this.notifyWatchers();
        }
    }

    /**
     * Get card index for a context
     */
    getCardIndexForContext(context: string): number {
        return this.state.instanceCardMap[context] ?? 0;
    }

    /**
     * Get registered instance count
     */
    getInstanceCount(): number {
        return this.state.registeredInstances.length;
    }

    /**
     * Register a player's buzzer button
     */
    registerBuzzer(context: string, playerId: number): void {
        const player = this.state.players.find(p => p.id === playerId);
        if (player) {
            player.buzzerContext = context;
            streamDeck.logger.info(`Registered buzzer for player ${playerId}`);
            this.saveState();
            this.notifyWatchers();
        }
    }

    /**
     * Handle player selection for position swapping
     */
    selectPlayerForSwap(playerId: number): void {
        if (this.state.gamePhase !== 'playerSelection') return;

        if (this.state.selectedPlayerForSwap === null) {
            // First selection - mark this player
            this.state.selectedPlayerForSwap = playerId;
            streamDeck.logger.info(`Player ${playerId} selected for swap`);
        } else if (this.state.selectedPlayerForSwap === playerId) {
            // Clicked same player - deselect
            this.state.selectedPlayerForSwap = null;
            streamDeck.logger.info(`Player ${playerId} deselected`);
        } else {
            // Second selection - swap positions
            const pos1 = this.state.playerPositions[this.state.selectedPlayerForSwap];
            const pos2 = this.state.playerPositions[playerId];

            this.state.playerPositions[this.state.selectedPlayerForSwap] = pos2;
            this.state.playerPositions[playerId] = pos1;

            streamDeck.logger.info(`Swapped player ${this.state.selectedPlayerForSwap} and player ${playerId} positions`);
            this.state.selectedPlayerForSwap = null;
        }

        this.saveState();
        this.notifyWatchers();
    }

    /**
     * Assign card index as player position (click on black card to assign selected player)
     */
    assignPlayerPosition(cardIndex: number): void {
        if (this.state.gamePhase !== 'playerSelection') return;
        if (this.state.selectedPlayerForSwap === null) return;

        // Find if any player is already at this position
        const existingPlayer = Object.entries(this.state.playerPositions)
            .find(([, pos]) => pos === cardIndex);

        if (existingPlayer) {
            // Swap with existing player
            const existingPlayerId = parseInt(existingPlayer[0]);
            const selectedPos = this.state.playerPositions[this.state.selectedPlayerForSwap];

            this.state.playerPositions[existingPlayerId] = selectedPos;
            this.state.playerPositions[this.state.selectedPlayerForSwap] = cardIndex;
        } else {
            // Just move to this position
            this.state.playerPositions[this.state.selectedPlayerForSwap] = cardIndex;
        }

        streamDeck.logger.info(`Assigned player ${this.state.selectedPlayerForSwap} to position ${cardIndex}`);
        this.state.selectedPlayerForSwap = null;

        this.saveState();
        this.notifyWatchers();
    }

    /**
     * Start countdown phase
     */
    startCountdown(): void {
        if (this.state.gamePhase !== 'playerSelection') return;

        this.state.gamePhase = 'countdown';
        this.state.selectionTimer = Date.now(); // Reuse for countdown

        streamDeck.logger.info('Starting pre-game countdown');

        // Auto-transition to live after countdown
        setTimeout(() => {
            if (this.state.gamePhase === 'countdown') {
                this.state.gamePhase = 'live';
                this.state.selectionTimer = null;
                this.saveState();
                this.notifyWatchers();
                streamDeck.logger.info('Game is now live!');
            }
        }, this.state.timerSettings.countdownDuration * 1000);

        this.saveState();
        this.notifyWatchers();
    }

    /**
     * Get countdown remaining time
     */
    getCountdownRemaining(): number {
        if (this.state.gamePhase !== 'countdown' || !this.state.selectionTimer) return 0;

        const elapsed = (Date.now() - this.state.selectionTimer) / 1000;
        const remaining = this.state.timerSettings.countdownDuration - elapsed;
        return Math.max(0, remaining);
    }

    /**
     * Handle buzz-in attempt (press)
     */
    buzzIn(playerId: number): boolean {
        if (this.state.gamePhase !== 'live') {
            streamDeck.logger.trace(`Buzz-in rejected: game phase is ${this.state.gamePhase}`);
            return false;
        }

        this.state.gamePhase = 'buzzHeld';
        this.state.buzzedInPlayer = playerId;
        this.state.buzzPressTime = Date.now();
        streamDeck.logger.info(`Player ${playerId} pressed buzzer`);

        this.saveState();
        this.notifyWatchers();
        return true;
    }

    /**
     * Check if buzz hold has timed out
     */
    isBuzzHoldTimedOut(): boolean {
        if (!this.state.buzzPressTime) return false;

        const elapsed = (Date.now() - this.state.buzzPressTime) / 1000;
        return elapsed > this.state.timerSettings.buzzHoldTimeout;
    }

    /**
     * Handle buzz hold timeout
     */
    handleBuzzHoldTimeout(): void {
        if (this.state.gamePhase !== 'buzzHeld') return;

        streamDeck.logger.info(`Player ${this.state.buzzedInPlayer} failed to release buzzer in time`);

        const player = this.state.players.find(p => p.id === this.state.buzzedInPlayer);
        if (player) {
            player.unsuccessfulSets++;
        }

        // Return to live
        this.state.gamePhase = 'live';
        this.state.buzzedInPlayer = null;
        this.state.buzzPressTime = null;

        this.saveState();
        this.notifyWatchers();
    }

    /**
     * Start selection timer (called when buzzer is released)
     */
    startSelectionTimer(): void {
        if (this.state.gamePhase === 'buzzHeld') {
            this.state.gamePhase = 'buzzed';
            this.state.buzzPressTime = null;

            // Short delay to show buzz winner, then start selecting
            setTimeout(() => {
                if (this.state.gamePhase === 'buzzed') {
                    this.state.gamePhase = 'selecting';
                    this.state.selectionTimer = Date.now();
                    streamDeck.logger.info('Selection timer started');
                    this.saveState();
                    this.notifyWatchers();
                }
            }, 1000); // 1 second to show buzz winner

            this.saveState();
            this.notifyWatchers();
        }
    }

    /**
     * Check if selection timer has expired
     */
    isSelectionTimedOut(): boolean {
        if (this.state.selectionTimer === null) return false;

        const elapsed = (Date.now() - this.state.selectionTimer) / 1000;
        return elapsed > this.state.timerSettings.selectionTimeout;
    }

    /**
     * Get selection time remaining
     */
    getSelectionTimeRemaining(): number {
        if (!this.state.selectionTimer) return 0;

        const elapsed = (Date.now() - this.state.selectionTimer) / 1000;
        const remaining = this.state.timerSettings.selectionTimeout - elapsed;
        return Math.max(0, remaining);
    }

    /**
     * Get buzz hold time remaining
     */
    getBuzzHoldTimeRemaining(): number {
        if (!this.state.buzzPressTime) return 0;

        const elapsed = (Date.now() - this.state.buzzPressTime) / 1000;
        const remaining = this.state.timerSettings.buzzHoldTimeout - elapsed;
        return Math.max(0, remaining);
    }

    /**
     * Update timer settings
     */
    updateTimerSettings(settings: Partial<TimerSettings>): void {
        this.state.timerSettings = { ...this.state.timerSettings, ...settings };
        streamDeck.logger.info(`Timer settings updated: ${JSON.stringify(this.state.timerSettings)}`);
        this.saveState();
        this.notifyWatchers();
    }

    /**
     * Get player position by ID
     */
    getPlayerPosition(playerId: number): number | undefined {
        return this.state.playerPositions[playerId];
    }

    /**
     * Check if card index is a player position
     */
    isPlayerPosition(cardIndex: number): boolean {
        return Object.values(this.state.playerPositions).includes(cardIndex);
    }

    /**
     * Get player ID at card index
     */
    getPlayerAtPosition(cardIndex: number): number | null {
        const entry = Object.entries(this.state.playerPositions)
            .find(([, pos]) => pos === cardIndex);
        return entry ? parseInt(entry[0]) : null;
    }

    /**
     * Select a card
     */
    selectCard(cardIndex: number): void {
        if (this.state.gamePhase !== 'selecting') {
            streamDeck.logger.trace(`Card selection rejected: game phase is ${this.state.gamePhase}`);
            return;
        }

        const cardId = this.state.activeCards[cardIndex]?.id;
        if (cardId === undefined) return;

        const selectedIndex = this.state.selectedCards.indexOf(cardId);

        if (selectedIndex >= 0) {
            // Deselect card
            this.state.selectedCards.splice(selectedIndex, 1);
            streamDeck.logger.trace(`Deselected card ${cardId}`);
        } else if (this.state.selectedCards.length < 3) {
            // Select card
            this.state.selectedCards.push(cardId);
            streamDeck.logger.trace(`Selected card ${cardId}`);

            // If 3 cards selected, validate immediately
            if (this.state.selectedCards.length === 3) {
                this.validateSet();
            }
        }

        this.saveState();
        this.notifyWatchers();
    }

    /**
     * Validate the selected set
     */
    private validateSet(): void {
        if (this.state.selectedCards.length !== 3) return;

        this.state.gamePhase = 'validating';

        const cards = this.state.selectedCards.map(cardId =>
            this.state.activeCards.find(c => c.id === cardId)!
        );

        const isValid = ThemeSystem.isValidSet(cards[0], cards[1], cards[2]);
        const playerId = this.state.buzzedInPlayer || 1;
        const player = this.state.players.find(p => p.id === playerId);

        if (player) {
            if (isValid) {
                player.successfulSets++;
                streamDeck.logger.info(`Player ${playerId} found a valid set!`);

                // Remove the three cards and draw three new ones
                this.replaceCards(this.state.selectedCards);
            } else {
                player.unsuccessfulSets++;
                streamDeck.logger.info(`Player ${playerId} selected an invalid set`);
            }
        }

        // Start cooldown phase
        setTimeout(() => this.returnToLive(), 1000);

        this.saveState();
        this.notifyWatchers();
    }

    /**
     * Handle selection timeout
     */
    handleTimeout(): void {
        if (this.state.gamePhase !== 'selecting') return;

        const playerId = this.state.buzzedInPlayer || 1;
        const player = this.state.players.find(p => p.id === playerId);

        if (player) {
            player.unsuccessfulSets++;
            streamDeck.logger.info(`Player ${playerId} timed out`);
        }

        this.state.gamePhase = 'cooldown';

        // Return to live after 1 second
        setTimeout(() => this.returnToLive(), 1000);

        this.saveState();
        this.notifyWatchers();
    }

    /**
     * Replace cards in the active set
     */
    private replaceCards(cardIds: number[]): void {
        // Find indices of cards to replace
        const indices = cardIds.map(id =>
            this.state.activeCards.findIndex(c => c.id === id)
        ).filter(i => i >= 0);

        // Remove cards from active cards
        const newActiveCards = this.state.activeCards.filter(c => !cardIds.includes(c.id));

        // Draw new cards from deck
        const remainingDeck = this.state.deck.filter(c =>
            !this.state.activeCards.some(ac => ac.id === c.id)
        );

        const newCards = remainingDeck.slice(0, 3);
        this.state.activeCards = [...newActiveCards, ...newCards];

        streamDeck.logger.info(`Replaced ${indices.length} cards with ${newCards.length} new cards`);
    }

    /**
     * Return to live game state
     */
    private returnToLive(): void {
        this.state.gamePhase = 'live';
        this.state.buzzedInPlayer = null;
        this.state.selectionTimer = null;
        this.state.selectedCards = [];

        streamDeck.logger.info('Returned to live game state');

        this.saveState();
        this.notifyWatchers();
    }

    /**
     * Get card at index
     */
    getCard(index: number): Card | null {
        return this.state.activeCards[index] || null;
    }

    /**
     * Is card selected?
     */
    isCardSelected(cardIndex: number): boolean {
        const cardId = this.state.activeCards[cardIndex]?.id;
        return cardId !== undefined && this.state.selectedCards.includes(cardId);
    }

    /**
     * Get player by ID
     */
    getPlayer(playerId: number): Player | null {
        return this.state.players.find(p => p.id === playerId) || null;
    }
}
