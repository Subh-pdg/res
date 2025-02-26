/* app.js - Updated for PWA integration and improved code structure */

// Global variables
let db;
let currentAudio = null;
let lyricsDatabaseContent = ""; // Holds the lyrics database text

// Open IndexedDB with version 2 (for songs and lyricsDatabase)
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("MelodorDB", 2);
    request.onerror = (e) => {
      console.error("Error opening DB", e);
      reject(e);
    };
    request.onupgradeneeded = (e) => {
      db = e.target.result;
      if (!db.objectStoreNames.contains("songs")) {
        db.createObjectStore("songs", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("lyricsDatabase")) {
        db.createObjectStore("lyricsDatabase", { keyPath: "id" });
      }
    };
    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };
  });
}

// Store the lyrics database text in IndexedDB
function storeLyricsDatabase(content) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("lyricsDatabase", "readwrite");
    const store = tx.objectStore("lyricsDatabase");
    const request = store.put({ id: "database", data: content });
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e);
  });
}

// Retrieve the lyrics database text from IndexedDB
function getLyricsDatabase() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("lyricsDatabase", "readonly");
    const store = tx.objectStore("lyricsDatabase");
    const request = store.get("database");
    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result.data);
      } else {
        resolve("");
      }
    };
    request.onerror = (e) => reject(e);
  });
}

// Reset both the songs database and the lyrics suggestion database
function resetAppDatabase() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["songs", "lyricsDatabase"], "readwrite");
    const songsStore = tx.objectStore("songs");
    const lyricsStore = tx.objectStore("lyricsDatabase");
    songsStore.clear();
    lyricsStore.clear();
    tx.oncomplete = () => {
      lyricsDatabaseContent = "";
      resolve();
    };
    tx.onerror = (e) => reject(e);
  });
}

// Display notifications to the user
function showNotification(message, type = "success") {
  const container = document.getElementById("notification");
  // Limit maximum notifications to 5; remove oldest if needed.
  while (container.children.length >= 5) {
    container.removeChild(container.firstChild);
  }
  const notif = document.createElement("div");
  notif.className = `notification ${type}`;
  notif.innerText = message;
  container.appendChild(notif);
  setTimeout(() => {
    notif.classList.add("hide");
    setTimeout(() => {
      if (container.contains(notif)) {
        container.removeChild(notif);
      }
    }, 500);
  }, 5000);
}

// Display a modal to confirm deletion; returns a promise resolving to true or false
function showDeleteModal(message) {
  return new Promise((resolve) => {
    const modal = document.getElementById("customModal");
    document.getElementById("modalMessage").textContent = message;
    modal.classList.add("show");
    modal.style.display = "flex";
    const yesBtn = modal.querySelector(".btn-confirm");
    const noBtn = modal.querySelector(".btn-cancel");
    function cleanUp() {
      yesBtn.removeEventListener("click", onYes);
      noBtn.removeEventListener("click", onNo);
      modal.classList.remove("show");
      modal.style.display = "none";
    }
    function onYes() { cleanUp(); resolve(true); }
    function onNo() { cleanUp(); resolve(false); }
    yesBtn.addEventListener("click", onYes);
    noBtn.addEventListener("click", onNo);
  });
}

// Navigate to a specific page; pauses audio if leaving songDetails
function navigate(page) {
  if (page !== "songDetails" && currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  if (page === "home") {
    document.getElementById("homePage").classList.add("active");
  } else if (page === "addSong") {
    document.getElementById("addSongPage").classList.add("active");
  } else if (page === "editSong") {
    document.getElementById("editSongPage").classList.add("active");
  } else if (page === "songList") {
    document.getElementById("songListPage").classList.add("active");
    loadSongList();
  } else if (page === "songDetails") {
    document.getElementById("songDetailsPage").classList.add("active");
  } else if (page === "settings") {
    document.getElementById("settingsPage").classList.add("active");
  }
}

// IndexedDB CRUD operations for songs
function addSongToDB(song) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("songs", "readwrite");
    const store = tx.objectStore("songs");
    const request = store.add(song);
    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e);
  });
}

