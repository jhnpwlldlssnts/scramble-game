const board = document.getElementById("board");
const rack = document.getElementById("rack");
const scoreDisplay = document.getElementById("score");

let totalScore = 0;
let turnTiles = new Set(); // tiles placed this turn
let confirmedCells = new Set(); // already played (locked) cells
let isFirstTurn = true; // Track if it's the first turn

// Multiplayer variables
let players = [];
let currentPlayerIndex = 0;
let gameStarted = false;

const SIZE = 15;
const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const letterValues = {
  A:1,B:3,C:3,D:2,E:1,F:4,G:2,H:4,I:1,J:8,K:5,L:1,M:3,
  N:1,O:1,P:3,Q:10,R:1,S:1,T:1,U:1,V:4,W:4,X:8,Y:4,Z:10
};

// Premium square positions (official Scrabble board layout)
const premiumSquares = {
  // Triple Word Score (TW)
  TW: [[0,0], [0,7], [0,14], [7,0], [7,14], [14,0], [14,7], [14,14]],
  
  // Double Word Score (DW)
  DW: [[1,1], [2,2], [3,3], [4,4], [1,13], [2,12], [3,11], [4,10],
       [10,4], [11,3], [12,2], [13,1], [10,10], [11,11], [12,12], [13,13]],
  
  // Triple Letter Score (TL)
  TL: [[1,5], [1,9], [5,1], [5,5], [5,9], [5,13], [9,1], [9,5], [9,9], [9,13], [13,5], [13,9]],
  
  // Double Letter Score (DL)
  DL: [[0,3], [0,11], [2,6], [2,8], [3,0], [3,7], [3,14], [6,2], [6,6], [6,8], [6,12],
       [7,3], [7,11], [8,2], [8,6], [8,8], [8,12], [11,0], [11,7], [11,14], [12,6], [12,8], [14,3], [14,11]],
  
  // Center Star
  STAR: [[7,7]]
};

// Get premium square type
function getPremiumType(row, col) {
  for (const [type, positions] of Object.entries(premiumSquares)) {
    if (positions.some(([r, c]) => r === row && c === col)) {
      return type;
    }
  }
  return null;
}

// Tile bag system (like real Scrabble distribution)
let tileBag = [];

// Initialize tile bag with proper Scrabble distribution
function initializeTileBag() {
  const distribution = {
    'A': 9, 'B': 2, 'C': 2, 'D': 4, 'E': 12, 'F': 2, 'G': 3, 'H': 2,
    'I': 9, 'J': 1, 'K': 1, 'L': 4, 'M': 2, 'N': 6, 'O': 8, 'P': 2,
    'Q': 1, 'R': 6, 'S': 4, 'T': 6, 'U': 4, 'V': 2, 'W': 2, 'X': 1,
    'Y': 2, 'Z': 1
  };
  
  tileBag = [];
  for (const [letter, count] of Object.entries(distribution)) {
    for (let i = 0; i < count; i++) {
      tileBag.push(letter);
    }
  }
  
  // Shuffle the bag
  tileBag.sort(() => Math.random() - 0.5);
}

// Draw a tile from the bag
function drawTile() {
  if (tileBag.length === 0) return null;
  return tileBag.pop();
}

// Create a tile element
function createTile(letter) {
  const tile = document.createElement("div");
  tile.classList.add("tile");
  tile.draggable = true;
  tile.textContent = letter;
  tile.dataset.letter = letter; // Store the letter in dataset

  tile.addEventListener("dragstart", e => {
    e.dataTransfer.setData("text", tile.textContent); // Use current textContent, not closure variable
    e.dataTransfer.setData("source", "rack"); // Mark this as coming from rack
    tile.classList.add("dragging");
  });

  tile.addEventListener("dragend", e => {
    tile.classList.remove("dragging");
  });

  return tile;
}

// --- Build 15x15 board ---
for (let i = 0; i < SIZE * SIZE; i++) {
  const cell = document.createElement("div");
  cell.classList.add("cell");
  const row = Math.floor(i / SIZE);
  const col = i % SIZE;
  cell.dataset.row = row;
  cell.dataset.col = col;
  
  // Add premium square classes and labels
  const premiumType = getPremiumType(row, col);
  if (premiumType) {
    cell.classList.add(premiumType.toLowerCase());
    
    // Add labels for premium squares
    const label = document.createElement("span");
    label.className = "premium-label";
    
    switch(premiumType) {
      case 'TW':
        label.textContent = 'TRIPLE WORD SCORE';
        break;
      case 'DW':
        label.textContent = 'DOUBLE WORD SCORE';
        break;
      case 'TL':
        label.textContent = 'TRIPLE LETTER SCORE';
        break;
      case 'DL':
        label.textContent = 'DOUBLE LETTER SCORE';
        break;
      case 'STAR':
        label.innerHTML = '★';
        label.style.fontSize = '30px';
        break;
    }
    
    cell.appendChild(label);
  }
  
  board.appendChild(cell);
}

