const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const boardingController = require('../controllers/boardingController');

// Test what's exported
console.log('Boarding controller exports:', Object.keys(boardingController));
console.log('createBoardingPlace:', typeof boardingController.createBoardingPlace);

// Public routes
router.get('/places', boardingController.getBoardingPlaces);
router.get('/places/:id', boardingController.getBoardingPlaceById);
router.post('/places/:id/inquire', boardingController.incrementInquiry);

// Protected routes (vendor only)
router.post('/places', protect, boardingController.createBoardingPlace);
router.post('/places/:id/pay', protect, boardingController.payForListing);
router.get('/my-listings', protect, boardingController.getMyBoardingListings);
router.patch('/places/:id', protect, boardingController.updateBoardingPlace);
router.delete('/places/:id', protect, boardingController.deleteBoardingPlace);

module.exports = router;
