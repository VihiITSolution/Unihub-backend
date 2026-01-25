const express = require('express');
const router = express.Router();
const boardingController = require('../controllers/boardingController');
const { authMiddleware } = require('../middleware/auth');

// Public routes
router.route('/places')
  .get(boardingController.getBoardingPlaces)
  .post(authMiddleware, boardingController.createBoardingPlace);

router.route('/places/:id')
  .get(boardingController.getBoardingPlaceById)
  .patch(authMiddleware, boardingController.updateBoardingPlace)
  .delete(authMiddleware, boardingController.deleteBoardingPlace);

router.post('/places/:id/pay', authMiddleware, boardingController.payForListing);
router.post('/places/:id/inquire', boardingController.incrementInquiry);
router.get('/my-listings', authMiddleware, boardingController.getMyBoardingListings);

module.exports = router;
