document.addEventListener('DOMContentLoaded', () => {
  let db;
  let songToDelete = null;
  let isSubmitting = false;
  let lyricsDatabaseArray = [];
  let currentSong = null; // Track current song for download JSON
  let playedSongIds = new Set(); // Track songs played in games
  let songCache = {}; // Cache song objects by id for quick updates
  let activationKey = null;
  let activationKeyExpiry = null;
  // Add this near the top with other global variables
  let lastViewedSongId = null;

  // Bulk Export Modal Functionality
  const bulkExportModal = document.getElementById('bulkExportModal');
  const closeBulkExport = document.getElementById('closeBulkExport');
  const selectAllSongs = document.getElementById('selectAllSongs');
  const bulkExportItems = document.getElementById('bulkExportItems');
  const bulkExportWarning = document.getElementById('bulkExportWarning');
  const cancelBulkExport = document.getElementById('cancelBulkExport');
  const confirmBulkExport = document.getElementById('confirmBulkExport');
  const bulkExportBtn = document.getElementById('bulkExportBtn');

  console.log('Modal elements:', {
    bulkExportModal,
    closeBulkExport,
    selectAllSongs,
    bulkExportItems,
    bulkExportWarning,
    cancelBulkExport,
    confirmBulkExport,
    bulkExportBtn
  });

  // Add event listener for the bulk export button
  if (bulkExportBtn) {
    bulkExportBtn.addEventListener('click', () => {
      console.log('Bulk export button clicked');
      showBulkExportModal();
    });
  } else {
    console.error('Bulk export button not found');
  }

  // Function to show the bulk export modal
  function showBulkExportModal() {
    bulkExportModal.style.display = 'flex';
    bulkExportModal.offsetHeight; // Force reflow
    bulkExportModal.classList.add('show');
    
    const loadingSpinner = document.getElementById('bulkExportLoading');
    const songList = document.querySelector('.bulk-export-list');
    
    // Show loading spinner and hide song list
    loadingSpinner.style.display = 'flex';
    songList.style.display = 'none';
    
    // Simulate loading delay
    setTimeout(() => {
      populateSongList();
      // Hide loading spinner and show song list
      loadingSpinner.style.display = 'none';
      songList.style.display = 'block';
    }, 1500); // 1.5 second delay
  }

  // Function to hide the bulk export modal
  function hideBulkExportModal() {
    bulkExportModal.classList.remove('show');
    // Reset search input
    document.getElementById('bulkExportSearch').value = '';
    // Reset select all checkbox
    selectAllSongs.checked = false;
    // Clear all selections
    const items = bulkExportItems.querySelectorAll('.bulk-export-item');
    items.forEach(item => item.classList.remove('selected'));
    // Update warning
    updateWarning();
  }

  // Function to populate the song list
  function populateSongList() {
    const songList = document.querySelector('.bulk-export-list');
    const itemsContainer = document.getElementById('bulkExportItems');
    const loadingSpinner = document.getElementById('bulkExportLoading');
    
    songList.style.display = 'none';
    loadingSpinner.style.display = 'flex';
    itemsContainer.innerHTML = '';
    
    const transaction = db.transaction(['songs'], 'readonly');
    const store = transaction.objectStore('songs');
    
    store.openCursor().onsuccess = e => {
      const cursor = e.target.result;
      if (cursor) {
        const song = cursor.value;
        const item = document.createElement('div');
        item.className = 'bulk-export-item';
        item.dataset.songId = song.id;
        item.dataset.songName = song.songName.toLowerCase();
        item.dataset.singerName = (song.songSinger || '').toLowerCase();
        item.dataset.writerName = (song.songWriter || '').toLowerCase();
        
        item.innerHTML = `
          <div class="song-item-content">
            <div class="song-checkbox">
              <input type="checkbox" id="song-${song.id}">
              <label for="song-${song.id}"></label>
            </div>
            <div class="song-info">
              <div class="song-name">${song.songName}</div>
              <div class="song-details">
                <span class="song-writer">Writer: ${song.songWriter || 'Unknown'}</span>
                <span class="song-singer">Singer: ${song.songSinger || 'Unknown'}</span>
              </div>
            </div>
          </div>
        `;
        
        // Add click event to the entire item
        item.addEventListener('click', (e) => {
          // Don't toggle if clicking the checkbox directly
          if (e.target.tagName === 'INPUT') return;
          
          const checkbox = item.querySelector('input[type="checkbox"]');
          checkbox.checked = !checkbox.checked;
          item.classList.toggle('selected', checkbox.checked);
          updateSelectAllState();
          updateWarning();
        });
        
        // Add change event to the checkbox
        const checkbox = item.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', () => {
          item.classList.toggle('selected', checkbox.checked);
          updateSelectAllState();
          updateWarning();
        });
        
        itemsContainer.appendChild(item);
        cursor.continue();
      } else {
        loadingSpinner.style.display = 'none';
        songList.style.display = 'block';
        updateSelectAllState();
        updateWarning();
      }
    };
  }

  function updateSelectAllState() {
    const items = document.querySelectorAll('.bulk-export-item');
    const selectAllCheckbox = document.getElementById('selectAllSongs');
    const allSelected = items.length > 0 && Array.from(items).every(item => 
      item.querySelector('input[type="checkbox"]').checked
    );
    selectAllCheckbox.checked = allSelected;
  }

  function updateWarning() {
    const selectedCount = document.querySelectorAll('.bulk-export-item input[type="checkbox"]:checked').length;
    const warning = document.getElementById('bulkExportWarning');
    
    if (selectedCount > 0) {
      warning.textContent = `${selectedCount} song${selectedCount > 1 ? 's' : ''} selected`;
      warning.style.display = 'block';
    } else {
      warning.textContent = 'Please select at least one song to export';
      warning.style.display = 'block';
    }
  }

  // Event Listeners for bulk export modal
  closeBulkExport.addEventListener('click', hideBulkExportModal);
  cancelBulkExport.addEventListener('click', hideBulkExportModal);

  // Add event listener for select all checkbox
  document.getElementById('selectAllSongs').addEventListener('change', function() {
    const items = document.querySelectorAll('.bulk-export-item');
    items.forEach(item => {
      const checkbox = item.querySelector('input[type="checkbox"]');
      checkbox.checked = this.checked;
      item.classList.toggle('selected', this.checked);
    });
    updateWarning();
  });

  // Update select all state when individual items are selected/deselected
  bulkExportItems.addEventListener('click', function(e) {
    const item = e.target.closest('.bulk-export-item');
    if (item) {
      item.classList.toggle('selected');
      updateSelectAllState();
      updateWarning();
    }
  });

  confirmBulkExport.addEventListener('click', exportSelectedSongs);

  // Close modal when clicking outside
  bulkExportModal.addEventListener('click', (e) => {
    if (e.target === bulkExportModal) {
      hideBulkExportModal();
    }
  });

  // Add keyboard support
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && bulkExportModal.classList.contains('show')) {
      hideBulkExportModal();
    }
  });

  // Helper function to format file size
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Bulk upload state variables
  let isBulkUploading = false;
  let bulkUploadCountdown = 0;
  let bulkUploadInterval = null;

  // ------------------ Games Variables ------------------
  let gameCurrentSong = null;
  let gameAudioPlayer = null;
  let snippetTimer; // timer for snippet playback
  const SAFE_OFFSET = 25; // do not play first/last 25 seconds

  // Snippet duration is random between 10 and 15 seconds.
  function randomSnippetDuration() {
    return Math.floor(Math.random() * 6) + 10; // [10..15]
  }

  // SVG Icons for play and pause
  const playIcon = '<svg viewBox="0 0 24 24" class="icon"><path d="M8 5v14l11-7z"/></svg>';
  const pauseIcon = '<svg viewBox="0 0 24 24" class="icon"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';

  // Next button (disabled until answer is submitted)
  const gameNextBtn = document.getElementById("gameNextBtn");
  if (gameNextBtn) gameNextBtn.disabled = true;

  // ------------------ Stop any Playing Audio ------------------
  function stopAudioPlayback() {
    // Stop song details audio
    const audioPlayer = document.getElementById("audioPlayer");
    if (audioPlayer && !audioPlayer.paused) {
      audioPlayer.pause();
      audioPlayer.currentTime = 0;
    }
    // Stop game snippet audio
    if (gameAudioPlayer) {
      clearTimeout(snippetTimer);
      gameAudioPlayer.pause();
      gameAudioPlayer.currentTime = 0;
    }
  }

  // ------------------ Navigation ------------------
  const pages = document.querySelectorAll('.page');
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      // Stop any audio playing before navigating away
      stopAudioPlayback();
      const target = link.getAttribute('data-page');
      showPage(target);
      if (target === 'games') {
        initGame();
      } else {
        // Reset game state when navigating away
        if (gameAudioPlayer) {
          gameAudioPlayer.pause();
          gameAudioPlayer.currentTime = 0;
        }
        clearTimeout(snippetTimer);
        gameCurrentSong = null;
        document.getElementById("gameMessage").innerHTML = "";
        document.getElementById("gameMessage").style.backgroundColor = "";
        if (gameNextBtn) gameNextBtn.disabled = true;
        document.getElementById("gameSubmitBtn").disabled = false;
        const dropdownHeader = document.getElementById("gameDropdownHeader");
        if (dropdownHeader) {
          dropdownHeader.value = "";
          dropdownHeader.dataset.songId = "";
        }
      }
    });
  });

  // Breadcrumb Navigation
  function updateBreadcrumb(pageId, pageTitle, songName = '') {
    const breadcrumbNav = document.getElementById('breadcrumbNav');
    breadcrumbNav.innerHTML = '';

    // Always start with Home
    const homeItem = document.createElement('div');
    homeItem.className = 'breadcrumb-item';
    homeItem.innerHTML = `<a href="#" data-page="home">Home</a>`;
    breadcrumbNav.appendChild(homeItem);

    // Add separator after Home
    const separator = document.createElement('div');
    separator.className = 'breadcrumb-separator';
    separator.textContent = '›';
    breadcrumbNav.appendChild(separator);

    // Add current page or song name
    const currentItem = document.createElement('div');
    currentItem.className = 'breadcrumb-item active';
    
    if (pageId === 'upload' && songName) {
      currentItem.textContent = `Edit: ${songName}`;
    } else {
      currentItem.textContent = pageTitle;
    }
    
    breadcrumbNav.appendChild(currentItem);

    // Add click event to Home link
    const homeLink = homeItem.querySelector('a');
    homeLink.addEventListener('click', (e) => {
      e.preventDefault();
      // Stop any audio playing before navigating away
      stopAudioPlayback();
      // Reset game state when navigating away
      if (gameAudioPlayer) {
        gameAudioPlayer.pause();
        gameAudioPlayer.currentTime = 0;
      }
      clearTimeout(snippetTimer);
      gameCurrentSong = null;
      document.getElementById("gameMessage").innerHTML = "";
      document.getElementById("gameMessage").style.backgroundColor = "";
      if (gameNextBtn) gameNextBtn.disabled = true;
      document.getElementById("gameSubmitBtn").disabled = false;
      const dropdownHeader = document.getElementById("gameDropdownHeader");
      if (dropdownHeader) {
        dropdownHeader.value = "";
        dropdownHeader.dataset.songId = "";
      }
      showPage('home');
    });
  }

  // Add event listener for song name input to update breadcrumb
  document.getElementById('songName')?.addEventListener('input', function() {
    if (document.getElementById('upload').classList.contains('active')) {
      updateBreadcrumb('upload', 'Add Song', this.value);
    }
  });

  // Add function to check for unsaved changes
  function hasUnsavedChanges() {
    const uploadPage = document.getElementById('upload');
    if (!uploadPage.classList.contains('active')) return false;

    const songId = document.getElementById('songId').value;
    const songName = document.getElementById('songName').value;
    const songWriter = document.getElementById('songWriter').value;
    const songSinger = document.getElementById('songSinger').value;
    const songLyrics = document.getElementById('songLyrics').innerHTML;
    const songFontSize = document.getElementById('songLyrics').style.fontSize || "16px";
    const file = document.getElementById('songAudio').files[0];

    // If it's a new song and no data has been entered, no need to save
    if (!songId && !songName && !songWriter && !songSinger && !songLyrics && !file) {
      return false;
    }

    // If editing existing song, check if any changes were made
    if (songId) {
      const originalSong = songCache[songId];
      if (!originalSong) return true;

      return originalSong.songName !== songName ||
             originalSong.songWriter !== songWriter ||
             originalSong.songSinger !== songSinger ||
             originalSong.songLyrics !== songLyrics ||
             originalSong.lyricsFontSize !== songFontSize ||
             file !== null;
    }

    return true;
  }

  // Modify the showPage function to handle auto-save
  function showPage(pageId) {
    // Check for unsaved changes before navigating
    if (hasUnsavedChanges()) {
      const songName = document.getElementById('songName').value;
      const songWriter = document.getElementById('songWriter').value;
      const songSinger = document.getElementById('songSinger').value;
      const songLyrics = document.getElementById('songLyrics').innerHTML;
      const songFontSize = document.getElementById('songLyrics').style.fontSize || "16px";
      const songId = document.getElementById('songId').value;
      const file = document.getElementById('songAudio').files[0];

      if (songId && !file) {
        updateSong({ songName, songWriter, songSinger, songLyrics, songFontSize }, Number(songId), null);
      } else if (songId && file) {
        const reader = new FileReader();
        reader.onload = evt => {
          const audioBlob = new Blob([evt.target.result], { type: file.type });
          updateSong({ songName, songWriter, songSinger, songLyrics, songFontSize }, Number(songId), audioBlob);
        };
        reader.readAsArrayBuffer(file);
      } else if (!songId && file) {
        const reader = new FileReader();
        reader.onload = evt => {
          const audioBlob = new Blob([evt.target.result], { type: file.type });
          updateSong({ songName, songWriter, songSinger, songLyrics, songFontSize }, null, audioBlob);
        };
        reader.readAsArrayBuffer(file);
      }
    }

    // Store current scroll position if we're leaving the songs list
    const currentPage = document.querySelector('.page.active');
    if (currentPage && currentPage.id === 'songs') {
      sessionStorage.setItem('songsListScroll', window.scrollY);
    }

    // Hide all pages with transition
    document.querySelectorAll('.page').forEach(page => {
      page.classList.remove('active');
    });

    // Show selected page with transition
    const selectedPage = document.getElementById(pageId);
    if (selectedPage) {
      // Force reflow to ensure transition works
      selectedPage.offsetHeight;
      selectedPage.classList.add('active');
    }

    // Update navigation links
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('data-page') === pageId) {
        link.classList.add('active');
      }
    });

    // Update breadcrumb based on page
    let pageTitle = '';
    let songName = '';
    
    switch (pageId) {
      case 'home':
        pageTitle = 'Favorites';
        break;
      case 'upload':
        pageTitle = 'Add Song';
        songName = document.getElementById('songName').value;
        break;
      case 'songs':
        pageTitle = 'All Songs';
        break;
      case 'games':
        pageTitle = 'Games';
        break;
      case 'settings':
        pageTitle = 'Settings';
        break;
      case 'songDetails':
        pageTitle = document.getElementById('detailSongName').textContent;
        break;
    }
    
    updateBreadcrumb(pageId, pageTitle, songName);

    // Only scroll to top for new pages, not when returning to songs list
    if (pageId !== 'songs') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (pageId === 'home') loadFavorites();
    if (pageId === 'songs') {
      document.getElementById('songsList').innerHTML = "";
      loadSongs();
      document.getElementById('searchBar').value = "";
      
      // Restore scroll position after a short delay to ensure content is loaded
      setTimeout(() => {
        const savedScroll = sessionStorage.getItem('songsListScroll');
        if (savedScroll) {
          window.scrollTo(0, parseInt(savedScroll));
          sessionStorage.removeItem('songsListScroll');
        }
      }, 100);
    }
    if (pageId === 'upload') resetUploadForm();
  }

  // ------------------ Settings Tabs ------------------
  document.getElementById('transferTabBtn').addEventListener('click', () => {
    document.getElementById('transferSection').style.display = "block";
    document.getElementById('databaseSection').style.display = "none";
  });
  document.getElementById('databaseTabBtn').addEventListener('click', () => {
    document.getElementById('transferSection').style.display = "none";
    document.getElementById('databaseSection').style.display = "block";
    loadLyricsFileList();
  });

  // ------------------ IndexedDB Setup ------------------
  const request = indexedDB.open('songLibrary', 3);
  request.onupgradeneeded = e => {
    db = e.target.result;
    if (!db.objectStoreNames.contains('songs')) {
      db.createObjectStore('songs', { keyPath: 'id', autoIncrement: true });
    }
    if (!db.objectStoreNames.contains('lyricsDB')) {
      db.createObjectStore('lyricsDB', { keyPath: 'key' });
    }
    if (!db.objectStoreNames.contains('appSettings')) {
      db.createObjectStore('appSettings', { keyPath: 'key' });
    }
  };
  request.onsuccess = async e => {
    db = e.target.result;
    
    // Check if app is activated
    const isActivated = await checkActivation();
    
    if (!isActivated) {
      // Generate new activation key
      activationKey = generateActivationKey();
      activationKeyExpiry = Date.now() + (5 * 60 * 1000); // 5 minutes from now
      
      // Log the key to console
      console.log('Activation Key:', activationKey);
      console.log('Valid until:', new Date(activationKeyExpiry).toLocaleTimeString());
      
      // Show activation modal
      const modal = document.getElementById('activationModal');
      modal.style.display = 'flex';
      modal.offsetHeight;
      modal.classList.add('show');
      
      // Start the timer
      updateActivationTimer();
      timerInterval = setInterval(updateActivationTimer, 1000);
      
      // Focus the input
      document.getElementById('activationKey').focus();
    } else {
      // App is already activated, proceed with normal initialization
      loadFavorites();
      loadSongs();
      loadLyricsDatabase();
    }
  };
  request.onerror = e => {
    console.error('IndexedDB error:', e.target.errorCode);
  };

  // ------------------ Toast Notifications ------------------
  function showToast(message, type="success") {
    const toastContainer = document.getElementById("toastContainer");
    if (!toastContainer) return;

    // Remove excess toasts if more than 4 exist (to keep max 5 including new one)
    const existingToasts = toastContainer.querySelectorAll('.toast');
    if (existingToasts.length >= 4) {
      existingToasts[0].style.opacity = "0";
      setTimeout(() => existingToasts[0].remove(), 500);
    }

    const toast = document.createElement("div");
    toast.className = "toast";
    
    // Add icon based on type
    let icon = '';
    switch(type) {
      case "success":
        icon = '<svg viewBox="0 0 24 24" class="toast-icon"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>';
        break;
      case "warning":
        icon = '<svg viewBox="0 0 24 24" class="toast-icon"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>';
        break;
      case "error":
        icon = '<svg viewBox="0 0 24 24" class="toast-icon"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>';
        break;
    }
    
    toast.innerHTML = `
      <div class="toast-content">
        ${icon}
        <span>${message}</span>
      </div>
    `;
    
    if (type === "success") toast.classList.add("success");
    else if (type === "warning") toast.classList.add("warning");
    else if (type === "error") toast.classList.add("error");
    
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 500);
    }, 3000);
  }

  // ------------------ Rich Text Toolbar with Selective Font Size ------------------
  function changeSelectedTextFontSize(increase) {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.rangeCount > 0 && document.activeElement === document.getElementById("songLyrics")) {
      const range = sel.getRangeAt(0);
      // Create a span to wrap the selected text
      const span = document.createElement('span');
      // Determine current font size from computed style of the first selected node's parent, fallback to 16px
      let currentSize = 16;
      if (range.startContainer.parentNode && window.getComputedStyle(range.startContainer.parentNode).fontSize) {
        currentSize = parseInt(window.getComputedStyle(range.startContainer.parentNode).fontSize);
      }
      const newSize = increase ? currentSize + 2 : Math.max(10, currentSize - 2);
      span.style.fontSize = newSize + "px";
      // Surround the selection with the span
      try {
        range.surroundContents(span);
      } catch (err) {
        // Fallback if range.surroundContents fails (e.g. when partial nodes are selected)
        document.execCommand("fontSize", false, 7);
      }
      sel.removeAllRanges();
    } else {
      // Fallback: adjust the entire editor's font size
      const editor = document.getElementById("songLyrics");
      let currentSize = parseInt(window.getComputedStyle(editor).fontSize);
      const newSize = increase ? currentSize + 2 : Math.max(10, currentSize - 2);
      editor.style.fontSize = newSize + "px";
    }
  }

  document.querySelectorAll('.rich-text-toolbar button').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.id === "increaseFontBtn") {
        changeSelectedTextFontSize(true);
      } else if (btn.id === "decreaseFontBtn") {
        changeSelectedTextFontSize(false);
      } else {
        document.execCommand(btn.getAttribute('data-command'), false, null);
      }
    });
  });

  // ------------------ Reset Upload Form ------------------
  function resetUploadForm() {
    document.getElementById('uploadTitle').textContent = "Add Song";
    document.getElementById('uploadForm').reset();
    document.getElementById('songId').value = "";
    const audioInfo = document.getElementById('audioInfo');
    if (audioInfo) {
      audioInfo.textContent = "";
    }
    const editor = document.getElementById('songLyrics');
    editor.innerHTML = "";
    editor.style.fontSize = "16px";
    isSubmitting = false;
  }

  // ------------------ Add/Edit Song ------------------
  const uploadForm = document.getElementById('uploadForm');
  uploadForm.addEventListener('submit', e => {
    e.preventDefault();
    if (isSubmitting) return;
    isSubmitting = true;

    const songName = document.getElementById('songName').value;
    const songWriter = document.getElementById('songWriter').value;
    const songSinger = document.getElementById('songSinger').value;
    const songLyrics = document.getElementById('songLyrics').innerHTML;
    const songFontSize = document.getElementById('songLyrics').style.fontSize || "16px";
    const songId = document.getElementById('songId').value;
    const file = document.getElementById('songAudio').files[0];

    // If creating a new song, audio file is required.
    if (!songId && !file) {
      showToast("Please select an audio file for new song upload.", "warning");
      isSubmitting = false;
      return;
    }
    if (songId && !file) {
      updateSong({ songName, songWriter, songSinger, songLyrics, songFontSize }, Number(songId), null);
      return;
    }
    if (songId && file) {
      const reader = new FileReader();
      reader.onload = evt => {
        const audioBlob = new Blob([evt.target.result], { type: file.type });
        updateSong({ songName, songWriter, songSinger, songLyrics, songFontSize }, Number(songId), audioBlob);
      };
      reader.readAsArrayBuffer(file);
      return;
    }
    if (!songId && file) {
      const reader = new FileReader();
      reader.onload = evt => {
        const audioBlob = new Blob([evt.target.result], { type: file.type });
        updateSong({ songName, songWriter, songSinger, songLyrics, songFontSize }, null, audioBlob);
      };
      reader.readAsArrayBuffer(file);
    }
  });

  // Updated updateSong: Now call showPage("songs") only once
  function updateSong(data, id, audioBlob) {
    const transaction = db.transaction(['songs'], 'readwrite');
    const store = transaction.objectStore('songs');
    if (id) {
      const getRequest = store.get(id);
      getRequest.onsuccess = e => {
        const song = e.target.result;
        song.songName = data.songName;
        song.songWriter = data.songWriter;
        song.songSinger = data.songSinger;
        song.songLyrics = data.songLyrics;
        song.lyricsFontSize = data.songFontSize;
        if (audioBlob) song.audioBlob = audioBlob;
        store.put(song).onsuccess = () => {
          // Also update the cache
          songCache[song.id] = song;
          showToast("Song updated successfully!", "success");
          // Clear file picker
          const songAudioInput = document.getElementById('songAudio');
          songAudioInput.value = "";
          const filePreview = document.querySelector('.file-preview');
          if (filePreview) {
            filePreview.classList.remove('visible');
          }
          resetUploadForm();
          showPage("songs");
        };
      };
    } else {
      const newSong = {
        songName: data.songName,
        songWriter: data.songWriter,
        songSinger: data.songSinger,
        songLyrics: data.songLyrics,
        lyricsFontSize: data.songFontSize,
        audioBlob: audioBlob,
        favorited: false,
        created: new Date()
      };
      store.add(newSong).onsuccess = e => {
        // Cache the new song using its generated id
        newSong.id = e.target.result;
        songCache[newSong.id] = newSong;
        showToast("Song imported successfully!", "success");
        // Clear file picker
        const songAudioInput = document.getElementById('songAudio');
        songAudioInput.value = "";
        const filePreview = document.querySelector('.file-preview');
        if (filePreview) {
          filePreview.classList.remove('visible');
        }
        showPage("songs");
      };
    }
  }

  // ------------------ Load Songs List ------------------
  // Updated to fetch all songs, sort them alphabetically (A-Z), then display.
  function loadSongs() {
    const songsList = document.getElementById('songsList');
    songsList.innerHTML = "";
    const transaction = db.transaction(['songs'], 'readonly');
    const store = transaction.objectStore('songs');
    const request = store.getAll();
    request.onsuccess = e => {
      let songs = e.target.result;
      // Sort songs alphabetically by songName (A-Z)
      songs.sort((a, b) => a.songName.localeCompare(b.songName));
      songs.forEach(song => {
        songCache[song.id] = song;
        const li = document.createElement("li");
        // Add highlight class if this is the last viewed song
        if (song.id === lastViewedSongId) {
          li.classList.add('last-viewed');
        }
        const songInfo = document.createElement("div");
        songInfo.className = "song-info";
        songInfo.textContent = song.songName + " ";
        const bySpan = document.createElement("span");
        bySpan.textContent = "sung by " + song.songSinger;
        songInfo.appendChild(bySpan);
        songInfo.addEventListener("click", () => showSongDetails(song));
        li.appendChild(songInfo);

        const actionsDiv = document.createElement("div");
        actionsDiv.className = "song-actions";

        // Updated heart creation with immediate UI update:
        const heart = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        heart.setAttribute("viewBox", "0 0 24 24");
        heart.classList.add("heart-svg");
        heart.setAttribute("data-id", song.id);
        if (song.favorited) {
          heart.classList.add("heart-filled");
          heart.innerHTML = '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>';
        } else {
          heart.classList.add("heart-outlined");
          heart.innerHTML = '<path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3z" fill="none" stroke="#d32f2f" stroke-width="2"/>';
        }
        heart.addEventListener("click", e => {
          e.stopPropagation();
          toggleFavorite(song.id, !song.favorited);
        });
        actionsDiv.appendChild(heart);

        const editIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        editIcon.setAttribute("viewBox", "0 0 24 24");
        editIcon.classList.add("icon");
        editIcon.innerHTML = '<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM21.41 6.34l-2.75-2.75c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 4.16 4.16 1.83-1.83c.39-.38.39-1.02 0-1.41z"/>';
        editIcon.addEventListener("click", e => {
          e.stopPropagation();
          openEdit(song);
        });
        actionsDiv.appendChild(editIcon);

        const deleteIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        deleteIcon.setAttribute("viewBox", "0 0 24 24");
        deleteIcon.classList.add("icon");
        deleteIcon.innerHTML = '<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zm3.46-7.12l1.41 1.41L12 11.41l1.12 1.12 1.41-1.41L13.41 10l1.12-1.12-1.41-1.41L12 8.59l-1.12-1.12-1.41 1.41L10.59 10l-1.13 1.13zM15 4l-1-1H10l-1 1H5v2h14V4z"/>';
        deleteIcon.addEventListener("click", e => {
          e.stopPropagation();
          songToDelete = song.id;
          openVerifyModal();
        });
        actionsDiv.appendChild(deleteIcon);

        li.appendChild(actionsDiv);
        songsList.appendChild(li);
      });
    };
  }

  document.getElementById('searchBar').addEventListener('input', function () {
    const query = this.value.toLowerCase();
    const listItems = document.querySelectorAll('#songsList li');
    const emptySearch = document.getElementById('emptySearch');
    let hasResults = false;
    
    listItems.forEach(li => {
      const text = li.querySelector('.song-info').textContent.toLowerCase();
      const isVisible = text.includes(query);
      li.style.display = isVisible ? "" : "none";
      if (isVisible) hasResults = true;
    });
    
    // Show/hide empty search state
    emptySearch.style.display = hasResults ? "none" : "flex";
  });

  // ------------------ Load Favorites ------------------
  function loadFavorites() {
    const favoritesList = document.getElementById('favoritesList');
    const emptyFavorites = document.getElementById('emptyFavorites');
    favoritesList.innerHTML = "";
    let hasFavorites = false;
    
    const transaction = db.transaction(['songs'], 'readonly');
    const store = transaction.objectStore('songs');
    store.openCursor().onsuccess = e => {
      const cursor = e.target.result;
      if (cursor) {
        const song = cursor.value;
        // Update cache as well.
        songCache[song.id] = song;
        if (song.favorited) {
          hasFavorites = true;
          const li = document.createElement("li");
          li.textContent = song.songName + " sung by " + song.songSinger;
          li.addEventListener("click", () => showSongDetails(song));
          favoritesList.appendChild(li);
        }
        cursor.continue();
      } else {
        // After all songs are processed, show/hide empty state
        emptyFavorites.style.display = hasFavorites ? "none" : "flex";
      }
    };
  }

  // ------------------ Toggle Favorite ------------------
  function toggleFavorite(id, newState) {
    // Immediately update the heart icon in the songs list.
    const heartIcon = document.querySelector(`.heart-svg[data-id="${id}"]`);
    if (heartIcon) {
      if (newState) {
        heartIcon.classList.remove("heart-outlined");
        heartIcon.classList.add("heart-filled");
        heartIcon.innerHTML = '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>';
      } else {
        heartIcon.classList.remove("heart-filled");
        heartIcon.classList.add("heart-outlined");
        heartIcon.innerHTML = '<path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3z" fill="none" stroke="#d32f2f" stroke-width="2"/>';
      }
    }

    // Update the cached song and then push the update to IndexedDB.
    let song = songCache[id];
    if (song) {
      song.favorited = newState;
      const transaction = db.transaction(['songs'], 'readwrite');
      const store = transaction.objectStore('songs');
      store.put(song);
    }
  }

  // ------------------ Show Song Details ------------------
  function showSongDetails(song) {
    // Store the last viewed song ID
    lastViewedSongId = song.id;
    
    // Set the song name first
    document.getElementById("detailSongName").textContent = song.songName;
    
    // Show loading spinner
    const loadingSpinner = document.getElementById('loadingSpinner');
    loadingSpinner.classList.add('visible');

    // Stop any audio when leaving details page if needed
    stopAudioPlayback();

    // Use setTimeout to ensure the loading spinner is visible before processing
    setTimeout(() => {
      showPage("songDetails");
      document.getElementById("detailSongWriter").textContent = song.songWriter;
      document.getElementById("detailSongSinger").textContent = song.songSinger;
      document.getElementById("detailSongLyrics").innerHTML = song.songLyrics;
      document.getElementById("detailSongLyrics").style.fontSize = song.lyricsFontSize || "16px";
      const audioPlayer = document.getElementById("audioPlayer");
      if (audioPlayer) {
        audioPlayer.src = song.audioBlob ? URL.createObjectURL(song.audioBlob) : "";
      }
      currentSong = song;

      // Hide loading spinner after a short delay to ensure smooth transition
      setTimeout(() => {
        loadingSpinner.classList.remove('visible');
      }, 300);
    }, 500);
  }

  // ------------------ Open Edit Page ------------------
  function openEdit(song) {
    // Stop any audio playback before editing
    stopAudioPlayback();
    showPage("upload");
    
    // Get all required elements
    const uploadTitle = document.getElementById("uploadTitle");
    const songId = document.getElementById("songId");
    const songName = document.getElementById("songName");
    const songWriter = document.getElementById("songWriter");
    const songSinger = document.getElementById("songSinger");
    const songLyrics = document.getElementById("songLyrics");
    const filePreview = document.querySelector('.file-preview');
    
    // Only set values if elements exist
    if (uploadTitle) uploadTitle.textContent = "Edit Song";
    if (songId) songId.value = song.id;
    if (songName) songName.value = song.songName;
    if (songWriter) songWriter.value = song.songWriter;
    if (songSinger) songSinger.value = song.songSinger;
    if (songLyrics) {
      songLyrics.innerHTML = song.songLyrics;
      songLyrics.style.fontSize = song.lyricsFontSize || "16px";
    }
    
    // Update file preview if audio exists
    if (filePreview && song.audioBlob) {
      filePreview.classList.add('visible');
      const previewName = filePreview.querySelector('.file-picker-preview-name');
      const previewSize = filePreview.querySelector('.file-picker-preview-size');
      const removeBtn = filePreview.querySelector('.file-picker-preview-remove');
      
      if (previewName) previewName.textContent = 'Existing audio file';
      if (previewSize) previewSize.textContent = formatFileSize(song.audioBlob.size);
      
      // Add event listener to remove button
      if (removeBtn) {
        removeBtn.onclick = () => {
          filePreview.classList.remove('visible');
          const songAudio = document.getElementById('songAudio');
          if (songAudio) songAudio.value = '';
        };
      }
    } else if (filePreview) {
      filePreview.classList.remove('visible');
    }
  }

  // ------------------ Back Button ------------------
  document.getElementById("backToList").addEventListener("click", () => {
    // Stop any playing audio when navigating away
    stopAudioPlayback();
    showPage("songs");
  });

  // ------------------ Import Songs ------------------
  document.getElementById("importButton").addEventListener("click", () => {
    const importFiles = document.getElementById("importFiles");
    const files = importFiles.files;
    if (files.length === 0) {
      showToast("No files selected for import.", "warning");
      return;
    }
    let filesProcessed = 0;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = evt => {
        try {
          const songData = JSON.parse(evt.target.result);
          const transaction = db.transaction(['songs'], 'readwrite');
          const store = transaction.objectStore('songs');
          store.add({
            songName: songData.songName,
            songWriter: songData.songWriter,
            songSinger: songData.songSinger,
            songLyrics: songData.songLyrics,
            lyricsFontSize: "16px",
            audioBlob: songData.audioBase64
              ? dataURLtoBlob(songData.audioBase64, songData.audioBlobType)
              : null,
            favorited: songData.favorited || false,
            created: songData.created || new Date()
          }).onsuccess = e => {
            const newId = e.target.result;
            // Cache the imported song
            songCache[newId] = {
              id: newId,
              songName: songData.songName,
              songWriter: songData.songWriter,
              songSinger: songData.songSinger,
              songLyrics: songData.songLyrics,
              lyricsFontSize: "16px",
              audioBlob: songData.audioBase64
                ? dataURLtoBlob(songData.audioBase64, songData.audioBlobType)
                : null,
              favorited: songData.favorited || false,
              created: songData.created || new Date()
            };
            filesProcessed++;
            if (filesProcessed === files.length) {
              showToast("All files imported successfully!", "success");
              // Clear file picker
              importFiles.value = "";
              const preview = importFiles.nextElementSibling;
              if (preview && preview.classList.contains('file-picker-preview')) {
                preview.classList.remove('visible');
              }
              showPage("songs");
            }
          };
        } catch (err) {
          console.error("Error importing file", file.name, err);
          showToast("Error importing file: " + file.name, "error");
          filesProcessed++;
          if (filesProcessed === files.length) {
            showPage("songs");
          }
        }
      };
      reader.readAsText(file);
    });
  });

  // ------------------ Bulk Audio Upload ------------------
  document.getElementById("bulkUploadButton").addEventListener("click", () => {
    if (isBulkUploading) {
      showToast(`Bulk upload in progress. Please keep cool and wait for ${bulkUploadCountdown} more seconds.`, "warning");
      return;
    }
    const bulkInput = document.getElementById("bulkAudioFiles");
    const files = bulkInput.files;
    if (files.length === 0) {
      showToast("No audio files selected for bulk upload.", "warning");
      return;
    }

    // Process filenames and check for duplicates
    const processedFiles = new Map();
    const duplicateFiles = new Map();
    const existingSongs = new Map();

    // First, get all existing songs from database
    const transaction = db.transaction(['songs'], 'readonly');
    const store = transaction.objectStore('songs');
    store.openCursor().onsuccess = e => {
      const cursor = e.target.result;
      if (cursor) {
        const song = cursor.value;
        const cleanName = cleanFileNameForComparison(song.songName);
        existingSongs.set(cleanName, song);
        cursor.continue();
      } else {
        // After getting existing songs, process the new files
        Array.from(files).forEach(file => {
          const originalName = file.name;
          const cleanName = cleanFileNameForStorage(originalName);
          const comparisonName = cleanFileNameForComparison(originalName);
          
          // Check for similar filenames
          const similarNames = findSimilarFilenames(comparisonName, existingSongs);
          if (similarNames.length > 0) {
            duplicateFiles.set(originalName, {
              originalName: originalName,
              cleanName: cleanName,
              file: file,
              similarTo: similarNames[0].name,
              similarity: similarNames[0].similarity
            });
          } else if (processedFiles.has(comparisonName)) {
            // Check if this is a duplicate within the current upload
            duplicateFiles.set(originalName, {
              originalName: originalName,
              cleanName: cleanName,
              file: file,
              similarTo: comparisonName,
              similarity: 1
            });
          } else {
            processedFiles.set(comparisonName, {
              originalName: originalName,
              cleanName: cleanName,
              file: file
            });
          }
        });

        // If there are duplicates, show the modal
        if (duplicateFiles.size > 0) {
          showDuplicateFilesModal(duplicateFiles, processedFiles);
        } else {
          // No duplicates, proceed with upload
          startBulkUpload(processedFiles);
        }
      }
    };
  });

  // Function to clean filename for comparison only
  function cleanFileNameForComparison(filename) {
    return filename
      .replace(/\.(mp3|wav|ogg|m4a|flac)$/i, "") // Remove audio extensions
      .replace(/[-_\s]/g, "") // Remove hyphens, underscores, and spaces
      .replace(/[^\w]/g, "") // Remove special characters
      .toLowerCase(); // Convert to lowercase for comparison only
  }

  // Function to clean filename for display and storage
  function cleanFileNameForStorage(filename) {
    return filename
      .replace(/\.(mp3|wav|ogg|m4a|flac)$/i, "") // Remove audio extensions
      .replace(/[-_]/g, " ") // Replace hyphens and underscores with spaces
      .replace(/[^\w\s]/g, "") // Remove special characters
      .replace(/\s+/g, " ") // Replace multiple spaces with single space
      .trim(); // Remove leading/trailing spaces
  }

  // Function to extract song name without artist
  function extractSongName(filename) {
    // Common artist name patterns
    const artistPatterns = [
      /by\s+([^\-]+)/i,
      /feat\.?\s+([^\-]+)/i,
      /ft\.?\s+([^\-]+)/i,
      /with\s+([^\-]+)/i,
      /\s*-\s*([^\-]+)$/i,
      /\s*\(([^)]+)\)$/i
    ];

    let name = filename;
    
    // Try to remove artist names using patterns
    for (const pattern of artistPatterns) {
      name = name.replace(pattern, '').trim();
    }

    // If the name is too short after removal, keep the original
    if (name.length < 3) {
      return filename;
    }

    return name;
  }

  // Function to calculate string similarity
  function calculateSimilarity(str1, str2) {
    // Extract song names without artists
    const song1 = extractSongName(str1);
    const song2 = extractSongName(str2);
    
    // Clean the extracted names for comparison
    const clean1 = cleanFileNameForComparison(song1);
    const clean2 = cleanFileNameForComparison(song2);
    
    // If strings are identical after cleaning, return 1
    if (clean1 === clean2) return 1;
    
    // Check if one string contains the other
    if (clean1.includes(clean2) || clean2.includes(clean1)) {
      const shorter = clean1.length < clean2.length ? clean1 : clean2;
      const longer = clean1.length < clean2.length ? clean2 : clean1;
      // If the shorter string is at least 70% of the longer string's length
      if (shorter.length / longer.length >= 0.7) {
        return 1;
      }
    }
    
    // Calculate character-level similarity
    const len1 = clean1.length;
    const len2 = clean2.length;
    
    // If one string is much longer than the other, reduce similarity
    if (Math.abs(len1 - len2) > Math.max(len1, len2) * 0.3) {
      return 0;
    }
    
    // Create matrix for Levenshtein distance
    const matrix = Array(len1 + 1).fill().map(() => Array(len2 + 1).fill(0));
    
    // Initialize matrix
    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;
    
    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = clean1[i - 1] === clean2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }
    
    // Calculate similarity ratio
    const maxLen = Math.max(len1, len2);
    return 1 - (matrix[len1][len2] / maxLen);
  }

  // Function to find similar filenames
  function findSimilarFilenames(filename, existingNames, threshold = 0.8) {
    const similarNames = [];
    for (const [existingName, song] of existingNames) {
      const similarity = calculateSimilarity(filename, existingName);
      if (similarity >= threshold) {
        similarNames.push({ name: existingName, similarity, song });
      }
    }
    return similarNames.sort((a, b) => b.similarity - a.similarity);
  }

  // Function to show duplicate files modal
  function showDuplicateFilesModal(duplicateFiles, processedFiles) {
    const modal = document.getElementById("duplicateFilesModal");
    const content = document.getElementById("duplicateFilesContent");
    content.innerHTML = "";

    // Create list of duplicate files
    const list = document.createElement("ul");
    list.className = "duplicate-files-list";
    
    duplicateFiles.forEach((file, originalName) => {
      const li = document.createElement("li");
      const similarityPercent = Math.round(file.similarity * 100);
      li.innerHTML = `
        <div class="duplicate-file-item">
          <span class="original-name">${originalName}</span>
          <span class="clean-name">→ ${file.cleanName}</span>
          <span class="similarity-info">${similarityPercent}% similar to "${file.similarTo}"</span>
          <button class="add-duplicate-btn" data-filename="${originalName}">
            <svg viewBox="0 0 24 24" class="icon">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
          </button>
        </div>
      `;
      list.appendChild(li);
    });

    content.appendChild(list);

    // Add event listeners to add buttons
    content.querySelectorAll('.add-duplicate-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const filename = btn.dataset.filename;
        const file = duplicateFiles.get(filename);
        if (file) {
          processedFiles.set(file.cleanName, file);
          duplicateFiles.delete(filename);
          btn.closest('.duplicate-file-item').style.opacity = '0.5';
          btn.disabled = true;
        }
      });
    });

    // Update continue button
    const continueBtn = document.getElementById("continueBulkUpload");
    continueBtn.onclick = () => {
      closeModal("duplicateFilesModal");
      startBulkUpload(processedFiles);
    };

    // Show modal
    modal.style.display = "flex";
    modal.offsetHeight;
    modal.classList.add("show");
  }

  // Function to start bulk upload
  function startBulkUpload(processedFiles) {
    isBulkUploading = true;
    bulkUploadCountdown = processedFiles.size * 2;
    bulkUploadInterval = setInterval(() => {
      bulkUploadCountdown--;
      if (bulkUploadCountdown <= 0) {
        clearInterval(bulkUploadInterval);
      }
    }, 1000);

    let filesProcessed = 0;
    let errorOccurred = false;

    processedFiles.forEach((fileData, comparisonName) => {
      const reader = new FileReader();
      reader.onload = evt => {
        const audioBlob = new Blob([evt.target.result], { type: fileData.file.type });
        const newSong = {
          songName: fileData.cleanName, // Use the cleaned name for storage
          songWriter: "N/A",
          songSinger: "N/A",
          songLyrics: "N/A",
          lyricsFontSize: "16px",
          audioBlob: audioBlob,
          favorited: false,
          created: new Date()
        };
        const transaction = db.transaction(['songs'], 'readwrite');
        const store = transaction.objectStore('songs');
        store.add(newSong).onsuccess = e => {
          newSong.id = e.target.result;
          songCache[newSong.id] = newSong;
          filesProcessed++;
          if (filesProcessed === processedFiles.size) {
            if (!errorOccurred) {
              showToast("Bulk upload completed successfully!", "success");
            }
            // Clear file picker
            const bulkInput = document.getElementById("bulkAudioFiles");
            bulkInput.value = "";
            const preview = bulkInput.nextElementSibling;
            if (preview && preview.classList.contains('file-picker-preview')) {
              preview.classList.remove('visible');
            }
            showPage("songs");
            isBulkUploading = false;
            clearInterval(bulkUploadInterval);
          }
        };
        transaction.onerror = () => {
          errorOccurred = true;
          filesProcessed++;
          showToast(`Error uploading file: ${fileData.originalName}. Please try again.`, "error");
          if (filesProcessed === processedFiles.size) {
            showPage("songs");
            isBulkUploading = false;
            clearInterval(bulkUploadInterval);
          }
        };
      };
      reader.readAsArrayBuffer(fileData.file);
    });
  }

  // ------------------ Upload Lyrics Database ------------------
  document.getElementById("uploadLyricsDbBtn").addEventListener("click", () => {
    const fileInput = document.getElementById("lyricsDbFile");
    const files = fileInput.files;
    if (files.length === 0) {
      showToast("Please select a lyrics file to upload.", "warning");
      return;
    }
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = evt => {
        const content = evt.target.result;
        const transaction = db.transaction(['lyricsDB'], 'readwrite');
        const store = transaction.objectStore('lyricsDB');
        store.put({ key: file.name, content: content }).onsuccess = () => {
          loadLyricsFileList();
          loadLyricsDatabase();
          showToast("Lyrics file uploaded successfully!", "success");
          // Clear file picker
          fileInput.value = "";
          const preview = fileInput.nextElementSibling;
          if (preview && preview.classList.contains('file-picker-preview')) {
            preview.classList.remove('visible');
          }
        };
      };
      reader.readAsText(file);
    });
  });

  // ------------------ Base64 to Blob ------------------
  function dataURLtoBlob(dataurl, type) {
    const arr = dataurl.split(',');
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--) { u8arr[n] = bstr.charCodeAt(n); }
    return new Blob([u8arr], { type });
  }

  // ------------------ Download Song JSON Backup ------------------
  function downloadSongJson(song) {
    if (!song.audioBlob) {
      showToast("No audio available for this song.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = function() {
      const songData = {
        songName: song.songName,
        songWriter: song.songWriter,
        songSinger: song.songSinger,
        songLyrics: song.songLyrics,
        lyricsFontSize: song.lyricsFontSize || "16px",
        audioBase64: reader.result,
        audioBlobType: song.audioBlob.type,
        favorited: song.favorited,
        created: song.created
      };
      const jsonString = JSON.stringify(songData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${song.songName || "song"}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };
    reader.readAsDataURL(song.audioBlob);
  }

  const downloadJsonBtn = document.getElementById("downloadJsonBtn");
  if (downloadJsonBtn) {
    downloadJsonBtn.addEventListener("click", () => {
      if (currentSong) {
        downloadSongJson(currentSong);
      }
    });
  }

  // ------------------ Verification Modal for Song Deletion ------------------
  function openVerifyModal() {
    const modal = document.getElementById("verifyModal");
    modal.style.display = "flex";
    // Force reflow
    modal.offsetHeight;
    modal.classList.add("show");
  }

  // Update all modal close functions
  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove("show");
    // Wait for animation to complete before hiding
    setTimeout(() => {
      modal.style.display = "none";
    }, 300);
  }

  // Update event listeners for all modals
  document.querySelectorAll(".close-modal").forEach(closeBtn => {
    closeBtn.addEventListener("click", () => {
      const modal = closeBtn.closest(".modal");
      closeModal(modal.id);
    });
  });

  // Add event listener for confirm delete button
  document.getElementById("confirmDelete").addEventListener("click", () => {
    if (songToDelete) {
      deleteSong(songToDelete);
      closeModal("verifyModal");
      songToDelete = null;
    }
  });

  function deleteSong(id) {
    const transaction = db.transaction(['songs'], 'readwrite');
    const store = transaction.objectStore('songs');
    store.delete(id).onsuccess = () => {
      // Remove the song from cache
      delete songCache[id];
      
      // Remove the song from the DOM
      const songElement = document.querySelector(`.heart-svg[data-id="${id}"]`)?.closest('li');
      if (songElement) {
        songElement.remove();
      }
      
      // Check if there are any songs left
      const songsList = document.getElementById('songsList');
      const emptySearch = document.getElementById('emptySearch');
      if (songsList.children.length === 0) {
        emptySearch.style.display = 'flex';
      }
      
      showToast("Song deleted successfully!", "success");
    };
  }

  // ------------------ Lyrics Database ------------------
  function loadLyricsDatabase() {
    const transaction = db.transaction(['lyricsDB'], 'readonly');
    const store = transaction.objectStore('lyricsDB');
    let allBlocks = [];
    store.openCursor().onsuccess = e => {
      const cursor = e.target.result;
      if (cursor) {
        const blocks = cursor.value.content.split(/\n\*\s*-\s*\n/).filter(Boolean);
        blocks.forEach(block => {
          allBlocks.push({ fileName: cursor.key, content: block });
        });
        cursor.continue();
      } else {
        lyricsDatabaseArray = allBlocks;
      }
    };
  }
  function loadLyricsFileList() {
    const listDiv = document.getElementById("lyricsFileList");
    listDiv.innerHTML = "";
    const transaction = db.transaction(['lyricsDB'], 'readonly');
    const store = transaction.objectStore('lyricsDB');
    store.openCursor().onsuccess = e => {
      const cursor = e.target.result;
      if (cursor) {
        const fileItem = document.createElement("div");
        fileItem.className = "lyrics-file-item";
        fileItem.innerHTML = `<span>${cursor.key}</span>`;
        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Delete";
        deleteBtn.addEventListener("click", () => {
          fileToDeleteKey = cursor.key;
          openLyricsDeleteModal();
        });
        fileItem.appendChild(deleteBtn);
        listDiv.appendChild(fileItem);
        cursor.continue();
      }
    };
  }
  function openLyricsDeleteModal() {
    const modal = document.getElementById("lyricsDeleteModal");
    modal.style.display = "flex";
    // Force reflow
    modal.offsetHeight;
    modal.classList.add("show");
  }
  document.getElementById("closeLyricsDelete").addEventListener("click", () => {
    document.getElementById("lyricsDeleteModal").style.display = "none";
    fileToDeleteKey = null;
  });
  document.getElementById("confirmLyricsDelete").addEventListener("click", () => {
    if (fileToDeleteKey) {
      const transaction = db.transaction(['lyricsDB'], 'readwrite');
      const store = transaction.objectStore('lyricsDB');
      store.delete(fileToDeleteKey).onsuccess = () => {
        loadLyricsFileList();
        loadLyricsDatabase();
        document.getElementById("lyricsDeleteModal").style.display = "none";
        showToast("Lyrics file deleted successfully!", "success");
        fileToDeleteKey = null;
      };
    }
  });

  // ------------------ "Search Lyrics" ------------------
  document.getElementById("lyricsSearchBtn").addEventListener("click", () => {
    const query = document.getElementById("songLyrics").innerText.trim();
    // Check if query is too short
    if (query.length < 3) {
      showToast("Please enter at least 3 characters to search lyrics.", "warning");
      return;
    }
    // Check if there is a lyrics database available
    if (lyricsDatabaseArray.length === 0) {
      showToast("No lyrics file found. Please upload a lyrics file to search.", "warning");
      return;
    }

    // Show loading spinner
    const loadingSpinner = document.getElementById('loadingSpinner');
    loadingSpinner.classList.add('visible');

    // Use setTimeout to ensure the loading spinner is visible before processing
    setTimeout(() => {
      const normalizedQuery = query.replace(/\s+/g, " ").trim().toLowerCase();
      let matches = [];
      lyricsDatabaseArray.forEach(block => {
        const normalizedBlock = block.content.replace(/\s+/g, " ").trim().toLowerCase();
        if (normalizedBlock.includes(normalizedQuery)) {
          matches.push({ block, score: 100 });
        }
      });
      if (matches.length === 0) {
        const words = normalizedQuery.split(" ");
        lyricsDatabaseArray.forEach(block => {
          const normalizedBlock = block.content.replace(/\s+/g, " ").trim().toLowerCase();
          let matchCount = 0;
          words.forEach(word => {
            if (normalizedBlock.includes(word)) matchCount++;
          });
          if (matchCount > 0) {
            matches.push({ block, score: matchCount });
          }
        });
        matches.sort((a, b) => b.score - a.score);
      }
      if (matches.length > 0) {
        const highlightedMatches = matches.map(match => {
          let highlighted = match.block.content;
          normalizedQuery.split(" ").forEach(word => {
            if (word) {
              const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "gi");
              highlighted = highlighted.replace(regex, "<mark>$&</mark>");
            }
          });
          return { original: match.block.content, highlighted };
        });
        showLyricsModal(highlightedMatches);
      } else {
        showToast("No matching lyrics found.", "warning");
      }

      // Hide loading spinner
      loadingSpinner.classList.remove('visible');
    }, 500);
  });
  function showLyricsModal(matches) {
    const modal = document.getElementById("lyricsModal");
    const contentDiv = document.getElementById("lyricsModalContent");
    contentDiv.innerHTML = "";
    const maxLength = 100;
    matches.forEach(match => {
      const card = document.createElement("div");
      card.className = "lyrics-card";
      const p = document.createElement("p");
      if (match.original.length > maxLength) {
        p.innerHTML = match.highlighted.substring(0, maxLength) + "...";
        p.dataset.full = match.highlighted;
        p.dataset.truncated = match.highlighted.substring(0, maxLength) + "...";
        p.dataset.expanded = "false";
      } else {
        p.innerHTML = match.highlighted;
      }
      card.appendChild(p);
      const btnContainer = document.createElement("div");
      btnContainer.className = "buttons";
      const useBtn = document.createElement("button");
      useBtn.textContent = "Use Lyrics";
      useBtn.addEventListener("click", () => {
        const formatted = match.original.replace(/\n/g, "<br>");
        document.getElementById("songLyrics").innerHTML = formatted;
        modal.style.display = "none";
        showToast("Lyrics applied to the editor.", "success");
      });
      btnContainer.appendChild(useBtn);
      const copyBtn = document.createElement("button");
      copyBtn.textContent = "Copy";
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(match.original);
        showToast("Lyrics copied to clipboard.", "success");
      });
      btnContainer.appendChild(copyBtn);
      if (match.original.length > maxLength) {
        const toggleBtn = document.createElement("button");
        toggleBtn.textContent = "Show more";
        toggleBtn.addEventListener("click", () => {
          if (p.dataset.expanded === "false") {
            p.innerHTML = p.dataset.full;
            toggleBtn.textContent = "Show less";
            p.dataset.expanded = "true";
          } else {
            p.innerHTML = p.dataset.truncated;
            toggleBtn.textContent = "Show more";
            p.dataset.expanded = "false";
          }
        });
        btnContainer.appendChild(toggleBtn);
      }
      card.appendChild(btnContainer);
      contentDiv.appendChild(card);
    });
    modal.style.display = "flex";
    // Force reflow
    modal.offsetHeight;
    modal.classList.add("show");
  }
  document.getElementById("closeLyricsModal").addEventListener("click", () => {
    document.getElementById("lyricsModal").style.display = "none";
  });

  // ------------------ Games Page ------------------
  // Updated buildGameDropdown: the dropdown header is now an input field with search functionality.
  function buildGameDropdown() {
    const dropdownContainer = document.getElementById("gameDropdownContainer");
    // Replace the header with an input element if not already one.
    let dropdownHeader = document.getElementById("gameDropdownHeader");
    if (dropdownHeader.tagName.toLowerCase() !== 'input') {
      const input = document.createElement("input");
      input.type = "text";
      input.id = "gameDropdownHeader";
      input.placeholder = "Select a song...";
      input.readOnly = false;
      dropdownContainer.replaceChild(input, dropdownHeader);
      dropdownHeader = input;
    }
    // Clear any previous options.
    const dropdownList = document.getElementById("gameDropdownList");
    dropdownList.innerHTML = "";
    const transaction = db.transaction(['songs'], 'readonly');
    const store = transaction.objectStore('songs');
    let loadedSongs = [];
    store.openCursor().onsuccess = e => {
      const cursor = e.target.result;
      if (cursor) {
        if (cursor.value.audioBlob) {
          loadedSongs.push(cursor.value);
        }
        cursor.continue();
      } else {
        // Always show all songs that have an audio blob.
        loadedSongs.forEach(song => {
          const div = document.createElement("div");
          div.className = "dropdown-option";
          div.textContent = song.songName;
          div.dataset.songId = song.id;
          dropdownList.appendChild(div);
        });
      }
    };

    // When the user types in the header input, filter the dropdown options.
    dropdownHeader.addEventListener("input", e => {
      const query = e.target.value.toLowerCase();
      const options = dropdownList.querySelectorAll(".dropdown-option");
      options.forEach(opt => {
        const text = opt.textContent.toLowerCase();
        opt.classList.toggle("hide", !text.includes(query));
      });
      dropdownList.classList.add("show");
    });

    // When the header input gains focus, show the dropdown list.
    dropdownHeader.addEventListener("focus", () => {
      dropdownList.classList.add("show");
    });

    // When clicking an option, update the header input value.
    dropdownList.addEventListener("click", e => {
      if (e.target.classList.contains("dropdown-option")) {
        dropdownHeader.value = e.target.textContent;
        dropdownHeader.dataset.songId = e.target.dataset.songId;
        dropdownList.classList.remove("show");
      }
    });

    // Close dropdown when clicking outside.
    document.addEventListener("click", e => {
      if (!dropdownContainer.contains(e.target)) {
        dropdownList.classList.remove("show");
      }
    });
  }

  function initGame() {
    gameCurrentSong = null;
    document.getElementById("gameMessage").innerHTML = "";
    document.getElementById("gameMessage").style.backgroundColor = "";
    if (gameNextBtn) gameNextBtn.disabled = true;
    // Re-enable the submit button for the new game round
    document.getElementById("gameSubmitBtn").disabled = false;
    buildGameDropdown();
    // Clear any previous selection in the dropdown header
    const dropdownHeader = document.getElementById("gameDropdownHeader");
    if (dropdownHeader) {
      dropdownHeader.value = "";
      dropdownHeader.dataset.songId = "";
    }
    if (!gameAudioPlayer) {
      gameAudioPlayer = document.getElementById("gameAudio");
      if (gameAudioPlayer) {
        gameAudioPlayer.controls = false;
      }
    }
    document.getElementById("gamePlayBtn").innerHTML = playIcon;
  }

  function startGame() {
    const transaction = db.transaction(['songs'], 'readonly');
    const store = transaction.objectStore('songs');
    let songs = [];
    store.openCursor().onsuccess = e => {
      const cursor = e.target.result;
      if (cursor) {
        if (cursor.value.audioBlob) songs.push(cursor.value);
        cursor.continue();
      } else {
        if (songs.length === 0) {
          const gameMessage = document.getElementById("gameMessage");
          gameMessage.innerHTML = "<strong style='color:#fff;'>No songs available for the game.</strong>";
          gameMessage.style.backgroundColor = "#f9a825";
          return;
        }
        // Filter available songs that haven't been played
        let availableSongs = songs.filter(song => !playedSongIds.has(song.id));
        if (availableSongs.length === 0) {
          playedSongIds.clear();
          availableSongs = songs;
        }
        let chosenSong;
        if (gameCurrentSong && availableSongs.length > 1) {
          do {
            chosenSong = availableSongs[Math.floor(Math.random() * availableSongs.length)];
          } while (chosenSong.id === gameCurrentSong.id && availableSongs.length > 1);
        } else {
          chosenSong = availableSongs[Math.floor(Math.random() * availableSongs.length)];
        }
        // Mark this song as played
        playedSongIds.add(chosenSong.id);
        gameCurrentSong = chosenSong;
        const audioUrl = URL.createObjectURL(gameCurrentSong.audioBlob);
        if (gameAudioPlayer) {
          gameAudioPlayer.src = audioUrl;
          gameAudioPlayer.onloadedmetadata = () => {
            const duration = gameAudioPlayer.duration;
            const snippetLen = randomSnippetDuration();
            const maxStart = Math.max(0, duration - SAFE_OFFSET - snippetLen);
            const minStart = SAFE_OFFSET;
            const startTime = (maxStart <= minStart) ? minStart : Math.floor(Math.random() * (maxStart - minStart + 1)) + minStart;
            gameCurrentSong.snippetStart = startTime;
            gameCurrentSong.snippetDuration = snippetLen;
            gameAudioPlayer.currentTime = startTime;
            gameAudioPlayer.play();
            document.getElementById("gamePlayBtn").innerHTML = pauseIcon;
            snippetTimer = setTimeout(() => {
              gameAudioPlayer.pause();
              gameAudioPlayer.currentTime = startTime;
              document.getElementById("gamePlayBtn").innerHTML = playIcon;
            }, snippetLen * 1000);
          };
        }
      }
    };
  }

  function toggleGamePlay() {
    if (!gameCurrentSong) {
      startGame();
    } else {
      if (gameAudioPlayer && gameAudioPlayer.paused) {
        clearTimeout(snippetTimer);
        gameAudioPlayer.currentTime = gameCurrentSong.snippetStart;
        gameAudioPlayer.play();
        document.getElementById("gamePlayBtn").innerHTML = pauseIcon;
        snippetTimer = setTimeout(() => {
          gameAudioPlayer.pause();
          gameAudioPlayer.currentTime = gameCurrentSong.snippetStart;
          document.getElementById("gamePlayBtn").innerHTML = playIcon;
        }, gameCurrentSong.snippetDuration * 1000);
      } else if (gameAudioPlayer) {
        clearTimeout(snippetTimer);
        gameAudioPlayer.pause();
        document.getElementById("gamePlayBtn").innerHTML = playIcon;
      }
    }
  }

  function submitGame() {
    const dropdownHeader = document.getElementById("gameDropdownHeader");
    const chosenSongId = parseInt(dropdownHeader.dataset.songId || "-1");
    const gameMessage = document.getElementById("gameMessage");
    gameMessage.style.backgroundColor = "";
    clearTimeout(snippetTimer);
    // Pause game audio after submission
    if (gameAudioPlayer) {
      gameAudioPlayer.pause();
    }
    if (!gameCurrentSong) {
      showToast("No game is active. Please start a game first.", "warning");
      return;
    }
    if (isNaN(chosenSongId) || chosenSongId < 0) {
      showToast("Please select a song from the dropdown.", "warning");
      return;
    }
    if (chosenSongId === gameCurrentSong.id) {
      gameMessage.innerHTML = `
        <div class="feedback-content correct">
          <svg viewBox="0 0 24 24" class="feedback-icon">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <div class="feedback-text">
            <strong>Correct!</strong>
            <span>Great job! You identified the song correctly.</span>
          </div>
        </div>
      `;
      gameMessage.style.backgroundColor = "#2e7d32";
    } else {
      gameMessage.innerHTML = `
        <div class="feedback-content incorrect">
          <div class="feedback-text">
            <strong>Incorrect</strong>
            <span>The correct song was "${gameCurrentSong.songName}"</span>
          </div>
        </div>
      `;
      gameMessage.style.backgroundColor = "#d32f2f";
    }
    // Disable the submit button until the next game round
    document.getElementById("gameSubmitBtn").disabled = true;
    if (gameNextBtn) gameNextBtn.disabled = false;
  }

  document.getElementById("gamePlayBtn").addEventListener("click", toggleGamePlay);
  document.getElementById("gameSubmitBtn").addEventListener("click", submitGame);
  document.getElementById("gameNextBtn").addEventListener("click", () => {
    initGame();
    startGame();
    showToast("New game started!", "success");
  });

  // ------------------ Export All Songs ------------------
  // This new section is added in the Transfer section of the settings page.
  // It exports a separate JSON backup for each song in the song list.
  document.getElementById("exportAllBtn").addEventListener("click", () => {
    const transaction = db.transaction(["songs"], "readonly");
    const store = transaction.objectStore("songs");
    store.openCursor().onsuccess = e => {
      const cursor = e.target.result;
      if (cursor) {
        const song = cursor.value;
        const songData = {
          songName: song.songName,
          songWriter: song.songWriter,
          songSinger: song.songSinger,
          songLyrics: song.songLyrics,
          lyricsFontSize: song.lyricsFontSize || "16px",
          favorited: song.favorited,
          created: song.created
        };
        if (song.audioBlob) {
          const reader = new FileReader();
          reader.onload = function() {
            songData.audioBase64 = reader.result;
            songData.audioBlobType = song.audioBlob.type;
            const jsonString = JSON.stringify(songData, null, 2);
            const blob = new Blob([jsonString], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${song.songName || "song"}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          };
          reader.readAsDataURL(song.audioBlob);
        } else {
          const jsonString = JSON.stringify(songData, null, 2);
          const blob = new Blob([jsonString], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${song.songName || "song"}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
        cursor.continue();
      }
    };
  });

  // ------------------ Enhanced Modal Dialogue Functions ------------------
  function openEnhancedModal({title = "Modal Title", message = "Modal message goes here.", onConfirm = null, onCancel = null}) {
    const modal = document.getElementById("enhancedModal");
    const modalTitle = document.getElementById("enhancedModalTitle");
    const modalBody = document.getElementById("enhancedModalBody");
    const confirmBtn = document.getElementById("enhancedModalConfirmBtn");
    const cancelBtn = document.getElementById("enhancedModalCancelBtn");
    
    modalTitle.textContent = title;
    modalBody.innerHTML = message;
    
    // Remove existing event listeners
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    
    if (onConfirm) {
      newConfirmBtn.addEventListener("click", () => {
        onConfirm();
        closeModal("enhancedModal");
      });
    } else {
      newConfirmBtn.addEventListener("click", () => closeModal("enhancedModal"));
    }
    if (onCancel) {
      newCancelBtn.addEventListener("click", () => {
        onCancel();
        closeModal("enhancedModal");
      });
    } else {
      newCancelBtn.addEventListener("click", () => closeModal("enhancedModal"));
    }
    
    modal.style.display = "flex";
    // Force reflow
    modal.offsetHeight;
    modal.classList.add("show");
  }

  function closeEnhancedModal() {
    closeModal("enhancedModal");
  }

  // Add ripple effect to buttons
  function addRippleEffect() {
    document.querySelectorAll('button, .nav-link, .custom-button').forEach(button => {
      button.classList.add('ripple');
      button.addEventListener('click', function(e) {
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const ripple = document.createElement('span');
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        this.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
      });
    });
  }

  // Initialize ripple effect when DOM is loaded
  addRippleEffect();

  // File Input Handling for Transfer and Database Sections
  function setupFilePicker(inputId, containerId) {
    const fileInput = document.getElementById(inputId);
    const container = document.getElementById(containerId);
    
    // Create preview container
    const preview = document.createElement('div');
    preview.className = 'file-picker-preview';
    preview.innerHTML = `
      <svg viewBox="0 0 24 24" class="file-picker-preview-icon">
        <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/>
      </svg>
      <div class="file-picker-preview-info">
        <div class="file-picker-preview-name"></div>
        <div class="file-picker-preview-size"></div>
      </div>
      <button type="button" class="file-picker-preview-remove">
        <svg viewBox="0 0 24 24" style="width:24px; height:24px;">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    `;
    
    // Insert preview after the file input container
    fileInput.parentNode.insertBefore(preview, fileInput.nextSibling);

    // Handle file selection
    fileInput.addEventListener('change', function() {
      if (this.files.length > 0) {
        const files = Array.from(this.files);
        const totalSize = files.reduce((acc, file) => acc + file.size, 0);
        
        preview.querySelector('.file-picker-preview-name').textContent = 
          files.length === 1 ? files[0].name : `${files.length} files selected`;
        preview.querySelector('.file-picker-preview-size').textContent = 
          formatFileSize(totalSize);
        preview.classList.add('visible');
      }
    });

    // Handle remove button
    preview.querySelector('.file-picker-preview-remove').addEventListener('click', function() {
      fileInput.value = '';
      preview.classList.remove('visible');
    });
  }

  // Initialize file pickers
  setupFilePicker('importFiles', 'transferSection');
  setupFilePicker('bulkAudioFiles', 'bulkAudioUploadSection');
  setupFilePicker('lyricsDbFile', 'databaseSection');

  // Add file preview for song audio input
  const songAudioInput = document.getElementById('songAudio');
  const songFilePreview = document.querySelector('.file-preview');

  songAudioInput.addEventListener('change', function() {
    if (this.files.length > 0) {
      const file = this.files[0];
      songFilePreview.classList.add('visible');
      songFilePreview.querySelector('.file-picker-preview-name').textContent = file.name;
      songFilePreview.querySelector('.file-picker-preview-size').textContent = formatFileSize(file.size);
      
      // Add event listener to remove button
      const removeBtn = songFilePreview.querySelector('.file-picker-preview-remove');
      removeBtn.onclick = () => {
        songFilePreview.classList.remove('visible');
        this.value = '';
      };
    }
  });

  // Helper function to generate a complex 9-letter key
  function generateActivationKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const specialChars = '!@#$%^&*';
    const numbers = '0123456789';
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    
    let key = '';
    
    // Ensure at least one special character
    key += specialChars.charAt(Math.floor(Math.random() * specialChars.length));
    
    // Ensure at least one number
    key += numbers.charAt(Math.floor(Math.random() * numbers.length));
    
    // Ensure at least one uppercase letter
    key += letters.charAt(Math.floor(Math.random() * 26));
    
    // Ensure at least one lowercase letter
    key += letters.charAt(26 + Math.floor(Math.random() * 26));
    
    // Fill the rest with random characters
    while (key.length < 9) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Shuffle the key
    return key.split('').sort(() => 0.5 - Math.random()).join('');
  }

  // Helper function to check if the app is activated
  async function checkActivation() {
    return new Promise((resolve) => {
      const transaction = db.transaction(['appSettings'], 'readonly');
      const store = transaction.objectStore('appSettings');
      const request = store.get('activation');
      
      request.onsuccess = (e) => {
        resolve(e.target.result ? e.target.result.activated : false);
      };
      
      request.onerror = () => {
        resolve(false);
      };
    });
  }

  // Helper function to save activation status
  function saveActivation() {
    const transaction = db.transaction(['appSettings'], 'readwrite');
    const store = transaction.objectStore('appSettings');
    store.put({ key: 'activation', activated: true, activatedAt: new Date() });
  }

  // Handle activation key submission
  document.getElementById('submitActivation').addEventListener('click', () => {
    const enteredKey = document.getElementById('activationKey').value;
    const modal = document.getElementById('activationModal');
    
    if (!activationKey || Date.now() > activationKeyExpiry) {
      showToast('Activation key has expired. Please refresh the page for a new key.', 'error');
      return;
    }
    
    if (enteredKey === activationKey) {
      // Add success class to trigger animations
      modal.querySelector('.modal-content').classList.add('activation-success');
      
      // Wait for animations to complete before proceeding
      setTimeout(() => {
        saveActivation();
        closeModal('activationModal');
        showToast('App activated successfully!', 'success');
        loadFavorites();
        loadSongs();
        loadLyricsDatabase();
      }, 1500); // Wait for all animations to complete
    } else {
      showToast('Invalid activation key. Please try again.', 'error');
    }
  });

  // Prevent caps lock in activation key input
  document.getElementById('activationKey').addEventListener('keydown', (e) => {
    if (e.getModifierState('CapsLock')) {
      e.preventDefault();
      showToast('Please turn off Caps Lock', 'warning');
    }
  });

  // Timer functionality for activation key
  function updateActivationTimer() {
    if (!activationKeyExpiry) return;
    
    const now = Date.now();
    const timeLeft = Math.max(0, activationKeyExpiry - now);
    
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      document.getElementById('activationTimer').textContent = '00:00';
      showToast('Activation key has expired. Please refresh the page for a new key.', 'error');
      return;
    }
    
    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);
    document.getElementById('activationTimer').textContent = 
      `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  let timerInterval;
  request.onsuccess = async e => {
    db = e.target.result;
    
    // Check if app is activated
    const isActivated = await checkActivation();
    
    if (!isActivated) {
      // Generate new activation key
      activationKey = generateActivationKey();
      activationKeyExpiry = Date.now() + (5 * 60 * 1000); // 5 minutes from now
      
      // Log the key to console
      console.log('Activation Key:', activationKey);
      console.log('Valid until:', new Date(activationKeyExpiry).toLocaleTimeString());
      
      // Show activation modal
      const modal = document.getElementById('activationModal');
      modal.style.display = 'flex';
      modal.offsetHeight;
      modal.classList.add('show');
      
      // Start the timer
      updateActivationTimer();
      timerInterval = setInterval(updateActivationTimer, 1000);
      
      // Focus the input
      document.getElementById('activationKey').focus();
    } else {
      // App is already activated, proceed with normal initialization
      loadFavorites();
      loadSongs();
      loadLyricsDatabase();
    }
  };

  // Add search functionality
  const bulkExportSearch = document.getElementById('bulkExportSearch');
  if (bulkExportSearch) {
    bulkExportSearch.addEventListener('input', function(e) {
      const searchTerm = e.target.value.toLowerCase();
      const items = document.querySelectorAll('.bulk-export-item');
      
      items.forEach(item => {
        const songName = item.dataset.songName;
        const singerName = item.dataset.singerName;
        const writerName = item.dataset.writerName;
        const matches = songName.includes(searchTerm) || 
                       singerName.includes(searchTerm) || 
                       writerName.includes(searchTerm);
        item.style.display = matches ? 'flex' : 'none';
      });
    });
  }

  // Update the export functionality to include audio data
  async function exportSelectedSongs() {
    const selectedItems = document.querySelectorAll('.bulk-export-item input[type="checkbox"]:checked');
    if (selectedItems.length === 0) {
      showToast('Please select at least one song to export', 'error');
      return;
    }

    const transaction = db.transaction(['songs'], 'readonly');
    const store = transaction.objectStore('songs');
    let exportedCount = 0;
    const totalToExport = selectedItems.length;

    for (const checkbox of selectedItems) {
      const songId = parseInt(checkbox.id.replace('song-', ''));
      const song = await new Promise((resolve) => {
        const request = store.get(songId);
        request.onsuccess = () => resolve(request.result);
      });

      if (song) {
        try {
          // Create a copy of the song data for export
          const exportData = {
            songName: song.songName,
            songWriter: song.songWriter || '',
            songSinger: song.songSinger || '',
            songLyrics: song.songLyrics || '',
            lyricsFontSize: song.lyricsFontSize || '16px',
            favorited: song.favorited || false,
            created: song.created || new Date(),
            audioBase64: null,
            audioBlobType: null
          };

          // Handle audio blob if it exists
          if (song.audioBlob) {
            exportData.audioBase64 = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.readAsDataURL(song.audioBlob);
            });
            exportData.audioBlobType = song.audioBlob.type;
          }

          // Create and download the JSON file
          const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${song.songName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          exportedCount++;
        } catch (error) {
          console.error('Error exporting song:', error);
          showToast(`Error exporting ${song.songName}`, 'error');
        }
      }
    }

    // Close modal and show single success message after all exports are complete
    if (exportedCount === totalToExport) {
      document.getElementById('bulkExportModal').style.display = 'none';
      showToast(`Successfully exported ${exportedCount} song${exportedCount > 1 ? 's' : ''}!`, 'success');
    }
  }
});
