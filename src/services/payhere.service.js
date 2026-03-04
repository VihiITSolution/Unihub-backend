const crypto = require('crypto');
const axios = require('axios');

/**
 * PayHere Payment Gateway Service for Sri Lanka
 * Documentation: https://support.payhere.lk/api-&-mobile-sdk/payhere-payment-api
 */

class PayHereService {
  constructor() {
    this.merchantId = process.env.PAYHERE_MERCHANT_ID;
    this.merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;
    this.mode = process.env.PAYHERE_MODE || 'sandbox';
    this.baseUrl = this.mode === 'live' 
      ? 'https://www.payhere.lk'
      : 'https://sandbox.payhere.lk';
    this.notifyUrl = process.env.PAYHERE_NOTIFY_URL;
    this.returnUrl = process.env.PAYHERE_RETURN_URL;
    this.cancelUrl = process.env.PAYHERE_CANCEL_URL;
  }

  /**
   * Generate MD5 hash for PayHere signature
   */
  generateHash(orderId, amount, currency = 'USD') {
    const amountFormatted = parseFloat(amount).toFixed(2);
    const hashString = `${this.merchantId}${orderId}${amountFormatted}${currency}${this.merchantSecret}`;
    return crypto.createHash('md5').update(hashString).digest('hex').toUpperCase();
  }

  /**
   * Initialize payment and get payment page URL
   * @param {Object} options - Payment options
   * @returns {Object} Payment initialization data
   */
  async initializePayment(options) {
    const {
      orderId,
      amount,
      currency = 'USD',
      itemName,
      firstName,
      lastName,
      email,
      phone,
      address,
      city,
      country = 'Sri Lanka'
    } = options;

    try {
      const hash = this.generateHash(orderId, amount, currency);
      
      const paymentData = {
        merchant_id: this.merchantId,
        return_url: this.returnUrl,
        cancel_url: this.cancelUrl,
        notify_url: this.notifyUrl,
        order_id: orderId,
        items: itemName,
        currency: currency,
        amount: parseFloat(amount).toFixed(2),
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone: phone,
        address: address,
        city: city,
        country: country,
        hash: hash
      };

      // PayHere uses a form submission approach
      // Return data for frontend to create form and submit
      return {
        success: true,
        paymentUrl: `${this.baseUrl}/pay/checkout`,
        paymentData: paymentData,
        method: 'POST'
      };
    } catch (error) {
      console.error('PayHere initialization error:', error);
      throw new Error(`Failed to initialize PayHere payment: ${error.message}`);
    }
  }

  /**
   * Verify payment notification from PayHere webhook
   * @param {Object} notificationData - Data from PayHere notification
   * @returns {Boolean} Whether the notification is valid
   */
  verifyNotification(notificationData) {
    try {
      const {
        merchant_id,
        order_id,
        payhere_amount,
        payhere_currency,
        status_code,
        md5sig
      } = notificationData;

      // Verify merchant ID
      if (merchant_id !== this.merchantId) {
        console.error('Invalid merchant ID in notification');
        return false;
      }

      // Generate expected hash
      const merchantSecret = this.merchantSecret;
      const amountFormatted = parseFloat(payhere_amount).toFixed(2);
      const hashString = `${merchant_id}${order_id}${amountFormatted}${payhere_currency}${status_code}${merchantSecret}`;
      const expectedHash = crypto.createHash('md5').update(hashString).digest('hex').toUpperCase();

      // Compare hash
      if (md5sig !== expectedHash) {
        console.error('Invalid hash signature in notification');
        return false;
      }

      return true;
    } catch (error) {
      console.error('PayHere verification error:', error);
      return false;
    }
  }

  /**
   * Process PayHere notification and return payment status
   * @param {Object} notificationData - Data from PayHere notification
   * @returns {Object} Processed payment information
   */
  processNotification(notificationData) {
    const {
      order_id,
      payhere_amount,
      payhere_currency,
      status_code,
      payment_id,
      method,
      status_message,
      card_holder_name,
      card_no
    } = notificationData;

    // PayHere status codes:
    // 2 = Success
    // 0 = Pending
    // -1 = Cancelled
    // -2 = Failed
    // -3 = Chargedback
    let status = 'pending';
    if (status_code === '2') {
      status = 'completed';
    } else if (status_code === '-1') {
      status = 'cancelled';
    } else if (status_code === '-2' || status_code === '-3') {
      status = 'failed';
    }

    return {
      orderId: order_id,
      transactionId: payment_id,
      amount: parseFloat(payhere_amount),
      currency: payhere_currency,
      status: status,
      statusCode: status_code,
      statusMessage: status_message,
      paymentMethod: method,
      cardHolderName: card_holder_name,
      cardNo: card_no,
      processedAt: new Date()
    };
  }

  /**
   * Check if PayHere is properly configured
   * @returns {Boolean}
   */
  isConfigured() {
    return !!(this.merchantId && this.merchantSecret);
  }
}

module.exports = new PayHereService();
