import streamDeck, { LogLevel } from "@elgato/streamdeck";

import { SetCardAction } from "./actions/set-card";

// Enable trace logging for development
streamDeck.logger.setLevel(LogLevel.TRACE);

// Register the Set card action
streamDeck.actions.registerAction(new SetCardAction());

// Connect to Stream Deck
streamDeck.connect();