function getAllSongs() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("songs", "readonly");
    const store = tx.objectStore("songs");
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e);
  });
}

function getSongById(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("songs", "readonly");
    const store = tx.objectStore("songs");
    const request = store.get(Number(id));
    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e);
  });
}

function updateSongInDB(song) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("songs", "readwrite");
    const store = tx.objectStore("songs");
    const request = store.put(song);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e);
  });
}

function deleteSongFromDB(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("songs", "readwrite");
    const store = tx.objectStore("songs");
    const request = store.delete(Number(id));
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e);
  });
}

// Load favourite songs and update the home page list
async function loadFavouriteSongs() {
  try {
    const songs = await getAllSongs();
    const favList = document.getElementById("favouriteSongs");
    favList.innerHTML = "";
    songs.filter(song => song.isFavourite).forEach(song => {
      const li = document.createElement("li");
      li.className = "song-item";
      li.textContent = song.songName;
      li.addEventListener("click", () => renderSongDetails(song.id));
      favList.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    showNotification("Error loading favourite songs", "error");
  }
}

// Load all songs and update the song list page
async function loadSongList() {
  try {
    const songs = await getAllSongs();
    const list = document.getElementById("songList");
    list.innerHTML = "";
    const seen = new Set();
    songs.forEach(song => {
      const key = song.songName + " - " + song.singerName;
      if (seen.has(key)) return;
      seen.add(key);
      const li = document.createElement("li");
      li.className = "song-item";
      const infoDiv = document.createElement("div");
      infoDiv.className = "song-info";
      infoDiv.textContent = `${song.songName} - ${song.singerName}`;
      infoDiv.addEventListener("click", () => renderSongDetails(song.id));
      const heart = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      heart.setAttribute("viewBox", "0 0 24 24");
      heart.classList.add("heart");
      heart.innerHTML = song.isFavourite ?
        '<path fill="red" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>' :
        '<path fill="none" stroke="red" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>';
      heart.addEventListener("click", async (e) => {
        e.stopPropagation();
        song.isFavourite = !song.isFavourite;
        try {
          await updateSongInDB(song);
          loadFavouriteSongs();
          loadSongList();
          showNotification("Favourite status updated", "success");
        } catch (err) {
          console.error(err);
          showNotification("Error updating favourite status", "error");
        }
      });
      const editBtn = document.createElement("button");
      editBtn.className = "btn-icon edit-btn";
      editBtn.innerHTML = '<i class="fas fa-pen-to-square"></i>';
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openEditForm(song);
      });
      const delBtn = document.createElement("button");
      delBtn.className = "btn-icon delete-btn";
      delBtn.innerHTML = '<i class="fas fa-trash"></i>';
      delBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const confirmed = await showDeleteModal("Are you sure you want to delete this song?");
        if (confirmed) {
          try {
            await deleteSongFromDB(song.id);
            loadFavouriteSongs();
            loadSongList();
            showNotification("Song deleted", "warning");
          } catch (err) {
            console.error(err);
            showNotification("Error deleting song", "error");
          }
        }
      });
      const backupBtn = document.createElement("button");
      backupBtn.className = "btn-icon backup-btn";
      backupBtn.innerHTML = '<i class="fas fa-cloud-download-alt"></i>';
      backupBtn.title = "Download Backup";
      backupBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        downloadSongBackup(song);
      });
      const audioDetailsBtn = document.createElement("button");
      audioDetailsBtn.className = "btn-icon audio-details-btn";
      audioDetailsBtn.innerHTML = '<i class="fas fa-file-download"></i>';
      audioDetailsBtn.title = "Download Audio & Details";
      audioDetailsBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        downloadSongAudioAndDetails(song);
      });
      
      li.appendChild(infoDiv);
      li.appendChild(heart);
      li.appendChild(editBtn);
      li.appendChild(delBtn);
      li.appendChild(backupBtn);
      li.appendChild(audioDetailsBtn);
      list.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    showNotification("Error loading songs", "error");
  }
}

