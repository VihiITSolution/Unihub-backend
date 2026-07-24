const express = require('express');
const router = express.Router();
const boardingController = require('../controllers/boardingController');
const { authMiddleware } = require('../middleware/auth');
const { uploadBoardingImages, uploadBoardingVideos } = require('../config/cloudinary');

// Media upload routes (used by the create/edit listing forms before submit)
router.post(
  '/upload-images',
  authMiddleware,
  (req, res, next) => {
    uploadBoardingImages(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
      next();
    });
  },
  boardingController.uploadBoardingImages,
);

router.post(
  '/upload-videos',
  authMiddleware,
  (req, res, next) => {
    uploadBoardingVideos(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
      next();
    });
  },
  boardingController.uploadBoardingVideos,
);

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
