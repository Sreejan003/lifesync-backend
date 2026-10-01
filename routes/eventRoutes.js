const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', eventController.getEvents);
router.get('/:id', eventController.getEventById);
router.post('/', eventController.createEvent);
router.put('/:id', eventController.updateEvent);
router.delete('/:id', eventController.deleteEvent);

module.exports = router;