// --- Generate Rack ---
function generateRack() {
  rack.innerHTML = "";
  for (let i = 0; i < 7; i++) {
    const letter = drawTile();
    if (letter) {
      const tile = createTile(letter);
      rack.appendChild(tile);
    }
  }
}

// Start game setup
function showPlayerSetup() {
  const overlay = document.createElement("div");
  overlay.id = "player-setup-overlay";
  overlay.innerHTML = `
    <div class="setup-modal">
      <h2>🎮 Multiplayer Setup</h2>
      <p>How many players? (2-4)</p>
      <div class="player-count-buttons">
        <button onclick="startGame(2)">2 Players</button>
        <button onclick="startGame(3)">3 Players</button>
        <button onclick="startGame(4)">4 Players</button>
      </div>
      <button class="single-player-btn" onclick="startGame(1)">Single Player</button>
    </div>
  `;
  document.body.appendChild(overlay);
}

// Initialize players
window.startGame = function(numPlayers) {
  players = [];
  
  // Create each player with their own initial rack
  for (let i = 0; i < numPlayers; i++) {
    const playerRack = [];
    
    // Give each player 7 tiles from the bag
    for (let j = 0; j < 7; j++) {
      const letter = drawTile();
      if (letter) {
        playerRack.push(letter);
      }
    }
    
    players.push({
      name: `Player ${i + 1}`,
      score: 0,
      rack: playerRack,
      canUseTrashBin: true // Each player gets one exchange opportunity
    });
  }
  
  console.log("Game started with players:", players); // Debug
  
  // Remove setup overlay
  const overlay = document.getElementById("player-setup-overlay");
  if (overlay) overlay.remove();
  
  // Initialize first player
  currentPlayerIndex = 0;
  gameStarted = true;
  displayCurrentPlayer();
  updateScoreboard();
};

// Display current player's rack
function displayCurrentPlayer() {
  const currentPlayer = players[currentPlayerIndex];
  
  // Update player indicator
  const playerTurnDiv = document.getElementById("current-turn");
  if (playerTurnDiv) {
    playerTurnDiv.textContent = `${currentPlayer.name}'s Turn`;
    playerTurnDiv.style.color = getPlayerColor(currentPlayerIndex);
  }
  
  // Display rack
  rack.innerHTML = "";
  currentPlayer.rack.forEach(letter => {
    const tile = createTile(letter);
    rack.appendChild(tile);
  });
  
  // Update trash bin availability
  const trashBin = document.getElementById("trash-bin");
  if (trashBin) {
    if (currentPlayer.canUseTrashBin) {
      trashBin.style.opacity = "1";
      trashBin.style.cursor = "pointer";
      trashBin.style.background = "linear-gradient(145deg, #e74c3c, #c0392b)";
      const trashLabel = trashBin.querySelector(".trash-label");
      if (trashLabel) trashLabel.textContent = "Drag Here to Exchange";
    } else {
      trashBin.style.opacity = "0.4";
      trashBin.style.cursor = "not-allowed";
      trashBin.style.background = "linear-gradient(145deg, #7f8c8d, #95a5a6)";
      const trashLabel = trashBin.querySelector(".trash-label");
      if (trashLabel) trashLabel.textContent = "Already Used";
    }
  }
}

// Update scoreboard
function updateScoreboard() {
  const scoreboard = document.getElementById("scoreboard");
  if (scoreboard) {
    scoreboard.innerHTML = players.map((player, index) => `
      <div class="player-score ${index === currentPlayerIndex ? 'active-player' : ''}" style="border-left: 4px solid ${getPlayerColor(index)}">
        <span class="player-name">${player.name}</span>
        <span class="player-points">${player.score} pts</span>
      </div>
    `).join("");
  }
}

// Get player color
function getPlayerColor(index) {
  const colors = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12"];
  return colors[index % colors.length];
}