async function renderSongDetails(id) {
  try {
    const song = await getSongById(id);
    if (!song) return;
    navigate("songDetails");
    const detailsDiv = document.getElementById("songDetails");
    detailsDiv.innerHTML = `
      <div class="song-details-card">
        <button id="backToList" title="Back"><i class="fas fa-arrow-left"></i></button>
        <h3>${song.songName}</h3>
        <p><strong>Song Writer:</strong> ${song.songWriter}</p>
        <p><strong>Singer:</strong> ${song.singerName}</p>
        <div class="audio-container">
          <audio controls src="${URL.createObjectURL(song.audioFile)}">
            Your browser does not support the audio element.
          </audio>
        </div>
        <div id="lyricsDisplay">
          ${
            song.lyricsOption === "text" 
              ? `<pre>${song.lyricsText || ""}</pre>` 
              : (song.lyricsImage 
                    ? `<div class="image-container"><img style="image-rendering: crisp-edges; max-width: 100%; height: auto;" src="${URL.createObjectURL(song.lyricsImage)}" alt="Lyrics Image"></div>` 
                    : "")
          }
        </div>
      </div>
    `;
    document.getElementById("backToList").addEventListener("click", () => {
      navigate("songList");
    });
  } catch (err) {
    console.error(err);
    showNotification("Error loading song details", "error");
  }
}

async function openEditForm(song) {
  try {
    navigate("editSong");
    document.getElementById("editSongId").value = song.id;
    document.getElementById("editSongName").value = song.songName;
    document.getElementById("editSongWriter").value = song.songWriter;
    document.getElementById("editSingerName").value = song.singerName;
    document.getElementById("editAudioFile").value = "";
    document.getElementById("editLyricsImage").value = "";
    document.getElementById("editLyricsImagePreview").innerHTML = "";
    document.getElementById("removeEditLyricsImage").classList.add("hidden");
    if (song.lyricsOption === "text") {
      document.getElementById("editToggleText").classList.add("active");
      document.getElementById("editToggleImage").classList.remove("active");
      document.getElementById("editLyricsTextDiv").classList.remove("hidden");
      document.getElementById("editLyricsImageDiv").classList.add("hidden");
      document.getElementById("editLyricsText").value = song.lyricsText || "";
      document.getElementById("editLyricsImage").value = "";
    } else {
      document.getElementById("editToggleImage").classList.add("active");
      document.getElementById("editToggleText").classList.remove("active");
      document.getElementById("editLyricsImageDiv").classList.remove("hidden");
      document.getElementById("editLyricsTextDiv").classList.add("hidden");
      if (song.lyricsImage) {
        const preview = document.getElementById("editLyricsImagePreview");
        preview.innerHTML = `<img style="image-rendering: crisp-edges; max-width: 100%; height: auto;" src="${URL.createObjectURL(song.lyricsImage)}" alt="Lyrics Image Preview">`;
        document.getElementById("removeEditLyricsImage").classList.remove("hidden");
      }
    }
  } catch (err) {
    console.error(err);
    showNotification("Error opening edit form", "error");
  }
}

// Utility functions to convert blobs to/from DataURLs
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function dataURLToBlob(dataURL) {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while(n--) { u8arr[n] = bstr.charCodeAt(n); }
  return new Blob([u8arr], { type: mime });
}

