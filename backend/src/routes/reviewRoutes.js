const express = require('express');
const router  = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { getReviews, upsertReview, deleteReview } = require('../controllers/review.controller');

router.get('/:propertyId',    getReviews);                  // pública
router.post('/:propertyId',   protect, upsertReview);       // requiere auth
router.delete('/:propertyId', protect, deleteReview);       // requiere auth

module.exports = router;