import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { searchDocuments } from '../services/searchService.js';
import { generateGroundedAnswer } from '../services/answerService.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = express.Router();
const MAX_QUERY_LENGTH = 500;

router.use(requireAuth);

/**
 * POST /api/search
 * Natural language PDF content search.
 * Body: { query: "Find my Java Chapter 1 notes" }
 */
router.post('/', rateLimit({ name: 'search', windowMs: 60 * 1000, max: 20 }), async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Search query is required.',
      });
    }
    if (query.length > MAX_QUERY_LENGTH) {
      return res.status(413).json({
        error: 'QueryTooLong',
        message: `Search query must be ${MAX_QUERY_LENGTH} characters or fewer.`,
      });
    }

    const userId = req.user.id;
    const searchResults = await searchDocuments(userId, query);
    const answer = await generateGroundedAnswer(query, searchResults.results);

    return res.json({ ...searchResults, answer });
  } catch (error) {
    console.error('Search endpoint error:', error);
    return res.status(500).json({
      error: 'SearchError',
      message: error.message || 'Failed to process search query.',
    });
  }
});

export default router;