// Export all songs as JSON
async function exportAllSongs() {
  const exportBtn = document.getElementById("exportBtn");
  exportBtn.disabled = true;
  try {
    const songs = await getAllSongs();
    const exportData = [];
    for (const song of songs) {
      const audioData = await blobToDataURL(song.audioFile);
      let lyricsImageData = null;
      if (song.lyricsImage) {
        lyricsImageData = await blobToDataURL(song.lyricsImage);
      }
      exportData.push({
        songName: song.songName,
        songWriter: song.songWriter,
        singerName: song.singerName,
        audioFileData: audioData,
        lyricsOption: song.lyricsOption,
        lyricsText: song.lyricsText,
        lyricsImageData,
        isFavourite: song.isFavourite
      });
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    const jsonStr = JSON.stringify(exportData, null, 2);
    document.getElementById("exportData").value = jsonStr;
    showNotification("All songs exported as JSON", "success");
  } catch (err) {
    console.error(err);
    showNotification("Error exporting all songs", "error");
  } finally {
    exportBtn.disabled = false;
  }
}

// Download a backup JSON for a specific song
async function downloadSongBackup(song) {
  try {
    const audioData = await blobToDataURL(song.audioFile);
    let lyricsImageData = null;
    if (song.lyricsImage) {
      lyricsImageData = await blobToDataURL(song.lyricsImage);
    }
    const exportObj = {
      songName: song.songName,
      songWriter: song.songWriter,
      singerName: song.singerName,
      audioFileData: audioData,
      lyricsOption: song.lyricsOption,
      lyricsText: song.lyricsText,
      lyricsImageData,
      isFavourite: song.isFavourite
    };
    const jsonStr = JSON.stringify(exportObj, null, 2);
    const blobObj = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blobObj);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${song.songName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_backup.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification("Song backup downloaded", "success");
  } catch (err) {
    console.error(err);
    showNotification("Error downloading song backup", "error");
  }
}

// Download audio and song details (and lyrics image if provided)
async function downloadSongAudioAndDetails(song) {
  try {
    let extension = "";
    const mime = song.audioFile.type;
    if (mime.includes("mpeg")) extension = ".mp3";
    else if (mime.includes("wav")) extension = ".wav";
    else if (mime.includes("ogg")) extension = ".ogg";
    const audioUrl = URL.createObjectURL(song.audioFile);
    const audioAnchor = document.createElement("a");
    audioAnchor.href = audioUrl;
    audioAnchor.download = `${song.songName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}${extension}`;
    document.body.appendChild(audioAnchor);
    audioAnchor.click();
    document.body.removeChild(audioAnchor);
    URL.revokeObjectURL(audioUrl);
    
    let detailsText = `Song Name: ${song.songName}
Song Writer: ${song.songWriter}
Singer: ${song.singerName}
Lyrics Option: ${song.lyricsOption}

Lyrics:
${song.lyricsOption === "text" ? song.lyricsText : "Lyrics image provided"}

Favourite: ${song.isFavourite ? "Yes" : "No"}
`;
    const detailsBlob = new Blob([detailsText], { type: "text/plain" });
    const detailsUrl = URL.createObjectURL(detailsBlob);
    const detailsAnchor = document.createElement("a");
    detailsAnchor.href = detailsUrl;
    detailsAnchor.download = `${song.songName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_details.txt`;
    document.body.appendChild(detailsAnchor);
    detailsAnchor.click();
    document.body.removeChild(detailsAnchor);
    URL.revokeObjectURL(detailsUrl);
    
    if (song.lyricsOption === "image" && song.lyricsImage) {
      let imgExt = "";
      const imgMime = song.lyricsImage.type;
      if (imgMime.includes("jpeg") || imgMime.includes("jpg")) imgExt = ".jpg";
      else if (imgMime.includes("png")) imgExt = ".png";
      else if (imgMime.includes("gif")) imgExt = ".gif";
      else imgExt = ".img";
      const imgUrl = URL.createObjectURL(song.lyricsImage);
      const imgAnchor = document.createElement("a");
      imgAnchor.href = imgUrl;
      imgAnchor.download = `${song.songName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_lyrics${imgExt}`;
      document.body.appendChild(imgAnchor);
      imgAnchor.click();
      document.body.removeChild(imgAnchor);
      URL.revokeObjectURL(imgUrl);
    }
    
    showNotification("Song audio and details downloaded", "success");
  } catch (err) {
    console.error(err);
    showNotification("Error downloading song audio/details", "error");
  }
}

// Import a song from a JSON file
function importSong() {
  const fileInput = document.getElementById("importFile");
  if (fileInput.files.length === 0) {
    showNotification("Please select a JSON file to import", "error");
    return;
  }
  const file = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const audioFile = data.audioFileData ? dataURLToBlob(data.audioFileData) : null;
      const lyricsImage = data.lyricsImageData ? dataURLToBlob(data.lyricsImageData) : null;
      const song = {
        songName: data.songName,
        songWriter: data.songWriter,
        singerName: data.singerName,
        audioFile,
        lyricsOption: data.lyricsOption,
        lyricsText: data.lyricsText,
        lyricsImage,
        isFavourite: data.isFavourite || false
      };
      await addSongToDB(song);
      showNotification("Song imported successfully", "success");
      loadSongList();
    } catch (err) {
      console.error(err);
      showNotification("Error importing song", "error");
    }
  };
  reader.readAsText(file);
}

