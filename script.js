const board = document.getElementById("board");
const rack = document.getElementById("rack");
const scoreDisplay = document.getElementById("score");

let totalScore = 0;
let turnTiles = new Set(); // tiles placed this turn
let confirmedCells = new Set(); // already played (locked) cells

const SIZE = 15;
const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const letterValues = {
  A:1,B:3,C:3,D:2,E:1,F:4,G:2,H:4,I:1,J:8,K:5,L:1,M:3,
  N:1,O:1,P:3,Q:10,R:1,S:1,T:1,U:1,V:4,W:4,X:8,Y:4,Z:10
};

// --- Build 15x15 board ---
for (let i = 0; i < SIZE * SIZE; i++) {
  const cell = document.createElement("div");
  cell.classList.add("cell");
  cell.dataset.row = Math.floor(i / SIZE);
  cell.dataset.col = i % SIZE;
  board.appendChild(cell);
}

// --- Generate Rack ---
function generateRack() {
  rack.innerHTML = "";
  for (let i = 0; i < 7; i++) {
    const letter = letters[Math.floor(Math.random() * letters.length)];
    const tile = document.createElement("div");
    tile.classList.add("tile");
    tile.draggable = true;
    tile.textContent = letter;

    tile.addEventListener("dragstart", e => {
      e.dataTransfer.setData("text", letter);
    });

    rack.appendChild(tile);
  }
}
generateRack();

// --- Drop letters ---
document.querySelectorAll(".cell").forEach(cell => {
  cell.addEventListener("dragover", e => e.preventDefault());
  cell.addEventListener("drop", e => {
    const letter = e.dataTransfer.getData("text");
    if (!cell.textContent && !confirmedCells.has(cell)) {
      cell.textContent = letter;
      turnTiles.add(cell); // mark this as placed this turn
    }
  });
});

document.getElementById("shuffle").addEventListener("click", generateRack);

// --- Dictionary API ---
async function checkWordValidity(word) {
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`;
  try {
    const res = await fetch(url);
    return res.ok;
  } catch {
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
    boardArray[r][c] = cell.textContent.trim();
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

      // Compute word score
      let wordScore = 0;
      for (const ch of word) {
        wordScore += letterValues[ch];
      }
      turnScore += wordScore;

    } else {
      invalidWords.push(word);
    }
  }

  if (validWords.length > 0) {
    totalScore += turnScore;
    scoreDisplay.textContent = `Score: ${totalScore}`;
    alert(`✅ Valid words this turn:\n${validWords.join(", ")}\n+${turnScore} points!`);
  }
  if (invalidWords.length > 0) {
    alert(`❌ Invalid words:\n${invalidWords.join(", ")}`);
  }

  // Lock in tiles (they can’t be moved anymore)
  turnTiles.forEach(cell => confirmedCells.add(cell));
  turnTiles.clear();
});
