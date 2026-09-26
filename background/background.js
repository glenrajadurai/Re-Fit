// background.js - Smart ReturnGuard Service Worker

// Initialize default settings upon installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    const defaultProfile = {
      userProfile: {
        name: "Alex Morgan",
        heightCm: 175,
        weightKg: 68,
        chestCm: 96,
        waistCm: 80,
        hipsCm: 98,
        shoulderCm: 44,
        fitPreference: "regular", // "tight", "regular", "relaxed", "oversized"
        bodyShape: "athletic", // "hourglass", "athletic", "rectangle", "pear", "inverted_triangle"
        skinTone: "#d4aa78", // Hex color for color matching
        flexibilityToleranceCm: 3, // Allowed variance
        genderPreference: "unisex"
      },
      stats: {
        returnsAvoided: 14,
        moneySavedUsd: 420.00,
        co2SavedKg: 38.5,
        fitScansPerformed: 32
      },
      scanHistory: []
    };

    chrome.storage.local.set(defaultProfile, () => {
      console.log('Smart ReturnGuard initialized with default user profile & stats.');
    });
  }
});

// Listener for content script and popup messaging
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_USER_PROFILE') {
    chrome.storage.local.get(['userProfile', 'stats'], (data) => {
      sendResponse(data);
    });
    return true; // Asynchronous response
  }

  if (request.action === 'SAVE_FIT_ANALYSIS') {
    chrome.storage.local.get(['scanHistory', 'stats'], (data) => {
      const history = data.scanHistory || [];
      history.unshift(request.payload);
      // Keep last 20 scans
      if (history.length > 20) history.pop();

      const newStats = data.stats || { returnsAvoided: 0, moneySavedUsd: 0, co2SavedKg: 0, fitScansPerformed: 0 };
      newStats.fitScansPerformed += 1;
      
      if (request.payload.riskLevel === 'HIGH' || request.payload.riskLevel === 'MEDIUM') {
        // Increment avoided return projection if bad fit was flagged
        newStats.returnsAvoided += 1;
        newStats.moneySavedUsd += 29.99;
        newStats.co2SavedKg += 2.75;
      }

      chrome.storage.local.set({ scanHistory: history, stats: newStats }, () => {
        sendResponse({ success: true, stats: newStats });
      });
    });
    return true;
  }
});