// Search the lyrics database for a query and return results
function searchLyricsDatabase(query) {
  if (!lyricsDatabaseContent) {
    showNotification("No lyrics database loaded. Please load a .txt file in Settings > Database.", "error");
    return [];
  }
  if (!query.trim()) {
    showNotification("Search query is empty.", "warning");
    return [];
  }
  const entries = lyricsDatabaseContent.split("* -").map(e => e.trim()).filter(e => e);
  const results = [];
  const normalizedQuery = query.replace(/\s+/g, "").toLowerCase();
  entries.forEach(entry => {
    const normalizedEntry = entry.replace(/\s+/g, "").toLowerCase();
    if (normalizedEntry.includes(normalizedQuery)) {
      const regex = new RegExp(query, "gi");
      const highlighted = entry.replace(regex, (match) => `<mark class="highlight">${match}</mark>`);
      results.push({ original: entry, highlighted });
    }
  });
  return results;
}

// Open the search modal with results and copy selected lyrics into the target textarea
function openSearchModal(results, targetTextAreaId) {
  const modal = document.getElementById("searchModal");
  const resultsContainer = document.getElementById("searchResults");
  resultsContainer.innerHTML = "";
  modal.classList.add("active");
  modal.style.display = "flex";
  if (results.length === 0) {
    resultsContainer.innerHTML = "<p>No matching lyrics found.</p>";
  } else {
    results.forEach(result => {
      const card = document.createElement("div");
      card.className = "search-result-card";
      const maxLength = 200;
      let displayed = result.highlighted;
      let truncated = false;
      if (result.original.length > maxLength) {
        displayed = result.highlighted.substring(0, maxLength) + "...";
        truncated = true;
      }
      card.innerHTML = `<div class="result-content" style="white-space: pre-wrap;">${displayed}</div>`;
      if (truncated) {
        const toggle = document.createElement("span");
        toggle.className = "show-more";
        toggle.innerText = "Show More";
        toggle.style.cssText = "background: #f5576c; color: #fff; padding: 4px 10px; border-radius: 4px; margin-right: 10px; cursor: pointer;";
        toggle.addEventListener("click", () => {
          if (toggle.innerText === "Show More") {
            card.querySelector(".result-content").innerHTML = result.highlighted;
            toggle.innerText = "Show Less";
          } else {
            card.querySelector(".result-content").innerHTML = result.highlighted.substring(0, maxLength) + "...";
            toggle.innerText = "Show More";
          }
        });
        card.appendChild(toggle);
      }
      const useBtn = document.createElement("span");
      useBtn.className = "use-lyrics";
      useBtn.innerText = "Use Lyrics";
      useBtn.style.cssText = "background: #28a745; color: #fff; padding: 4px 10px; border-radius: 4px; cursor: pointer;";
      useBtn.addEventListener("click", () => {
        document.getElementById(targetTextAreaId).value = result.original;
        closeSearchModal();
        showNotification("Lyrics copied into editor.", "success");
      });
      card.appendChild(useBtn);
      resultsContainer.appendChild(card);
    });
  }
}

// Close the search modal
function closeSearchModal() {
  const modal = document.getElementById("searchModal");
  modal.classList.remove("active");
  modal.style.display = "none";
}

