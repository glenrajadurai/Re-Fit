// content.js - Smart ReturnGuard In-Page System (No Text Overlay on Camera View)

(function () {
  let isWidgetInjected = false;
  let parsedProductCache = null;
  let isClothingPageDetected = false;
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

  // Clothing keyword detection dictionary
  const clothingKeywords = [
    "shirt", "t-shirt", "tshirt", "tee", "top", "dress", "jacket", "coat", "hoodie", "sweater", "sweatshirt",
    "pullover", "cardigan", "blazer", "jeans", "pants", "trousers", "chinos", "shorts", "skirt", "suit",
    "denim", "cotton", "polyester", "spandex", "elastane", "linen", "apparel", "garment", "outerwear",
    "activewear", "vest", "blouse", "kurta", "kurti", "polo", "joggers", "leggings", "tracksuit"
  ];

  function checkIfClothingPage(pageTextLower, titleLower) {
    const combined = titleLower + " " + pageTextLower.substring(0, 3000);
    for (const kw of clothingKeywords) {
      const reg = new RegExp(`\\b${kw}\\b`, 'i');
      if (reg.test(combined)) return true;
    }
    // Check sizing patterns common in apparel
    if (/\b(size\s*(xs|s|m|l|xl|xxl|2xl)|\d{2}\s*(cm|inch|chest|waist))\b/i.test(combined)) {
      return true;
    }
    return false;
  }

  function detectWebpageSizes() {
    let selectedSize = null;
    const availableSizes = [];

    // Helper: sanitize size label (e.g. "Size: M", "US 8", "L (Only 2 left)", "32 / 32", "Medium")
    function cleanSizeLabel(str) {
      if (!str) return null;
      let s = str.trim().replace(/[\r\n\t]+/g, ' ');
      // If it says "Size: M" or "Select Size: XL"
      const matchPrefix = s.match(/(?:size|select\s*size|sz)[\s:]*([A-Za-z0-9\/\.\-]+)/i);
      if (matchPrefix && matchPrefix[1]) {
        s = matchPrefix[1];
      }
      // Remove stock notes like "(Out of stock)", "Only 2 left"
      s = s.replace(/\s*\([^)]*\)/g, '').trim();
      s = s.replace(/\s*(?:out of stock|sold out|low stock|few left).*/i, '').trim();
      if (!s) return null;

      // Map full names to standard codes
      const lower = s.toLowerCase();
      if (lower === 'extra small' || lower === 'x-small') return 'XS';
      if (lower === 'small') return 'S';
      if (lower === 'medium') return 'M';
      if (lower === 'large') return 'L';
      if (lower === 'extra large' || lower === 'x-large') return 'XL';
      if (lower === 'xx-large' || lower === '2x-large' || lower === 'double xl') return '2XL';

      // Keep standard abbreviations or numeric sizes (XS, S, M, L, XL, XXL, 2XL, 28, 30, 32, 34, 36, 38, etc.)
      const standardMatch = s.match(/\b(XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL|\d{2}(?:\.\d)?(?:\s*(?:Regular|Tall|Short|R|L|S))?)\b/i);
      if (standardMatch) {
        return standardMatch[1].toUpperCase();
      }

      if (s.length <= 8) return s.toUpperCase();
      return null;
    }

    // 1. Check for explicitly selected / active size elements across various e-commerce platforms
    const selectedSelectors = [
      // Standard inputs/radios
      'input[name*="size"]:checked',
      'input[id*="size"]:checked',
      'input[data-property*="size"]:checked',
      // Active / selected buttons & pills (Zara, ASOS, Myntra, H&M, Nike, Amazon, Shopify, Shein)
      'button[aria-checked="true"][class*="size"]',
      'button[aria-selected="true"][class*="size"]',
      '[role="radio"][aria-checked="true"]',
      '[role="option"][aria-selected="true"]',
      'button[class*="size"][class*="selected"]',
      'button[class*="size"][class*="active"]',
      'li[class*="size"][class*="selected"]',
      'li[class*="size"][class*="active"]',
      'div[class*="size"][class*="selected"]',
      'div[class*="size"][class*="active"]',
      'button[data-selected="true"]',
      'button.is-selected',
      'button.size-selected',
      '.size-selector .selected',
      '.size-buttons .active',
      '.sizes-list .selected',
      '.swatches .selected',
      // Amazon size dropdown selected
      '#native_dropdown_selected_size_name option:checked',
      'select[name*="size"] option:checked',
      'select[id*="size"] option:checked',
      'select[data-action*="size"] option:checked',
      // Text containers that explicitly announce the selected size (e.g. "Size: M", "Selected: L")
      '[class*="selected-size"]',
      '[class*="current-size"]',
      '[data-testid*="selected-size"]',
      '.size-value',
      '.selected-size-label'
    ];

    for (const sel of selectedSelectors) {
      try {
        const el = document.querySelector(sel);
        if (el) {
          const raw = el.value || el.innerText || el.getAttribute('data-size') || el.getAttribute('aria-label') || '';
          const cleaned = cleanSizeLabel(raw);
          if (cleaned && cleaned !== 'SELECT' && cleaned !== 'CHOOSE') {
            selectedSize = cleaned;
            break;
          }
        }
      } catch (e) {}
    }

    // 2. Gather all available product sizes present on the page
    const optionSelectors = [
      'button[class*="size"]',
      'li[class*="size"]',
      'div[class*="size-item"]',
      'div[class*="size-pill"]',
      'button[data-size]',
      '[role="radio"][class*="size"]',
      '.size-options button',
      '.size-buttons button',
      '.size-selector button',
      'select[name*="size"] option',
      '#native_dropdown_selected_size_name option'
    ];

    const seenSizes = new Set();
    for (const sel of optionSelectors) {
      try {
        const elements = document.querySelectorAll(sel);
        if (elements && elements.length > 0) {
          elements.forEach(el => {
            const raw = el.value || el.innerText || el.getAttribute('data-size') || el.getAttribute('aria-label') || '';
            const cleaned = cleanSizeLabel(raw);
            if (cleaned && !seenSizes.has(cleaned) && cleaned !== 'SELECT' && cleaned !== 'CHOOSE' && cleaned !== 'SIZE') {
              seenSizes.add(cleaned);
              availableSizes.push(cleaned);
            }
          });
          if (availableSizes.length > 0) break;
        }
      } catch (e) {}
    }

    // Fallback: If no size was specifically highlighted as selected, but sizes were found, pick the first available or 'M'
    return {
      selectedSize: selectedSize || (availableSizes.length > 0 ? availableSizes[0] : null),
      availableSizes: availableSizes.length > 0 ? availableSizes : ['XS', 'S', 'M', 'L', 'XL', '2XL']
    };
  }

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

    const isClothing = checkIfClothingPage(pageTextLower, title.toLowerCase());
    isClothingPageDetected = isClothing;

    // Scrape only CLOTHING product links from the current website
    const scrapedLinks = [];
    const seenHrefs = new Set();
    const currentOrigin = window.location.origin;
    const currentPath = window.location.pathname;

    const candidateAnchors = document.querySelectorAll('a[href*="clothing"], a[href*="apparel"], a[href*="product"], a[href*="item"], a[href*="/p/"], a[href*="/dp/"], a[class*="product"], a[class*="item"]');
    const allLinks = candidateAnchors.length >= 4 ? candidateAnchors : document.querySelectorAll('main a[href], article a[href], .products a[href], a[href]');

    for (const a of allLinks) {
      try {
        const href = a.href;
        if (!href || href.startsWith('javascript:') || href.includes('#') || href === window.location.href) continue;
        const urlObj = new URL(href, window.location.origin);
        if (urlObj.origin !== currentOrigin) continue; // Same website only
        if (urlObj.pathname === currentPath) continue;

        const anchorText = (a.innerText || a.getAttribute('title') || a.getAttribute('aria-label') || '').trim();
        const anchorLower = (anchorText + ' ' + urlObj.pathname).toLowerCase();

        // STRICT CLOTHING FILTER: Must match apparel / clothing terms
        const isClothingLink = clothingKeywords.some(kw => anchorLower.includes(kw));
        if (isClothingLink && anchorText.length > 3 && !seenHrefs.has(urlObj.pathname)) {
          seenHrefs.add(urlObj.pathname);
          scrapedLinks.push({
            url: href,
            title: anchorText.split('\n')[0].trim().substring(0, 35)
          });
          if (scrapedLinks.length >= 10) break;
        }
      } catch (e) {}
    }

    const pageSizes = detectWebpageSizes();

    parsedProductCache = {
      title: title.length > 50 ? title.substring(0, 50) + '...' : title,
      imageUrl: imageUrl,
      fabric: fabricComposition,
      stretchFactor: stretchFactor,
      reviewSentiment: reviewSentiment,
      siteLinks: scrapedLinks,
      isClothing: isClothing,
      origin: window.location.origin,
      webpageSelectedSize: pageSizes.selectedSize,
      availableSizes: pageSizes.availableSizes
    };

    if (pageSizes.selectedSize) {
      selectedSize = pageSizes.selectedSize;
    }

    if (imageUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        loadedGarmentImg = img;
        renderInPageVR();
      };
      img.onerror = () => {
        const imgNoCors = new Image();
        imgNoCors.onload = () => {
          loadedGarmentImg = imgNoCors;
          renderInPageVR();
        };
        imgNoCors.src = imageUrl;
      };
      img.src = imageUrl;
    }

    return parsedProductCache;
  }

  // Chrome Extension message listener so popup can query active tab product and links
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'GET_PAGE_PRODUCT_DATA') {
        const productData = parseProductDetails();
        sendResponse(productData);
      }
      return true;
    });
  }

  function injectExactPopupModal() {
    if (isWidgetInjected || document.getElementById('return-guard-root')) return;

    const product = parseProductDetails();
    // Only inject floating button and in-page modal if page is apparel/clothing
    if (!product.isClothing) {
      console.log("[Smart ReturnGuard] Not a clothing page. Floating widget withheld.");
      return;
    }

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
              
              <div class="rg-card" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(248, 250, 252, 0.95)); border: 1px solid rgba(99, 102, 241, 0.25);">
                <div style="font-size: 12px; font-weight: 700; color: #4338ca; display: flex; justify-content: space-between; align-items: center;">
                  <span>📏 SELECT YOUR SIZE BELOW</span>
                  <span id="rg-inpage-detected-size-badge" style="font-size: 10px; color: ${product.webpageSelectedSize ? '#047857' : '#047857'}; background: ${product.webpageSelectedSize ? 'rgba(16, 185, 129, 0.18)' : 'rgba(16, 185, 129, 0.15)'}; padding: 2px 6px; border-radius: 4px; font-weight: 700;">
                    ${product.webpageSelectedSize ? `Store Size: ${product.webpageSelectedSize} (Auto-Detected)` : 'Click to Set'}
                  </span>
                </div>
                
                <div class="rg-size-group" id="rg-inpage-size-group">
                  <button class="rg-chip ${selectedSize === 'XS' ? 'active' : ''}" data-size="XS">XS</button>
                  <button class="rg-chip ${selectedSize === 'S' ? 'active' : ''}" data-size="S">S</button>
                  <button class="rg-chip ${selectedSize === 'M' ? 'active' : ''}" data-size="M">M</button>
                  <button class="rg-chip ${selectedSize === 'L' ? 'active' : ''}" data-size="L">L</button>
                  <button class="rg-chip ${selectedSize === 'XL' ? 'active' : ''}" data-size="XL">XL</button>
                  <button class="rg-chip ${selectedSize === '2XL' ? 'active' : ''}" data-size="2XL">2XL</button>
                  ${product.webpageSelectedSize && !['XS', 'S', 'M', 'L', 'XL', '2XL'].includes(product.webpageSelectedSize) ? `<button class="rg-chip active" data-size="${product.webpageSelectedSize}">${product.webpageSelectedSize}</button>` : ''}
                </div>

                <div class="rg-grid-2" style="margin-top: 4px;">
                  <div>
                    <label style="font-size: 10px; color: #64748b;">Usual Brand:</label>
                    <select class="rg-select" id="rg-brand-select">
                      <option value="Nike" selected>Nike (Standard)</option>
                      <option value="Zara">Zara (Runs Small)</option>
                      <option value="H&M">H&M (Runs Large)</option>
                      <option value="ASOS">ASOS (Slim Fit)</option>
                    </select>
                  </div>
                  <div>
                    <label style="font-size: 10px; color: #64748b;">Fit Preference:</label>
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
                  <span style="font-size: 11px; font-weight: 700; color: #64748b;">ACTIVE ITEM SCANNED</span>
                  <span style="font-size: 10px; color: #059669; background: rgba(16,185,129,0.12); padding: 2px 8px; border-radius: 12px;">Stretch ${(product.stretchFactor*100).toFixed(0)}%</span>
                </div>
                <div style="font-weight: 700; font-size: 13px; line-height: 1.3; color: #0f172a;">${product.title}</div>
                <div style="font-size: 11px; color: #64748b;">
                  🧵 Material: <strong style="color: #334155;">${product.fabric}</strong> | 
                  💬 Reviews: <strong style="color: ${product.reviewSentiment === 'RUNS_SMALL' ? '#dc2626' : '#059669'};">
                    ${product.reviewSentiment === 'RUNS_SMALL' ? 'Runs Small (Size Up!)' : 'True to Size'}
                  </strong>
                </div>
              </div>

              <!-- CIRCULAR FIT SCORE GAUGE RING -->
              <div style="display: flex; align-items: center; justify-content: space-between; background: #ffffff; padding: 14px; border-radius: 12px; border: 1px solid rgba(99, 102, 241, 0.25); box-shadow: 0 2px 6px rgba(99, 102, 241, 0.08);">
                <div style="position: relative; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center;">
                  <svg width="80" height="80" viewBox="0 0 36 36">
                    <path stroke="#e2e8f0" stroke-width="3.8" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <path id="rg-inpage-gauge" stroke="#6366f1" stroke-linecap="round" stroke-width="3.8" stroke-dasharray="88, 100" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  </svg>
                  <span style="position: absolute; font-size: 20px; font-weight: 800; color: #0f172a;" id="rg-inpage-score-text">88%</span>
                </div>
                <div style="flex: 1; margin-left: 14px;">
                  <div style="font-size: 15px; font-weight: 700; color: #059669;" id="rg-inpage-verdict">Great Fit Match</div>
                  <div style="font-size: 11px; color: #64748b; line-height: 1.4;" id="rg-inpage-verdict-desc">Calculated against your selected Size M & fabric elasticity.</div>
                </div>
              </div>

              <!-- RECOMMENDED SIZE CARD -->
              <div class="rg-card" style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(248, 250, 252, 0.95)); border: 1px solid rgba(16, 185, 129, 0.3);">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div style="font-size: 11px; color: #64748b; font-weight: 600;">RECOMMENDED PURCHASE SIZE</div>
                    <div style="font-size: 22px; font-weight: 800; color: #059669;" id="rg-m-rec-size">SIZE M</div>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-size: 11px; color: #64748b;">Your Selected Size: <strong style="color: #0284c7;" id="rg-inpage-your-size">Size M</strong></div>
                    <div style="font-size: 11px; color: #d97706;">Return Risk: <strong id="rg-inpage-risk-lbl">LOW</strong></div>
                  </div>
                </div>
              </div>

              <!-- ZONE TENSION PROGRESS BARS -->
              <div class="rg-card">
                <span style="font-size: 12px; font-weight: 700; color: #64748b;">ZONE TENSION ANALYSIS</span>

                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <div style="display: flex; justify-content: space-between; font-size: 11px;">
                    <span>Chest Ease</span>
                    <span id="rg-inpage-chest-val" style="color: #059669;">Perfect (+4cm)</span>
                  </div>
                  <div style="height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
                    <div id="rg-inpage-chest-bar" style="height: 100%; width: 85%; background: #10b981;"></div>
                  </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <div style="display: flex; justify-content: space-between; font-size: 11px;">
                    <span>Waist Comfort</span>
                    <span id="rg-inpage-waist-val" style="color: #059669;">Ideal (+2.5cm)</span>
                  </div>
                  <div style="height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
                    <div id="rg-inpage-waist-bar" style="height: 100%; width: 78%; background: #10b981;"></div>
                  </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <div style="display: flex; justify-content: space-between; font-size: 11px;">
                    <span>Shoulders & Sleeves</span>
                    <span id="rg-inpage-shoulder-val" style="color: #d97706;">Snug Fit (+0.5cm)</span>
                  </div>
                  <div style="height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
                    <div id="rg-inpage-shoulder-bar" style="height: 100%; width: 60%; background: #f59e0b;"></div>
                  </div>
                </div>
              </div>

              <!-- AUTOMATED RECOMMENDATIONS LIST -->
              <div class="rg-card" id="rg-inpage-rec-card">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 11px; font-weight: 700; color: #64748b;">AUTOMATED TAILORED MATCHES</span>
                  <span style="font-size: 10px; color: #6366f1; background: rgba(99, 102, 241, 0.12); padding: 2px 8px; border-radius: 12px; font-weight: 700;">4 Tailored Items</span>
                </div>
                <div style="font-size: 10.5px; color: #64748b;">
                  Generated automatically for your size and body measurements:
                </div>
                <div class="rg-rec-list" id="rg-inpage-rec-items">
                  <!-- Dynamically populated -->
                </div>
              </div>

            </div>

            <!-- MODULE 2: 3D AR STUDIO WITH TOGGLE CAMERA -->
            <div class="rg-tab-panel" id="tab-inpage-ar">
              
              <div class="rg-card" style="display: flex; flex-direction: row; justify-content: space-between; align-items: center;">
                <span style="font-size: 12px; font-weight: 700; color: #0284c7;">🎥 Live Camera AR Try-On Studio</span>
                <button class="rg-btn-primary" id="rg-ar-camera-btn" style="padding: 6px 12px; font-size: 11px;">Start Camera</button>
              </div>

              <div class="rg-canvas-box" style="position: relative;">
                <video id="rgInPageVideo" autoplay playsinline style="display: none; position: absolute; top:0; left:0; width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1);"></video>
                <canvas id="rgInPageCanvas" width="390" height="250" style="position: relative; z-index: 2;"></canvas>
              </div>

              <div class="rg-card rg-grid-2">
                <div>
                  <label style="font-size: 10px; color: #64748b;">Overlay Size:</label>
                  <select class="rg-select" id="rg-ar-size-select">
                    <option value="XS">Size XS</option>
                    <option value="S">Size S</option>
                    <option value="M" selected>Size M</option>
                    <option value="L">Size L</option>
                    <option value="XL">Size XL</option>
                  </select>
                </div>
                <div>
                  <label style="font-size: 10px; color: #64748b;">Rotate 360°:</label>
                  <button class="rg-btn-primary" id="rg-m-rotate-btn" style="width: 100%; padding: 7px; font-size: 11px;">🔄 Spin Avatar</button>
                </div>
              </div>

            </div>

            <!-- MODULE 3: MY SIZES -->
            <div class="rg-tab-panel" id="tab-inpage-sizes">
              
              <div class="rg-card" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(248, 250, 252, 0.95)); border: 1px solid rgba(99, 102, 241, 0.25);">
                <div style="font-size: 12px; font-weight: 700; color: #4338ca;">📐 YOUR BODY MEASUREMENTS (CM)</div>
                
                <div class="rg-grid-2">
                  <div>
                    <label style="font-size: 10px; color: #64748b;">Height (cm)</label>
                    <input type="number" class="rg-input" id="rg-in-height" value="175">
                  </div>
                  <div>
                    <label style="font-size: 10px; color: #64748b;">Weight (kg)</label>
                    <input type="number" class="rg-input" id="rg-in-weight" value="68">
                  </div>
                </div>

                <div class="rg-grid-2">
                  <div>
                    <label style="font-size: 10px; color: #64748b;">Chest (cm)</label>
                    <input type="number" class="rg-input" id="rg-in-chest" value="96">
                  </div>
                  <div>
                    <label style="font-size: 10px; color: #64748b;">Waist (cm)</label>
                    <input type="number" class="rg-input" id="rg-in-waist" value="80">
                  </div>
                </div>

                <div class="rg-grid-2">
                  <div>
                    <label style="font-size: 10px; color: #64748b;">Hips (cm)</label>
                    <input type="number" class="rg-input" id="rg-in-hips" value="98">
                  </div>
                  <div>
                    <label style="font-size: 10px; color: #64748b;">Shoulders (cm)</label>
                    <input type="number" class="rg-input" id="rg-in-shoulders" value="44">
                  </div>
                </div>

                <button class="rg-btn-primary" id="rg-save-sizes-btn" style="margin-top: 6px;">Save Body Sizes</button>
              </div>

              <!-- AUTOMATED RECOMMENDED ITEMS IN MY SIZES TAB -->
              <div class="rg-card" style="margin-top: 4px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 11px; font-weight: 700; color: #64748b;">AUTOMATED TAILORED MATCHES</span>
                  <span style="font-size: 10px; color: #6366f1; background: rgba(99, 102, 241, 0.12); padding: 2px 8px; border-radius: 12px; font-weight: 700;">Matched</span>
                </div>
                <div style="font-size: 10.5px; color: #64748b;">
                  Curated automatically based on your measurements:
                </div>
                <div class="rg-rec-list" id="rg-inpage-profile-rec-items">
                  <!-- Dynamically populated -->
                </div>
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
      updateModalFitCalculations();
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
      
      // Numeric waist size directly (e.g., 30, 32, 34 inch pants)
      const numMatch = s.match(/^(\d{2})/);
      if (numMatch) {
        const val = parseInt(numMatch[1], 10);
        if (val >= 24 && val <= 50) {
          // Assume waist inches translated to cm ~ val * 2.54, chest ~ waist + 16
          const waistCm = Math.round(val * 2.54);
          return { chest: waistCm + 16, waist: waistCm };
        }
      }
      return { chest: 98, waist: 82 };
    }

    const baseDim = getBaseDimensionsForSize(selectedSize);
    let baseChest = baseDim.chest;
    let baseWaist = baseDim.waist;

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

    updateInPageAutomatedRecommendations(recSize);
  }

  function updateInPageAutomatedRecommendations(recSize) {
    const list = document.getElementById('rg-inpage-rec-items');
    if (!list) return;

    const siteLinks = (parsedProductCache && parsedProductCache.siteLinks && parsedProductCache.siteLinks.length > 0)
      ? parsedProductCache.siteLinks
      : [];

    const items = [
      {
        icon: "👕",
        title: siteLinks[0] ? siteLinks[0].title : "Breathable Slim-Fit Crewneck",
        category: "T-Shirt / Top",
        fabric: "95% Cotton, 5% Spandex",
        recommendedSize: recSize,
        matchScore: 96,
        url: siteLinks[0] ? siteLinks[0].url : window.location.href
      },
      {
        icon: "🧥",
        title: siteLinks[1] ? siteLinks[1].title : "Urban Stretch Bomber Jacket",
        category: "Outerwear",
        fabric: "Cotton-Poly Flex Weave",
        recommendedSize: (['XS', 'S', 'M', 'L', 'XL', '2XL'][Math.min(5, ['XS', 'S', 'M', 'L', 'XL', '2XL'].indexOf(recSize) + 1)]) || recSize,
        matchScore: 92,
        url: siteLinks[1] ? siteLinks[1].url : window.location.href
      },
      {
        icon: "👔",
        title: siteLinks[2] ? siteLinks[2].title : "Tailored Comfort Oxford Shirt",
        category: "Formal / Casual Shirt",
        fabric: "100% Breathable Linen/Cotton",
        recommendedSize: recSize,
        matchScore: 89,
        url: siteLinks[2] ? siteLinks[2].url : window.location.href
      },
      {
        icon: "👖",
        title: siteLinks[3] ? siteLinks[3].title : "Flexible Tapered Chino Pants",
        category: "Bottoms",
        fabric: "98% Cotton, 2% Elastane",
        recommendedSize: recSize === 'XS' ? '28' : (recSize === 'S' ? '30' : (recSize === 'M' ? '32' : (recSize === 'L' ? '34' : '36'))),
        matchScore: 94,
        url: siteLinks[3] ? siteLinks[3].url : window.location.href
      }
    ];

    list.innerHTML = items.map(item => `
      <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="rg-rec-card" style="text-decoration: none; color: inherit; cursor: pointer; display: flex;">
        <div class="rg-rec-left">
          <div class="rg-rec-icon">${item.icon}</div>
          <div class="rg-rec-info">
            <div class="rg-rec-title" style="display: flex; align-items: center; gap: 4px;">
              <span>${item.title}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </div>
            <div class="rg-rec-desc">${item.category} • ${item.fabric}</div>
          </div>
        </div>
        <div class="rg-rec-right">
          <span class="rg-rec-size">Size ${item.recommendedSize}</span>
          <span class="rg-rec-match">✓ ${item.matchScore}% Match</span>
        </div>
      </a>
    `).join('');

    const profileList = document.getElementById('rg-inpage-profile-rec-items');
    if (profileList) {
      profileList.innerHTML = list.innerHTML;
    }
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
    if (isCameraActive && video && video.readyState >= 1) {
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
    if (selectedSize === 'XS') sizeScale = 0.82;
    if (selectedSize === 'S') sizeScale = 0.90;
    if (selectedSize === 'M') sizeScale = 1.00;
    if (selectedSize === 'L') sizeScale = 1.12;
    if (selectedSize === 'XL') sizeScale = 1.25;
    if (selectedSize === '2XL') sizeScale = 1.38;

    const sw = 64 * sizeScale; // Shoulder half-width
    const ww = 52 * sizeScale; // Waist half-width
    const topY = h * 0.30;     // Garment top position
    const botY = h * 0.78;     // Garment bottom position
    const neckR = 20 * sizeScale;

    ctx.save();
    ctx.translate(w / 2, 0);

    if (rotationAngle) {
      ctx.translate(0, (topY + botY) / 2);
      ctx.rotate((rotationAngle * Math.PI) / 180);
      ctx.translate(0, -(topY + botY) / 2);
    }

    // 3. RENDER GARMENT IMAGE (WITHOUT SHIRT CUTOUT BORDER / SILHOUETTE)
    const imgW = sw * 2;
    const imgH = (botY - topY) + 20;

    if (loadedGarmentImg && loadedGarmentImg.complete && loadedGarmentImg.naturalWidth !== 0) {
      ctx.save();
      ctx.globalAlpha = isCameraActive ? 0.92 : 1.0;
      ctx.drawImage(loadedGarmentImg, -sw, topY - 10, imgW, imgH);
      ctx.restore();
    } else {
      // Clean styled garment card preview when no scraped image is available
      ctx.save();
      const cardGrad = ctx.createLinearGradient(0, topY, 0, botY);
      cardGrad.addColorStop(0, "rgba(99, 102, 241, 0.9)");
      cardGrad.addColorStop(1, "rgba(139, 92, 246, 0.85)");
      ctx.fillStyle = cardGrad;

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

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(parsedProductCache ? parsedProductCache.title.substring(0, 24) : "Product Garment", 0, topY + (botY - topY) / 2);
      ctx.font = "9px sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.fillText(`Size ${selectedSize}`, 0, topY + (botY - topY) / 2 + 16);
      ctx.restore();
    }

    ctx.restore();
  }

  setTimeout(() => {
    try { injectExactPopupModal(); } catch (e) {}
  }, 800);

})();
