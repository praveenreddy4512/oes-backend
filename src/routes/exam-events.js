/**
 * Exam Events Routes
 * Tracks student actions during exams (tab switching, page refresh, time per question, etc.)
 */

import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

/**
 * Log an exam event
 * POST /api/submissions/:submissionId/events
 * 
 * Body:
 * {
 *   "event_type": "tab_switched|page_refreshed|question_viewed|answer_saved|exam_started|exam_submitted",
 *   "event_details": { optional JSON object with event data },
 *   "question_id": optional question ID,
 *   "time_spent_seconds": optional time spent on current question,
 *   "student_id": student ID,
 *   "exam_id": exam ID
 * }
 */
router.post('/:submissionId/events', async (req, res) => {
  const { submissionId } = req.params;
  const { event_type, event_details, question_id, time_spent_seconds, student_id, exam_id } = req.body;

  // ✅ SECURE: Validate required fields
  if (!event_type || !student_id || !exam_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // ✅ SECURE: Validate event type
  const validEventTypes = [
    'exam_started',
    'question_viewed',
    'answer_saved',
    'tab_switched',
    'page_refreshed',
    'exam_submitted'
  ];
  
  if (!validEventTypes.includes(event_type)) {
    return res.status(400).json({ error: 'Invalid event type' });
  }

  try {
    // Insert event into database
    const [result] = await pool.execute(
      `INSERT INTO exam_events 
       (submission_id, student_id, exam_id, event_type, event_details, question_id, time_spent_seconds) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        submissionId,
        student_id,
        exam_id,
        event_type,
        event_details ? JSON.stringify(event_details) : null,
        question_id || null,
        time_spent_seconds || null
      ]
    );

    console.log(`[📊 EVENT LOGGED] Type: ${event_type}, Student: ${student_id}, Submission: ${submissionId}`);

    res.json({
      eventId: result.insertId,
      message: 'Event logged successfully',
      event: {
        type: event_type,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[❌ EVENT LOGGING ERROR]', error.message);
    res.status(500).json({ error: 'Failed to log event', details: error.message });
  }
});

/**
 * Get all events for a submission
 * GET /api/submissions/:submissionId/events
 */
router.get('/:submissionId/events', async (req, res) => {
  const { submissionId } = req.params;

  try {
    const [events] = await pool.execute(
      `SELECT 
        id,
        event_type,
        event_details,
        question_id,
        time_spent_seconds,
        timestamp
       FROM exam_events
       WHERE submission_id = ?
       ORDER BY timestamp ASC`,
      [submissionId]
    );

    // Parse JSON details
    const parsedEvents = events.map(event => ({
      ...event,
      event_details: event.event_details ? JSON.parse(event.event_details) : null
    }));

    res.json({
      submissionId,
      totalEvents: parsedEvents.length,
      events: parsedEvents
    });
  } catch (error) {
    console.error('[❌ GET EVENTS ERROR]', error.message);
    res.status(500).json({ error: 'Failed to fetch events', details: error.message });
  }
});

/**
 * Get event summary statistics for a submission
 * GET /api/submissions/:submissionId/events/summary
 */
router.get('/:submissionId/events/summary', async (req, res) => {
  const { submissionId } = req.params;

  try {
    const [results] = await pool.execute(
      `SELECT 
        event_type,
        COUNT(*) as count,
        SUM(CASE WHEN time_spent_seconds IS NOT NULL THEN time_spent_seconds ELSE 0 END) as total_time_seconds,
        MIN(timestamp) as first_occurrence,
        MAX(timestamp) as last_occurrence
       FROM exam_events
       WHERE submission_id = ?
       GROUP BY event_type`,
      [submissionId]
    );

    // Calculate suspicious activity indicators
    const tabSwitches = results.find(r => r.event_type === 'tab_switched')?.count || 0;
    const pageRefreshes = results.find(r => r.event_type === 'page_refreshed')?.count || 0;
    const suspiciousLevel = tabSwitches > 3 || pageRefreshes > 2 ? 'HIGH' : 'LOW';

    res.json({
      submissionId,
      summary: results,
      suspiciousActivity: {
        tabSwitches,
        pageRefreshes,
        suspicionLevel: suspiciousLevel
      }
    });
  } catch (error) {
    console.error('[❌ SUMMARY ERROR]', error.message);
    res.status(500).json({ error: 'Failed to generate summary', details: error.message });
  }
});

export default router;