// Initialize the settings page (switching between Transfer and Database tabs)
function initSettingsPage() {
  const transferTab = document.getElementById("settingsTransferTab");
  const databaseTab = document.getElementById("settingsDatabaseTab");
  const transferSection = document.getElementById("settingsTransferSection");
  const databaseSection = document.getElementById("settingsDatabaseSection");

  transferTab.addEventListener("click", () => {
    transferTab.classList.add("active");
    transferTab.classList.remove("inactive");
    databaseTab.classList.remove("active");
    databaseTab.classList.add("inactive");
    transferSection.classList.add("active");
    databaseSection.classList.remove("active");
  });
  databaseTab.addEventListener("click", () => {
    databaseTab.classList.add("active");
    databaseTab.classList.remove("inactive");
    transferTab.classList.remove("active");
    transferTab.classList.add("inactive");
    databaseSection.classList.add("active");
    transferSection.classList.remove("active");
  });
  document.getElementById("databaseFile").addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        lyricsDatabaseContent = reader.result;
        storeLyricsDatabase(lyricsDatabaseContent)
          .then(() => showNotification("Lyrics database loaded and saved.", "success"))
          .catch(() => showNotification("Error saving lyrics database.", "error"));
      };
      reader.onerror = () => {
        showNotification("Error reading lyrics database.", "error");
      };
      reader.readAsText(file);
    }
  });
  document.getElementById("closeSearchModal").addEventListener("click", closeSearchModal);
}

// Initialize lyrics search buttons on both Add and Edit forms
function initLyricsSearchButtons() {
  document.getElementById("lyricsSearchBtn").addEventListener("click", () => {
    const query = document.getElementById("lyricsText").value;
    if (!query.trim()) {
      showNotification("Search query is empty.", "warning");
      return;
    }
    const results = searchLyricsDatabase(query);
    openSearchModal(results, "lyricsText");
  });
  document.getElementById("editLyricsSearchBtn").addEventListener("click", () => {
    const query = document.getElementById("editLyricsText").value;
    if (!query.trim()) {
      showNotification("Search query is empty.", "warning");
      return;
    }
    const results = searchLyricsDatabase(query);
    openSearchModal(results, "editLyricsText");
  });
}

