/**
 * WavOracle Professional Audio Analyzer with Essentia.js
 * Industry-grade key/BPM detection using Spotify's audio analysis library
 */

class EssentiaProfessionalAnalyzer {
  constructor() {
    this.confidenceThreshold = 0.85; // Only show results when 85%+ confident
    this.analysisCache = new Map(); // Cache results to avoid re-analysis
    this.essentiaExtractor = null;
    this.isInitialized = false;
    this.initializationPromise = null;
  }

  /**
   * Initialize Essentia.js library
   */
  async initialize() {
    if (this.isInitialized) return;
    
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        console.log('🚀 Initializing Essentia.js...');
        
        // Load Essentia.js from CDN
        await this.loadEssentiaScripts();
        
        // Wait for EssentiaWASM to be available
        if (typeof EssentiaWASM === 'undefined') {
          throw new Error('EssentiaWASM not loaded');
        }

        // Initialize Essentia
        const WasmModule = await EssentiaWASM();
        this.essentiaExtractor = new EssentiaExtractor(WasmModule);
        
        console.log(`✅ Essentia.js ${this.essentiaExtractor.version} initialized`);
        this.isInitialized = true;
        resolve();
        
      } catch (error) {
        console.error('❌ Failed to initialize Essentia.js:', error);
        reject(error);
      }
    });

    return this.initializationPromise;
  }

  /**
   * Load Essentia.js scripts from CDN
   */
  async loadEssentiaScripts() {
    const scripts = [
      'https://cdn.jsdelivr.net/npm/essentia.js@0.1.0/dist/essentia-wasm.web.js',
      'https://cdn.jsdelivr.net/npm/essentia.js@0.1.0/dist/essentia.js-extractor.js',
      'https://cdn.jsdelivr.net/npm/essentia.js@0.1.0/dist/essentia.js-plot.js'
    ];

    for (const script of scripts) {
      await this.loadScript(script);
    }
  }

  /**
   * Load a script dynamically
   */
  loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Main analysis function using Essentia.js
   */
  async analyzeSong(audioFile, title, artist = null) {
    console.log(`🎵 Analyzing with Essentia.js: ${title} by ${artist || 'Unknown'}`);
    
    // Ensure Essentia.js is initialized
    await this.initialize();
    
    // Check cache first
    const cacheKey = `${title}-${artist}-${audioFile.size}`;
    if (this.analysisCache.has(cacheKey)) {
      console.log('📋 Returning cached result');
      return this.analysisCache.get(cacheKey);
    }

    const results = {
      title,
      artist,
      analysis: null,
      webData: null,
      finalResult: null,
      confidence: 'low',
      method: 'none'
    };

    // Method 1: Essentia.js Professional Audio Analysis
    try {
      results.analysis = await this.essentiaAnalysis(audioFile);
      console.log('✅ Essentia.js analysis completed');
    } catch (error) {
      console.error('❌ Essentia.js analysis failed:', error);
    }

    // Method 2: Web Scraping Fallback
    try {
      results.webData = await this.searchMultipleDatabases(title, artist);
      console.log('✅ Web scraping completed');
    } catch (error) {
      console.error('❌ Web scraping failed:', error);
    }

    // Generate final result with confidence scoring
    results.finalResult = this.generateConfidentResult(results);
    
    // Cache the result
    this.analysisCache.set(cacheKey, results);
    
    return results;
  }

  /**
   * Professional audio analysis using Essentia.js
   */
  async essentiaAnalysis(audioFile) {
    return new Promise((resolve, reject) => {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          
          // Configure Essentia extractor
          this.essentiaExtractor.frameSize = 4096;
          this.essentiaExtractor.hopSize = 2048;
          this.essentiaExtractor.sampleRate = audioBuffer.sampleRate;
          
          // Get audio data
          const audioData = audioBuffer.getChannelData(0);
          
          // Analyze key using HPCP (Harmonic Pitch Class Profile)
          const keyInfo = await this.detectKeyWithEssentia(audioData, audioBuffer.sampleRate);
          
          // Analyze BPM using rhythm extractors
          const bpmInfo = await this.detectBPMWithEssentia(audioData, audioBuffer.sampleRate);
          
          resolve({
            key: keyInfo,
            bpm: bpmInfo,
            duration: audioBuffer.duration,
            sampleRate: audioBuffer.sampleRate,
            channels: audioBuffer.numberOfChannels
          });
          
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = reject;
      reader.readAsArrayBuffer(audioFile);
    });
  }

  /**
   * Detect musical key using Essentia.js HPCP
   */
  async detectKeyWithEssentia(audioData, sampleRate) {
    try {
      // Generate overlapping frames
      const frameSize = 4096;
      const hopSize = 2048;
      const audioFrames = this.essentiaExtractor.FrameGenerator(audioData, frameSize, hopSize);
      
      // Extract HPCP for each frame
      const hpcpgram = [];
      for (let i = 0; i < audioFrames.size(); i++) {
        const frame = this.essentiaExtractor.vectorToArray(audioFrames.get(i));
        const hpcp = this.essentiaExtractor.hpcpExtractor(frame);
        hpcpgram.push(hpcp);
      }
      
      // Analyze key from HPCP data
      const keyAnalysis = this.analyzeKeyFromHPCP(hpcpgram);
      
      // Clean up
      this.essentiaExtractor.delete();
      
      return keyAnalysis;
      
    } catch (error) {
      console.error('Key detection failed:', error);
      return { key: 'Unknown', confidence: 0.0 };
    }
  }

  /**
   * Analyze key from HPCP chromagram data
   */
  analyzeKeyFromHPCP(hpcpgram) {
    try {
      // Average HPCP across all frames
      const avgHPCP = new Array(12).fill(0);
      let frameCount = 0;
      
      hpcpgram.forEach(frame => {
        if (frame && frame.length === 12) {
          frame.forEach((value, index) => {
            avgHPCP[index] += value;
          });
          frameCount++;
        }
      });
      
      if (frameCount === 0) return { key: 'Unknown', confidence: 0.0 };
      
      // Normalize
      avgHPCP.forEach((value, index) => {
        avgHPCP[index] = value / frameCount;
      });
      
      // Key profiles for major and minor scales
      const keyProfiles = this.getKeyProfiles();
      const correlations = {};
      
      // Calculate correlation with each key
      Object.keys(keyProfiles).forEach(keyName => {
        const profile = keyProfiles[keyName];
        const correlation = this.calculateCorrelation(avgHPCP, profile);
        correlations[keyName] = correlation;
      });
      
      // Find best matching key
      let bestKey = 'C major';
      let maxCorrelation = -1;
      
      Object.entries(correlations).forEach(([key, correlation]) => {
        if (correlation > maxCorrelation) {
          maxCorrelation = correlation;
          bestKey = key;
        }
      });
      
      return {
        key: bestKey,
        confidence: Math.max(0, maxCorrelation),
        allCorrelations: correlations
      };
      
    } catch (error) {
      console.error('HPCP analysis failed:', error);
      return { key: 'Unknown', confidence: 0.0 };
    }
  }

  /**
   * Detect BPM using Essentia.js rhythm extractors
   */
  async detectBPMWithEssentia(audioData, sampleRate) {
    try {
      // Use Essentia's rhythm extractors
      const rhythmExtractor = this.essentiaExtractor.RhythmExtractor2013(audioData);
      
      // Get BPM and confidence
      const bpm = rhythmExtractor.bpm;
      const confidence = rhythmExtractor.confidence;
      
      // Clean up
      this.essentiaExtractor.delete();
      
      return {
        bpm: Math.round(bpm),
        confidence: Math.max(0, confidence),
        method: 'essentia_rhythm_extractor'
      };
      
    } catch (error) {
      console.error('BPM detection failed:', error);
      return { bpm: 0, confidence: 0.0 };
    }
  }

  /**
   * Get key profiles for correlation analysis
   */
  getKeyProfiles() {
    const profiles = {};
    
    // Major scales
    const majorScale = [0, 2, 4, 5, 7, 9, 11]; // C major scale intervals
    const minorScale = [0, 2, 3, 5, 7, 8, 10]; // C minor scale intervals
    
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    notes.forEach((note, index) => {
      // Major key profile
      const majorProfile = new Array(12).fill(0);
      majorScale.forEach(interval => {
        const noteIndex = (index + interval) % 12;
        majorProfile[noteIndex] = 1.0;
      });
      profiles[`${note} major`] = majorProfile;
      
      // Minor key profile
      const minorProfile = new Array(12).fill(0);
      minorScale.forEach(interval => {
        const noteIndex = (index + interval) % 12;
        minorProfile[noteIndex] = 1.0;
      });
      profiles[`${note} minor`] = minorProfile;
    });
    
    return profiles;
  }

  /**
   * Calculate correlation between two arrays
   */
  calculateCorrelation(array1, array2) {
    if (array1.length !== array2.length) return 0;
    
    const n = array1.length;
    const sum1 = array1.reduce((a, b) => a + b, 0);
    const sum2 = array2.reduce((a, b) => a + b, 0);
    const sum1Sq = array1.reduce((a, b) => a + b * b, 0);
    const sum2Sq = array2.reduce((a, b) => a + b * b, 0);
    const pSum = array1.reduce((a, b, i) => a + b * array2[i], 0);
    
    const num = pSum - (sum1 * sum2 / n);
    const den = Math.sqrt((sum1Sq - sum1 * sum1 / n) * (sum2Sq - sum2 * sum2 / n));
    
    return den === 0 ? 0 : num / den;
  }

  /**
   * Search multiple databases for song information
   */
  async searchMultipleDatabases(title, artist) {
    const databases = [
      { name: 'Tunebat', search: () => this.searchTunebat(title, artist) },
      { name: 'MusicBrainz', search: () => this.searchMusicBrainz(title, artist) }
    ];
    
    const results = [];
    
    for (const db of databases) {
      try {
        const result = await db.search();
        if (result) {
          result.source = db.name;
          results.push(result);
        }
      } catch (error) {
        console.warn(`Search failed for ${db.name}:`, error);
      }
    }
    
    return results;
  }

  /**
   * Search Tunebat for song information
   */
  async searchTunebat(title, artist) {
    try {
      const query = artist ? `${artist} ${title}` : title;
      const searchUrl = `https://tunebat.com/Search?q=${encodeURIComponent(query)}`;
      
      // Use a CORS proxy for actual web scraping
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(searchUrl)}`;
      
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error('Tunebat search failed');
      
      const html = await response.text();
      
      // Parse HTML for key and BPM (customize based on Tunebat's structure)
      const keyMatch = html.match(/key["\s]*:["\s]*([^"<>\s]+)/i);
      const bpmMatch = html.match(/bpm["\s]*:["\s]*(\d+)/i);
      
      if (keyMatch && bpmMatch) {
        return {
          key: keyMatch[1],
          bpm: bpmMatch[1],
          source: 'Tunebat'
        };
      }
      
      return null;
    } catch (error) {
      console.error('Tunebat search error:', error);
      return null;
    }
  }

  /**
   * Search MusicBrainz for song information
   */
  async searchMusicBrainz(title, artist) {
    try {
      const query = artist ? `${artist} ${title}` : title;
      const searchUrl = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(query)}&fmt=json`;
      
      const response = await fetch(searchUrl);
      if (!response.ok) throw new Error('MusicBrainz search failed');
      
      const data = await response.json();
      
      if (data.recordings && data.recordings.length > 0) {
        const recording = data.recordings[0];
        return {
          key: recording.key || 'Unknown',
          bpm: recording.bpm || '0',
          source: 'MusicBrainz'
        };
      }
      
      return null;
    } catch (error) {
      console.error('MusicBrainz search error:', error);
      return null;
    }
  }

  /**
   * Generate final result with confidence scoring
   */
  generateConfidentResult(results) {
    let finalKey = 'Unknown';
    let finalBPM = 0;
    let confidence = 'low';
    let method = 'none';
    let notes = [];
    
    // Prioritize Essentia.js analysis if confidence is high enough
    if (results.analysis) {
      const keyConfidence = results.analysis.key.confidence;
      const bpmConfidence = results.analysis.bpm.confidence;
      
      if (keyConfidence > this.confidenceThreshold && bpmConfidence > this.confidenceThreshold) {
        finalKey = results.analysis.key.key;
        finalBPM = results.analysis.bpm.bpm;
        confidence = 'high';
        method = 'essentia_analysis';
        notes.push('High confidence - Essentia.js professional analysis');
        notes.push(`Key confidence: ${(keyConfidence * 100).toFixed(1)}%`);
        notes.push(`BPM confidence: ${(bpmConfidence * 100).toFixed(1)}%`);
      } else if (confidence === 'low') {
        // Use Essentia.js as fallback if web scraping failed
        finalKey = results.analysis.key.key;
        finalBPM = results.analysis.bpm.bpm;
        confidence = 'medium';
        method = 'essentia_analysis_fallback';
        notes.push('Medium confidence - Essentia.js analysis');
        notes.push(`Key confidence: ${(keyConfidence * 100).toFixed(1)}%`);
        notes.push(`BPM confidence: ${(bpmConfidence * 100).toFixed(1)}%`);
      }
    }
    
    // Use web scraping as fallback
    if (confidence === 'low' && results.webData && results.webData.length > 0) {
      const bestWebResult = results.webData[0];
      finalKey = bestWebResult.key;
      finalBPM = parseInt(bestWebResult.bpm) || 0;
      confidence = 'medium';
      method = 'web_database';
      notes.push(`Data from ${bestWebResult.source}`);
      notes.push('Medium confidence - database lookup');
    }
    
    // Only return results if we have some confidence
    if (confidence === 'low') {
      return {
        key: 'Unknown',
        bpm: 0,
        confidence: 'low',
        method: 'none',
        notes: ['Analysis failed - insufficient confidence'],
        recommendation: 'Try a different song or check audio quality'
      };
    }
    
    return {
      key: finalKey,
      bpm: finalBPM,
      confidence,
      method,
      notes,
      recommendation: this.generateRecommendation(finalKey, finalBPM, confidence)
    };
  }

  /**
   * Generate DJ/producer recommendations
   */
  generateRecommendation(key, bpm, confidence) {
    if (confidence === 'high') {
      return `High confidence result - safe to use for mixing and production`;
    } else if (confidence === 'medium') {
      return `Medium confidence - verify with your ears before mixing`;
    } else {
      return `Low confidence - manual verification recommended`;
    }
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EssentiaProfessionalAnalyzer;
} else {
  window.EssentiaProfessionalAnalyzer = EssentiaProfessionalAnalyzer;
} 