# Set Matching Game - Stream Deck Plugin

A Stream Deck plugin that brings the classic **Set** card game to your Stream Deck! Features both solo and offline multiplayer modes (up to 4 players) with support for buttons and dials. Race to find matching sets of symbols!

## What is Set?

Set is a real-time card game where players search for "Sets" among 12 face-up cards. Each card has 4 properties:
- **Shape**: Diamond, Oval, or Squiggle
- **Color**: Red, Green, or Purple
- **Count**: 1, 2, or 3 symbols
- **Fill**: Solid, Striped, or Empty

**A valid Set consists of 3 cards where each property is either:**
- All the SAME across the 3 cards, OR
- All DIFFERENT across the 3 cards

## Features

- **Solo Mode**: Practice finding Sets and track your success rate
- **Multiplayer Mode**: Compete with 2-4 players on the same computer
- **Buzz-In System**: First player to press their buzzer gets to select a Set
- **Score Tracking**: Successful and unsuccessful Sets displayed in real-time
- **Timer**: 4 seconds to select your Set after buzzing in
- **Works on Buttons & Dials**: Full support for Stream Deck, Stream Deck +, and other models
- **Theme System**: Extensible architecture for future card themes

## Installation

1. Download the `.streamDeckPlugin` file from [Releases](https://github.com/KatsuJinCode/set-matching-game-solo--multiplayer/releases)
2. Double-click to install
3. The "Set Card" action will appear in your Stream Deck actions

## Setup

### Solo Mode (1 Player)

1. Drag 12 "Set Card" actions onto your Stream Deck
2. Configure each with a unique **Card Index** (1-12)
3. Your score will automatically appear in the corners of cards 1 & 2
4. Start finding Sets!

### Multiplayer Mode (2-4 Players)

1. Drag 12 "Set Card" actions for the game board (Card Index 1-12)
2. **Optional**: Drag additional "Set Card" actions as dedicated buzzer buttons for each player
   - Enable "Is Buzzer Button" checkbox
   - Assign each buzzer to a different Player ID (1-4)
   - Buzzers show player scores in the corners
3. **Note**: Any card can act as a buzzer! You don't need dedicated buzzer buttons

## How to Play

### Solo Mode
1. Study the 12 cards displayed on your Stream Deck
2. Click any 3 cards that form a valid Set
3. Valid Sets increment ✓ (green), invalid Sets increment ✗ (red)
4. Successfully matched cards are replaced with new ones from the deck
5. Keep playing until all 81 cards are used!

### Multiplayer Mode
1. **Live Game**: Green borders indicate you can buzz in
2. **Buzz In**: Press your buzzer (or any card) to lock out other players
3. **Start Timer**: Release the buzzer to start the 4-second countdown
4. **Select Set**: Click 3 cards to form your Set
5. **Validation**:
   - ✓ Valid Set: Adds to your score, cards are replaced
   - ✗ Invalid/Timeout: Adds to unsuccessful count
6. **Cooldown**: 1-second animation, then back to live game

## Configuration

Each "Set Card" action has these settings in the Property Inspector:

### Card Index
Select which of the 12 game cards this button displays (1-12)

### Is Buzzer Button
Enable this to make it a dedicated player buzzer

### Player ID
If buzzer is enabled, assign to Player 1, 2, 3, or 4

## Examples

### Classic Set - All Same
```
Card 1: 1 Red Solid Diamond
Card 2: 1 Red Solid Oval
Card 3: 1 Red Solid Squiggle
✓ Valid! (Count: same, Color: same, Fill: same, Shape: all different)
```

### Classic Set - All Different
```
Card 1: 1 Red Solid Diamond
Card 2: 2 Green Striped Oval
Card 3: 3 Purple Empty Squiggle
✓ Valid! (All properties are all different)
```

### Invalid Set
```
Card 1: 1 Red Solid Diamond
Card 2: 2 Red Solid Diamond
Card 3: 3 Green Solid Diamond
✗ Invalid! (Color: 2 red, 1 green - not all same or all different)
```

## Development

### Prerequisites
- Node.js 20+
- npm
- Stream Deck software

### Build from Source
```bash
git clone https://github.com/KatsuJinCode/set-matching-game-solo--multiplayer.git
cd set-matching-game-solo--multiplayer
npm install
npm run build
```

### Development Mode
```bash
npm run watch
```
This will auto-rebuild and restart the plugin on file changes.

### Project Structure
```
src/
├── plugin.ts                  # Main plugin entry point
├── theme-system.ts            # Card generation and Set validation
├── game-state-manager.ts      # Shared game state across all instances
├── card-renderer.ts           # Canvas-based card rendering
└── actions/
    └── set-card.ts            # Main card action handler
```

## Architecture Highlights

- **Singleton Game State**: All card instances share game state via file-based persistence
- **Per-Instance Configuration**: Each button/dial configured independently
- **Reactive Updates**: State changes automatically update all cards
- **Buzz-In Lockout**: First player to press locks out others until round completes
- **Timer System**: Automatic timeout handling with cooldown periods
- **Canvas Rendering**: Dynamic card generation with shapes, colors, and scoring overlays

## Future Features

- Additional themes (numbers, symbols, colors, etc.)
- Profile system with persistent player stats
- Leaderboard display
- Online multiplayer support
- Hint system for solo mode
- Difficulty levels

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes with clear commit messages
4. Submit a pull request

## License

MIT License - feel free to use and modify!

## Credits

- Original Set game by Marsha Falco
- Plugin developed for Elgato Stream Deck
- Built with [@elgato/streamdeck SDK](https://github.com/elgatosf/streamdeck)

## Support

- **Issues**: [GitHub Issues](https://github.com/KatsuJinCode/set-matching-game-solo--multiplayer/issues)
- **Discussions**: [GitHub Discussions](https://github.com/KatsuJinCode/set-matching-game-solo--multiplayer/discussions)

---

**Version**: 0.1.0
**Author**: jw
**Repository**: https://github.com/KatsuJinCode/set-matching-game-solo--multiplayer

Enjoy playing Set on your Stream Deck!