// Initialize all event listeners
function initEventListeners() {
  document.querySelectorAll("nav a").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const page = link.getAttribute("data-page");
      navigate(page);
    });
  });
  
  initSettingsPage();
  initLyricsSearchButtons();
  
  // Toggle buttons for adding a song
  document.getElementById("toggleText").addEventListener("click", () => {
    const lyricsImageInput = document.getElementById("lyricsImage");
    if (lyricsImageInput.files.length > 0) {
      showNotification("Warning: Cannot switch to typed lyrics because a lyrics image is already selected. Please remove the image first.", "warning");
      return;
    }
    document.getElementById("toggleText").classList.add("active");
    document.getElementById("toggleImage").classList.remove("active");
    document.getElementById("lyricsTextDiv").classList.remove("hidden");
    document.getElementById("lyricsImageDiv").classList.add("hidden");
  });
  document.getElementById("toggleImage").addEventListener("click", () => {
    const lyricsTextValue = document.getElementById("lyricsText").value;
    if (lyricsTextValue.trim() !== "") {
      showNotification("Warning: Cannot switch to image upload because lyrics have been typed. Please clear the text first.", "warning");
      return;
    }
    document.getElementById("toggleImage").classList.add("active");
    document.getElementById("toggleText").classList.remove("active");
    document.getElementById("lyricsImageDiv").classList.remove("hidden");
    document.getElementById("lyricsTextDiv").classList.add("hidden");
  });
  
  document.getElementById("lyricsImage").addEventListener("change", (e) => {
    const removeBtn = document.getElementById("removeLyricsImage");
    const preview = document.getElementById("lyricsImagePreview");
    if (e.target.files.length > 0) {
      removeBtn.classList.remove("hidden");
      const file = e.target.files[0];
      preview.innerHTML = `<img style="image-rendering: crisp-edges; max-width: 100%; height: auto;" src="${URL.createObjectURL(file)}" alt="Lyrics Image Preview">`;
    } else {
      removeBtn.classList.add("hidden");
      preview.innerHTML = "";
    }
  });
  document.getElementById("removeLyricsImage").addEventListener("click", () => {
    document.getElementById("lyricsImage").value = "";
    document.getElementById("removeLyricsImage").classList.add("hidden");
    document.getElementById("lyricsImagePreview").innerHTML = "";
  });
  
  // Submit event for Add Song form
  document.getElementById("songForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const songName = document.getElementById("songName").value;
    const songWriter = document.getElementById("songWriter").value;
    const singerName = document.getElementById("singerName").value;
    const audioFileInput = document.getElementById("audioFile");
    if (audioFileInput.files.length === 0) {
      showNotification("Please select an audio file", "error");
      return;
    }
    const audioFile = audioFileInput.files[0];
    let lyricsOption, lyricsText = "", lyricsImage = null;
    if (document.getElementById("toggleText").classList.contains("active")) {
      lyricsOption = "text";
      lyricsText = document.getElementById("lyricsText").value;
      if (document.getElementById("lyricsImage").files.length > 0) {
        showNotification("Error: Cannot upload a lyrics image when using typed lyrics", "error");
        return;
      }
    } else {
      lyricsOption = "image";
      const lyricsImageInput = document.getElementById("lyricsImage");
      if (lyricsImageInput.files.length === 0) {
        showNotification("Please select a lyrics image", "error");
        return;
      }
      lyricsImage = lyricsImageInput.files[0];
    }
    const song = {
      songName,
      songWriter,
      singerName,
      audioFile,
      lyricsOption,
      lyricsText,
      lyricsImage,
      isFavourite: false
    };
    try {
      await addSongToDB(song);
      showNotification("Song saved successfully", "success");
      document.getElementById("songForm").reset();
      document.getElementById("toggleText").click();
      loadSongList();
    } catch (err) {
      console.error(err);
      showNotification("Error saving song", "error");
    }
  });
  
  // Toggle buttons for editing a song
  document.getElementById("editToggleText").addEventListener("click", () => {
    const editLyricsImageInput = document.getElementById("editLyricsImage");
    if (editLyricsImageInput.files.length > 0) {
      showNotification("Warning: Cannot switch to typed lyrics because a lyrics image is already selected. Please remove the image first.", "warning");
      return;
    }
    document.getElementById("editToggleText").classList.add("active");
    document.getElementById("editToggleImage").classList.remove("active");
    document.getElementById("editLyricsTextDiv").classList.remove("hidden");
    document.getElementById("editLyricsImageDiv").classList.add("hidden");
  });
  document.getElementById("editToggleImage").addEventListener("click", () => {
    const editLyricsTextValue = document.getElementById("editLyricsText").value;
    if (editLyricsTextValue.trim() !== "") {
      showNotification("Warning: Cannot switch to image upload because lyrics have been typed. Please clear the text first.", "warning");
      return;
    }
    document.getElementById("editToggleImage").classList.add("active");
    document.getElementById("editToggleText").classList.remove("active");
    document.getElementById("editLyricsImageDiv").classList.remove("hidden");
    document.getElementById("editLyricsTextDiv").classList.add("hidden");
  });
  
  document.getElementById("editLyricsImage").addEventListener("change", (e) => {
    const removeBtn = document.getElementById("removeEditLyricsImage");
    const preview = document.getElementById("editLyricsImagePreview");
    if (e.target.files.length > 0) {
      removeBtn.classList.remove("hidden");
      const file = e.target.files[0];
      preview.innerHTML = `<img style="image-rendering: crisp-edges; max-width: 100%; height: auto;" src="${URL.createObjectURL(file)}" alt="Lyrics Image Preview">`;
    } else {
      removeBtn.classList.add("hidden");
      preview.innerHTML = "";
    }
  });
  document.getElementById("removeEditLyricsImage").addEventListener("click", () => {
    document.getElementById("editLyricsImage").value = "";
    document.getElementById("removeEditLyricsImage").classList.add("hidden");
    document.getElementById("editLyricsImagePreview").innerHTML = "";
  });
  
  // Submit event for Edit Song form
  document.getElementById("editSongForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("editSongId").value;
    const songName = document.getElementById("editSongName").value;
    const songWriter = document.getElementById("editSongWriter").value;
    const singerName = document.getElementById("editSingerName").value;
    const audioFileInput = document.getElementById("editAudioFile");
    let audioFile = null;
    if (audioFileInput.files.length > 0) {
      audioFile = audioFileInput.files[0];
    }
    let lyricsOption, lyricsText = "", lyricsImage = null;
    if (document.getElementById("editToggleText").classList.contains("active")) {
      lyricsOption = "text";
      lyricsText = document.getElementById("editLyricsText").value;
      if (document.getElementById("editLyricsImage").files.length > 0) {
        showNotification("Error: Cannot upload a lyrics image when using typed lyrics", "error");
        return;
      }
    } else {
      lyricsOption = "image";
      const lyricsImageInput = document.getElementById("editLyricsImage");
      if (lyricsImageInput.files.length > 0) {
        lyricsImage = lyricsImageInput.files[0];
      }
    }
    try {
      const song = await getSongById(id);
      if (!song) return;
      song.songName = songName;
      song.songWriter = songWriter;
      song.singerName = singerName;
      if (audioFile) song.audioFile = audioFile;
      song.lyricsOption = lyricsOption;
      if (lyricsOption === "text") {
        song.lyricsText = lyricsText;
      } else if (lyricsImage) {
        song.lyricsImage = lyricsImage;
      }
      await updateSongInDB(song);
      showNotification("Song updated successfully", "success");
      navigate("songList");
      loadSongList();
    } catch (err) {
      console.error(err);
      showNotification("Error updating song", "error");
    }
  });
  
  document.getElementById("cancelEdit").addEventListener("click", () => {
    navigate("songList");
  });
  
  document.getElementById("exportBtn").addEventListener("click", exportAllSongs);
  document.getElementById("copyExportBtn").addEventListener("click", () => {
    const exportDataText = document.getElementById("exportData").value;
    if (exportDataText) {
      navigator.clipboard.writeText(exportDataText).then(() => {
         showNotification("Exported JSON copied to clipboard", "success");
      }).catch(err => {
         console.error(err);
         showNotification("Error copying to clipboard", "error");
      });
    } else {
      showNotification("No export data to copy", "warning");
    }
  });
  document.getElementById("importBtn").addEventListener("click", importSong);
  
  // Reset Database Functionality
  document.getElementById("resetDatabaseBtn").addEventListener("click", () => {
    const resetModal = document.getElementById("resetModal");
    resetModal.classList.add("active");
    resetModal.style.display = "flex";
  });
  
  document.getElementById("cancelResetBtn").addEventListener("click", () => {
    const resetModal = document.getElementById("resetModal");
    resetModal.classList.remove("active");
    resetModal.style.display = "none";
  });
  
  document.getElementById("confirmResetBtn").addEventListener("click", async () => {
    const code = document.getElementById("resetCodeInput").value;
    if (code !== "YESTORESET") {
      showNotification("Incorrect reset code. Database reset aborted.", "error");
      return;
    }
    try {
      await resetAppDatabase();
      showNotification("Songs and lyrics database reset successfully.", "success");
    } catch (err) {
      console.error(err);
      showNotification("Error resetting the database.", "error");
    } finally {
      document.getElementById("resetCodeInput").value = "";
      const resetModal = document.getElementById("resetModal");
      resetModal.classList.remove("active");
      resetModal.style.display = "none";
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await openDatabase();
    lyricsDatabaseContent = await getLyricsDatabase();
    initEventListeners();
    navigate("home");
    loadFavouriteSongs();
    loadSongList();
  } catch (err) {
    console.error("Initialization error", err);
    showNotification("Error initializing app", "error");
  }
});
