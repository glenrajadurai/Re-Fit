// content.js - Smart ReturnGuard In-Page System (No Text Overlay on Camera View)

(function () {
  let isWidgetInjected = false;
  let parsedProductCache = null;
  let selectedSize = 'M';
  let referenceBrand = 'Nike';
  let rotationAngle = 0;
  let isCameraActive = false;
  let cameraStream = null;
  let loadedGarmentImg = null;

  let userMeasurements = {
    height: 175,
    weight: 68,
    chest: 96,
    waist: 80,
    hips: 98,
    shoulders: 44
  };

  function parseProductDetails() {
    const pageText = document.body.innerText || '';
    const pageTextLower = pageText.toLowerCase();

    let title = '';
    const h1 = document.querySelector('h1');
    if (h1 && h1.innerText.trim()) {
      title = h1.innerText.trim();
    } else {
      const ogTitle = document.querySelector('meta[property="og:title"]');
      title = ogTitle ? ogTitle.getAttribute('content') : document.title;
    }
    title = title.split('|')[0].split('-')[0].trim();

    let imageUrl = '';
    const ogImg = document.querySelector('meta[property="og:image"]');
    if (ogImg && ogImg.content) {
      imageUrl = ogImg.content;
    } else {
      const imgEl = document.querySelector('img[src*="product"], img[class*="product"], img[id*="product"], img[data-src]');
      if (imgEl && imgEl.src) imageUrl = imgEl.src;
    }

    const fabricKeywords = ["cotton", "elastane", "spandex", "polyester", "wool", "linen", "denim", "viscose", "silk", "nylon"];
    let fabricComposition = "100% Cotton (Standard Non-Stretch)";
    let stretchFactor = 0.02;

    const compositionMatch = pageTextLower.match(/\b(\d{1,3}%\s*[a-z]+(\s*,\s*|\s+and\s+|\s+)?){1,4}\b/i);
    if (compositionMatch) {
      fabricComposition = compositionMatch[0].replace(/\s+/g, ' ').toUpperCase();
    } else {
      for (const kw of fabricKeywords) {
        if (pageTextLower.includes(kw)) {
          fabricComposition = `Contains ${kw.toUpperCase()}`;
          break;
        }
      }
    }

    if (pageTextLower.includes('elastane') || pageTextLower.includes('spandex') || pageTextLower.includes('stretch')) {
      stretchFactor = 0.12;
    } else if (pageTextLower.includes('polyester') || pageTextLower.includes('nylon')) {
      stretchFactor = 0.05;
    } else if (pageTextLower.includes('cotton') || pageTextLower.includes('linen') || pageTextLower.includes('denim')) {
      stretchFactor = 0.01;
    }

    let reviewSentiment = "TRUE_TO_SIZE";
    if (pageTextLower.includes('runs small') || pageTextLower.includes('order a size up') || pageTextLower.includes('too tight') || pageTextLower.includes('size up')) {
      reviewSentiment = "RUNS_SMALL";
    } else if (pageTextLower.includes('runs large') || pageTextLower.includes('size down') || pageTextLower.includes('oversized fit')) {
      reviewSentiment = "RUNS_LARGE";
    }

    parsedProductCache = {
      title: title.length > 50 ? title.substring(0, 50) + '...' : title,
      imageUrl: imageUrl,
      fabric: fabricComposition,
      stretchFactor: stretchFactor,
      reviewSentiment: reviewSentiment
    };

    if (imageUrl) {
      loadedGarmentImg = new Image();
      loadedGarmentImg.crossOrigin = "anonymous";
      loadedGarmentImg.src = imageUrl;
      loadedGarmentImg.onload = () => renderInPageVR();
    }

    return parsedProductCache;
  }

  function injectExactPopupModal() {
    if (isWidgetInjected || document.getElementById('return-guard-root')) return;

    const product = parseProductDetails();
    const root = document.createElement('div');
    root.id = 'return-guard-root';

    root.innerHTML = `
      <!-- FLOATING WIDGET BUTTON -->
      <div class="rg-floating-btn" id="rg-trigger">
        <div class="rg-pulse-dot"></div>
        <span>🛡️ Check Your Fit</span>
      </div>

      <!-- FULL IN-PAGE MODAL -->
      <div class="rg-modal-backdrop" id="rg-modal">
        <div class="rg-modal-dialog">
          
          <div class="rg-modal-header">
            <div class="rg-modal-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              Check Your Fit
            </div>
            <button class="rg-modal-close" id="rg-modal-close">&times;</button>
          </div>

          <div class="rg-tabs-nav">
            <button class="rg-tab-btn active" data-tab="tab-inpage-fit">Fit Check</button>
            <button class="rg-tab-btn" data-tab="tab-inpage-ar">3D AR Studio</button>
            <button class="rg-tab-btn" data-tab="tab-inpage-sizes">My Sizes</button>
          </div>

          <div class="rg-modal-viewport">
            
            <!-- MODULE 1: FIT CHECK (NO PRICE) -->
            <div class="rg-tab-panel active" id="tab-inpage-fit">
              
              <div class="rg-card" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(15, 23, 42, 0.95)); border: 1px solid rgba(129, 140, 248, 0.4);">
                <div style="font-size: 12px; font-weight: 700; color: #c7d2fe; display: flex; justify-content: space-between; align-items: center;">
                  <span>📏 SELECT YOUR SIZE BELOW</span>
                  <span style="font-size: 10px; color: #a7f3d0; background: rgba(16, 185, 129, 0.2); padding: 2px 6px; border-radius: 4px;">Click to Set</span>
                </div>
                
                <div class="rg-size-group">
                  <button class="rg-chip" data-size="XS">XS</button>
                  <button class="rg-chip" data-size="S">S</button>
                  <button class="rg-chip active" data-size="M">M</button>
                  <button class="rg-chip" data-size="L">L</button>
                  <button class="rg-chip" data-size="XL">XL</button>
                  <button class="rg-chip" data-size="2XL">2XL</button>
                </div>

                <div class="rg-grid-2" style="margin-top: 4px;">
                  <div>
                    <label style="font-size: 10px; color: #94a3b8;">Usual Brand:</label>
                    <select class="rg-select" id="rg-brand-select">
                      <option value="Nike" selected>Nike (Standard)</option>
                      <option value="Zara">Zara (Runs Small)</option>
                      <option value="H&M">H&M (Runs Large)</option>
                      <option value="ASOS">ASOS (Slim Fit)</option>
                    </select>
                  </div>
                  <div>
                    <label style="font-size: 10px; color: #94a3b8;">Fit Preference:</label>
                    <select class="rg-select" id="rg-pref-select">
                      <option value="regular" selected>Regular Comfort</option>
                      <option value="tight">Slim / Tight Fit</option>
                      <option value="relaxed">Relaxed / Loose</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- SCRAPED ITEM CARD (NO PRICE) -->
              <div class="rg-card">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 11px; font-weight: 700; color: #94a3b8;">ACTIVE ITEM SCANNED</span>
                  <span style="font-size: 10px; color: #34d399; background: rgba(16,185,129,0.15); padding: 2px 8px; border-radius: 12px;">Stretch ${(product.stretchFactor*100).toFixed(0)}%</span>
                </div>
                <div style="font-weight: 700; font-size: 13px; line-height: 1.3;">${product.title}</div>
                <div style="font-size: 11px; color: #94a3b8;">
                  🧵 Material: <strong style="color: #cbd5e1;">${product.fabric}</strong> | 
                  💬 Reviews: <strong style="color: ${product.reviewSentiment === 'RUNS_SMALL' ? '#f87171' : '#34d399'};">
                    ${product.reviewSentiment === 'RUNS_SMALL' ? 'Runs Small (Size Up!)' : 'True to Size'}
                  </strong>
                </div>
              </div>

              <!-- CIRCULAR FIT SCORE GAUGE RING -->
              <div style="display: flex; align-items: center; justify-content: space-between; background: linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9)); padding: 14px; border-radius: 12px; border: 1px solid rgba(99, 102, 241, 0.2);">
                <div style="position: relative; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center;">
                  <svg width="80" height="80" viewBox="0 0 36 36">
                    <path stroke="#1e293b" stroke-width="3.8" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <path id="rg-inpage-gauge" stroke="#6366f1" stroke-linecap="round" stroke-width="3.8" stroke-dasharray="88, 100" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  </svg>
                  <span style="position: absolute; font-size: 20px; font-weight: 800; color: #ffffff;" id="rg-inpage-score-text">88%</span>
                </div>
                <div style="flex: 1; margin-left: 14px;">
                  <div style="font-size: 15px; font-weight: 700; color: #34d399;" id="rg-inpage-verdict">Great Fit Match</div>
                  <div style="font-size: 11px; color: #94a3b8; line-height: 1.4;" id="rg-inpage-verdict-desc">Calculated against your selected Size M & fabric elasticity.</div>
                </div>
              </div>

              <!-- RECOMMENDED SIZE CARD -->
              <div class="rg-card" style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(15, 23, 42, 0.8)); border-color: rgba(16, 185, 129, 0.3);">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div style="font-size: 11px; color: #94a3b8; font-weight: 600;">RECOMMENDED PURCHASE SIZE</div>
                    <div style="font-size: 22px; font-weight: 800; color: #34d399;" id="rg-m-rec-size">SIZE M</div>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-size: 11px; color: #94a3b8;">Your Selected Size: <strong style="color: #38bdf8;" id="rg-inpage-your-size">Size M</strong></div>
                    <div style="font-size: 11px; color: #fbbf24;">Return Risk: <strong id="rg-inpage-risk-lbl">LOW</strong></div>
                  </div>
                </div>
              </div>

              <!-- ZONE TENSION PROGRESS BARS -->
              <div class="rg-card">
                <span style="font-size: 12px; font-weight: 700; color: #94a3b8;">ZONE TENSION ANALYSIS</span>

                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <div style="display: flex; justify-content: space-between; font-size: 11px;">
                    <span>Chest Ease</span>
                    <span id="rg-inpage-chest-val" style="color: #34d399;">Perfect (+4cm)</span>
                  </div>
                  <div style="height: 6px; background: #334155; border-radius: 3px; overflow: hidden;">
                    <div id="rg-inpage-chest-bar" style="height: 100%; width: 85%; background: #10b981;"></div>
                  </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <div style="display: flex; justify-content: space-between; font-size: 11px;">
                    <span>Waist Comfort</span>
                    <span id="rg-inpage-waist-val" style="color: #34d399;">Ideal (+2.5cm)</span>
                  </div>
                  <div style="height: 6px; background: #334155; border-radius: 3px; overflow: hidden;">
                    <div id="rg-inpage-waist-bar" style="height: 100%; width: 78%; background: #10b981;"></div>
                  </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <div style="display: flex; justify-content: space-between; font-size: 11px;">
                    <span>Shoulders & Sleeves</span>
                    <span id="rg-inpage-shoulder-val" style="color: #fbbf24;">Snug Fit (+0.5cm)</span>
                  </div>
                  <div style="height: 6px; background: #334155; border-radius: 3px; overflow: hidden;">
                    <div id="rg-inpage-shoulder-bar" style="height: 100%; width: 60%; background: #f59e0b;"></div>
                  </div>
                </div>
              </div>

            </div>

            <!-- MODULE 2: 3D AR STUDIO WITH TOGGLE CAMERA -->
            <div class="rg-tab-panel" id="tab-inpage-ar">
              
              <div class="rg-card" style="display: flex; flex-direction: row; justify-content: space-between; align-items: center;">
                <span style="font-size: 12px; font-weight: 700; color: #38bdf8;">🎥 Live Camera AR Try-On Studio</span>
                <button class="rg-btn-primary" id="rg-ar-camera-btn" style="padding: 6px 12px; font-size: 11px;">Start Camera</button>
              </div>

              <div class="rg-canvas-box" style="position: relative;">
                <video id="rgInPageVideo" autoplay playsinline style="display: none; position: absolute; top:0; left:0; width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1);"></video>
                <canvas id="rgInPageCanvas" width="390" height="250" style="position: relative; z-index: 2;"></canvas>
              </div>

              <div class="rg-card rg-grid-2">
                <div>
                  <label style="font-size: 10px; color: #94a3b8;">Overlay Size:</label>
                  <select class="rg-select" id="rg-ar-size-select">
                    <option value="XS">Size XS</option>
                    <option value="S">Size S</option>
                    <option value="M" selected>Size M</option>
                    <option value="L">Size L</option>
                    <option value="XL">Size XL</option>
                  </select>
                </div>
                <div>
                  <label style="font-size: 10px; color: #94a3b8;">Rotate 360°:</label>
                  <button class="rg-btn-primary" id="rg-m-rotate-btn" style="width: 100%; padding: 7px; font-size: 11px;">🔄 Spin Avatar</button>
                </div>
              </div>

            </div>

            <!-- MODULE 3: MY SIZES -->
            <div class="rg-tab-panel" id="tab-inpage-sizes">
              
              <div class="rg-card" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(15, 23, 42, 0.95));">
                <div style="font-size: 12px; font-weight: 700; color: #c7d2fe;">📐 YOUR BODY MEASUREMENTS (CM)</div>
                
                <div class="rg-grid-2">
                  <div>
                    <label style="font-size: 10px; color: #94a3b8;">Height (cm)</label>
                    <input type="number" class="rg-input" id="rg-in-height" value="175">
                  </div>
                  <div>
                    <label style="font-size: 10px; color: #94a3b8;">Weight (kg)</label>
                    <input type="number" class="rg-input" id="rg-in-weight" value="68">
                  </div>
                </div>

                <div class="rg-grid-2">
                  <div>
                    <label style="font-size: 10px; color: #94a3b8;">Chest (cm)</label>
                    <input type="number" class="rg-input" id="rg-in-chest" value="96">
                  </div>
                  <div>
                    <label style="font-size: 10px; color: #94a3b8;">Waist (cm)</label>
                    <input type="number" class="rg-input" id="rg-in-waist" value="80">
                  </div>
                </div>

                <div class="rg-grid-2">
                  <div>
                    <label style="font-size: 10px; color: #94a3b8;">Hips (cm)</label>
                    <input type="number" class="rg-input" id="rg-in-hips" value="98">
                  </div>
                  <div>
                    <label style="font-size: 10px; color: #94a3b8;">Shoulders (cm)</label>
                    <input type="number" class="rg-input" id="rg-in-shoulders" value="44">
                  </div>
                </div>

                <button class="rg-btn-primary" id="rg-save-sizes-btn" style="margin-top: 6px;">Save Body Sizes</button>
              </div>

            </div>

          </div>

        </div>
      </div>
    `;

    document.body.appendChild(root);
    isWidgetInjected = true;

    const trigger = root.querySelector('#rg-trigger');
    const modal = root.querySelector('#rg-modal');
    const closeBtn = root.querySelector('#rg-modal-close');
    const tabBtns = root.querySelectorAll('.rg-tab-btn');
    const tabPanels = root.querySelectorAll('.rg-tab-panel');
    const chips = root.querySelectorAll('.rg-chip');
    const cameraBtn = root.querySelector('#rg-ar-camera-btn');
    const rotateBtn = root.querySelector('#rg-m-rotate-btn');
    const saveSizesBtn = root.querySelector('#rg-save-sizes-btn');

    trigger.addEventListener('click', () => {
      modal.classList.add('active');
      setTimeout(() => renderInPageVR(), 50);
    });

    closeBtn.addEventListener('click', () => {
      modal.classList.remove('active');
    });

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const panel = root.querySelector('#' + targetTab);
        if (panel) panel.classList.add('active');

        if (targetTab === 'tab-inpage-ar') {
          setTimeout(() => renderInPageVR(), 50);
        }
      });
    });

    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        selectedSize = chip.getAttribute('data-size');
        updateModalFitCalculations();
        renderInPageVR();
      });
    });

    root.querySelector('#rg-brand-select').addEventListener('change', (e) => {
      referenceBrand = e.target.value;
      updateModalFitCalculations();
    });

    rotateBtn.addEventListener('click', () => {
      rotationAngle = (rotationAngle + 45) % 360;
      renderInPageVR();
    });

    // CAMERA TOGGLE ON / OFF
    cameraBtn.addEventListener('click', async () => {
      const video = root.querySelector('#rgInPageVideo');
      if (isCameraActive) {
        if (cameraStream) {
          cameraStream.getTracks().forEach(track => track.stop());
          cameraStream = null;
        }
        if (video) video.srcObject = null;
        isCameraActive = false;
        cameraBtn.innerText = "🎥 Start Live Camera";
        cameraBtn.style.background = "linear-gradient(135deg, #6366f1, #8b5cf6)";
        renderInPageVR();
      } else {
        try {
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = cameraStream;
            video.play();
            isCameraActive = true;
            cameraBtn.innerText = "🔴 Camera Active (Click to Turn Off)";
            cameraBtn.style.background = "#ef4444";
            startInPageARLoop();
          }
        } catch (err) {
          isCameraActive = true;
          cameraBtn.innerText = "🔴 AR Mirror Active (Click to Turn Off)";
          startInPageARLoop();
        }
      }
    });

    saveSizesBtn.addEventListener('click', () => {
      userMeasurements = {
        height: parseFloat(root.querySelector('#rg-in-height').value) || 175,
        weight: parseFloat(root.querySelector('#rg-in-weight').value) || 68,
        chest: parseFloat(root.querySelector('#rg-in-chest').value) || 96,
        waist: parseFloat(root.querySelector('#rg-in-waist').value) || 80,
        hips: parseFloat(root.querySelector('#rg-in-hips').value) || 98,
        shoulders: parseFloat(root.querySelector('#rg-in-shoulders').value) || 44
      };
      alert("✅ Custom measurements saved!");
      updateModalFitCalculations();
      renderInPageVR();
    });
  }

  function startInPageARLoop() {
    function loop() {
      renderInPageVR();
      if (isCameraActive) requestAnimationFrame(loop);
    }
    loop();
  }

  function updateModalFitCalculations() {
    const product = parsedProductCache || { stretchFactor: 0.05, reviewSentiment: "TRUE_TO_SIZE" };
    
    let baseChest = 98;
    let baseWaist = 82;

    if (selectedSize === 'XS') { baseChest = 86; baseWaist = 70; }
    if (selectedSize === 'S') { baseChest = 92; baseWaist = 76; }
    if (selectedSize === 'M') { baseChest = 98; baseWaist = 82; }
    if (selectedSize === 'L') { baseChest = 104; baseWaist = 88; }
    if (selectedSize === 'XL') { baseChest = 112; baseWaist = 96; }
    if (selectedSize === '2XL') { baseChest = 120; baseWaist = 104; }

    if (referenceBrand === 'Zara') { baseChest -= 3; baseWaist -= 3; }
    if (referenceBrand === 'H&M') { baseChest += 3; baseWaist += 3; }
    if (referenceBrand === 'ASOS') { baseChest -= 2; }

    if (product.reviewSentiment === "RUNS_SMALL") {
      baseChest -= 4;
      baseWaist -= 4;
    }

    const stretchAllowanceCm = baseChest * (product.stretchFactor || 0.05);
    const chestDiff = (baseChest + stretchAllowanceCm) - userMeasurements.chest;
    const waistDiff = (baseWaist + stretchAllowanceCm) - userMeasurements.waist;

    let score = 100;
    if (chestDiff < 0) score += chestDiff * 3.5;
    if (waistDiff < 0) score += waistDiff * 3.5;
    if (chestDiff > 14) score -= (chestDiff - 14) * 2;

    score = Math.max(45, Math.min(98, Math.round(score)));

    let recSize = selectedSize;
    if (product.reviewSentiment === "RUNS_SMALL" || score < 72) {
      const order = ['XS', 'S', 'M', 'L', 'XL', '2XL'];
      const idx = order.indexOf(selectedSize);
      if (idx !== -1 && idx < order.length - 1) recSize = order[idx + 1];
    }

    const recEl = document.getElementById('rg-m-rec-size');
    const scoreTextEl = document.getElementById('rg-inpage-score-text');
    const gaugeEl = document.getElementById('rg-inpage-gauge');
    const verdictEl = document.getElementById('rg-inpage-verdict');
    const verdictDescEl = document.getElementById('rg-inpage-verdict-desc');
    const yourSizeEl = document.getElementById('rg-inpage-your-size');
    const riskLblEl = document.getElementById('rg-inpage-risk-lbl');

    if (recEl) recEl.innerText = `SIZE ${recSize}`;
    if (scoreTextEl) scoreTextEl.innerText = `${score}%`;
    if (gaugeEl) {
      const dash = Math.round((score / 100) * 100);
      gaugeEl.setAttribute('stroke-dasharray', `${dash}, 100`);
      gaugeEl.setAttribute('stroke', score >= 84 ? '#10b981' : (score >= 68 ? '#f59e0b' : '#ef4444'));
    }

    if (yourSizeEl) yourSizeEl.innerText = `Size ${selectedSize}`;

    if (verdictEl) {
      if (score >= 84) {
        verdictEl.innerText = "Great Fit Match";
        verdictEl.style.color = "#34d399";
        if (verdictDescEl) verdictDescEl.innerText = `Selected Size ${selectedSize} provides optimal ease with +${(product.stretchFactor*100).toFixed(0)}% stretch.`;
        if (riskLblEl) { riskLblEl.innerText = "LOW"; riskLblEl.style.color = "#34d399"; }
      } else if (score >= 68) {
        verdictEl.innerText = "Slightly Snug Ease";
        verdictEl.style.color = "#fbbf24";
        if (verdictDescEl) verdictDescEl.innerText = `Garment cut is slightly tight around waist. Consider sizing up for comfort.`;
        if (riskLblEl) { riskLblEl.innerText = "MODERATE"; riskLblEl.style.color = "#fbbf24"; }
      } else {
        verdictEl.innerText = "High Return Risk";
        verdictEl.style.color = "#f87171";
        if (verdictDescEl) verdictDescEl.innerText = `Lack of fabric stretch will cause tight constriction. Size up to avoid returning.`;
        if (riskLblEl) { riskLblEl.innerText = "HIGH"; riskLblEl.style.color = "#f87171"; }
      }
    }

    updateInPageMetricBar('rg-inpage-chest-bar', 'rg-inpage-chest-val', chestDiff);
    updateInPageMetricBar('rg-inpage-waist-bar', 'rg-inpage-waist-val', waistDiff);
  }

  function updateInPageMetricBar(barId, labelId, easeCm) {
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

  function renderInPageVR() {
    const canvas = document.getElementById('rgInPageCanvas');
    const video = document.getElementById('rgInPageVideo');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width = 390;
    const h = canvas.height = 250;

    ctx.clearRect(0, 0, w, h);

    // 1. RENDER MIRRORED LIVE CAMERA FEED
    if (isCameraActive && video && video.readyState === 4) {
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
    if (selectedSize === 'XS') sizeScale = 0.82;
    if (selectedSize === 'S') sizeScale = 0.90;
    if (selectedSize === 'M') sizeScale = 1.00;
    if (selectedSize === 'L') sizeScale = 1.12;
    if (selectedSize === 'XL') sizeScale = 1.25;
    if (selectedSize === '2XL') sizeScale = 1.38;

    const sw = 64 * sizeScale; // Shoulder half-width
    const ww = 52 * sizeScale; // Waist half-width
    const topY = h * 0.32;     // Garment collar top
    const botY = h * 0.78;     // Garment hem bottom
    const neckR = 20 * sizeScale; // Neck cutout radius

    ctx.save();
    ctx.translate(w / 2, 0);

    if (rotationAngle) {
      ctx.translate(0, (topY + botY) / 2);
      ctx.rotate((rotationAngle * Math.PI) / 180);
      ctx.translate(0, -(topY + botY) / 2);
    }

    // 3. DRAW MANNEQUIN BODY WHEN CAMERA IS INACTIVE
    if (!isCameraActive) {
      ctx.fillStyle = "rgba(96, 165, 250, 0.9)";
      ctx.beginPath();
      ctx.arc(0, topY - 26, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(59, 130, 246, 0.85)";
      ctx.fillRect(-6, topY - 10, 12, 12);
    }

    // 4. GOOGLE MEET STYLE TORSO SEGMENT MASK PATH
    ctx.beginPath();
    ctx.moveTo(-neckR, topY);
    ctx.quadraticCurveTo(0, topY + neckR * 0.75, neckR, topY); // Neck cutout curve
    ctx.lineTo(sw, topY + 14); // Right shoulder
    ctx.lineTo(sw + 18, topY + 44); // Right sleeve out
    ctx.lineTo(sw - 6, topY + 56);  // Right sleeve under
    ctx.lineTo(ww, botY);           // Right waist side
    ctx.quadraticCurveTo(0, botY + 8, -ww, botY); // Bottom hem curve
    ctx.lineTo(-sw + 6, topY + 56);  // Left waist side
    ctx.lineTo(-sw - 18, topY + 44); // Left sleeve under
    ctx.lineTo(-sw, topY + 14);      // Left shoulder
    ctx.closePath();

    // 5. CLIP & RENDER SCRAEPD CLOTH IMAGE (GOOGLE MEET BACKGROUND BLEND EFFECT)
    ctx.save();
    ctx.clip(); // Mask content strictly within body silhouette!

    if (loadedGarmentImg && loadedGarmentImg.complete) {
      ctx.globalAlpha = isCameraActive ? 0.92 : 1.0;
      ctx.drawImage(loadedGarmentImg, -sw - 20, topY - 10, (sw + 20) * 2, botY - topY + 20);

      // Google Meet Ambient Lighting & Shading Layer over clothing
      if (isCameraActive) {
        let shadeGrad = ctx.createRadialGradient(0, topY + 40, 10, 0, topY + 40, sw * 1.5);
        shadeGrad.addColorStop(0, "rgba(255, 255, 255, 0.15)");
        shadeGrad.addColorStop(0.7, "rgba(0, 0, 0, 0.05)");
        shadeGrad.addColorStop(1, "rgba(0, 0, 0, 0.35)");
        ctx.fillStyle = shadeGrad;
        ctx.fillRect(-sw - 30, topY - 20, (sw + 30) * 2, botY - topY + 40);
      }
    } else {
      // Fallback Heatmap Texture
      let heatmapGrad = ctx.createLinearGradient(0, topY, 0, botY);
      if (selectedSize === 'XS' || selectedSize === 'S') {
        heatmapGrad.addColorStop(0, "rgba(239, 68, 68, 0.85)");
        heatmapGrad.addColorStop(0.5, "rgba(245, 158, 11, 0.75)");
        heatmapGrad.addColorStop(1, "rgba(16, 185, 129, 0.65)");
      } else if (selectedSize === 'M') {
        heatmapGrad.addColorStop(0, "rgba(16, 185, 129, 0.85)");
        heatmapGrad.addColorStop(0.6, "rgba(16, 185, 129, 0.75)");
        heatmapGrad.addColorStop(1, "rgba(56, 189, 248, 0.65)");
      } else {
        heatmapGrad.addColorStop(0, "rgba(56, 189, 248, 0.85)");
        heatmapGrad.addColorStop(1, "rgba(99, 102, 241, 0.65)");
      }
      ctx.fillStyle = heatmapGrad;
      ctx.fillRect(-sw - 30, topY - 20, (sw + 30) * 2, botY - topY + 40);
    }
    ctx.restore(); // End clipping mask

    // 6. GOOGLE MEET GLOWING BODY CONTOUR HIGHLIGHT
    ctx.strokeStyle = isCameraActive ? "rgba(52, 211, 153, 0.85)" : "rgba(129, 140, 248, 0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // 7. HUD STATUS OVERLAY FOR GOOGLE MEET STYLE VIRTUAL FIT
    if (isCameraActive) {
      ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
      ctx.fillRect(-150, 10, 300, 22);
      ctx.strokeStyle = "rgba(52, 211, 153, 0.4)";
      ctx.lineWidth = 1;
      ctx.strokeRect(-150, 10, 300, 22);

      ctx.fillStyle = "#34d399";
      ctx.beginPath();
      ctx.arc(-138, 21, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "600 10px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`Google Meet Virtual Fit • AI Body Lock (${selectedSize})`, -128, 25);
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(parsedProductCache ? parsedProductCache.title.substring(0, 22) : "Scraped Garment", 0, topY + (botY - topY) / 2);
    }

    ctx.restore();
  }

  setTimeout(() => {
    try { injectExactPopupModal(); } catch (e) {}
  }, 800);

})();