// Show transition screen between players
function showPlayerTransition(nextPlayerIndex) {
  const overlay = document.createElement("div");
  overlay.id = "transition-overlay";
  overlay.innerHTML = `
    <div class="transition-modal">
      <h2>✅ Turn Complete!</h2>
      <p style="font-size: 24px; margin: 20px 0;">Pass device to</p>
      <h1 style="color: ${getPlayerColor(nextPlayerIndex)}; margin: 10px 0;">${players[nextPlayerIndex].name}</h1>
      <button class="ready-btn" onclick="hideTransition()">I'm Ready!</button>
    </div>
  `;
  document.body.appendChild(overlay);
}

window.hideTransition = function() {
  const overlay = document.getElementById("transition-overlay");
  if (overlay) overlay.remove();
  displayCurrentPlayer();
};

// Initialize tile bag and generate initial rack
initializeTileBag();
showPlayerSetup(); // Show player setup instead of auto-generating

// --- Make Rack Accept Dropped Tiles (Return to Rack) ---
rack.addEventListener("dragover", e => {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
});

rack.addEventListener("drop", e => {
  e.preventDefault();
  const letter = e.dataTransfer.getData("text");
  const source = e.dataTransfer.getData("source");
  
  // Only allow returning tiles from board (not rack to rack)
  if (source === "board") {
    const draggingCell = document.querySelector(".cell.dragging-cell");
    if (draggingCell && turnTiles.has(draggingCell)) {
      // Remove letter text nodes from board (keep premium label)
      Array.from(draggingCell.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .forEach(node => node.remove());
      
      draggingCell.draggable = false;
      draggingCell.style.cursor = "";
      turnTiles.delete(draggingCell);
      
      // Add back to rack
      const tile = createTile(letter);
      rack.appendChild(tile);
    }
  }
});

// --- Trash Bin for Exchanging Tiles ---
const trashBin = document.getElementById("trash-bin");

if (trashBin) {
  trashBin.addEventListener("dragover", e => {
    e.preventDefault(); // CRITICAL: This allows the drop
    e.dataTransfer.dropEffect = "move"; // Show move cursor
    trashBin.classList.add("trash-hover");
  });

  trashBin.addEventListener("dragleave", () => {
    trashBin.classList.remove("trash-hover");
  });

  trashBin.addEventListener("drop", e => {
    e.preventDefault();
    trashBin.classList.remove("trash-hover");
    
    // CHECK: Only allow exchange if current player hasn't used it
    const currentPlayer = players[currentPlayerIndex];
    if (!currentPlayer.canUseTrashBin) {
      alert("❌ You've already used your tile exchange!");
      return;
    }
    
    const letter = e.dataTransfer.getData("text");
    const source = e.dataTransfer.getData("source");
    
    console.log("Dropped on trash:", letter, "from", source);
    console.log("Tile bag before exchange:", tileBag.length, "tiles");
    
    if (source !== "rack") {
      alert("❌ You can only exchange tiles from your rack, not from the board!");
      return;
    }
    
    if (tileBag.length === 0) {
      alert("❌ No more tiles in the bag to exchange!");
      return;
    }
    
    if (turnTiles.size > 0) {
      alert("❌ You can't exchange tiles after placing some on the board! Remove placed tiles first.");
      return;
    }
    
    const draggingTile = rack.querySelector(".tile.dragging");
    if (draggingTile) {
      console.log("Removing tile:", draggingTile.textContent);
      draggingTile.remove();
      
      // Update player's rack
      const tileIndex = currentPlayer.rack.indexOf(letter);
      if (tileIndex > -1) {
        currentPlayer.rack.splice(tileIndex, 1);
      }
      
      tileBag.push(letter);
      console.log("Returned", letter, "to bag. Bag now has", tileBag.length, "tiles");
      
      tileBag.sort(() => Math.random() - 0.5);
      
      const newLetter = drawTile();
      console.log("Drew new letter:", newLetter);
      
      if (newLetter) {
        currentPlayer.rack.push(newLetter);
        const newTile = createTile(newLetter);
        rack.appendChild(newTile);
        
        trashBin.style.animation = "trashShake 0.5s ease";
        setTimeout(() => {
          trashBin.style.animation = "";
        }, 500);
        
        const msg = document.createElement("div");
        msg.className = "exchange-msg";
        msg.textContent = `${letter} → ${newLetter}`;
        trashBin.appendChild(msg);
        setTimeout(() => msg.remove(), 1500);
      }
    } else {
      console.error("No dragging tile found!");
    }
  });
} else {
  console.error("Trash bin element not found! Make sure HTML has id='trash-bin'");
}

// --- Drop letters ---
document.querySelectorAll(".cell").forEach(cell => {
  cell.addEventListener("dragover", e => e.preventDefault());
  
  // Make cells draggable if they have tiles from current turn
  cell.addEventListener("mouseenter", () => {
    if (cell.textContent && turnTiles.has(cell)) {
      cell.draggable = true;
      cell.style.cursor = "grab";
    }
  });
  
  // Drag from board cell
  cell.addEventListener("dragstart", e => {
    if (turnTiles.has(cell) && !confirmedCells.has(cell)) {
      // Get actual letter (skip the label span)
      const letterText = Array.from(cell.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent)
        .join('');
      
      e.dataTransfer.setData("text", letterText);
      e.dataTransfer.setData("source", "board");
      cell.classList.add("dragging-cell");
      cell.style.opacity = "0.5";
    } else {
      e.preventDefault(); // Don't allow dragging confirmed tiles
    }
  });
  
  cell.addEventListener("dragend", () => {
    cell.classList.remove("dragging-cell");
    cell.style.opacity = "1";
  });
  
  cell.addEventListener("drop", e => {
    e.preventDefault();
    const letter = e.dataTransfer.getData("text");
    const source = e.dataTransfer.getData("source");
    
    // Check if cell already has a letter (text node that's not in a span)
    const existingLetter = Array.from(cell.childNodes)
      .filter(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim())
      .length > 0;
    
    if (!existingLetter && !confirmedCells.has(cell)) {
      // Add letter as text node (not replacing the label)
      const textNode = document.createTextNode(letter);
      cell.appendChild(textNode);
      turnTiles.add(cell);
      
      if (source === "rack") {
        // Remove the dragged tile from rack
        const draggingTile = rack.querySelector(".tile.dragging");
        if (draggingTile) {
          draggingTile.remove();
        }
      } else if (source === "board") {
        // Remove letter from old cell
        const draggingCell = document.querySelector(".cell.dragging-cell");
        if (draggingCell) {
          // Remove only text nodes, keep the label
          Array.from(draggingCell.childNodes)
            .filter(node => node.nodeType === Node.TEXT_NODE)
            .forEach(node => node.remove());
          draggingCell.draggable = false;
          draggingCell.style.cursor = "";
          turnTiles.delete(draggingCell);
        }
      }
    }
  });
});

document.getElementById("shuffle").addEventListener("click", () => {
  if (!gameStarted) return;
  
  // Only shuffle tiles currently in rack (don't generate new ones)
  const currentPlayer = players[currentPlayerIndex];
  currentPlayer.rack.sort(() => Math.random() - 0.5);
  
  rack.innerHTML = "";
  currentPlayer.rack.forEach(letter => {
    const tile = createTile(letter);
    rack.appendChild(tile);
  });
});

// --- Dictionary API ---
async function checkWordValidity(word) {
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`;
  try {
    const res = await fetch(url);
    return res.ok;
  } catch (error) {
    console.error(`Failed to validate "${word}":`, error);
    return false;
  }
}

// --- Get Board Array ---
function getBoardArray() {
  const cells = Array.from(document.querySelectorAll(".cell"));
  const boardArray = Array(SIZE).fill().map(() => Array(SIZE).fill(""));
  cells.forEach(cell => {
    const r = parseInt(cell.dataset.row);
    const c = parseInt(cell.dataset.col);
    
    // Get only text nodes (letters), not the premium label
    const letterText = Array.from(cell.childNodes)
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent.trim())
      .join('');
    
    boardArray[r][c] = letterText;
  });
  return boardArray;
}

// --- Find all words (like before) ---
function getAllWords(boardArray) {
  const words = [];
  const positions = [];

  // Horizontal
  for (let r = 0; r < SIZE; r++) {
    let word = "";
    let coords = [];
    for (let c = 0; c < SIZE; c++) {
      const ch = boardArray[r][c];
      if (/[A-Z]/.test(ch)) {
        word += ch;
        coords.push([r, c]);
      } else {
        if (word.length >= 2) {
          words.push(word);
          positions.push(coords);
        }
        word = "";
        coords = [];
      }
    }
    if (word.length >= 2) {
      words.push(word);
      positions.push(coords);
    }
  }

  // Vertical
  for (let c = 0; c < SIZE; c++) {
    let word = "";
    let coords = [];
    for (let r = 0; r < SIZE; r++) {
      const ch = boardArray[r][c];
      if (/[A-Z]/.test(ch)) {
        word += ch;
        coords.push([r, c]);
      } else {
        if (word.length >= 2) {
          words.push(word);
          positions.push(coords);
        }
        word = "";
        coords = [];
      }
    }
    if (word.length >= 2) {
      words.push(word);
      positions.push(coords);
    }
  }

  return { words, positions };
}

// --- Submit Turn ---
document.getElementById("submit").addEventListener("click", async () => {
  if (!gameStarted) {
    alert("Please start a game first!");
    return;
  }
  
  if (turnTiles.size === 0) {
    alert("You haven't placed any tiles this turn!");
    return;
  }

  const boardArray = getBoardArray();
  const { words, positions } = getAllWords(boardArray);

  // Only check words that include at least one tile from this turn
  const newWords = [];
  const newPositions = [];

  for (let i = 0; i < words.length; i++) {
    const coords = positions[i];
    const includesNewTile = coords.some(([r, c]) => {
      const cell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
      return turnTiles.has(cell);
    });
    if (includesNewTile) {
      newWords.push(words[i]);
      newPositions.push(coords);
    }
  }

  if (newWords.length === 0) {
    alert("No new words formed!");
    return;
  }

  let validWords = [];
  let invalidWords = [];
  let turnScore = 0;

  for (const word of newWords) {
    const isValid = await checkWordValidity(word.toLowerCase());
    if (isValid) {
      validWords.push(word);

      // Find the word's position to calculate score with multipliers
      const wordIndex = newWords.indexOf(word);
      const wordCoords = newPositions[wordIndex];
      
      let wordScore = 0;
      let wordMultiplier = 1;
      
      // Calculate score for each letter in the word
      for (const [r, c] of wordCoords) {
        const cell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
        
        // Get the letter (text node, not the label)
        const letterText = Array.from(cell.childNodes)
          .filter(node => node.nodeType === Node.TEXT_NODE)
          .map(node => node.textContent.trim())
          .join('');
        
        let letterScore = letterValues[letterText];
        
        // Apply multipliers only for NEW tiles placed this turn
        if (turnTiles.has(cell)) {
          const premiumType = getPremiumType(r, c);
          
          if (premiumType === 'TL') {
            letterScore *= 3;
          } else if (premiumType === 'DL') {
            letterScore *= 2;
          } else if (premiumType === 'TW') {
            wordMultiplier *= 3;
          } else if (premiumType === 'DW' || premiumType === 'STAR') {
            wordMultiplier *= 2;
          }
        }
        
        wordScore += letterScore;
      }
      
      wordScore *= wordMultiplier;
      turnScore += wordScore;

    } else {
      invalidWords.push(word);
    }
  }

  if (validWords.length > 0) {
    const currentPlayer = players[currentPlayerIndex];
    currentPlayer.score += turnScore;
    
    alert(`✅ Valid words this turn:\n${validWords.join(", ")}\n+${turnScore} points!`);
    
    // Lock in tiles (they can't be moved anymore)
    turnTiles.forEach(cell => confirmedCells.add(cell));
    turnTiles.clear();
    
    // Disable trash bin for this player permanently
    currentPlayer.canUseTrashBin = false;
    
    // Update current player's rack from DOM
    currentPlayer.rack = Array.from(rack.querySelectorAll(".tile")).map(t => t.textContent);
    
    // REFILL current player's rack to 7 tiles
    const tilesToDraw = 7 - currentPlayer.rack.length;
    
    for (let i = 0; i < tilesToDraw; i++) {
      const newLetter = drawTile();
      if (newLetter) {
        currentPlayer.rack.push(newLetter);
      } else {
        alert("🎉 No more tiles in the bag! Game is ending soon.");
        break;
      }
    }
    
    // Update scoreboard
    updateScoreboard();
    
    // Move to next player
    const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
    showPlayerTransition(nextPlayerIndex);
    currentPlayerIndex = nextPlayerIndex;
  }
  
  if (invalidWords.length > 0) {
    alert(`❌ Invalid words:\n${invalidWords.join(", ")}\nTurn not submitted. Remove invalid tiles and try again.`);
  }
});