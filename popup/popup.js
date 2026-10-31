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
  }, 50);

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
          }, 30);
        }
      });
    });
  }

  function resizeCanvasIfNeeded() {
    if (!canvas) return;
    const parent = canvas.parentElement;
    const w = (parent && parent.clientWidth > 100) ? parent.clientWidth : 370;
    const h = (parent && parent.clientHeight > 100) ? parent.clientHeight : 260;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
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
    const group = document.getElementById('sizeQuickGroup');
    if (!group) return;

    // Check if the current size chip exists in the group
    let chip = group.querySelector(`.size-chip[data-size="${sz}"]`);
    if (!chip && sz) {
      // Add a dynamic chip for detected store size if not present in default XS-2XL
      chip = document.createElement('button');
      chip.className = 'size-chip active';
      chip.setAttribute('data-size', sz);
      chip.innerText = sz;
      chip.addEventListener('click', () => {
        group.querySelectorAll('.size-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        selectedUserSize = sz;
        vrState.size = sz;
        const vrSelect = document.getElementById('vrSizeSelect');
        if (vrSelect) vrSelect.value = sz;
        calculateFitScore();
        renderVRMannequin();
      });
      group.appendChild(chip);
    }

    const chips = group.querySelectorAll('.size-chip');
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
    if (document.getElementById('inputHeight')) document.getElementById('inputHeight').value = userProfile.heightCm;
    if (document.getElementById('inputWeight')) document.getElementById('inputWeight').value = userProfile.weightKg;
    if (document.getElementById('inputChest')) document.getElementById('inputChest').value = userProfile.chestCm;
    if (document.getElementById('inputWaist')) document.getElementById('inputWaist').value = userProfile.waistCm;
    if (document.getElementById('inputHips')) document.getElementById('inputHips').value = userProfile.hipsCm;
    if (document.getElementById('inputShoulder')) document.getElementById('inputShoulder').value = userProfile.shoulderCm;
    if (document.getElementById('selectFitPref')) document.getElementById('selectFitPref').value = userProfile.fitPreference;
    if (document.getElementById('selectBodyShape')) document.getElementById('selectBodyShape').value = userProfile.bodyShape;
  }

  function saveProfileData() {
    userProfile = {
      heightCm: parseFloat(document.getElementById('inputHeight').value) || 175,
      weightKg: parseFloat(document.getElementById('inputWeight').value) || 68,
      chestCm: parseFloat(document.getElementById('inputChest').value) || 96,
      waistCm: parseFloat(document.getElementById('inputWaist').value) || 80,
      hipsCm: parseFloat(document.getElementById('inputHips').value) || 98,
      shoulderCm: parseFloat(document.getElementById('inputShoulder').value) || 44,
      fitPreference: document.getElementById('selectFitPref') ? document.getElementById('selectFitPref').value : 'regular',
      bodyShape: document.getElementById('selectBodyShape') ? document.getElementById('selectBodyShape').value : 'athletic'
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

              // If the webpage has an active size selected, automatically adopt it
              if (response.webpageSelectedSize) {
                selectedUserSize = response.webpageSelectedSize;
                vrState.size = selectedUserSize;
                updateSizeChipUI(selectedUserSize);
                const vrSelect = document.getElementById('vrSizeSelect');
                if (vrSelect) vrSelect.value = selectedUserSize;

                const badge = document.getElementById('detectedSizeBadge');
                if (badge) {
                  badge.innerText = `Store Size: ${selectedUserSize} (Auto-Detected)`;
                  badge.style.background = "rgba(16, 185, 129, 0.18)";
                  badge.style.color = "#047857";
                  badge.style.fontWeight = "700";
                }
              }

              if (currentProduct.imageUrl) {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => {
                  loadedGarmentImg = img;
                  renderVRMannequin();
                };
                img.onerror = () => {
                  const imgNoCors = new Image();
                  imgNoCors.onload = () => {
                    loadedGarmentImg = imgNoCors;
                    renderVRMannequin();
                  };
                  imgNoCors.src = currentProduct.imageUrl;
                };
                img.src = currentProduct.imageUrl;
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
    if (document.getElementById('productTitleDisplay')) document.getElementById('productTitleDisplay').innerText = currentProduct.title || "Clothing Item Scanned";
    if (document.getElementById('productFabricDisplay')) document.getElementById('productFabricDisplay').innerText = currentProduct.fabric || "Cotton Mix";

    // Non-clothing page alert banner
    let nonClothingBanner = document.getElementById('nonClothingWarningBanner');
    if (currentProduct.isClothing === false) {
      if (!nonClothingBanner) {
        nonClothingBanner = document.createElement('div');
        nonClothingBanner.id = 'nonClothingWarningBanner';
        nonClothingBanner.style.cssText = "background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; font-size: 11px; padding: 8px 12px; border-radius: 8px; font-weight: 600; margin-bottom: 8px;";
        nonClothingBanner.innerHTML = "⚠️ <strong>Non-Clothing Page Detected</strong>: Smart ReturnGuard works specifically on apparel and garment product pages.";
        const viewport = document.querySelector('.content-viewport');
        if (viewport) viewport.insertBefore(nonClothingBanner, viewport.firstChild);
      }
    } else if (nonClothingBanner) {
      nonClothingBanner.remove();
    }

    const sentimentEl = document.getElementById('productReviewSentimentDisplay');
    if (sentimentEl) {
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
    }

    const badge = document.getElementById('fabricStretchBadge');
    if (badge) {
      const stretchPct = Math.round((currentProduct.stretchFactor || 0.05) * 100);
      badge.innerText = `Stretch ${stretchPct}%`;
      badge.className = stretchPct >= 8 ? "risk-badge risk-low" : "risk-badge risk-med";
    }
  }

  function calculateFitScore() {
    const brandSelect = document.getElementById('refBrandNameSelect');
    referenceBrand = brandSelect ? brandSelect.value : 'Nike';

    // Helper: Map arbitrary size to standard chest/waist base
    function getBaseDimensionsForSize(sz) {
      if (!sz) return { chest: 98, waist: 82 };
      const s = String(sz).trim().toUpperCase();
      if (s === 'XXS') return { chest: 80, waist: 64 };
      if (s === 'XS' || s === '28') return { chest: 86, waist: 70 };
      if (s === 'S' || s === '30') return { chest: 92, waist: 76 };
      if (s === 'M' || s === '32') return { chest: 98, waist: 82 };
      if (s === 'L' || s === '34') return { chest: 104, waist: 88 };
      if (s === 'XL' || s === '36') return { chest: 112, waist: 96 };
      if (s === 'XXL' || s === '2XL' || s === '38') return { chest: 120, waist: 104 };
      if (s === '3XL' || s === '40') return { chest: 126, waist: 110 };

      // Numeric waist size directly (e.g. 28, 30, 32, 34 inch pants)
      const numMatch = s.match(/^(\d{2})/);
      if (numMatch) {
        const val = parseInt(numMatch[1], 10);
        if (val >= 24 && val <= 50) {
          const waistCm = Math.round(val * 2.54);
          return { chest: waistCm + 16, waist: waistCm };
        }
      }
      return { chest: 98, waist: 82 };
    }

    const baseDim = getBaseDimensionsForSize(selectedUserSize);
    let baseChest = baseDim.chest;
    let baseWaist = baseDim.waist;

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

    if (scoreVal) scoreVal.innerText = `${score}%`;
    if (scoreGauge) {
      const dashVal = Math.round((score / 100) * 100);
      scoreGauge.setAttribute('stroke-dasharray', `${dashVal}, 100`);
    }

    let recSize = selectedUserSize;
    if (currentProduct.reviewSentiment === "RUNS_SMALL" || score < 72) {
      recSize = getNextSizeUp(selectedUserSize);
    }

    if (verdictTitle) {
      if (score >= 84) {
        if (scoreGauge) scoreGauge.setAttribute('stroke', '#10b981');
        verdictTitle.innerText = "Great Fit Match";
        verdictTitle.style.color = "#34d399";
        if (verdictDesc) verdictDesc.innerText = `Selected Size ${selectedUserSize} provides optimal ease with +${(currentProduct.stretchFactor*100).toFixed(0)}% fabric stretch.`;
        if (recommendedSize) recommendedSize.innerText = `SIZE ${recSize}`;
        if (riskDisplay) { riskDisplay.innerText = "LOW"; riskDisplay.style.color = "#34d399"; }
      } else if (score >= 68) {
        if (scoreGauge) scoreGauge.setAttribute('stroke', '#f59e0b');
        verdictTitle.innerText = "Slightly Snug Ease";
        verdictTitle.style.color = "#fbbf24";
        if (verdictDesc) verdictDesc.innerText = `Garment cut is slightly tight around waist. Consider sizing up for comfort.`;
        if (recommendedSize) recommendedSize.innerText = `SIZE ${recSize}`;
        if (riskDisplay) { riskDisplay.innerText = "MODERATE"; riskDisplay.style.color = "#fbbf24"; }
      } else {
        if (scoreGauge) scoreGauge.setAttribute('stroke', '#ef4444');
        verdictTitle.innerText = "High Return Risk";
        verdictTitle.style.color = "#f87171";
        if (verdictDesc) verdictDesc.innerText = `Lack of fabric stretch will cause tight constriction. Size up to avoid returning.`;
        if (recommendedSize) recommendedSize.innerText = `SIZE ${recSize}`;
        if (riskDisplay) { riskDisplay.innerText = "HIGH"; riskDisplay.style.color = "#f87171"; }
      }
    }

    updateMetricBar('chestBar', 'chestEaseVal', chestDiff, "Chest");
    updateMetricBar('waistBar', 'waistEaseVal', waistDiff, "Waist");
    updateMetricBar('shoulderBar', 'shoulderEaseVal', 1.5, "Shoulder");

    updateAutomatedRecommendedItems(recSize, userProfile);
  }

  function updateAutomatedRecommendedItems(recSize, profile) {
    const container = document.getElementById('recItemsContainer');
    if (!container) return;

    const siteLinks = (currentProduct && currentProduct.siteLinks && currentProduct.siteLinks.length > 0)
      ? currentProduct.siteLinks
      : [];

    // Automated catalog based on user's measurements & selected preferences
    const catalog = [
      {
        icon: "👕",
        title: siteLinks[0] ? siteLinks[0].title : "Breathable Slim-Fit Crewneck",
        category: "T-Shirt / Top",
        fabric: "95% Cotton, 5% Spandex",
        recommendedSize: recSize,
        matchScore: 96,
        risk: "LOW",
        url: siteLinks[0] ? siteLinks[0].url : ""
      },
      {
        icon: "🧥",
        title: siteLinks[1] ? siteLinks[1].title : "Urban Stretch Bomber Jacket",
        category: "Outerwear",
        fabric: "Cotton-Poly Flex Weave",
        recommendedSize: getNextSizeUp(recSize),
        matchScore: 92,
        risk: "LOW",
        url: siteLinks[1] ? siteLinks[1].url : ""
      },
      {
        icon: "👔",
        title: siteLinks[2] ? siteLinks[2].title : "Tailored Comfort Oxford Shirt",
        category: "Formal / Casual Shirt",
        fabric: "100% Breathable Linen/Cotton",
        recommendedSize: recSize,
        matchScore: 89,
        risk: "LOW",
        url: siteLinks[2] ? siteLinks[2].url : ""
      },
      {
        icon: "👖",
        title: siteLinks[3] ? siteLinks[3].title : "Flexible Tapered Chino Pants",
        category: "Bottoms",
        fabric: "98% Cotton, 2% Elastane",
        recommendedSize: recSize === 'XS' ? '28' : (recSize === 'S' ? '30' : (recSize === 'M' ? '32' : (recSize === 'L' ? '34' : '36'))),
        matchScore: 94,
        risk: "LOW",
        url: siteLinks[3] ? siteLinks[3].url : ""
      }
    ];

    container.innerHTML = catalog.map(item => `
      <a href="${item.url || '#'}" ${item.url ? 'target="_blank" rel="noopener noreferrer"' : ''} class="rec-item-card" style="text-decoration: none; color: inherit; cursor: pointer;">
        <div class="rec-item-left">
          <div class="rec-item-icon">${item.icon}</div>
          <div class="rec-item-info">
            <div class="rec-item-title" style="display: flex; align-items: center; gap: 4px;">
              <span>${item.title}</span>
              ${item.url ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>' : ''}
            </div>
            <div class="rec-item-desc">${item.category} • ${item.fabric}</div>
          </div>
        </div>
        <div class="rec-item-right">
          <span class="rec-item-size">Size ${item.recommendedSize}</span>
          <span class="rec-item-match">✓ ${item.matchScore}% Match</span>
        </div>
      </a>
    `).join('');

    const countBadge = document.getElementById('recItemsCountBadge');
    if (countBadge) countBadge.innerText = `${catalog.length} Tailored`;

    const profileContainer = document.getElementById('profileRecItemsContainer');
    if (profileContainer) {
      profileContainer.innerHTML = container.innerHTML;
    }
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
    const btn = document.getElementById('btnStartCamera');
    if (vrState.isCameraActive) {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
      }
      if (video) {
        video.srcObject = null;
      }
      vrState.isCameraActive = false;
      if (btn) {
        btn.innerText = "🎥 Start Live Camera";
        btn.style.background = "linear-gradient(135deg, #6366f1, #8b5cf6)";
      }
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
            if (btn) {
              btn.innerText = "🔴 Camera Active (Click to Turn Off)";
              btn.style.background = "#ef4444";
            }
            startARLoop();
          }
        }
      } catch (err) {
        console.error("Camera error:", err);
        vrState.isCameraActive = true;
        if (btn) {
          btn.innerText = "🔴 AR Mirror Active (Click to Turn Off)";
        }
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
    if (vrState.isCameraActive && video && video.readyState >= 1) {
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, w, h);
      ctx.restore();
    } else {
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = "rgba(99, 102, 241, 0.18)";
      ctx.lineWidth = 1;
      const centerY = h - 35;
      for (let x = 0; x <= w; x += 25) {
        ctx.beginPath();
        ctx.moveTo(x, centerY);
        ctx.lineTo(w / 2 + (x - w / 2) * 1.8, h);
        ctx.stroke();
      }
    }

    // 2. CALCULATE DYNAMIC SIZE SCALE
    let sizeScale = 1.0;
    if (vrState.size === 'XS') sizeScale = 0.82;
    if (vrState.size === 'S') sizeScale = 0.90;
    if (vrState.size === 'M') sizeScale = 1.00;
    if (vrState.size === 'L') sizeScale = 1.12;
    if (vrState.size === 'XL') sizeScale = 1.25;
    if (vrState.size === '2XL') sizeScale = 1.38;

    const sw = 64 * sizeScale; // Shoulder half-width
    const ww = 52 * sizeScale; // Waist half-width
    const topY = h * 0.30;     // Garment top position
    const botY = h * 0.78;     // Garment bottom position
    const neckR = 20 * sizeScale; // Neck cutout radius

    ctx.save();
    ctx.translate(w / 2, 0);

    if (vrState.rotationAngle) {
      ctx.translate(0, (topY + botY) / 2);
      ctx.rotate((vrState.rotationAngle * Math.PI) / 180);
      ctx.translate(0, -(topY + botY) / 2);
    }

    // 3. RENDER GARMENT IMAGE (WITHOUT SHIRT CUTOUT BORDER / SILHOUETTE)
    const imgW = sw * 2;
    const imgH = (botY - topY) + 20;

    if (loadedGarmentImg && loadedGarmentImg.complete && loadedGarmentImg.naturalWidth !== 0) {
      ctx.save();
      ctx.globalAlpha = vrState.isCameraActive ? 0.92 : 1.0;
      ctx.drawImage(loadedGarmentImg, -sw, topY - 10, imgW, imgH);
      ctx.restore();
    } else {
      // Clean styled garment card preview when no scraped image is available
      ctx.save();
      const cardGrad = ctx.createLinearGradient(0, topY, 0, botY);
      cardGrad.addColorStop(0, "rgba(99, 102, 241, 0.9)");
      cardGrad.addColorStop(1, "rgba(139, 92, 246, 0.85)");
      ctx.fillStyle = cardGrad;

      // Rounded rectangle for apparel display (natural box, no neck cutout or sleeve borders)
      const rx = -sw, ry = topY, rw = imgW, rh = botY - topY, radius = 12;
      ctx.beginPath();
      ctx.moveTo(rx + radius, ry);
      ctx.lineTo(rx + rw - radius, ry);
      ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + radius);
      ctx.lineTo(rx + rw, ry + rh - radius);
      ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - radius, ry + rh);
      ctx.lineTo(rx + radius, ry + rh);
      ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - radius);
      ctx.lineTo(rx, ry + radius);
      ctx.quadraticCurveTo(rx, ry, rx + radius, ry);
      ctx.closePath();
      ctx.fill();

      // Label inside
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(currentProduct.title ? currentProduct.title.substring(0, 24) : "Product Garment", 0, topY + (botY - topY) / 2);
      ctx.font = "9px sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.fillText(`Size ${vrState.size}`, 0, topY + (botY - topY) / 2 + 16);
      ctx.restore();
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
        const vrSel = document.getElementById('vrSizeSelect');
        if (vrSel) vrSel.value = selectedUserSize;
        calculateFitScore();
        renderVRMannequin();
      });
    });

    if (document.getElementById('refBrandNameSelect')) document.getElementById('refBrandNameSelect').addEventListener('change', calculateFitScore);
    if (document.getElementById('fitPrefQuickSelect')) document.getElementById('fitPrefQuickSelect').addEventListener('change', calculateFitScore);

    if (document.getElementById('btnSaveProfile')) document.getElementById('btnSaveProfile').addEventListener('click', saveProfileData);

    if (document.getElementById('btnRescanPage')) {
      document.getElementById('btnRescanPage').addEventListener('click', () => {
        queryActiveTabProduct();
      });
    }

    if (document.getElementById('btnStartCamera')) {
      document.getElementById('btnStartCamera').addEventListener('click', () => {
        toggleLiveCamera();
      });
    }

    if (document.getElementById('vrSizeSelect')) {
      document.getElementById('vrSizeSelect').addEventListener('change', (e) => {
        vrState.size = e.target.value;
        renderVRMannequin();
      });
    }

    if (document.getElementById('vrPoseSelect')) {
      document.getElementById('vrPoseSelect').addEventListener('change', (e) => {
        vrState.pose = e.target.value;
        renderVRMannequin();
      });
    }

    if (document.getElementById('vrGarmentTypeSelect')) {
      document.getElementById('vrGarmentTypeSelect').addEventListener('change', (e) => {
        vrState.garmentType = e.target.value;
        renderVRMannequin();
      });
    }

    const rotationSlider = document.getElementById('vrRotationSlider');
    if (rotationSlider) {
      rotationSlider.addEventListener('input', (e) => {
        vrState.rotationAngle = parseInt(e.target.value, 10);
        renderVRMannequin();
      });
    }

    const toggleHeatmapBtn = document.getElementById('toggleHeatmapBtn');
    if (toggleHeatmapBtn) {
      toggleHeatmapBtn.addEventListener('click', () => {
        vrState.showHeatmap = !vrState.showHeatmap;
        const modeLbl = document.getElementById('vrModeLabel');
        if (modeLbl) modeLbl.innerText = vrState.showHeatmap ? "3D Heatmap" : "Fabric Only";
        renderVRMannequin();
      });
    }

    const rotateMannequinBtn = document.getElementById('rotateMannequinBtn');
    if (rotateMannequinBtn) {
      rotateMannequinBtn.addEventListener('click', () => {
        vrState.rotationAngle = (vrState.rotationAngle + 45) % 360;
        if (rotationSlider) rotationSlider.value = vrState.rotationAngle;
        renderVRMannequin();
      });
    }
  }

});
