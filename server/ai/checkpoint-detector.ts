// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎯 CHECKPOINT AUTO-DETECTOR SERVICE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Automatically detects and verifies checkpoints from conversation transcript
// Uses semantic matching + keyword detection to validate checkpoint requirements
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface Checkpoint {
  id: string;
  description: string;
  verifications: string[];
  lineNumber: number;
}

interface TranscriptMessage {
  messageId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  phase?: string;
}

interface CheckpointVerificationEvidence {
  requirement: string;
  status: "verified" | "pending" | "failed";
  evidence?: {
    messageId: string;
    excerpt: string;
    matchedKeywords: string[];
    timestamp: string;
  };
}

interface CheckpointDetectionResult {
  checkpointId: string;
  status: "completed" | "pending" | "failed";
  completedAt: string;
  verifications: CheckpointVerificationEvidence[];
}

/**
 * Auto-detect checkpoint completions from conversation transcript
 */
export class CheckpointDetector {
  
  /**
   * Analyze transcript and detect which checkpoints are completed
   */
  static detectCheckpoints(
    checkpoints: Checkpoint[],
    transcript: TranscriptMessage[],
    currentPhase: string
  ): CheckpointDetectionResult[] {
    const results: CheckpointDetectionResult[] = [];
    
    console.log(`\n🔍 [CHECKPOINT-DETECTOR] Analyzing ${transcript.length} messages for ${checkpoints.length} checkpoints in phase ${currentPhase}`);
    
    for (const checkpoint of checkpoints) {
      const detection = this.detectSingleCheckpoint(checkpoint, transcript);
      results.push(detection);
      
      console.log(`   ${detection.status === "completed" ? "✅" : detection.status === "pending" ? "⏳" : "❌"} ${checkpoint.id}: ${detection.status}`);
      console.log(`      Verifications: ${detection.verifications.filter(v => v.status === "verified").length}/${detection.verifications.length} verified`);
    }
    
    return results;
  }
  
  /**
   * Detect single checkpoint from transcript
   */
  private static detectSingleCheckpoint(
    checkpoint: Checkpoint,
    transcript: TranscriptMessage[]
  ): CheckpointDetectionResult {
    const verifications: CheckpointVerificationEvidence[] = [];
    
    // For each verification requirement, search for evidence in transcript
    for (const requirement of checkpoint.verifications) {
      const evidence = this.findEvidenceForRequirement(requirement, transcript);
      verifications.push({
        requirement,
        status: evidence ? "verified" : "pending",
        evidence: evidence || undefined
      });
    }
    
    // Determine overall checkpoint status
    const allVerified = verifications.every(v => v.status === "verified");
    const anyFailed = verifications.some(v => v.status === "failed");
    const status = anyFailed ? "failed" : (allVerified ? "completed" : "pending");
    
    return {
      checkpointId: checkpoint.id,
      status,
      completedAt: new Date().toISOString(),
      verifications
    };
  }
  
  /**
   * Find evidence in transcript for a specific requirement
   */
  private static findEvidenceForRequirement(
    requirement: string,
    transcript: TranscriptMessage[]
  ): { messageId: string; excerpt: string; matchedKeywords: string[]; timestamp: string } | null {
    
    // Extract keywords from requirement
    const keywords = this.extractKeywords(requirement);
    
    console.log(`      🔎 Searching for: "${requirement}"`);
    console.log(`         Keywords: ${keywords.join(', ')}`);
    
    // Search through transcript for matching messages
    for (const msg of transcript) {
      const contentLower = msg.content.toLowerCase();
      const matchedKeywords: string[] = [];
      
      // Check how many keywords match (exact match)
      for (const keyword of keywords) {
        if (contentLower.includes(keyword.toLowerCase())) {
          matchedKeywords.push(keyword);
        }
      }
      
      // NEW: Also check fuzzy matching for similar words
      const fuzzyMatches: string[] = [];
      for (const keyword of keywords) {
        if (!matchedKeywords.includes(keyword)) {
          // Check if there's a similar word in content (Levenshtein-like)
          const contentWords = contentLower.split(/\s+/);
          for (const word of contentWords) {
            if (this.isSimilarWord(keyword.toLowerCase(), word)) {
              fuzzyMatches.push(keyword);
              break;
            }
          }
        }
      }
      
      const totalMatches = matchedKeywords.length + (fuzzyMatches.length * 0.7); // Fuzzy match conta 70%
      
      // MODIFIED: Abbassato threshold a 40% e min keyword a 1
      // Questo rende il sistema più malleabile e permette match anche con meno keywords
      const matchRate = totalMatches / Math.max(keywords.length, 1);
      if (matchRate >= 0.4 && (matchedKeywords.length >= 1 || fuzzyMatches.length >= 1)) {
        const allMatches = [...matchedKeywords, ...fuzzyMatches.map(k => `${k} (fuzzy)`)];
        console.log(`         ✅ Found evidence in message ${msg.messageId.substring(0, 8)}: ${allMatches.join(', ')} (match rate: ${(matchRate * 100).toFixed(1)}%)`);
        
        return {
          messageId: msg.messageId,
          excerpt: msg.content.substring(0, 200),
          matchedKeywords: allMatches,
          timestamp: msg.timestamp
        };
      }
    }
    
    console.log(`         ❌ No evidence found`);
    return null;
  }
  
  /**
   * Extract meaningful keywords from requirement text
   */
  private static extractKeywords(text: string): string[] {
    // Remove common stopwords and extract meaningful words
    const stopwords = new Set([
      'il', 'lo', 'la', 'i', 'gli', 'le',
      'un', 'uno', 'una',
      'di', 'a', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra',
      'è', 'sono', 'sia', 'stato', 'stata', 'stati', 'state',
      'che', 'cui', 'quale', 'quali',
      'del', 'dello', 'della', 'dei', 'degli', 'delle',
      'al', 'allo', 'alla', 'ai', 'agli', 'alle',
      'dal', 'dallo', 'dalla', 'dai', 'dagli', 'dalle',
      'nel', 'nello', 'nella', 'nei', 'negli', 'nelle',
      'sul', 'sullo', 'sulla', 'sui', 'sugli', 'sulle',
      'e', 'o', 'ma', 'però', 'anche', 'se', 'quando', 'dove', 'come', 'perché'
    ]);
    
    const words = text
      .toLowerCase()
      .replace(/[.,;:!?()[\]{}]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopwords.has(w));
    
    // Return unique keywords
    return [...new Set(words)];
  }
  
  /**
   * Calculate similarity between two texts (0.0 to 1.0)
   */
  private static calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    
    if (words1.size === 0 || words2.size === 0) return 0;
    
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }
  
  /**
   * Check if two words are similar using Levenshtein distance
   * Returns true if words are similar enough (max 2 character difference for words > 5 chars)
   */
  private static isSimilarWord(word1: string, word2: string): boolean {
    // Skip if too different in length
    if (Math.abs(word1.length - word2.length) > 3) return false;
    
    // Skip if both words are too short
    if (word1.length < 4 || word2.length < 4) return false;
    
    // Calculate Levenshtein distance
    const distance = this.levenshteinDistance(word1, word2);
    
    // Allow max 2 character difference for words > 5 chars, 1 for shorter
    const maxDistance = word1.length > 5 ? 2 : 1;
    
    return distance <= maxDistance;
  }
  
  /**
   * Calculate Levenshtein distance between two strings
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,    // deletion
            dp[i][j - 1] + 1,    // insertion
            dp[i - 1][j - 1] + 1 // substitution
          );
        }
      }
    }
    
    return dp[m][n];
  }
}
