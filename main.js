"use strict";

// https://stackoverflow.com/a/12646864
// I can't believe this isn't in some standard library
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random#getting_a_random_integer_between_two_values
// Same here
function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min);
  // The maximum is exclusive and the minimum is inclusive
}

const TOTAL_CARDS = 52;
const SUITS = 4;
const RANKS = TOTAL_CARDS / SUITS;


class Card {
  constructor(rank, suit) {
    this.rank = rank;
    this.suit = suit;
  }

  static makeStandardDeck() {
    let deck = [];
    for (let suit = 0; suit < SUITS; suit++) {
      for (let rank = 0; rank < RANKS; rank++) {
        deck.push(new Card(rank, suit));
      }
    }
    return deck;
  }
};

class Player {
  constructor(name, playerIndex) {
    this.name = name;
    this.playerIndex = playerIndex;
    this.ai = null;

    this.cards = Array(RANKS);
    // if I do Array(RANKS).fill([]), that'll fill it with the same array object
    for (let rank = 0; rank < RANKS; rank++) {
      this.cards[rank] = [];
    }
    this.numberOfCards = 0;

    this.books = [];
  }

  setAI(ai) {
    this.ai = ai;
  }

  canBeAsked() {
    // Returns whether this player can be asked for cards.
    return this.numberOfCards > 0;
  }

  addCard(card) {
    let cardsOfThisRank = this.cards[card.rank];
    cardsOfThisRank.push(card);
    cardsOfThisRank.sort((card1, card2) => card1.suit - card2.suit);
    this.numberOfCards += 1;
  }

  checkBooks() {
    for (let [rank, cardsOfOneRank] of this.cards.entries()) {
      while (cardsOfOneRank.length >= 4) {
        this.books.push(cardsOfOneRank.splice(-4, 4));
        this.numberOfCards -= 4;
        console.log(`${this.name} made a book with rank ${rank}.`)
      }
    }
  }

  removeCardsWithRank(rank) {
    let cardsToRemove = this.cards[rank];
    this.numberOfCards -= cardsToRemove.length;
    this.cards[rank] = [];
    return cardsToRemove;
  }
}

class Game {
  constructor(playerNames) {
    let deck = Card.makeStandardDeck();
    shuffleArray(deck);
    this.players = playerNames.map((name, index) => new Player(name, index));

    let cardsPerPlayer = 0;
    if (this.players.length < 1 || this.players.length > 10) {
      throw RangeError("Only 2-10 players allowed");
    } else if (this.players.length == 2) {
      cardsPerPlayer = 7;
    } else {
      cardsPerPlayer = 5;
    }

    for (let player of this.players) {
      for (let card of deck.splice(-cardsPerPlayer, cardsPerPlayer)) {
        player.addCard(card);
      }
      player.checkBooks();
    }

    // Remaining cards go in the pool
    this.pool = deck;

    // Index of the player whose turn it is
    this.activePlayerIndex = 0;

    // Whether we are waiting for a non-AI to play their turn
    this.waiting = false;
  }

  checkGameEnded() {
    return this.players.every((player) => player.numberOfCards === 0);
  }

  printScoreboard() {
    console.log("Game end!");
    // Rank players by the number of books they have
    let bookCounts = this.players.map((player) => [player.books.length, player.playerIndex]);
    bookCounts.sort(([books1, index1], [books2, index2]) => books2 - books1);
    for (const [place, [books, playerIndex]] of bookCounts.entries()) {
      console.log(`Place ${place + 1}: ${this.players[playerIndex].name}, ${books} books.`);
    }
  }

  tick() {
    // Advances the game by one tick, unless the active player isn't an AI.
    if (this.checkGameEnded()) {
      return;
    }

    let activePlayer = this.players[this.activePlayerIndex];
    if (activePlayer.ai) {
      // this should call this.ask() and move to next player
      activePlayer.ai.tick();
    } else {
      this.waiting = true;
    }
  }

  ask(askingPlayer, askedPlayerIndex, rank) {
    if (askingPlayer != this.players[this.activePlayerIndex]) {
      throw Error("asking player is not the active player");
    }
    let askedPlayer = this.players[askedPlayerIndex];
    console.log(`${askingPlayer.name} asks ${askedPlayer.name} for rank ${rank}.`)
    let cards = askedPlayer.removeCardsWithRank(rank);
    if (cards.length === 0) {
      console.log(`${askedPlayer.name} didn't have any such cards.`);
      this.#takeFromPool(askingPlayer);
    } else {
      console.log(`${askedPlayer.name} had ${cards.length} of those cards.`);
      for (let card of cards) {
        askingPlayer.addCard(card);
      }
    }
    askingPlayer.checkBooks();
    // Move to next player
    this.activePlayerIndex = (this.activePlayerIndex + 1) % this.players.length;
    this.waiting = false;
  }

  #takeFromPool(player) {
    let card = this.pool.pop();
    if (card !== undefined) {
      player.addCard(card);
      console.log(`${player.name} drew a ${card.rank}.`);
    } else {
      console.log("The pool was empty.");
    }
  }

  poolIsEmpty() {
    return this.pool.length == 0;
  }
}

class AI {
  constructor(player, game) {
    this.player = player;
    this.game = game;
  }

  tick() {
    // Get the rank with the most cards
    let cardCounts = this.player.cards.map((cardsOfOneRank) => cardsOfOneRank.length);
    let maximalRank = 0;
    let maximalLength = 0;
    for (let [rank, length] of cardCounts.entries()) {
      if (length > maximalLength) {
        maximalRank = rank;
        maximalLength = length;
      }
    }
    // Ask a random player that isn't me
    // TODO: make some parts public, e.g. whether they can be asked, how many cards they have, what books they have.
    let askedPlayerIndex;
    do {
      askedPlayerIndex = getRandomInt(0, this.game.players.length);
    } while (askedPlayerIndex == this.player.playerIndex);
    this.game.ask(this.player, askedPlayerIndex, maximalRank);
  }
}

let game = new Game(["P0", "P1", "P2"]);
game.players[0].ai = new AI(game.players[0], game);
game.players[1].ai = new AI(game.players[1], game);
game.players[2].ai = new AI(game.players[2], game);

while (!game.checkGameEnded()) {
  game.tick();
}
game.printScoreboard();
