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

export type GamePhase = 'idle' | 'live' | 'buzzed' | 'selecting' | 'validating' | 'cooldown';

export interface GameState {
    themeId: string;
    playerCount: 1 | 2 | 3 | 4;
    players: Player[];
    deck: Card[];
    activeCards: Card[]; // 12 cards currently displayed
    cardContextMap: { [cardId: number]: string }; // Maps card ID to context ID
    selectedCards: number[]; // Card IDs of selected cards (max 3)
    gamePhase: GamePhase;
    buzzedInPlayer: number | null; // Player ID who buzzed in
    selectionTimer: number | null; // Timestamp when selection timer started
    selectionTimeoutSeconds: number; // How long player has to select (default 4)
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
            cardContextMap: {},
            selectedCards: [],
            gamePhase: 'live',
            buzzedInPlayer: null,
            selectionTimer: null,
            selectionTimeoutSeconds: 4
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
            cardContextMap: {},
            selectedCards: [],
            gamePhase: 'live',
            buzzedInPlayer: null,
            selectionTimer: null,
            selectionTimeoutSeconds: 4
        };

        this.saveState();
        this.notifyWatchers();
    }

    /**
     * Register a card context with a card ID
     */
    registerCard(context: string, cardIndex: number): void {
        if (cardIndex >= 0 && cardIndex < this.state.activeCards.length) {
            const cardId = this.state.activeCards[cardIndex].id;
            this.state.cardContextMap[cardId] = context;
            streamDeck.logger.trace(`Registered card ${cardId} to context ${context}`);
        }
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
     * Handle buzz-in attempt
     */
    buzzIn(playerId: number): boolean {
        if (this.state.gamePhase !== 'live') {
            streamDeck.logger.trace(`Buzz-in rejected: game phase is ${this.state.gamePhase}`);
            return false;
        }

        this.state.gamePhase = 'buzzed';
        this.state.buzzedInPlayer = playerId;
        streamDeck.logger.info(`Player ${playerId} buzzed in`);

        this.saveState();
        this.notifyWatchers();
        return true;
    }

    /**
     * Start selection timer (called when buzzer is released)
     */
    startSelectionTimer(): void {
        if (this.state.gamePhase === 'buzzed') {
            this.state.gamePhase = 'selecting';
            this.state.selectionTimer = Date.now();
            streamDeck.logger.info('Selection timer started');

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
        return elapsed > this.state.selectionTimeoutSeconds;
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
