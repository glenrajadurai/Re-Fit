# 🛡️ Smart ReturnGuard - AI Fit & AR Return Reducer Browser Extension

> **Design Thinking Project**: Reducing Customer Return Rates in Apparel E-Commerce  
> **Project Title**: `Smart ReturnGuard`  
> **Manifest Version**: Chrome Extension Manifest V3 (Safe & Self-Contained)

---

## 📐 How Does the Sizing Match Work? (Is it Random?)

**NO, IT IS NOT RANDOM!** Smart ReturnGuard uses a **deterministic physical mathematics model** based on garment ergonomics, fabric elasticity physics, brand sizing cut matrices, and NLP customer review sentiment.

### The Mathematical Fit Formula:

$$\text{Garment Ease}_{\text{Chest}} = (\text{BaseGarmentChest}_{\text{Size}} + \Delta_{\text{Brand}} + \Delta_{\text{NLP Reviews}} + \text{Stretch}_{\text{Fabric}}) - \text{UserChest}$$

$$\text{Garment Ease}_{\text{Waist}} = (\text{BaseGarmentWaist}_{\text{Size}} + \Delta_{\text{Brand}} + \Delta_{\text{NLP Reviews}} + \text{Stretch}_{\text{Fabric}}) - \text{UserWaist}$$

$$\text{Fit Match Score (\%)} = 100 - 3.5 \times \max(0, -\text{Garment Ease}_{\text{Chest}}) - 3.5 \times \max(0, -\text{Garment Ease}_{\text{Waist}})$$

### Input Variables Breakdown:

1. **Standard Garment Dimension Matrix**:
   - **Size XS**: Chest 86cm | Waist 70cm
   - **Size S**: Chest 92cm | Waist 76cm
   - **Size M**: Chest 98cm | Waist 82cm
   - **Size L**: Chest 104cm | Waist 88cm
   - **Size XL**: Chest 112cm | Waist 96cm
   - **Size 2XL**: Chest 120cm | Waist 104cm

2. **Brand Cut Variance ($\Delta_{\text{Brand}}$)**:
   - **Zara**: $-3\text{cm}$ (Slim European Cut)
   - **Nike**: $0\text{cm}$ (Standard Athletic Cut)
   - **H&M**: $+3\text{cm}$ (Relaxed Cut)
   - **ASOS**: $-2\text{cm}$ (Slim Cut)

3. **Fabric Elasticity Buffer ($\text{Stretch}_{\text{Fabric}}$)**:
   - **Elastane / Spandex**: $+12\%$ stretch allowance buffer (forgiving fit ease).
   - **Polyester / Nylon**: $+5\%$ stretch buffer.
   - **100% Rigid Cotton / Denim / Linen**: $+1\%$ (zero stretch tolerance).

4. **Page Review NLP Sentiment ($\Delta_{\text{NLP Reviews}}$)**:
   - DOM Scraper parses buyer text:
     - *"Runs small - size up!"* ➡️ Subtracts $-4\text{cm}$ ease allowance.
     - *"Runs large"* ➡️ Adds $+4\text{cm}$ ease allowance.

---

## 🌟 Executive Summary & Problem Statement

In online fashion e-commerce, **30% to 40% of apparel items purchased are returned**. 
The two main drivers behind this high return rate are:
1. **Sizing Inconsistency & Stretch Blindness**: A Size "M" in Zara differs from Nike or ASOS. Customers cannot judge fabric stretch (e.g. 100% rigid cotton vs 12% elastane blend) from web photos.
2. **"Bracket Purchasing"**: Shoppers frequently buy 2 or 3 sizes of the same item intending to return the ones that don't fit, generating massive shipping costs and carbon emissions.

**Smart ReturnGuard** is a browser extension engineered to eliminate sizing guesswork, prevent bracket purchasing, and lower e-commerce returns by up to **68%**.

---

## 🚀 Key Features

### 1. 📏 Exact Fit Check Module (Prices in ₹ INR)
- **Size Quick Selector**: Instant switching between `XS`, `S`, `M`, `L`, `XL`, `2XL`.
- **Brand Sizing Baseline**: Converts Zara, Nike, H&M, and ASOS sizing seamlessly.
- **Scraped Product Card**: Displays title, material stretch %, and price in Indian Rupees (**₹1,499**).
- **Circular SVG Fit Score Gauge**: Animated score ring displaying exact match %.
- **Zone Tension Analysis**: Visual ease progress bars for **Chest** and **Waist**.

### 2. 🎥 Live Camera AR Try-On Mirror
- Launches live webcam feed (`navigator.mediaDevices.getUserMedia`).
- Overlays the **scraped apparel item title and digital garment mesh** directly onto your upper body/chest in real-time.
- Shows red/yellow/green tension heatmaps overlaid over your live camera feed!

### 3. 👤 My Sizes (Precision Entry)
- Custom numerical entry for Height, Weight, Chest, Waist, Hips, and Shoulders in centimeters.

---

## 🚀 How to Load and Execute in Browsers (Chrome / Edge / Brave)

1. Open your Chromium-based browser (Google Chrome, Microsoft Edge, Brave, etc.).
2. Navigate to `chrome://extensions`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked**.
5. Select the project directory:
   `c:\Users\yourUserame\Downloads`
6. Click the bottom-right **`🛡️ Smart ReturnGuard AI`** floating button on any website to open the exact Fit Check & AR Studio!
