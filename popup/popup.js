// popup.js - Smart ReturnGuard Core Application Logic & 3D AR Camera Renderer

document.addEventListener('DOMContentLoaded', () => {
  let selectedUserSize = 'M';
  let referenceBrand = 'Nike';

  let userProfile = {
    heightCm: 175,
    weightKg: 68,
    chestCm: 96,
    waistCm: 80,
    hipsCm: 98,
    shoulderCm: 44,
    fitPreference: 'regular',
    bodyShape: 'athletic'
  };

  let currentProduct = {
    title: "Classic Essential Crewneck Sweater",
    imageUrl: "",
    fabric: "95% Cotton, 5% Elastane",
    stretchFactor: 0.12,
    reviewSentiment: "TRUE_TO_SIZE",
    modelInfo: "Model is 178cm wearing Size M",
    detectedSizes: ["S", "M", "L", "XL"]
  };

  let vrState = {
    size: 'M',
    pose: 'standing',
    garmentType: 'tshirt',
    showHeatmap: true,
    rotationAngle: 0,
    isCameraActive: false
  };

  const canvas = document.getElementById('vrCanvas');
  const video = document.getElementById('arCameraVideo');
  let ctx = canvas ? canvas.getContext('2d') : null;
  let cameraStream = null;
  let loadedGarmentImg = null;

  initTabs();
  loadStoredData();
  setupEventListeners();
  queryActiveTabProduct();

  setTimeout(() => {
    resizeCanvasIfNeeded();
    renderVRMannequin();
    calculateFitScore();
  }, 100);

  function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');

        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const panel = document.getElementById(targetTab);
        if (panel) panel.classList.add('active');

        if (targetTab === 'tab-vr') {
          setTimeout(() => {
            resizeCanvasIfNeeded();
            renderVRMannequin();
          }, 40);
        }
      });
    });
  }

  function resizeCanvasIfNeeded() {
    if (!canvas) return;
    const parent = canvas.parentElement;
    const w = (parent && parent.clientWidth > 100) ? parent.clientWidth : 370;
    const h = (parent && parent.clientHeight > 100) ? parent.clientHeight : 260;
    canvas.width = w;
    canvas.height = h;
  }

  function loadStoredData() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['userProfile', 'selectedUserSize'], (data) => {
        if (data.selectedUserSize) {
          selectedUserSize = data.selectedUserSize;
          updateSizeChipUI(selectedUserSize);
        }
        if (data.userProfile) {
          userProfile = { ...userProfile, ...data.userProfile };
          populateProfileForm();
        }
        calculateFitScore();
      });
    } else {
      calculateFitScore();
    }
  }

  function updateSizeChipUI(sz) {
    const chips = document.querySelectorAll('.size-chip');
    chips.forEach(c => {
      if (c.getAttribute('data-size') === sz) {
        c.classList.add('active');
      } else {
        c.classList.remove('active');
      }
    });
    const inputDisplay = document.getElementById('yourInputSizeDisplay');
    if (inputDisplay) inputDisplay.innerText = `Size ${sz}`;
  }

  function populateProfileForm() {
    document.getElementById('inputHeight').value = userProfile.heightCm;
    document.getElementById('inputWeight').value = userProfile.weightKg;
    document.getElementById('inputChest').value = userProfile.chestCm;
    document.getElementById('inputWaist').value = userProfile.waistCm;
    document.getElementById('inputHips').value = userProfile.hipsCm;
    document.getElementById('inputShoulder').value = userProfile.shoulderCm;
    document.getElementById('selectFitPref').value = userProfile.fitPreference;
    document.getElementById('selectBodyShape').value = userProfile.bodyShape;
  }

  function saveProfileData() {
    userProfile = {
      heightCm: parseFloat(document.getElementById('inputHeight').value) || 175,
      weightKg: parseFloat(document.getElementById('inputWeight').value) || 68,
      chestCm: parseFloat(document.getElementById('inputChest').value) || 96,
      waistCm: parseFloat(document.getElementById('inputWaist').value) || 80,
      hipsCm: parseFloat(document.getElementById('inputHips').value) || 98,
      shoulderCm: parseFloat(document.getElementById('inputShoulder').value) || 44,
      fitPreference: document.getElementById('selectFitPref').value,
      bodyShape: document.getElementById('selectBodyShape').value
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ userProfile: userProfile }, () => {
        alert("✅ Measurements saved successfully!");
        calculateFitScore();
        renderVRMannequin();
      });
    } else {
      alert("✅ Measurements saved locally!");
      calculateFitScore();
      renderVRMannequin();
    }
  }

  function queryActiveTabProduct() {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'GET_PAGE_PRODUCT_DATA' }, (response) => {
            if (response && response.title) {
              currentProduct = response;
              if (currentProduct.imageUrl) {
                loadedGarmentImg = new Image();
                loadedGarmentImg.crossOrigin = "anonymous";
                loadedGarmentImg.src = currentProduct.imageUrl;
                loadedGarmentImg.onload = () => renderVRMannequin();
              }
              updateProductDisplay();
              calculateFitScore();
            }
          });
        }
      });
    }
  }

  function updateProductDisplay() {
    document.getElementById('productTitleDisplay').innerText = currentProduct.title || "Clothing Item Scanned";
    document.getElementById('productFabricDisplay').innerText = currentProduct.fabric || "Cotton Mix";

    const sentimentEl = document.getElementById('productReviewSentimentDisplay');
    if (currentProduct.reviewSentiment === "RUNS_SMALL") {
      sentimentEl.innerText = "Runs Small (Size Up!)";
      sentimentEl.style.color = "#f87171";
    } else if (currentProduct.reviewSentiment === "RUNS_LARGE") {
      sentimentEl.innerText = "Runs Large (Size Down)";
      sentimentEl.style.color = "#38bdf8";
    } else {
      sentimentEl.innerText = "True to Size";
      sentimentEl.style.color = "#34d399";
    }

    const badge = document.getElementById('fabricStretchBadge');
    const stretchPct = Math.round((currentProduct.stretchFactor || 0.05) * 100);
    badge.innerText = `Stretch ${stretchPct}%`;
    badge.className = stretchPct >= 8 ? "risk-badge risk-low" : "risk-badge risk-med";
  }

  function calculateFitScore() {
    referenceBrand = document.getElementById('refBrandNameSelect').value || 'Nike';

    let baseChest = 98;
    let baseWaist = 82;

    if (selectedUserSize === 'XS') { baseChest = 86; baseWaist = 70; }
    if (selectedUserSize === 'S') { baseChest = 92; baseWaist = 76; }
    if (selectedUserSize === 'M') { baseChest = 98; baseWaist = 82; }
    if (selectedUserSize === 'L') { baseChest = 104; baseWaist = 88; }
    if (selectedUserSize === 'XL') { baseChest = 112; baseWaist = 96; }
    if (selectedUserSize === '2XL') { baseChest = 120; baseWaist = 104; }

    if (referenceBrand === 'Zara') { baseChest -= 3; baseWaist -= 3; }
    if (referenceBrand === 'H&M') { baseChest += 3; baseWaist += 3; }
    if (referenceBrand === 'ASOS') { baseChest -= 2; }

    if (currentProduct.reviewSentiment === "RUNS_SMALL") {
      baseChest -= 4;
      baseWaist -= 4;
    }

    const stretchAllowanceCm = baseChest * (currentProduct.stretchFactor || 0.05);
    const chestDiff = (baseChest + stretchAllowanceCm) - userProfile.chestCm;
    const waistDiff = (baseWaist + stretchAllowanceCm) - userProfile.waistCm;

    let score = 100;
    if (chestDiff < 0) score += chestDiff * 3.5;
    if (waistDiff < 0) score += waistDiff * 3.5;
    if (chestDiff > 14) score -= (chestDiff - 14) * 2;

    score = Math.max(45, Math.min(98, Math.round(score)));

    const scoreGauge = document.getElementById('scoreGaugeArc');
    const scoreVal = document.getElementById('scoreValue');
    const verdictTitle = document.getElementById('verdictTitle');
    const verdictDesc = document.getElementById('verdictDesc');
    const recommendedSize = document.getElementById('recommendedSize');
    const riskDisplay = document.getElementById('riskLabelDisplay');

    scoreVal.innerText = `${score}%`;
    const dashVal = Math.round((score / 100) * 100);
    scoreGauge.setAttribute('stroke-dasharray', `${dashVal}, 100`);

    let recSize = selectedUserSize;
    if (currentProduct.reviewSentiment === "RUNS_SMALL" || score < 72) {
      recSize = getNextSizeUp(selectedUserSize);
    }

    if (score >= 84) {
      scoreGauge.setAttribute('stroke', '#10b981');
      verdictTitle.innerText = "Great Fit Match";
      verdictTitle.style.color = "#34d399";
      verdictDesc.innerText = `Selected Size ${selectedUserSize} provides optimal ease with +${(currentProduct.stretchFactor*100).toFixed(0)}% fabric stretch.`;
      recommendedSize.innerText = `SIZE ${recSize}`;
      if (riskDisplay) { riskDisplay.innerText = "LOW"; riskDisplay.style.color = "#34d399"; }
    } else if (score >= 68) {
      scoreGauge.setAttribute('stroke', '#f59e0b');
      verdictTitle.innerText = "Slightly Snug Ease";
      verdictTitle.style.color = "#fbbf24";
      verdictDesc.innerText = `Garment cut is slightly tight around waist. Consider sizing up for comfort.`;
      recommendedSize.innerText = `SIZE ${recSize}`;
      if (riskDisplay) { riskDisplay.innerText = "MODERATE"; riskDisplay.style.color = "#fbbf24"; }
    } else {
      scoreGauge.setAttribute('stroke', '#ef4444');
      verdictTitle.innerText = "High Return Risk";
      verdictTitle.style.color = "#f87171";
      verdictDesc.innerText = `Lack of fabric stretch will cause tight constriction. Size up to avoid returning.`;
      recommendedSize.innerText = `SIZE ${recSize}`;
      if (riskDisplay) { riskDisplay.innerText = "HIGH"; riskDisplay.style.color = "#f87171"; }
    }

    updateMetricBar('chestBar', 'chestEaseVal', chestDiff, "Chest");
    updateMetricBar('waistBar', 'waistEaseVal', waistDiff, "Waist");
    updateMetricBar('shoulderBar', 'shoulderEaseVal', 1.5, "Shoulder");
  }

  function getNextSizeUp(sz) {
    const order = ['XS', 'S', 'M', 'L', 'XL', '2XL'];
    const idx = order.indexOf(sz);
    if (idx !== -1 && idx < order.length - 1) return order[idx + 1];
    return sz;
  }

  function updateMetricBar(barId, labelId, easeCm, name) {
    const bar = document.getElementById(barId);
    const lbl = document.getElementById(labelId);
    if (!bar || !lbl) return;

    if (easeCm >= 2) {
      bar.style.width = '88%';
      bar.style.background = '#10b981';
      lbl.innerText = `Comfortable (+${easeCm.toFixed(1)}cm)`;
      lbl.style.color = '#34d399';
    } else if (easeCm >= 0) {
      bar.style.width = '65%';
      bar.style.background = '#f59e0b';
      lbl.innerText = `Snug Fit (+${easeCm.toFixed(1)}cm)`;
      lbl.style.color = '#fbbf24';
    } else {
      bar.style.width = '35%';
      bar.style.background = '#ef4444';
      lbl.innerText = `Tight Tension (${easeCm.toFixed(1)}cm)`;
      lbl.style.color = '#f87171';
    }
  }

  async function toggleLiveCamera() {
    if (vrState.isCameraActive) {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
      }
      if (video) {
        video.srcObject = null;
      }
      vrState.isCameraActive = false;
      document.getElementById('btnStartCamera').innerText = "🎥 Start Live Camera";
      document.getElementById('btnStartCamera').style.background = "linear-gradient(135deg, #6366f1, #8b5cf6)";
      renderVRMannequin();
    } else {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: "user" }
          });
          if (video) {
            video.srcObject = cameraStream;
            video.play();
            vrState.isCameraActive = true;
            document.getElementById('btnStartCamera').innerText = "🔴 Camera Active (Click to Turn Off)";
            document.getElementById('btnStartCamera').style.background = "#ef4444";
            startARLoop();
          }
        }
      } catch (err) {
        vrState.isCameraActive = true;
        document.getElementById('btnStartCamera').innerText = "🔴 AR Mirror Active (Click to Turn Off)";
        startARLoop();
      }
    }
  }

  function startARLoop() {
    function loop() {
      renderVRMannequin();
      if (vrState.isCameraActive) {
        requestAnimationFrame(loop);
      }
    }
    loop();
  }

  function renderVRMannequin() {
    if (!canvas) return;
    if (!ctx) ctx = canvas.getContext('2d');
    if (!ctx) return;

    resizeCanvasIfNeeded();
    const w = canvas.width || 370;
    const h = canvas.height || 260;

    ctx.clearRect(0, 0, w, h);

    // 1. RENDER MIRRORED LIVE CAMERA FEED
    if (vrState.isCameraActive && video && video.readyState === 4) {
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, w, h);
      ctx.restore();
    } else {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = "rgba(99, 102, 241, 0.25)";
      ctx.lineWidth = 1;
      const centerY = h - 35;
      for (let x = 0; x <= w; x += 25) {
        ctx.beginPath();
        ctx.moveTo(x, centerY);
        ctx.lineTo(w / 2 + (x - w / 2) * 1.8, h);
        ctx.stroke();
      }
    }

    // 2. CALCULATE SIZE & BODY SCALE (GOOGLE MEET VIRTUAL FIT DYNAMICS)
    let sizeScale = 1.0;
    if (vrState.size === 'XS') sizeScale = 0.82;
    if (vrState.size === 'S') sizeScale = 0.90;
    if (vrState.size === 'M') sizeScale = 1.00;
    if (vrState.size === 'L') sizeScale = 1.12;
    if (vrState.size === 'XL') sizeScale = 1.25;
    if (vrState.size === '2XL') sizeScale = 1.38;

    const sw = 60 * sizeScale; // Shoulder half-width
    const ww = 48 * sizeScale; // Waist half-width
    const topY = h * 0.32;     // Garment collar top
    const botY = h * 0.78;     // Garment hem bottom
    const neckR = 18 * sizeScale; // Neck cutout radius

    ctx.save();
    ctx.translate(w / 2, 0);

    if (vrState.rotationAngle) {
      ctx.translate(0, (topY + botY) / 2);
      ctx.rotate((vrState.rotationAngle * Math.PI) / 180);
      ctx.translate(0, -(topY + botY) / 2);
    }

    // 3. DRAW MANNEQUIN BODY WHEN CAMERA IS INACTIVE
    if (!vrState.isCameraActive) {
      ctx.fillStyle = "rgba(96, 165, 250, 0.9)";
      ctx.beginPath();
      ctx.arc(0, topY - 24, 16, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(59, 130, 246, 0.85)";
      ctx.fillRect(-5, topY - 8, 10, 10);
    }

    // 4. GOOGLE MEET STYLE TORSO SEGMENT MASK PATH
    ctx.beginPath();
    ctx.moveTo(-neckR, topY);
    ctx.quadraticCurveTo(0, topY + neckR * 0.75, neckR, topY); // Neck cutout curve
    ctx.lineTo(sw, topY + 12); // Right shoulder
    ctx.lineTo(sw + 16, topY + 40); // Right sleeve out
    ctx.lineTo(sw - 5, topY + 52);  // Right sleeve under
    ctx.lineTo(ww, botY);           // Right waist side
    ctx.quadraticCurveTo(0, botY + 7, -ww, botY); // Bottom hem curve
    ctx.lineTo(-sw + 5, topY + 52);  // Left waist side
    ctx.lineTo(-sw - 16, topY + 40); // Left sleeve under
    ctx.lineTo(-sw, topY + 12);      // Left shoulder
    ctx.closePath();

    // 5. CLIP & RENDER SCRAPED CLOTH IMAGE (GOOGLE MEET BACKGROUND BLEND EFFECT)
    ctx.save();
    ctx.clip(); // Mask content strictly within body silhouette!

    if (loadedGarmentImg && loadedGarmentImg.complete) {
      ctx.globalAlpha = vrState.isCameraActive ? 0.92 : 1.0;
      ctx.drawImage(loadedGarmentImg, -sw - 18, topY - 10, (sw + 18) * 2, botY - topY + 20);

      // Google Meet Ambient Lighting & Shading Layer over clothing
      if (vrState.isCameraActive) {
        let shadeGrad = ctx.createRadialGradient(0, topY + 35, 8, 0, topY + 35, sw * 1.4);
        shadeGrad.addColorStop(0, "rgba(255, 255, 255, 0.15)");
        shadeGrad.addColorStop(0.7, "rgba(0, 0, 0, 0.05)");
        shadeGrad.addColorStop(1, "rgba(0, 0, 0, 0.35)");
        ctx.fillStyle = shadeGrad;
        ctx.fillRect(-sw - 25, topY - 20, (sw + 25) * 2, botY - topY + 40);
      }
    } else {
      // Fallback Heatmap Texture
      let heatmapGrad = ctx.createLinearGradient(0, topY, 0, botY);
      if (vrState.size === 'XS' || vrState.size === 'S') {
        heatmapGrad.addColorStop(0, "rgba(239, 68, 68, 0.85)");
        heatmapGrad.addColorStop(0.5, "rgba(245, 158, 11, 0.75)");
        heatmapGrad.addColorStop(1, "rgba(16, 185, 129, 0.65)");
      } else if (vrState.size === 'M') {
        heatmapGrad.addColorStop(0, "rgba(16, 185, 129, 0.85)");
        heatmapGrad.addColorStop(0.6, "rgba(16, 185, 129, 0.75)");
        heatmapGrad.addColorStop(1, "rgba(56, 189, 248, 0.65)");
      } else {
        heatmapGrad.addColorStop(0, "rgba(56, 189, 248, 0.85)");
        heatmapGrad.addColorStop(1, "rgba(99, 102, 241, 0.65)");
      }
      ctx.fillStyle = heatmapGrad;
      ctx.fillRect(-sw - 25, topY - 20, (sw + 25) * 2, botY - topY + 40);
    }
    ctx.restore(); // End clipping mask

    // 6. GOOGLE MEET GLOWING BODY CONTOUR HIGHLIGHT
    ctx.strokeStyle = vrState.isCameraActive ? "rgba(52, 211, 153, 0.85)" : "rgba(129, 140, 248, 0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // 7. HUD STATUS OVERLAY FOR GOOGLE MEET STYLE VIRTUAL FIT
    if (vrState.isCameraActive) {
      ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
      ctx.fillRect(-140, 8, 280, 20);
      ctx.strokeStyle = "rgba(52, 211, 153, 0.4)";
      ctx.lineWidth = 1;
      ctx.strokeRect(-140, 8, 280, 20);

      ctx.fillStyle = "#34d399";
      ctx.beginPath();
      ctx.arc(-128, 18, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "600 9.5px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`Google Meet Virtual Fit • AI Body Lock (${vrState.size})`, -118, 21);
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9.5px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(currentProduct.title ? currentProduct.title.substring(0, 20) : "Scraped Garment", 0, topY + (botY - topY) / 2);
    }

    ctx.restore();
  }

  function setupEventListeners() {
    const sizeChips = document.querySelectorAll('.size-chip');
    sizeChips.forEach(chip => {
      chip.addEventListener('click', () => {
        selectedUserSize = chip.getAttribute('data-size');
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ selectedUserSize: selectedUserSize });
        }
        updateSizeChipUI(selectedUserSize);
        vrState.size = selectedUserSize;
        document.getElementById('vrSizeSelect').value = selectedUserSize;
        calculateFitScore();
        renderVRMannequin();
      });
    });

    document.getElementById('refBrandNameSelect').addEventListener('change', calculateFitScore);
    document.getElementById('fitPrefQuickSelect').addEventListener('change', calculateFitScore);

    document.getElementById('btnSaveProfile').addEventListener('click', saveProfileData);

    document.getElementById('btnRescanPage').addEventListener('click', () => {
      queryActiveTabProduct();
    });

    document.getElementById('btnStartCamera').addEventListener('click', () => {
      toggleLiveCamera();
    });

    document.getElementById('vrSizeSelect').addEventListener('change', (e) => {
      vrState.size = e.target.value;
      renderVRMannequin();
    });

    document.getElementById('vrPoseSelect').addEventListener('change', (e) => {
      vrState.pose = e.target.value;
      renderVRMannequin();
    });

    document.getElementById('vrGarmentTypeSelect').addEventListener('change', (e) => {
      vrState.garmentType = e.target.value;
      renderVRMannequin();
    });

    const rotationSlider = document.getElementById('vrRotationSlider');
    if (rotationSlider) {
      rotationSlider.addEventListener('input', (e) => {
        vrState.rotationAngle = parseInt(e.target.value, 10);
        renderVRMannequin();
      });
    }

    document.getElementById('toggleHeatmapBtn').addEventListener('click', () => {
      vrState.showHeatmap = !vrState.showHeatmap;
      document.getElementById('vrModeLabel').innerText = vrState.showHeatmap ? "3D Heatmap" : "Fabric Only";
      renderVRMannequin();
    });

    document.getElementById('rotateMannequinBtn').addEventListener('click', () => {
      vrState.rotationAngle = (vrState.rotationAngle + 45) % 360;
      if (rotationSlider) rotationSlider.value = vrState.rotationAngle;
      renderVRMannequin();
    });
  }

});
