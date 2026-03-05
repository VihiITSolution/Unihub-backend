const crypto = require('crypto');
const axios = require('axios');

/**
 * HelaPay Payment Gateway Service for Sri Lanka
 * Note: This is a generic implementation. Adjust according to actual HelaPay API documentation.
 */

class HelaPayService {
  constructor() {
    this.apiKey = process.env.HELAPAY_API_KEY;
    this.merchantId = process.env.HELAPAY_MERCHANT_ID;
    this.mode = process.env.HELAPAY_MODE || 'sandbox';
    this.baseUrl = this.mode === 'live'
      ? 'https://api.helapay.lk/v1'
      : 'https://sandbox-api.helapay.lk/v1';
    this.webhookUrl = process.env.HELAPAY_WEBHOOK_URL;
    this.callbackUrl = process.env.HELAPAY_CALLBACK_URL;
  }

  /**
   * Generate signature for HelaPay requests
   */
  generateSignature(data, timestamp) {
    const payload = JSON.stringify(data) + timestamp + this.apiKey;
    return crypto.createHmac('sha256', this.apiKey).update(payload).digest('hex');
  }

  /**
   * Make authenticated request to HelaPay API
   */
  async makeRequest(endpoint, method = 'POST', data = {}) {
    try {
      const timestamp = Date.now().toString();
      const signature = this.generateSignature(data, timestamp);

      const config = {
        method: method,
        url: `${this.baseUrl}${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'X-Merchant-ID': this.merchantId,
          'X-Timestamp': timestamp,
          'X-Signature': signature
        },
        data: data
      };

      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error('HelaPay API error:', error.response?.data || error.message);
      throw new Error(`HelaPay API error: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Create payment request
   * @param {Object} options - Payment options
   * @returns {Object} Payment creation response
   */
  async createPaymentRequest(options) {
    const {
      orderId,
      amount,
      currency = 'LKR',
      description,
      customerName,
      customerEmail,
      customerPhone,
      metadata = {}
    } = options;

    try {
      const paymentData = {
        merchant_reference: orderId,
        amount: parseFloat(amount).toFixed(2),
        currency: currency,
        description: description,
        callback_url: this.callbackUrl,
        webhook_url: this.webhookUrl,
        customer: {
          name: customerName,
          email: customerEmail,
          phone: customerPhone
        },
        metadata: metadata
      };

      const response = await this.makeRequest('/payments/create', 'POST', paymentData);

      return {
        success: true,
        paymentId: response.payment_id,
        paymentUrl: response.payment_url,
        transactionId: response.transaction_id,
        status: response.status,
        expiresAt: response.expires_at
      };
    } catch (error) {
      console.error('HelaPay payment creation error:', error);
      throw new Error(`Failed to create HelaPay payment: ${error.message}`);
    }
  }

  /**
   * Check payment status
   * @param {String} transactionId - HelaPay transaction ID
   * @returns {Object} Payment status information
   */
  async checkPaymentStatus(transactionId) {
    try {
      const response = await this.makeRequest(`/payments/${transactionId}/status`, 'GET');

      // Map HelaPay status to our internal status
      let status = 'pending';
      switch (response.status) {
        case 'SUCCESS':
        case 'COMPLETED':
          status = 'completed';
          break;
        case 'FAILED':
        case 'REJECTED':
          status = 'failed';
          break;
        case 'CANCELLED':
        case 'EXPIRED':
          status = 'cancelled';
          break;
        case 'PENDING':
        case 'PROCESSING':
        default:
          status = 'pending';
      }

      return {
        transactionId: response.transaction_id,
        merchantReference: response.merchant_reference,
        amount: parseFloat(response.amount),
        currency: response.currency,
        status: status,
        statusRaw: response.status,
        paidAt: response.paid_at,
        method: response.payment_method,
        metadata: response.metadata
      };
    } catch (error) {
      console.error('HelaPay status check error:', error);
      throw new Error(`Failed to check payment status: ${error.message}`);
    }
  }

  /**
   * Verify webhook signature
   * @param {Object} webhookData - Data from HelaPay webhook
   * @param {String} signature - Signature from webhook headers
   * @returns {Boolean} Whether the webhook is valid
   */
  verifyWebhookSignature(webhookData, signature, timestamp) {
    try {
      const expectedSignature = this.generateSignature(webhookData, timestamp);
      return signature === expectedSignature;
    } catch (error) {
      console.error('HelaPay webhook verification error:', error);
      return false;
    }
  }

  /**
   * Process webhook payload
   * @param {Object} webhookData - Data from HelaPay webhook
   * @returns {Object} Processed payment information
   */
  processWebhook(webhookData) {
    const {
      transaction_id,
      merchant_reference,
      amount,
      currency,
      status,
      payment_method,
      paid_at,
      metadata
    } = webhookData;

    // Map HelaPay status to our internal status
    let mappedStatus = 'pending';
    switch (status) {
      case 'SUCCESS':
      case 'COMPLETED':
        mappedStatus = 'completed';
        break;
      case 'FAILED':
      case 'REJECTED':
        mappedStatus = 'failed';
        break;
      case 'CANCELLED':
      case 'EXPIRED':
        mappedStatus = 'cancelled';
        break;
      default:
        mappedStatus = 'pending';
    }

    return {
      transactionId: transaction_id,
      orderId: merchant_reference,
      amount: parseFloat(amount),
      currency: currency,
      status: mappedStatus,
      statusRaw: status,
      paymentMethod: payment_method,
      paidAt: paid_at ? new Date(paid_at) : null,
      metadata: metadata,
      processedAt: new Date()
    };
  }

  /**
   * Refund payment
   * @param {String} transactionId - Transaction ID to refund
   * @param {Number} amount - Amount to refund (optional, full refund if not specified)
   * @param {String} reason - Reason for refund
   * @returns {Object} Refund response
   */
  async refundPayment(transactionId, amount = null, reason = '') {
    try {
      const refundData = {
        transaction_id: transactionId,
        reason: reason
      };

      if (amount !== null) {
        refundData.amount = parseFloat(amount).toFixed(2);
      }

      const response = await this.makeRequest('/payments/refund', 'POST', refundData);

      return {
        success: true,
        refundId: response.refund_id,
        transactionId: response.transaction_id,
        amount: parseFloat(response.refund_amount),
        status: response.status,
        refundedAt: response.refunded_at
      };
    } catch (error) {
      console.error('HelaPay refund error:', error);
      throw new Error(`Failed to process refund: ${error.message}`);
    }
  }

  /**
   * Check if HelaPay is properly configured
   * @returns {Boolean}
   */
  isConfigured() {
    return !!(this.apiKey && this.merchantId);
  }
}

module.exports = new HelaPayService();
