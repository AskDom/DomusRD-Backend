const express = require('express');
const router  = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { reviewValidator } = require('../middlewares/validators');
const { getReviews, upsertReview, deleteReview } = require('../controllers/review.controller');

router.get('/:propertyId',    getReviews);
router.post('/:propertyId',   protect, reviewValidator, validate, upsertReview);
router.delete('/:propertyId', protect, deleteReview);

module.exports = router;