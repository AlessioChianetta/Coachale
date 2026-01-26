/**
 * X/Twitter Webhook Signature Verification
 * Validates incoming webhook requests using HMAC-SHA256
 * 
 * Reference: https://developer.x.com/en/docs/twitter-api/account-activity-api/manage-account-activity/validate-webhooks
 */

import crypto from "crypto";

/**
 * Verify X webhook signature
 * 
 * Validates that the incoming webhook request is from X/Twitter by comparing
 * the signature in the x-twitter-webhooks-signature header with a computed HMAC-SHA256.
 * 
 * IMPORTANT: The signature must be computed using the RAW request body (Buffer),
 * not the parsed JSON. This is critical because even minor whitespace differences
 * in JSON parsing will invalidate the signature.
 * 
 * @param signature The x-twitter-webhooks-signature header value (format: "sha256=<base64>")
 * @param rawBody The raw request body as a Buffer (not parsed JSON)
 * @param consumerSecret The consumer secret from X API credentials
 * @returns true if signature is valid, false otherwise
 * 
 * @example
 * ```typescript
 * // In Express middleware, capture raw body:
 * app.use(express.raw({ type: 'application/json' }));
 * 
 * // Then verify:
 * const signature = req.headers['x-twitter-webhooks-signature'];
 * const isValid = verifyWebhookSignature(signature, req.body, consumerSecret);
 * ```
 */
export function verifyWebhookSignature(
  signature: string,
  rawBody: Buffer,
  consumerSecret: string
): boolean {
  try {
    // ========================================================================
    // VALIDATION: Check for missing or invalid signature
    // ========================================================================
    if (!signature || typeof signature !== "string") {
      console.warn("⚠️ [TWITTER WEBHOOK] Missing or invalid signature header");
      return false;
    }

    if (!consumerSecret || typeof consumerSecret !== "string") {
      console.warn("⚠️ [TWITTER WEBHOOK] Missing or invalid consumer secret");
      return false;
    }

    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      console.warn("⚠️ [TWITTER WEBHOOK] Missing or invalid raw body buffer");
      return false;
    }

    // ========================================================================
    // PARSE: Extract algorithm and encoded signature from header
    // ========================================================================
    // Header format: "sha256=<base64-encoded-signature>"
    const signatureParts = signature.split("=");

    if (signatureParts.length !== 2) {
      console.warn(
        `⚠️ [TWITTER WEBHOOK] Invalid signature format: expected "sha256=<base64>", got "${signature.slice(0, 50)}..."`
      );
      return false;
    }

    const [algorithm, encodedSignature] = signatureParts;

    // Verify algorithm is sha256
    if (algorithm !== "sha256") {
      console.warn(
        `⚠️ [TWITTER WEBHOOK] Unsupported algorithm: expected "sha256", got "${algorithm}"`
      );
      return false;
    }

    // ========================================================================
    // DECODE: Convert base64-encoded signature to Buffer
    // ========================================================================
    let headerSignatureBuffer: Buffer;

    try {
      headerSignatureBuffer = Buffer.from(encodedSignature, "base64");
    } catch (error) {
      console.warn(
        `⚠️ [TWITTER WEBHOOK] Failed to decode base64 signature: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }

    // Validate decoded signature length (SHA256 produces 32 bytes)
    if (headerSignatureBuffer.length !== 32) {
      console.warn(
        `⚠️ [TWITTER WEBHOOK] Invalid signature length: expected 32 bytes, got ${headerSignatureBuffer.length}`
      );
      return false;
    }

    // ========================================================================
    // COMPUTE: Generate HMAC-SHA256 signature using raw body
    // ========================================================================
    const computedSignatureBuffer = crypto
      .createHmac("sha256", consumerSecret)
      .update(rawBody)
      .digest();

    // ========================================================================
    // COMPARE: Use constant-time comparison to prevent timing attacks
    // ========================================================================
    let isValid = false;

    try {
      isValid = crypto.timingSafeEqual(headerSignatureBuffer, computedSignatureBuffer);
    } catch (error) {
      console.warn(
        `⚠️ [TWITTER WEBHOOK] Signature comparison failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }

    // ========================================================================
    // LOG: Debug information (truncated for security)
    // ========================================================================
    const headerSigPreview = encodedSignature.slice(0, 16);
    const computedSigPreview = computedSignatureBuffer.toString("base64").slice(0, 16);

    if (isValid) {
      console.log("✅ [TWITTER WEBHOOK] Signature verification successful");
      console.log(
        `   Algorithm: sha256 | Signature: ${headerSigPreview}... (matches computed)`
      );
    } else {
      console.warn("❌ [TWITTER WEBHOOK] Signature verification failed");
      console.warn(`   Header sig:   sha256=${headerSigPreview}...`);
      console.warn(`   Computed sig: sha256=${computedSigPreview}...`);
    }

    return isValid;
  } catch (error) {
    console.error(
      `❌ [TWITTER WEBHOOK] Signature verification error: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}

/**
 * Generate CRC response token for webhook registration
 * 
 * X/Twitter sends a CRC (Challenge Response Check) during webhook registration.
 * You must compute and return a response token to complete the registration.
 * 
 * @param crcToken The crc_token from the challenge request
 * @param consumerSecret The consumer secret from X API credentials
 * @returns The response_token to send back to X (format: "sha256=<base64>")
 * 
 * @example
 * ```typescript
 * // In your webhook GET handler:
 * app.get('/webhook', (req, res) => {
 *   const crcToken = req.query.crc_token;
 *   const responseToken = generateCRCToken(crcToken, consumerSecret);
 *   res.json({ response_token: responseToken });
 * });
 * ```
 */
export function generateCRCToken(
  crcToken: string,
  consumerSecret: string
): string {
  try {
    if (!crcToken || typeof crcToken !== "string") {
      console.warn("⚠️ [TWITTER WEBHOOK CRC] Missing or invalid crc_token");
      return "";
    }

    if (!consumerSecret || typeof consumerSecret !== "string") {
      console.warn("⚠️ [TWITTER WEBHOOK CRC] Missing or invalid consumer secret");
      return "";
    }

    const hmacBuffer = crypto
      .createHmac("sha256", consumerSecret)
      .update(crcToken)
      .digest();

    const base64Signature = hmacBuffer.toString("base64");
    const responseToken = `sha256=${base64Signature}`;

    console.log("✅ [TWITTER WEBHOOK CRC] Generated CRC response token");
    console.log(`   Token: ${responseToken.slice(0, 20)}...`);

    return responseToken;
  } catch (error) {
    console.error(
      `❌ [TWITTER WEBHOOK CRC] Error generating CRC token: ${error instanceof Error ? error.message : String(error)}`
    );
    return "";
  }
}
